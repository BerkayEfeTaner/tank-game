import Phaser from 'phaser'
import { GAME_CONFIG } from './config'

export const MAP_THEMES = [
  { name: 'Iron Yard', floor: 0x1b2420, grid: 0x304037, panel: 0x26342d, accent: 0xf6d365, stain: 0x0c1110 },
  { name: 'Dust Depot', floor: 0x2b2720, grid: 0x4a412f, panel: 0x3a3328, accent: 0xe2b36c, stain: 0x17120e },
  { name: 'Frost Line', floor: 0x202933, grid: 0x354657, panel: 0x2b3a47, accent: 0x8ec5ff, stain: 0x101923 },
  { name: 'Hazard Grid', floor: 0x211f24, grid: 0x383641, panel: 0x2f2b36, accent: 0xff7b72, stain: 0x110f13 },
  { name: 'Overgrown Base', floor: 0x18241d, grid: 0x2e4535, panel: 0x233829, accent: 0x73e2a7, stain: 0x0b140f },
] as const

export type MapTheme = (typeof MAP_THEMES)[number]

const DECORATION_LAYOUT = [
  [92, 102, 'crate'],
  [846, 94, 'barrel'],
  [115, 438, 'stain'],
  [610, 94, 'stripe'],
  [820, 440, 'crate'],
  [358, 438, 'barrel'],
  [310, 72, 'stain'],
  [662, 360, 'stripe'],
] as const

export class MapThemeRenderer {
  private readonly scene: Phaser.Scene
  private readonly battlefield: Phaser.GameObjects.Graphics
  private decorations: Phaser.GameObjects.GameObject[] = []
  private currentTheme: MapTheme = MAP_THEMES[0]

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.battlefield = scene.add.graphics()
    this.battlefield.setDepth(-30)
    this.draw(MAP_THEMES[0])
  }

  get name(): string {
    return this.currentTheme.name
  }

  get theme(): MapTheme {
    return this.currentTheme
  }

  apply(waveIndex: number, walls: Phaser.GameObjects.Rectangle[]) {
    const theme = MAP_THEMES[waveIndex % MAP_THEMES.length]
    this.currentTheme = theme
    this.draw(theme)
    this.clearDecorations()

    walls.forEach((wall) => {
      wall.setFillStyle(theme.panel)
      wall.setStrokeStyle(2, theme.accent, 0.46)
    })

    DECORATION_LAYOUT.forEach(([baseX, baseY, type], index) => {
      const x = baseX + ((waveIndex * 37 + index * 11) % 28) - 14
      const y = baseY + ((waveIndex * 29 + index * 7) % 24) - 12
      if (type === 'crate') {
        this.addCrate(x, y, theme.accent)
      } else if (type === 'barrel') {
        this.addBarrel(x, y, theme.accent)
      } else if (type === 'stain') {
        this.addStain(x, y, theme.stain)
      } else if (type === 'stripe') {
        this.addStripe(x, y, theme.accent)
      }
    })
  }

  private draw(theme: MapTheme) {
    this.battlefield.clear()
    this.battlefield.fillStyle(theme.floor, 1)
    this.battlefield.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)

    this.battlefield.lineStyle(1, theme.grid, 0.58)
    for (let x = 0; x <= GAME_CONFIG.width; x += 48) {
      this.battlefield.lineBetween(x, 0, x, GAME_CONFIG.height)
    }
    for (let y = 0; y <= GAME_CONFIG.height; y += 48) {
      this.battlefield.lineBetween(0, y, GAME_CONFIG.width, y)
    }

    for (let index = 0; index < 12; index += 1) {
      const x = 42 + ((index * 127) % 850)
      const y = 76 + ((index * 83) % 392)
      this.battlefield.fillStyle(theme.panel, index % 3 === 0 ? 0.46 : 0.28)
      this.battlefield.fillRect(x, y, 72 + (index % 3) * 24, 36)
      this.battlefield.lineStyle(1, theme.grid, 0.48)
      this.battlefield.strokeRect(x, y, 72 + (index % 3) * 24, 36)
    }

    this.battlefield.fillStyle(theme.panel, 1)
    this.battlefield.fillRect(0, 0, GAME_CONFIG.width, 10)
    this.battlefield.fillRect(0, GAME_CONFIG.height - 10, GAME_CONFIG.width, 10)
    this.battlefield.fillRect(0, 0, 10, GAME_CONFIG.height)
    this.battlefield.fillRect(GAME_CONFIG.width - 10, 0, 10, GAME_CONFIG.height)
  }

  private clearDecorations() {
    for (const object of this.decorations) {
      object.destroy()
    }
    this.decorations = []
  }

  private addCrate(x: number, y: number, accent: number) {
    const crate = this.scene.add
      .image(x, y, accent === 0xe2b36c ? 'decor-crate-wood' : 'decor-crate-metal')
      .setDisplaySize(40, 40)
      .setDepth(-8)
      .setAlpha(0.9)
    crate.rotation = Phaser.Math.DegToRad((x + y) % 18)
    this.decorations.push(crate)
  }

  private addBarrel(x: number, y: number, accent: number) {
    const barrel = this.scene.add
      .image(x, y, accent === 0xff7b72 ? 'decor-barrel-red' : 'decor-barrel-dark')
      .setDisplaySize(34, 34)
      .setDepth(-8)
      .setAlpha(0.9)
    this.decorations.push(barrel)
  }

  private addStain(x: number, y: number, color: number) {
    const stain = this.scene.add.image(x, y, 'decor-oil').setDisplaySize(70, 44).setDepth(-9)
    stain.setTint(color).setAlpha(0.46)
    stain.rotation = Phaser.Math.DegToRad((x + y) % 42)
    this.decorations.push(stain)
  }

  private addStripe(x: number, y: number, accent: number) {
    const barricade = this.scene.add
      .image(x, y, accent === 0xf6d365 ? 'decor-barricade-metal' : 'decor-barricade-wood')
      .setDisplaySize(72, 24)
      .setDepth(-8)
      .setAlpha(0.88)
    barricade.rotation = Phaser.Math.DegToRad(((x + y) % 24) - 12)
    this.decorations.push(barricade)
  }
}
