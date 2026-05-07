import Phaser from 'phaser'
import { TANK_SPRITE_ROTATION_OFFSET } from '../constants'
import type { EnemyType, Tank } from '../types'

export type CreateTankOptions = {
  kind: 'player' | 'enemy'
  enemyType?: EnemyType
  x: number
  y: number
  hullColor: number
  turretColor: number
  maxHealth: number
  speed: number
  fireDelay: number
  bulletSpeed: number
  scoreValue: number
  damage: number
  preferredRange: number
  accuracy: number
  separationRadius: number
  bodyAssetOverride?: string
  barrelAssetOverride?: string
}

export function tankSizeForType(enemyType?: EnemyType) {
  if (enemyType === 'boss') {
    return 66
  }
  if (enemyType === 'shield') {
    return 52
  }
  if (enemyType === 'heavy') {
    return 48
  }
  if (enemyType === 'bomber') {
    return 44
  }
  if (enemyType === 'charger' || enemyType === 'scout') {
    return 36
  }
  return 42
}

export function tankBodyAsset(kind: 'player' | 'enemy', enemyType?: EnemyType) {
  if (kind === 'player') {
    return 'tank-player-body'
  }
  if (enemyType === 'heavy' || enemyType === 'shield' || enemyType === 'bomber' || enemyType === 'boss') {
    return 'tank-heavy-body'
  }
  if (enemyType === 'sniper') {
    return 'tank-sniper-body'
  }
  return 'tank-scout-body'
}

export function tankBarrelAsset(kind: 'player' | 'enemy', enemyType?: EnemyType) {
  if (kind === 'player') {
    return 'tank-player-barrel'
  }
  if (enemyType === 'heavy' || enemyType === 'shield' || enemyType === 'bomber' || enemyType === 'boss') {
    return 'tank-heavy-barrel'
  }
  if (enemyType === 'sniper') {
    return 'tank-sniper-barrel'
  }
  return 'tank-scout-barrel'
}

export function createTank(scene: Phaser.Scene, options: CreateTankOptions): Tank {
  const size = tankSizeForType(options.enemyType)
  const bodyKey = options.bodyAssetOverride ?? tankBodyAsset(options.kind, options.enemyType)
  const barrelKey = options.barrelAssetOverride ?? tankBarrelAsset(options.kind, options.enemyType)
  const hull = scene.add
    .image(options.x, options.y, bodyKey)
    .setDisplaySize(size, size)
    .setTint(options.hullColor)
  const barrelWidth = options.enemyType === 'boss' ? 17 : options.enemyType === 'sniper' ? 14 : 12
  const barrelHeight = options.enemyType === 'boss' ? 58 : options.enemyType === 'sniper' ? 52 : 44
  const turret = scene.add
    .image(options.x, options.y, barrelKey)
    .setDisplaySize(barrelWidth, barrelHeight)
    .setOrigin(0.5, 0.78)
    .setTint(options.turretColor)
  hull.setDepth(5)
  turret.setDepth(6)
  const healthBar = options.kind === 'enemy' ? scene.add.graphics().setDepth(8) : undefined

  const tank: Tank = {
    kind: options.kind,
    enemyType: options.enemyType,
    x: options.x,
    y: options.y,
    size,
    hull,
    turret,
    hullAngle: 0,
    turretAngle: 0,
    health: options.maxHealth,
    maxHealth: options.maxHealth,
    lastFire: 0,
    moveAngle: Phaser.Math.FloatBetween(0, Math.PI * 2),
    rethinkAt: 0,
    speed: options.speed,
    fireDelay: options.fireDelay,
    bulletSpeed: options.bulletSpeed,
    scoreValue: options.scoreValue,
    damage: options.damage,
    preferredRange: options.preferredRange,
    accuracy: options.accuracy,
    separationRadius: options.separationRadius,
    strafeDirection: Phaser.Math.Between(0, 1) === 0 ? -1 : 1,
    healthBar,
  }
  syncTankVisuals(tank)
  return tank
}

export function syncTankVisuals(tank: Tank) {
  tank.hull.setPosition(tank.x, tank.y)
  tank.turret.setPosition(tank.x, tank.y)
  tank.hull.rotation = tank.hullAngle + TANK_SPRITE_ROTATION_OFFSET
  tank.turret.rotation = tank.turretAngle + TANK_SPRITE_ROTATION_OFFSET
  drawEnemyHealthBar(tank)
}

export function drawEnemyHealthBar(tank: Tank) {
  if (tank.kind !== 'enemy' || !tank.healthBar) {
    return
  }

  const width = tank.size * 0.86
  const height = 5
  const x = tank.x - width / 2
  const y = tank.y - tank.size / 2 - 10
  const progress = Phaser.Math.Clamp(tank.health / tank.maxHealth, 0, 1)
  const fill = progress > 0.45 ? 0x74eeb5 : progress > 0.2 ? 0xf6d365 : 0xff6b6b
  tank.healthBar.clear()
  tank.healthBar.fillStyle(0x050706, 0.86)
  tank.healthBar.fillRoundedRect(x, y, width, height, 2)
  tank.healthBar.fillStyle(fill, 0.96)
  tank.healthBar.fillRoundedRect(x, y, Math.max(1, width * progress), height, 2)
}
