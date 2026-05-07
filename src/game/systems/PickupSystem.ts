import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'
import type { PickupDrop, PickupType, PlayerBuffs, Tank } from '../types'

export function xpRateForEnemy(enemy: Tank): number {
  if (enemy.enemyType === 'boss') return 0.16
  if (enemy.enemyType === 'shield' || enemy.enemyType === 'sniper') return 0.1
  if (enemy.enemyType === 'heavy' || enemy.enemyType === 'bomber') return 0.09
  if (enemy.enemyType === 'charger') return 0.085
  return 0.08
}

export function xpForEnemy(enemy: Tank, waveIndex: number, buffs: PlayerBuffs, now: number) {
  const waveBonus = 1 + Math.floor(waveIndex / 5) * 0.12
  const upgradeBonus = 1 + buffs.xpBonus * 0.14
  const temporaryBonus = buffs.doubleXpUntil > now ? 2 : 1
  const baseRate = xpRateForEnemy(enemy)
  const minimum = enemy.enemyType === 'boss' ? 18 : 3
  return Math.max(
    minimum,
    Math.round(enemy.scoreValue * baseRate * waveBonus * upgradeBonus * temporaryBonus),
  )
}

export function goldForEnemy(
  enemy: Tank,
  waveIndex: number,
  bossTier: number,
  buffs: PlayerBuffs,
  now: number,
) {
  const temporaryBonus = buffs.doubleGoldUntil > now ? 2 : 1
  let amount = 0
  if (enemy.enemyType === 'boss') {
    amount = 55 + bossTier * 16
  } else {
    const base
      = enemy.enemyType === 'heavy'
        ? 8
        : enemy.enemyType === 'sniper'
          ? 10
          : enemy.enemyType === 'shield'
            ? 12
            : enemy.enemyType === 'bomber'
              ? 9
              : enemy.enemyType === 'charger'
                ? 7
                : 5
    amount = base + Math.floor(waveIndex / 4)
  }
  return amount * temporaryBonus
}

export function xpRequiredForLevel(level: number) {
  return Math.round(120 + (level - 1) * 62 + (level - 1) ** 2 * 18)
}

export class PickupSystem {
  private readonly scene: Phaser.Scene
  private readonly pickups: PickupDrop[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  list(): readonly PickupDrop[] {
    return this.pickups
  }

  drop(type: PickupType, x: number, y: number, value: number) {
    const color = type === 'xp' ? GAME_CONFIG.colors.xp : 0xf6d365
    const labelText = type === 'xp' ? 'XP' : 'G'
    const sprite = this.scene.add
      .circle(x, y, type === 'xp' ? 8 : 9, color, 0.9)
      .setStrokeStyle(2, 0x050706, 0.85)
      .setDepth(3)
    const label = this.scene.add
      .text(x, y, labelText, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: type === 'xp' ? '8px' : '9px',
        color: '#101411',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(4)

    this.scene.tweens.add({
      targets: [sprite, label],
      y: `+=${Phaser.Math.Between(-5, 5)}`,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.pickups.push({ type, value, sprite, label })
  }

  update(player: Tank, radius: number, onCollect: (pickup: PickupDrop) => void) {
    const collectDistance = player.size / 2 + 11
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index]
      const distance = Phaser.Math.Distance.Between(
        pickup.sprite.x,
        pickup.sprite.y,
        player.x,
        player.y,
      )
      if (distance > radius) {
        continue
      }
      if (distance <= collectDistance) {
        onCollect(pickup)
        continue
      }
      this.pullPickupToward(pickup, player, distance, radius)
    }
  }

  private pullPickupToward(pickup: PickupDrop, player: Tank, distance: number, radius: number) {
    if (!pickup.attracting) {
      pickup.attracting = true
      this.scene.tweens.killTweensOf([pickup.sprite, pickup.label])
      this.scene.tweens.add({
        targets: [pickup.sprite, pickup.label],
        scale: 1.16,
        duration: 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    const pullStrength = Phaser.Math.Clamp(1 - distance / radius, 0.12, 0.55)
    const step = Math.min(distance, 3.5 + pullStrength * 13)
    const angle = Phaser.Math.Angle.Between(pickup.sprite.x, pickup.sprite.y, player.x, player.y)
    const nextX = pickup.sprite.x + Math.cos(angle) * step
    const nextY = pickup.sprite.y + Math.sin(angle) * step

    pickup.sprite.setPosition(nextX, nextY)
    pickup.label.setPosition(nextX, nextY)
  }

  remove(pickup: PickupDrop) {
    const index = this.pickups.indexOf(pickup)
    if (index < 0) {
      return false
    }
    this.scene.tweens.killTweensOf([pickup.sprite, pickup.label])
    pickup.sprite.destroy()
    pickup.label.destroy()
    this.pickups.splice(index, 1)
    return true
  }

  magnetTo(player: Tank, onCollect: (pickup: PickupDrop) => void) {
    const snapshot = [...this.pickups]
    for (const pickup of snapshot) {
      pickup.attracting = true
      this.scene.tweens.killTweensOf([pickup.sprite, pickup.label])
      this.scene.tweens.add({
        targets: [pickup.sprite, pickup.label],
        x: player.x,
        y: player.y,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => onCollect(pickup),
      })
    }
  }

  clear() {
    for (const pickup of this.pickups) {
      this.scene.tweens.killTweensOf([pickup.sprite, pickup.label])
      pickup.sprite.destroy()
      pickup.label.destroy()
    }
    this.pickups.length = 0
  }
}
