import Phaser from 'phaser'
import { TANK_SPRITE_ROTATION_OFFSET } from './constants'
import type { Tank } from './types'

export function flashTank(scene: Phaser.Scene, tank: Tank, color: number) {
  tank.hull.setTint(color)
  tank.turret.setTint(color)
  scene.time.delayedCall(90, () => {
    if (tank.hull.active) {
      tank.hull.clearTint()
      tank.turret.clearTint()
    }
  })
}

export function spawnMuzzleFlash(scene: Phaser.Scene, x: number, y: number, angle: number) {
  const flash = scene.add
    .image(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, 'muzzle-flash')
    .setDisplaySize(24, 24)
    .setDepth(7)
    .setAlpha(0.9)
  flash.rotation = angle + TANK_SPRITE_ROTATION_OFFSET
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scaleX: 1.8,
    scaleY: 1.4,
    duration: 90,
    onComplete: () => flash.destroy(),
  })
}

export function spawnHitSpark(scene: Phaser.Scene, x: number, y: number) {
  for (let index = 0; index < 7; index += 1) {
    const spark = scene.add.rectangle(x, y, 8, 2, 0xffd166)
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = Phaser.Math.Between(18, 36)
    spark.rotation = angle
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    })
  }
}

export function spawnBlastRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
) {
  const ring = scene.add.circle(x, y, 8, color, 0.12).setStrokeStyle(3, color, 0.8).setDepth(7)
  scene.tweens.add({
    targets: ring,
    radius,
    alpha: 0,
    duration: 210,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  })
}

export function spawnDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  damage: number,
  critical = false,
) {
  const text = scene.add
    .text(x, y, critical ? `${damage}!` : `${damage}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: critical ? '18px' : '14px',
      color: critical ? '#f6d365' : '#fff8dd',
      fontStyle: '900',
      stroke: '#050706',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(12)
  scene.tweens.add({
    targets: text,
    y: y - 24,
    alpha: 0,
    duration: critical ? 520 : 380,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  })
}

export function spawnFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: number,
) {
  const text = scene.add
    .text(x, y, message, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: '900',
      stroke: '#050706',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(12)
  scene.tweens.add({
    targets: text,
    y: y - 28,
    alpha: 0,
    duration: 620,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  })
}

export function spawnExplosion(scene: Phaser.Scene, x: number, y: number) {
  scene.cameras.main.shake(110, 0.004)
  const blast = scene.add.image(x, y, 'explosion-1').setDisplaySize(58, 58).setDepth(9)
  for (let frame = 2; frame <= 5; frame += 1) {
    scene.time.delayedCall((frame - 1) * 42, () => {
      if (blast.active) {
        blast.setTexture(`explosion-${frame}`)
      }
    })
  }
  scene.tweens.add({
    targets: blast,
    scale: 1.35,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.easeOut',
    onComplete: () => blast.destroy(),
  })
  for (let index = 0; index < 12; index += 1) {
    const shard = scene.add.rectangle(x, y, 12, 4, index % 2 === 0 ? 0xff6b6b : 0xf6d365)
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const distance = Phaser.Math.Between(34, 72)
    shard.rotation = angle
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: 0,
      duration: 310,
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy(),
    })
  }
}
