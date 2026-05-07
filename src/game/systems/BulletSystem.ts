import Phaser from 'phaser'
import { GAME_CONFIG } from '../config'
import { TANK_SPRITE_ROTATION_OFFSET } from '../constants'
import { spawnMuzzleFlash } from '../effects'
import { boundsOverlap, hitsWall, tankBounds } from '../tank/collision'
import type { Bullet, Tank, UpgradeType } from '../types'
import type { GameAudio } from './audio'

export type FireOptions = {
  angleOverride?: number
  lateralOffset?: number
  playSound?: boolean
  damageOverride?: number
  critical?: boolean
  bulletTint?: number
  baselineExplosiveRadius?: number
}

export type BulletHitContext = {
  enemies: Tank[]
  player: Tank
  walls: Phaser.GameObjects.Rectangle[]
  onEnemyHit: (enemyIndex: number, bullet: Bullet) => void
  onPlayerHit: (bullet: Bullet) => void
}

export class BulletSystem {
  private readonly scene: Phaser.Scene
  private readonly audio: GameAudio
  private readonly upgradeLevelOf: (type: UpgradeType) => number
  private readonly bullets: Bullet[] = []

  constructor(
    scene: Phaser.Scene,
    audio: GameAudio,
    upgradeLevelOf: (type: UpgradeType) => number,
  ) {
    this.scene = scene
    this.audio = audio
    this.upgradeLevelOf = upgradeLevelOf
  }

  fire(tank: Tank, fromPlayer: boolean, time: number, options: FireOptions = {}) {
    const lateralOffset = options.lateralOffset ?? 0
    const playSound = options.playSound ?? true
    const critical = options.critical ?? false
    tank.lastFire = time

    const angle
      = options.angleOverride
        ?? (fromPlayer
          ? tank.turretAngle
          : tank.turretAngle + Phaser.Math.FloatBetween(-tank.accuracy, tank.accuracy))
    const muzzleX = tank.x + Math.cos(angle) * 34 + Math.cos(angle + Math.PI / 2) * lateralOffset
    const muzzleY = tank.y + Math.sin(angle) * 34 + Math.sin(angle + Math.PI / 2) * lateralOffset
    const bulletKey
      = fromPlayer ? 'bullet-player' : tank.enemyType === 'sniper' ? 'bullet-sniper' : 'bullet-enemy'
    const sprite = this.scene.add
      .image(muzzleX, muzzleY, bulletKey)
      .setDisplaySize(critical ? 10 : 8, critical ? 22 : 18)
      .setDepth(4)
    if (critical) {
      sprite.setTint(0xf6d365)
    } else if (options.bulletTint !== undefined) {
      sprite.setTint(options.bulletTint)
    }
    sprite.rotation = angle + TANK_SPRITE_ROTATION_OFFSET
    const velocity = new Phaser.Math.Vector2(
      Math.cos(angle) * tank.bulletSpeed,
      Math.sin(angle) * tank.bulletSpeed,
    )

    const piercingLevel = fromPlayer ? this.upgradeLevelOf('piercingShell') : 0
    const explosiveLevel = fromPlayer ? this.upgradeLevelOf('explosiveShell') : 0
    const upgradeRadius = explosiveLevel > 0 ? 32 + explosiveLevel * 12 : 0
    const explosiveRadius = Math.max(upgradeRadius, options.baselineExplosiveRadius ?? 0)
    this.bullets.push({
      sprite,
      velocity,
      fromPlayer,
      age: 0,
      damage: options.damageOverride ?? tank.damage,
      critical,
      piercesShield: tank.enemyType === 'sniper',
      piercesLeft: piercingLevel,
      explosiveRadius,
    })
    spawnMuzzleFlash(this.scene, muzzleX, muzzleY, angle)
    if (playSound) {
      this.audio.shot()
    }
  }

  update(delta: number, ctx: BulletHitContext) {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index]
      bullet.age += delta
      bullet.sprite.x += bullet.velocity.x * (delta / 1000)
      bullet.sprite.y += bullet.velocity.y * (delta / 1000)

      if (this.shouldRemove(bullet, ctx.walls)) {
        this.removeAt(index)
        continue
      }

      if (bullet.fromPlayer) {
        const hitIndex = ctx.enemies.findIndex((enemy) =>
          boundsOverlap(bullet.sprite.getBounds(), tankBounds(enemy)),
        )
        if (hitIndex >= 0) {
          ctx.onEnemyHit(hitIndex, bullet)
          if ((bullet.piercesLeft ?? 0) > 0) {
            bullet.piercesLeft = (bullet.piercesLeft ?? 0) - 1
            continue
          }
          this.removeAt(index)
        }
      } else if (boundsOverlap(bullet.sprite.getBounds(), tankBounds(ctx.player))) {
        ctx.onPlayerHit(bullet)
        this.removeAt(index)
      }
    }
  }

  clear() {
    for (const bullet of this.bullets) {
      bullet.sprite.destroy()
    }
    this.bullets.length = 0
  }

  count() {
    return this.bullets.length
  }

  private shouldRemove(bullet: Bullet, walls: Phaser.GameObjects.Rectangle[]) {
    const outOfBounds
      = bullet.sprite.x < 0
      || bullet.sprite.x > GAME_CONFIG.width
      || bullet.sprite.y < 0
      || bullet.sprite.y > GAME_CONFIG.height
    return outOfBounds || bullet.age > GAME_CONFIG.bulletLife || hitsWall(bullet.sprite, walls)
  }

  private removeAt(index: number) {
    this.bullets[index].sprite.destroy()
    this.bullets.splice(index, 1)
  }
}
