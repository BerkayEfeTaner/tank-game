import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'
import type { Tank } from '../types'

export function squareBounds(x: number, y: number, size: number) {
  return new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size)
}

export function tankBoundsAt(tank: Tank, x: number, y: number) {
  return squareBounds(x, y, tank.size)
}

export function tankBounds(tank: Tank) {
  return tankBoundsAt(tank, tank.x, tank.y)
}

export function boundsOverlap(a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) {
  return Phaser.Geom.Intersects.RectangleToRectangle(a, b)
}

export function clampTankPosition(x: number, y: number, size: number) {
  const halfSize = size / 2
  return {
    x: Phaser.Math.Clamp(x, halfSize + 10, GAME_CONFIG.width - halfSize - 10),
    y: Phaser.Math.Clamp(y, halfSize + 10, GAME_CONFIG.height - halfSize - 10),
  }
}

export function hitsWall(
  object: { getBounds: () => Phaser.Geom.Rectangle },
  walls: Phaser.GameObjects.Rectangle[],
) {
  return walls.some((wall) => boundsOverlap(object.getBounds(), wall.getBounds()))
}

export function lineBlocked(from: Tank, to: Tank, walls: Phaser.GameObjects.Rectangle[]) {
  const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y)
  return walls.some((wall) => Phaser.Geom.Intersects.LineToRectangle(line, wall.getBounds()))
}

export function tankBlockedAt(
  tank: Tank,
  x: number,
  y: number,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
): boolean {
  const bounds = tankBoundsAt(tank, x, y)
  if (walls.some((wall) => boundsOverlap(bounds, wall.getBounds()))) {
    return true
  }

  if (tank.kind === 'enemy' && player && boundsOverlap(bounds, tankBounds(player))) {
    return true
  }

  return false
}

export function tankBlocked(
  tank: Tank,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
): boolean {
  return tankBlockedAt(tank, tank.x, tank.y, walls, player)
}

export function canTankMove(
  tank: Tank,
  dx: number,
  dy: number,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
): boolean {
  const next = clampTankPosition(tank.x + dx, tank.y + dy, tank.size)
  return !tankBlockedAt(tank, next.x, next.y, walls, player)
}

export function moveTankAxis(
  tank: Tank,
  dx: number,
  dy: number,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
): boolean {
  if (dx === 0 && dy === 0) {
    return true
  }

  const previousX = tank.x
  const previousY = tank.y
  const next = clampTankPosition(tank.x + dx, tank.y + dy, tank.size)
  tank.x = next.x
  tank.y = next.y

  if (tankBlocked(tank, walls, player)) {
    tank.x = previousX
    tank.y = previousY
    return false
  }

  return tank.x !== previousX || tank.y !== previousY
}

const SPAWN_OFFSETS = [
  [0, 0],
  [0, -64],
  [-64, 0],
  [64, 0],
  [0, 64],
  [-64, -64],
  [64, -64],
  [-64, 64],
  [64, 64],
  [0, -112],
  [-112, 0],
  [112, 0],
] as const

export function spawnIsClear(
  x: number,
  y: number,
  size: number,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
) {
  const bounds = squareBounds(x, y, size)
  const wallHit = walls.some((wall) => boundsOverlap(bounds, wall.getBounds()))
  const playerHit = player ? boundsOverlap(bounds, tankBounds(player)) : false
  return !wallHit && !playerHit
}

export function findClearSpawn(
  x: number,
  y: number,
  size: number,
  walls: Phaser.GameObjects.Rectangle[],
  player?: Tank,
) {
  for (const [offsetX, offsetY] of SPAWN_OFFSETS) {
    const candidate = clampTankPosition(x + offsetX, y + offsetY, size)
    if (spawnIsClear(candidate.x, candidate.y, size, walls, player)) {
      return candidate
    }
  }
  return clampTankPosition(x, y, size)
}
