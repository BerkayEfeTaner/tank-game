import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'

export type ScreenPanelOptions = {
  eyebrow: string
  title: string
  subtitle: string
  primary: string
  rows: string[]
  accent: number
}

export class ScreenPanelRenderer {
  private readonly scene: Phaser.Scene
  private objects: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  show(options: ScreenPanelOptions) {
    this.clear()
    const panelWidth = 500
    const panelHeight = 292
    const x = GAME_CONFIG.width / 2
    const y = GAME_CONFIG.height / 2
    const left = x - panelWidth / 2
    const top = y - panelHeight / 2
    const accentHex = `#${options.accent.toString(16).padStart(6, '0')}`

    const shade = this.scene.add.graphics().setDepth(61)
    shade.fillStyle(0x050706, 0.48)
    shade.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    shade.fillStyle(0x0b100e, 0.96)
    shade.fillRoundedRect(left, top, panelWidth, panelHeight, 14)
    shade.fillStyle(options.accent, 0.1)
    shade.fillRoundedRect(left + 10, top + 10, panelWidth - 20, 74, 10)
    shade.lineStyle(2, options.accent, 0.72)
    shade.strokeRoundedRect(left, top, panelWidth, panelHeight, 14)
    shade.lineStyle(1, 0xffffff, 0.12)
    shade.strokeRoundedRect(left + 10, top + 10, panelWidth - 20, panelHeight - 20, 10)
    shade.fillStyle(options.accent, 1)
    shade.fillRect(left, top + 30, 5, panelHeight - 60)

    const eyebrow = this.scene.add
      .text(x, top + 38, options.eyebrow, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: accentHex,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(62)
    const title = this.scene.add
      .text(x, top + 79, options.title, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '42px',
        color: GAME_CONFIG.colors.text,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(62)
    const subtitle = this.scene.add
      .text(x, top + 124, options.subtitle, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: GAME_CONFIG.colors.muted,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(62)
    const primary = this.scene.add
      .text(x, top + 172, options.primary, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '17px',
        color: '#0b0f0d',
        backgroundColor: accentHex,
        padding: { x: 16, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(62)
    const rows = this.scene.add
      .text(x, top + 230, options.rows.join('   |   '), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: GAME_CONFIG.colors.muted,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
      .setDepth(62)

    this.objects.push(shade, eyebrow, title, subtitle, primary, rows)
    shade.setAlpha(0)
    this.scene.tweens.add({
      targets: shade,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    })

    const panelTextObjects = [eyebrow, title, subtitle, primary, rows]
    panelTextObjects.forEach((object) => {
      object.setAlpha(0)
      object.y += 12
    })
    this.scene.tweens.add({
      targets: panelTextObjects,
      alpha: 1,
      y: '-=12',
      duration: 190,
      ease: 'Cubic.easeOut',
    })
  }

  clear() {
    for (const object of this.objects) {
      object.destroy()
    }
    this.objects = []
  }
}
