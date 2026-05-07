import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'
import { boundsOverlap, squareBounds } from '../tank/collision'
import type { Mine, Tank, WaveConfig } from '../types'

export class MineSystem {
  private readonly scene: Phaser.Scene
  private readonly mines: Mine[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  list(): readonly Mine[] {
    return this.mines
  }

  spawn(wave: WaveConfig, walls: Phaser.GameObjects.Rectangle[], player: Tank | undefined) {
    if (wave.number < 4) {
      return
    }

    const mineCount = Phaser.Math.Between(1, Math.min(2 + Math.floor(wave.number / 4), 6))
    for (let index = 0; index < mineCount; index += 1) {
      for (let attempt = 0; attempt < 22; attempt += 1) {
        const x = Phaser.Math.Between(170, GAME_CONFIG.width - 72)
        const y = Phaser.Math.Between(66, GAME_CONFIG.height - 58)
        if (!this.positionIsClear(x, y, walls, player)) {
          continue
        }

        const sprite = this.scene.add
          .circle(x, y, 16, 0x171a17, 0.96)
          .setStrokeStyle(3, 0xff5d5d, 0.98)
          .setDepth(3)
        const pulse = this.scene.add
          .circle(x, y, 5, 0xff5d5d, 0.95)
          .setDepth(4)
        this.scene.tweens.add({
          targets: sprite,
          scale: 1.1,
          alpha: 0.72,
          duration: 560,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
          targets: pulse,
          scale: 1.5,
          alpha: 0.45,
          duration: 420,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        this.mines.push({
          sprite,
          pulse,
          damage: 2 + Math.floor(wave.number / 6),
          radius: 20,
        })
        break
      }
    }
  }

  update(player: Tank, onTrigger: (mine: Mine) => void) {
    for (let index = this.mines.length - 1; index >= 0; index -= 1) {
      const mine = this.mines[index]
      const distance = Phaser.Math.Distance.Between(
        mine.sprite.x,
        mine.sprite.y,
        player.x,
        player.y,
      )
      if (distance > player.size / 2 + mine.radius) {
        continue
      }
      onTrigger(mine)
      mine.sprite.destroy()
      mine.pulse?.destroy()
      this.mines.splice(index, 1)
    }
  }

  clear() {
    for (const mine of this.mines) {
      mine.sprite.destroy()
      mine.pulse?.destroy()
    }
    this.mines.length = 0
  }

  private positionIsClear(
    x: number,
    y: number,
    walls: Phaser.GameObjects.Rectangle[],
    player: Tank | undefined,
  ) {
    const bounds = squareBounds(x, y, 42)
    const farFromPlayer = !player || Phaser.Math.Distance.Between(x, y, player.x, player.y) > 130
    const awayFromMines = this.mines.every(
      (mine) => Phaser.Math.Distance.Between(x, y, mine.sprite.x, mine.sprite.y) > 96,
    )
    return (
      farFromPlayer
      && awayFromMines
      && walls.every((wall) => !boundsOverlap(bounds, wall.getBounds()))
    )
  }
}
