import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'

const POWER_UP_GLYPHS: Record<PowerUpType, string> = {
  nuke: '☢',
  magnet: '⊕',
  freeze: '❄',
  doubleGold: '⛁',
  doubleXp: '★',
  repair: '✚',
  overdrive: '⚡',
}
import { boundsOverlap, tankBounds } from '../tank/collision'
import type { PowerUp, PowerUpType, Tank } from '../types'

export function rollPowerUpType(): PowerUpType {
  const roll = Math.random()
  if (roll < 0.14) return 'repair'
  if (roll < 0.25) return 'doubleGold'
  if (roll < 0.36) return 'doubleXp'
  if (roll < 0.56) return 'magnet'
  if (roll < 0.74) return 'freeze'
  if (roll < 0.9) return 'overdrive'
  return 'nuke'
}

export function powerUpName(type: PowerUpType): string {
  if (type === 'nuke') return 'Nuke'
  if (type === 'magnet') return 'Magnet'
  if (type === 'freeze') return 'Freeze'
  if (type === 'doubleGold') return '2x Gold'
  if (type === 'doubleXp') return '2x XP'
  if (type === 'repair') return 'Repair'
  return 'Overdrive'
}

export function powerUpColor(type: PowerUpType): number {
  if (type === 'nuke') return GAME_CONFIG.colors.nuke
  if (type === 'magnet') return GAME_CONFIG.colors.magnet
  if (type === 'freeze') return GAME_CONFIG.colors.freeze
  if (type === 'doubleGold') return GAME_CONFIG.colors.doubleGold
  if (type === 'doubleXp') return GAME_CONFIG.colors.doubleXp
  if (type === 'repair') return GAME_CONFIG.colors.repair
  return GAME_CONFIG.colors.overdrive
}

export class PowerUpSystem {
  private readonly scene: Phaser.Scene
  private readonly powerUps: PowerUp[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  list(): readonly PowerUp[] {
    return this.powerUps
  }

  maybeDrop(x: number, y: number) {
    if (Math.random() > GAME_CONFIG.powerUpDropChance) {
      return
    }

    const type = rollPowerUpType()
    const color = powerUpColor(type)
    const size = type === 'nuke' ? 38 : type === 'magnet' ? 34 : 30
    const ring = this.scene.add
      .circle(x, y, size * 0.72, color, 0.16)
      .setStrokeStyle(2, color, 0.9)
      .setDepth(3)
    const sprite = this.scene.add
      .rectangle(x, y, size, size, color, 0.94)
      .setStrokeStyle(3, 0x101411)
      .setDepth(4)
    sprite.rotation = Math.PI / 4
    const label = this.scene.add
      .text(x, y, POWER_UP_GLYPHS[type], {
        fontFamily: 'Apple Color Emoji, Segoe UI Symbol, Symbola, Inter, sans-serif',
        fontSize: '22px',
        color: '#101411',
        fontStyle: '900',
      })
      .setOrigin(0.5)
      .setDepth(5)
    const subLabel = this.scene.add
      .text(x, y, '', { fontSize: '1px' })
      .setOrigin(0.5)
      .setDepth(5)
      .setVisible(false)

    this.scene.tweens.add({
      targets: ring,
      scale: 1.16,
      alpha: 0.36,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.powerUps.push({ type, sprite, label, subLabel, ring })
  }

  update(player: Tank, onCollect: (type: PowerUpType) => void) {
    for (let index = this.powerUps.length - 1; index >= 0; index -= 1) {
      const powerUp = this.powerUps[index]
      if (!boundsOverlap(powerUp.sprite.getBounds(), tankBounds(player))) {
        continue
      }
      onCollect(powerUp.type)
      powerUp.sprite.destroy()
      powerUp.label.destroy()
      powerUp.subLabel.destroy()
      powerUp.ring.destroy()
      this.powerUps.splice(index, 1)
    }
  }

  clear() {
    for (const powerUp of this.powerUps) {
      powerUp.sprite.destroy()
      powerUp.label.destroy()
      powerUp.subLabel.destroy()
      powerUp.ring.destroy()
    }
    this.powerUps.length = 0
  }
}
