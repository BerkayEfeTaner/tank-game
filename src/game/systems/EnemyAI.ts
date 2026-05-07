import Phaser from 'phaser'
import { canTankMove } from '../tank/collision'
import type { Tank } from '../types'

export function chooseEnemyMove(
  enemy: Tank,
  player: Tank,
  walls: Phaser.GameObjects.Rectangle[],
  time: number,
) {
  if (time < enemy.rethinkAt) {
    return
  }

  const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y)
  const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y)
  const line = new Phaser.Geom.Line(enemy.x, enemy.y, player.x, player.y)
  const canSeePlayer = !walls.some((wall) => Phaser.Geom.Intersects.LineToRectangle(line, wall.getBounds()))

  enemy.rethinkAt = time + Phaser.Math.Between(170, 430)

  if (!canSeePlayer) {
    enemy.moveAngle = findPressureAngle(enemy, angleToPlayer, player, walls)
    return
  }

  if (enemy.enemyType === 'boss') {
    chooseBossMove(enemy, angleToPlayer, distanceToPlayer, time)
    return
  }

  if (enemy.enemyType === 'charger') {
    enemy.moveAngle = distanceToPlayer < 78 ? angleToPlayer + Math.PI : angleToPlayer
    enemy.rethinkAt = time + Phaser.Math.Between(90, 150)
    return
  }

  if (enemy.enemyType === 'bomber') {
    enemy.moveAngle = angleToPlayer
    enemy.rethinkAt = time + Phaser.Math.Between(120, 190)
    return
  }

  if (enemy.enemyType === 'shield' && distanceToPlayer > enemy.preferredRange + 25) {
    enemy.moveAngle = angleToPlayer
    return
  }

  if (enemy.enemyType === 'sniper' && distanceToPlayer < enemy.preferredRange - 55) {
    enemy.moveAngle = angleToPlayer + Math.PI
    return
  }

  if (enemy.enemyType === 'scout' && distanceToPlayer < enemy.preferredRange + 80) {
    enemy.strafeDirection
      = Phaser.Math.Between(0, 100) > 8
        ? enemy.strafeDirection
        : enemy.strafeDirection === 1
          ? -1
          : 1
    enemy.moveAngle = angleToPlayer + (Math.PI / 2) * enemy.strafeDirection
    return
  }

  if (distanceToPlayer > enemy.preferredRange + 35) {
    enemy.moveAngle = angleToPlayer
    return
  }

  if (distanceToPlayer < enemy.preferredRange - 45) {
    enemy.moveAngle = angleToPlayer + Math.PI
    return
  }

  enemy.strafeDirection
    = Phaser.Math.Between(0, 100) > 18
      ? enemy.strafeDirection
      : enemy.strafeDirection === 1
        ? -1
        : 1
  enemy.moveAngle = angleToPlayer + (Math.PI / 2) * enemy.strafeDirection
}

function chooseBossMove(enemy: Tank, angleToPlayer: number, distanceToPlayer: number, time: number) {
  const style = enemy.bossStyle ?? 'vanguard'
  const strafeAngle = angleToPlayer + (Math.PI / 2) * enemy.strafeDirection
  const flipStrafe = Phaser.Math.Between(0, 100) < 16
  if (flipStrafe) {
    enemy.strafeDirection = enemy.strafeDirection === 1 ? -1 : 1
  }

  if (style === 'artillery') {
    enemy.rethinkAt = time + Phaser.Math.Between(240, 380)
    enemy.moveAngle = distanceToPlayer < enemy.preferredRange - 70 ? angleToPlayer + Math.PI : strafeAngle
    return
  }

  if (style === 'swarm') {
    enemy.rethinkAt = time + Phaser.Math.Between(100, 180)
    enemy.moveAngle = distanceToPlayer > enemy.preferredRange - 25 ? angleToPlayer : strafeAngle
    return
  }

  if (style === 'warden') {
    enemy.rethinkAt = time + Phaser.Math.Between(260, 430)
    enemy.moveAngle = distanceToPlayer > enemy.preferredRange + 45 ? angleToPlayer : strafeAngle
    return
  }

  if (style === 'blitz') {
    enemy.rethinkAt = time + Phaser.Math.Between(80, 140)
    enemy.moveAngle = distanceToPlayer > 118 ? angleToPlayer : strafeAngle
    return
  }

  enemy.rethinkAt = time + Phaser.Math.Between(150, 260)
  if (distanceToPlayer > enemy.preferredRange + 20) {
    enemy.moveAngle = angleToPlayer
    return
  }
  enemy.moveAngle = distanceToPlayer < enemy.preferredRange - 55 ? angleToPlayer + Math.PI : strafeAngle
}

export function findPressureAngle(
  enemy: Tank,
  angleToPlayer: number,
  player: Tank,
  walls: Phaser.GameObjects.Rectangle[],
) {
  const candidates = [
    angleToPlayer,
    angleToPlayer + Math.PI / 6,
    angleToPlayer - Math.PI / 6,
    angleToPlayer + Math.PI / 4,
    angleToPlayer - Math.PI / 4,
    angleToPlayer + Math.PI / 2,
    angleToPlayer - Math.PI / 2,
    angleToPlayer + Math.PI * 0.72,
    angleToPlayer - Math.PI * 0.72,
  ]

  const best = candidates.find((angle) => {
    const probe = {
      x: enemy.x + Math.cos(angle) * 72,
      y: enemy.y + Math.sin(angle) * 72,
    }
    const line = new Phaser.Geom.Line(probe.x, probe.y, player.x, player.y)
    return (
      canTankMove(enemy, Math.cos(angle) * 18, Math.sin(angle) * 18, walls, player)
      && walls.every((wall) => !Phaser.Geom.Intersects.LineToRectangle(line, wall.getBounds()))
    )
  })

  return best ?? angleToPlayer + Phaser.Math.FloatBetween(-0.85, 0.85)
}

export function findOpenMoveAngle(
  enemy: Tank,
  player: Tank,
  walls: Phaser.GameObjects.Rectangle[],
  distance: number,
  preferredAngle = enemy.moveAngle,
) {
  const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y)
  const candidates = [
    preferredAngle,
    preferredAngle + Math.PI / 8,
    preferredAngle - Math.PI / 8,
    preferredAngle + Math.PI / 4,
    preferredAngle - Math.PI / 4,
    preferredAngle + Math.PI / 2,
    preferredAngle - Math.PI / 2,
    angleToPlayer + Math.PI / 2,
    angleToPlayer - Math.PI / 2,
    preferredAngle + Math.PI,
  ]

  const probeDistance = Math.max(26, distance * 4.5)
  return candidates.find((angle) =>
    canTankMove(
      enemy,
      Math.cos(angle) * probeDistance,
      Math.sin(angle) * probeDistance,
      walls,
      player,
    ),
  )
}

export function enemySeparation(enemy: Tank, enemies: Tank[]) {
  const force = new Phaser.Math.Vector2(0, 0)
  for (const other of enemies) {
    if (other === enemy) {
      continue
    }
    const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y)
    if (distance > 0 && distance < enemy.separationRadius) {
      force.x += (enemy.x - other.x) / distance
      force.y += (enemy.y - other.y) / distance
    }
  }

  if (force.lengthSq() > 0) {
    force.normalize().scale(0.55)
  }
  return force
}

export function wallAvoidance(enemy: Tank, walls: Phaser.GameObjects.Rectangle[]) {
  const force = new Phaser.Math.Vector2(0, 0)
  const buffer = enemy.size / 2 + 38
  for (const wall of walls) {
    const bounds = wall.getBounds()
    const closestX = Phaser.Math.Clamp(enemy.x, bounds.left, bounds.right)
    const closestY = Phaser.Math.Clamp(enemy.y, bounds.top, bounds.bottom)
    const dx = enemy.x - closestX
    const dy = enemy.y - closestY
    const distanceSq = dx * dx + dy * dy
    if (distanceSq <= 0 || distanceSq > buffer * buffer) {
      continue
    }

    const distance = Math.sqrt(distanceSq)
    const strength = (buffer - distance) / buffer
    force.x += (dx / distance) * strength
    force.y += (dy / distance) * strength
  }

  if (force.lengthSq() > 0) {
    force.normalize().scale(0.7)
  }
  return force
}
