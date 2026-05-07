import Phaser from 'phaser'
import { ENEMY_STATS, GAME_CONFIG, UPGRADE_OPTIONS } from '../config'
import {
  HUD_UPGRADE_LABELS,
  UPGRADE_CAPS,
  rarityColor,
  upgradeCategory,
  upgradeImpact,
} from '../upgrade-meta'
import { TANK_SPRITE_ROTATION_OFFSET } from '../constants'
import {
  flashTank,
  spawnBlastRing,
  spawnDamageNumber,
  spawnExplosion,
  spawnFloatingText,
  spawnHitSpark,
  spawnMuzzleFlash,
} from '../effects'
import { GameEventBus, type HudMod, type HudSnapshot, type ShopSnapshot } from '../events'
import { MapThemeRenderer } from '../map-theme'
import { MineSystem } from '../systems/MineSystem'
import {
  PickupSystem,
  goldForEnemy,
  xpForEnemy,
  xpRequiredForLevel,
} from '../systems/PickupSystem'
import { PowerUpSystem, powerUpColor, powerUpName } from '../systems/PowerUpSystem'
import { rollPlayerDamage } from '../systems/Combat'
import {
  chooseEnemyMove,
  enemySeparation,
  findOpenMoveAngle,
  wallAvoidance,
} from '../systems/EnemyAI'
import { bossTier, createWaveConfig, expandWaveQueue, isBossWave } from '../systems/WaveSystem'
import {
  boundsOverlap,
  findClearSpawn,
  hitsWall,
  lineBlocked,
  moveTankAxis,
  tankBounds,
} from '../tank/collision'
import { createTank, syncTankVisuals, tankSizeForType } from '../tank/factory'
import {
  loadGold,
  loadHighScore,
  loadStatLevels,
  saveGold,
  saveHighScore,
  saveStatLevels,
} from '../persistence'
import { STAT_UPGRADES, createEmptyStatLevels, statUpgradeCost } from '../stats'
import { GameAudio } from '../systems/audio'
import type {
  Bullet,
  EnemyType,
  GameState,
  PlayerBuffs,
  PickupDrop,
  PowerUpType,
  StatUpgradeType,
  Tank,
  UpgradeOption,
  UpgradeType,
  WaveConfig,
} from '../types'
import { HudController } from '../ui/HudController'
import { ShopController } from '../ui/ShopController'

const ASSET_BASE_PATH = '/assets/kenney-tanks'
const SPAWN_POINTS = [
  [792, 108],
  [826, 420],
  [548, 264],
  [360, 114],
  [662, 426],
  [805, 266],
  [560, 92],
  [720, 68],
  [865, 312],
] as const

const WALL_DATA = [
  [240, 260, 34, 210],
  [440, 150, 210, 34],
  [500, 395, 260, 34],
  [720, 260, 34, 180],
] as const

export class TankBattleScene extends Phaser.Scene {
  private audio = new GameAudio()
  private state: GameState = 'menu'
  private player!: Tank
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private bullets: Bullet[] = []
  private enemies: Tank[] = []
  private powerUpSystem!: PowerUpSystem
  private pickupSystem!: PickupSystem
  private mineSystem!: MineSystem
  private walls: Phaser.GameObjects.Rectangle[] = []
  private mapTheme!: MapThemeRenderer
  private upgradeObjects: Phaser.GameObjects.GameObject[] = []
  private upgradeCardBounds: Phaser.Geom.Rectangle[] = []
  private upgradeChoices: UpgradeOption[] = []
  private screenPanelObjects: Phaser.GameObjects.GameObject[] = []
  private uiLayer!: Phaser.GameObjects.Container
  private hudPanel!: Phaser.GameObjects.Graphics
  private hud!: Phaser.GameObjects.Text
  private bus = new GameEventBus()
  private hudController?: HudController
  private shopController?: ShopController
  private xpBar!: Phaser.GameObjects.Graphics
  private xpText!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private helper!: Phaser.GameObjects.Text
  private waveIndex = 0
  private score = 0
  private highScore = 0
  private multiplier = 1
  private waveMessageUntil = 0
  private waveSpawnAt = 0
  private pendingWave: WaveConfig | null = null
  private waveSpawnQueue: EnemyType[] = []
  private nextEnemySpawnAt = 0
  private isNewRecord = false
  private gold = 0
  private xp = 0
  private level = 1
  private nextLevelXp = 120
  private pendingUpgradeReason: 'wave' | 'level' = 'wave'
  private upgradeLevels: Record<UpgradeType, number> = this.createEmptyUpgradeLevels()
  private statLevels: Record<StatUpgradeType, number> = createEmptyStatLevels()
  private buffs: PlayerBuffs = this.createDefaultBuffs()
  private shopPausedRun = false

  constructor() {
    super('tank-battle')
  }

  private createEmptyUpgradeLevels(): Record<UpgradeType, number> {
    return {
      armor: 0,
      damage: 0,
      fireRate: 0,
      moveSpeed: 0,
      bulletSpeed: 0,
      critChance: 0,
      critDamage: 0,
      scoreBonus: 0,
      doubleShot: 0,
      tripleShot: 0,
      xpBoost: 0,
      piercingShell: 0,
      explosiveShell: 0,
      pickupRadius: 0,
      bossDamage: 0,
    }
  }

  private createDefaultBuffs(): PlayerBuffs {
    return {
      doubleGoldUntil: 0,
      doubleXpUntil: 0,
      freezeUntil: 0,
      overdriveUntil: 0,
      scoreBonus: 0,
      doubleShot: 0,
      tripleShot: 0,
      xpBonus: 0,
    }
  }

  private permanentMaxHealth() {
    return GAME_CONFIG.player.maxHealth + this.statLevels.maxHealth
  }

  private permanentDamage() {
    return GAME_CONFIG.player.damage + this.statLevels.damage
  }

  private permanentFireDelay() {
    return Math.max(80, GAME_CONFIG.player.fireDelay - this.statLevels.fireRate * 12)
  }

  private permanentMoveSpeed() {
    return GAME_CONFIG.player.speed + this.statLevels.moveSpeed * 10
  }

  private pickupCollectRadius() {
    return this.player.size / 2 + 13 + this.upgradeLevel('pickupRadius') * 18 + this.statLevels.pickupRadius * 12
  }

  private bossDamageMultiplier() {
    return 1 + this.upgradeLevel('bossDamage') * 0.12 + this.statLevels.bossDamage * 0.06
  }

  private upgradeLevel(type: UpgradeType) {
    return this.upgradeLevels[type] ?? 0
  }

  private upgradeCap(type: UpgradeType) {
    return UPGRADE_CAPS[type]
  }

  private isUpgradeMaxed(type: UpgradeType) {
    return this.upgradeLevel(type) >= this.upgradeCap(type)
  }

  private upgradeLevelText(type: UpgradeType, next = false) {
    const level = Math.min(this.upgradeLevel(type) + (next ? 1 : 0), this.upgradeCap(type))
    return `+${level}/${this.upgradeCap(type)}`
  }

  preload() {
    const assets = [
      ['tank-player-body', 'tankBody_blue.png'],
      ['tank-player-barrel', 'tankBlue_barrel1.png'],
      ['tank-scout-body', 'tankBody_green.png'],
      ['tank-scout-barrel', 'tankGreen_barrel1.png'],
      ['tank-heavy-body', 'tankBody_darkLarge.png'],
      ['tank-heavy-barrel', 'tankDark_barrel2.png'],
      ['tank-sniper-body', 'tankBody_red.png'],
      ['tank-sniper-barrel', 'tankRed_barrel1.png'],
      ['bullet-player', 'bulletBlue3_outline.png'],
      ['bullet-enemy', 'bulletRed3_outline.png'],
      ['bullet-sniper', 'bulletDark3_outline.png'],
      ['muzzle-flash', 'shotOrange.png'],
      ['decor-crate-metal', 'crateMetal.png'],
      ['decor-crate-wood', 'crateWood.png'],
      ['decor-barrel-red', 'barrelRed_top.png'],
      ['decor-barrel-dark', 'barrelBlack_top.png'],
      ['decor-oil', 'oilSpill_large.png'],
      ['decor-barricade-metal', 'barricadeMetal.png'],
      ['decor-barricade-wood', 'barricadeWood.png'],
      ['decor-sandbag', 'sandbagBrown.png'],
      ['decor-tree', 'treeGreen_large.png'],
      ['tile-grass', 'tileGrass1.png'],
      ['tile-sand', 'tileSand1.png'],
    ] as const

    assets.forEach(([key, fileName]) => {
      this.load.image(key, `${ASSET_BASE_PATH}/${fileName}`)
    })
    for (let index = 1; index <= 5; index += 1) {
      this.load.image(`explosion-${index}`, `${ASSET_BASE_PATH}/explosion${index}.png`)
    }
  }

  create() {
    this.highScore = loadHighScore()
    this.resetRuntime()
    this.createBattlefield()
    this.createWalls()
    this.createInput()
    this.createUi()
    this.showMenu()
  }

  update(time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.startGame()
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.togglePause()
      return
    }

    if (this.state === 'upgrade') {
      this.handleUpgradeHotkeys()
      return
    }

    if (this.state !== 'playing') {
      return
    }

    this.movePlayer(delta, time)
    this.aimTankAtPointer(this.player)

    if (this.keys.fire.isDown || this.input.activePointer.isDown) {
      this.fireFromPlayer(time)
    }

    this.updateEnemies(time, delta)
    this.updateBullets(delta, time)
    this.powerUpSystem.update(this.player, (type) => this.applyPowerUp(type))
    this.pickupSystem.update(this.player, this.pickupCollectRadius(), (pickup) => this.collectPickup(pickup))
    this.updateMines(time)
    this.updateWavePreparation(time)
    this.updateWaveSpawns(time)
    this.updateHud(time)
  }

  private resetRuntime() {
    this.bullets = []
    this.enemies = []
    this.powerUpSystem?.clear()
    this.pickupSystem?.clear()
    this.mineSystem?.clear()
    this.upgradeObjects = []
    this.screenPanelObjects = []
    this.upgradeChoices = []
    this.waveIndex = 0
    this.score = 0
    this.multiplier = 1
    this.waveMessageUntil = 0
    this.waveSpawnAt = 0
    this.pendingWave = null
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.isNewRecord = false
    this.gold = loadGold()
    this.xp = 0
    this.level = 1
    this.nextLevelXp = 120
    this.pendingUpgradeReason = 'wave'
    this.upgradeLevels = this.createEmptyUpgradeLevels()
    this.statLevels = loadStatLevels()
    this.buffs = this.createDefaultBuffs()
    this.state = 'menu'
  }

  private createBattlefield() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.colors.ground)
    this.mapTheme = new MapThemeRenderer(this)
    this.powerUpSystem = new PowerUpSystem(this)
    this.pickupSystem = new PickupSystem(this)
    this.mineSystem = new MineSystem(this)
  }

  private createWalls() {
    this.walls = WALL_DATA.map(([x, y, width, height]) => {
      const wall = this.add.rectangle(x, y, width, height, GAME_CONFIG.colors.wall)
      wall.setStrokeStyle(2, 0x77856f)
      wall.setDepth(1)
      return wall
    })
  }

  private createInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
    }) as Record<string, Phaser.Input.Keyboard.Key>

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.audio.unlock()
      if (this.state === 'menu' || this.state === 'won' || this.state === 'lost') {
        this.startGame()
        return
      }

      if (this.state === 'paused') {
        this.resumeGame()
        return
      }

      if (this.state === 'upgrade') {
        this.chooseUpgradeAt(pointer.x, pointer.y)
        return
      }

      this.fireFromPlayer(this.time.now)
    })
  }

  private createUi() {
    this.uiLayer = this.add.container(0, 0)
    this.uiLayer.setDepth(50)
    this.hudPanel = this.add.graphics()
    this.hud = this.add.text(16, 22, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '10px',
      color: GAME_CONFIG.colors.text,
      lineSpacing: 1,
      padding: { x: 0, y: 0 },
    })
    this.hud.setShadow(1, 1, '#050706', 3)

    this.xpBar = this.add.graphics()
    this.xpText = this.add.text(GAME_CONFIG.width / 2, 18, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '10px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
    }).setOrigin(0.5, 0)
    this.xpText.setShadow(1, 1, '#050706', 3)

    this.banner = this.add.text(GAME_CONFIG.width / 2, 176, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '40px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
    }).setOrigin(0.5)

    this.helper = this.add.text(GAME_CONFIG.width / 2, 246, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5)

    this.uiLayer.add([this.hudPanel, this.hud, this.xpBar, this.xpText, this.banner, this.helper])
    this.hudPanel.setVisible(false)
    this.hud.setVisible(false)
    this.xpBar.setVisible(false)
    this.xpText.setVisible(false)
    this.hudController = new HudController(this.bus)
    this.shopController = new ShopController(this.bus)
    this.wireBus()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown())
  }

  private wireBus() {
    this.bus.on('shop:open', () => {
      if (this.state === 'playing') {
        this.shopPausedRun = true
        this.state = 'paused'
      }
    })
    this.bus.on('shop:close', () => {
      if (this.shopPausedRun && this.state === 'paused') {
        this.state = 'playing'
        this.shopPausedRun = false
      }
    })
    this.bus.on('shop:purchase', (type) => this.buyStatUpgrade(type))
  }

  private teardown() {
    this.hudController?.destroy()
    this.shopController?.destroy()
    this.bus.destroy()
    this.hudController = undefined
    this.shopController = undefined
  }

  private showMenu() {
    this.state = 'menu'
    this.clearScreenPanel()
    this.hud.setText(`Best Score: ${this.highScore}`)
    this.drawHudPanel()
    this.publishHud()
    this.banner.setText('')
    this.helper.setText('')
    this.showScreenPanel({
      eyebrow: 'ARCADE SURVIVAL',
      title: 'Tank Game',
      subtitle: 'Clear waves, collect XP, build a stronger tank.',
      primary: 'Click or press R to deploy',
      rows: ['WASD / Arrow keys move', 'Mouse aims', 'Click / Space fires', 'Esc pauses'],
      accent: GAME_CONFIG.colors.xp,
    })
  }

  private showScreenPanel(options: {
    eyebrow: string
    title: string
    subtitle: string
    primary: string
    rows: string[]
    accent: number
  }) {
    this.clearScreenPanel()
    const panelWidth = 500
    const panelHeight = 292
    const x = GAME_CONFIG.width / 2
    const y = GAME_CONFIG.height / 2
    const left = x - panelWidth / 2
    const top = y - panelHeight / 2
    const accentHex = `#${options.accent.toString(16).padStart(6, '0')}`

    const shade = this.add.graphics().setDepth(61)
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

    const eyebrow = this.add.text(x, top + 38, options.eyebrow, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      color: accentHex,
      align: 'center',
    }).setOrigin(0.5).setDepth(62)
    const title = this.add.text(x, top + 79, options.title, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '42px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
    }).setOrigin(0.5).setDepth(62)
    const subtitle = this.add.text(x, top + 124, options.subtitle, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
    }).setOrigin(0.5).setDepth(62)
    const primary = this.add.text(x, top + 172, options.primary, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      color: '#0b0f0d',
      backgroundColor: accentHex,
      padding: { x: 16, y: 8 },
      align: 'center',
    }).setOrigin(0.5).setDepth(62)
    const rows = this.add.text(x, top + 230, options.rows.join('   |   '), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
      wordWrap: { width: 420 },
    }).setOrigin(0.5).setDepth(62)

    this.screenPanelObjects.push(shade, eyebrow, title, subtitle, primary, rows)
    shade.setAlpha(0)
    this.tweens.add({
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
    this.tweens.add({
      targets: panelTextObjects,
      alpha: 1,
      y: '-=12',
      duration: 190,
      ease: 'Cubic.easeOut',
    })
  }

  private clearScreenPanel() {
    for (const object of this.screenPanelObjects) {
      object.destroy()
    }
    this.screenPanelObjects = []
  }

  private togglePause() {
    if (this.state === 'playing') {
      this.pauseGame()
      return
    }

    if (this.state === 'paused') {
      this.resumeGame()
    }
  }

  private pauseGame() {
    this.state = 'paused'
    this.banner.setText('')
    this.helper.setText('')
    this.showScreenPanel({
      eyebrow: 'TACTICAL HOLD',
      title: 'Paused',
      subtitle: 'Action is frozen. Resume when ready.',
      primary: 'Esc or click to continue',
      rows: ['Press R to restart the run'],
      accent: GAME_CONFIG.colors.doubleGold,
    })
  }

  private resumeGame() {
    this.state = 'playing'
    this.clearScreenPanel()
    this.banner.setText('')
    this.helper.setText('')
  }

  private startGame() {
    this.audio.unlock()
    this.clearObjects()
    this.waveIndex = 0
    this.score = 0
    this.multiplier = 1
    this.isNewRecord = false
    this.waveSpawnAt = 0
    this.pendingWave = null
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.gold = loadGold()
    this.xp = 0
    this.level = 1
    this.nextLevelXp = 120
    this.pendingUpgradeReason = 'wave'
    this.upgradeLevels = this.createEmptyUpgradeLevels()
    this.statLevels = loadStatLevels()
    this.buffs = this.createDefaultBuffs()
    this.state = 'playing'
    this.clearScreenPanel()
    this.banner.setText('')
    this.helper.setText('')
    this.player = createTank(this, {
      kind: 'player',
      x: 130,
      y: 280,
      hullColor: GAME_CONFIG.colors.player,
      turretColor: GAME_CONFIG.colors.playerTurret,
      maxHealth: this.permanentMaxHealth(),
      speed: this.permanentMoveSpeed(),
      fireDelay: this.permanentFireDelay(),
      bulletSpeed: GAME_CONFIG.player.bulletSpeed,
      scoreValue: 0,
      damage: this.permanentDamage(),
      preferredRange: 0,
      accuracy: 0,
      separationRadius: 0,
    })
    this.startWave()
  }

  private startWave() {
    const wave = createWaveConfig(this.waveIndex)
    this.clearUpgradeObjects()
    this.mapTheme.apply(this.waveIndex, this.walls)
    this.mineSystem.clear()
    this.mineSystem.spawn(wave, this.walls, this.player)
    this.enemies = []
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.pendingWave = wave
    this.waveSpawnAt = this.time.now + 3000
    this.waveMessageUntil = this.waveSpawnAt + 1200
    this.banner.setText(`${isBossWave(wave.number) ? 'Boss wave' : `Wave ${wave.number}`} in 3`)
    this.helper.setText(isBossWave(wave.number) ? 'Destroy the commander' : 'Get ready')
    this.audio.wave()
  }

  private updateWavePreparation(time: number) {
    if (!this.pendingWave) {
      return
    }

    const remaining = Math.max(0, Math.ceil((this.waveSpawnAt - time) / 1000))
    if (remaining > 0) {
      const title = isBossWave(this.pendingWave.number) ? 'Boss wave' : `Wave ${this.pendingWave.number}`
      this.banner.setText(`${title} in ${remaining}`)
      return
    }

    const wave = this.pendingWave
    this.pendingWave = null
    this.waveSpawnAt = 0
    this.waveSpawnQueue = expandWaveQueue(wave)
    this.nextEnemySpawnAt = time
    this.banner.setText(isBossWave(wave.number) ? 'Boss wave' : `Wave ${wave.number}`)
    this.helper.setText('')
  }

  private updateWaveSpawns(time: number) {
    if (this.waveSpawnQueue.length === 0 || time < this.nextEnemySpawnAt) {
      return
    }

    const bossIndex = this.waveSpawnQueue.indexOf('boss')
    if (bossIndex >= 0) {
      const [type] = this.waveSpawnQueue.splice(bossIndex, 1)
      this.enemies.push(this.createEnemy(type, this.waveIndex + 1, this.enemies.length + this.waveSpawnQueue.length))
      this.nextEnemySpawnAt = time + 900
      return
    }

    const waveNumber = this.waveIndex + 1
    const pressure = Math.min(3, Math.floor(waveNumber / 7))
    const batchSize = Phaser.Math.Between(1 + Math.min(1, pressure), 2 + pressure)
    for (let index = 0; index < batchSize && this.waveSpawnQueue.length > 0; index += 1) {
      const [type] = this.waveSpawnQueue.splice(0, 1)
      this.enemies.push(this.createEnemy(type, this.waveIndex + 1, this.enemies.length + this.waveSpawnQueue.length))
    }

    const pace = Math.max(320, 1150 - this.waveIndex * 45)
    this.nextEnemySpawnAt = time + pace
  }

  private createEnemy(type: EnemyType, waveNumber: number, index: number) {
    const spawn = SPAWN_POINTS[(index + waveNumber) % SPAWN_POINTS.length]
    const stats = ENEMY_STATS[type]
    const clearSpawn = findClearSpawn(spawn[0], spawn[1], tankSizeForType(type), this.walls, this.player)
    const tier = type === 'boss' ? bossTier(waveNumber) : 0

    return createTank(this, {
      kind: 'enemy',
      enemyType: type,
      x: clearSpawn.x,
      y: clearSpawn.y,
      hullColor: stats.hullColor,
      turretColor: stats.turretColor,
      maxHealth: type === 'boss'
        ? stats.health + tier * 10
        : stats.health + Math.floor(this.waveIndex / 3),
      speed: type === 'boss'
        ? Math.min(stats.speed + tier * 3, 54)
        : stats.speed + Math.min(this.waveIndex * 2.2, 42),
      fireDelay: type === 'boss'
        ? Math.max(stats.fireDelay - tier * 70, 760)
        : Math.max(stats.fireDelay - this.waveIndex * 35, 760),
      bulletSpeed: type === 'boss'
        ? stats.bulletSpeed + tier * 18
        : stats.bulletSpeed + Math.min(this.waveIndex * 10, 140),
      scoreValue: type === 'boss' ? stats.scoreValue + tier * 250 : stats.scoreValue,
      damage: type === 'boss' && tier >= 3 ? stats.damage + 1 : stats.damage,
      preferredRange: stats.preferredRange,
      accuracy: stats.accuracy,
      separationRadius: stats.separationRadius,
    })
  }

  private movePlayer(delta: number, _time: number) {
    const direction = new Phaser.Math.Vector2(0, 0)

    if (this.cursors.left.isDown || this.keys.left.isDown) {
      direction.x -= 1
    }
    if (this.cursors.right.isDown || this.keys.right.isDown) {
      direction.x += 1
    }
    if (this.cursors.up.isDown || this.keys.up.isDown) {
      direction.y -= 1
    }
    if (this.cursors.down.isDown || this.keys.down.isDown) {
      direction.y += 1
    }

    if (direction.lengthSq() === 0) {
      return
    }

    direction.normalize()
    const distance = this.player.speed * (delta / 1000)

    moveTankAxis(this.player, direction.x * distance, 0, this.walls)
    moveTankAxis(this.player, 0, direction.y * distance, this.walls)
    this.player.hullAngle = direction.angle()
    syncTankVisuals(this.player)
  }

  private aimTankAtPointer(tank: Tank) {
    const pointer = this.input.activePointer
    tank.turretAngle = Phaser.Math.Angle.Between(tank.x, tank.y, pointer.worldX, pointer.worldY)
    syncTankVisuals(tank)
  }

  private updateEnemies(time: number, delta: number) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      if (enemy.enemyType === 'bomber' && distanceToPlayer < 54) {
        this.detonateBomber(index, time)
        continue
      }

      chooseEnemyMove(enemy, this.player, this.walls, time)
      this.moveEnemy(enemy, delta, time)
      enemy.turretAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      syncTankVisuals(enemy)

      const fireDelay = this.buffs.freezeUntil > time ? enemy.fireDelay * 2 : enemy.fireDelay
      if (time - enemy.lastFire > fireDelay && !lineBlocked(enemy, this.player, this.walls)) {
        if (enemy.enemyType === 'boss') {
          this.fireBossPattern(enemy, time)
        } else if (enemy.enemyType !== 'charger' && enemy.enemyType !== 'bomber') {
          this.fireBullet(enemy, false, time)
        }
      }
    }
  }

  private fireBossPattern(enemy: Tank, time: number) {
    const baseAngle = enemy.turretAngle
    const tier = bossTier(this.waveIndex + 1)
    const pattern = Math.floor(time / 2200) % (tier >= 3 ? 4 : 3)

    if (tier >= 2 && pattern === 1) {
      spawnBlastRing(this,enemy.x, enemy.y, 92, 0xffd166)
      const bulletCount = tier >= 4 ? 8 : 6
      for (let index = 0; index < bulletCount; index += 1) {
        this.fireBullet(enemy, false, time, baseAngle + (Math.PI * 2 * index) / bulletCount, 0, index === 0)
      }
      return
    }

    if (tier >= 3 && pattern === 2) {
      spawnBlastRing(this,enemy.x, enemy.y, 68, 0xff7b72)
      ;[-0.16, 0, 0.16].forEach((offset, index) => {
        this.fireBullet(enemy, false, time, baseAngle + offset, 18 * (index - 1), index === 0)
      })
      return
    }

    const angles = tier >= 4
      ? [-0.42, -0.21, 0, 0.21, 0.42]
      : tier >= 2
        ? [-0.3, 0, 0.3]
        : [-0.18, 0, 0.18]

    angles.forEach((offset, index) => {
      this.fireBullet(enemy, false, time, baseAngle + offset, 0, index === 0)
    })
  }

  private detonateBomber(index: number, time: number) {
    const enemy = this.enemies[index]
    if (!enemy) {
      return
    }

    spawnExplosion(this,enemy.x, enemy.y)
    spawnBlastRing(this,enemy.x, enemy.y, 82, 0xff8a3d)
    if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) <= 82) {
      this.damagePlayer(enemy.damage + Math.floor(this.waveIndex / 7), true, time)
    }
    enemy.hull.destroy()
    enemy.turret.destroy()
    enemy.healthBar?.destroy()
    this.enemies.splice(index, 1)
    this.audio.explosion()

    if (this.enemies.length === 0 && this.waveSpawnQueue.length === 0 && this.state === 'playing') {
      this.finishWave()
    }
  }

  private moveEnemy(enemy: Tank, delta: number, time: number) {
    const freezeMultiplier = this.buffs.freezeUntil > time ? 0.45 : 1
    const distance = enemy.speed * freezeMultiplier * (delta / 1000)
    const separation = enemySeparation(enemy, this.enemies)
    const avoidance = wallAvoidance(enemy, this.walls)
    const steeredAngle
      = findOpenMoveAngle(enemy, this.player, this.walls, distance, enemy.moveAngle) ?? enemy.moveAngle
    const moveX = (Math.cos(steeredAngle) + separation.x + avoidance.x) * distance
    const moveY = (Math.sin(steeredAngle) + separation.y + avoidance.y) * distance

    const movedX = moveTankAxis(enemy, moveX, 0, this.walls, this.player)
    const movedY = moveTankAxis(enemy, 0, moveY, this.walls, this.player)
    enemy.hullAngle = Phaser.Math.Angle.RotateTo(enemy.hullAngle, steeredAngle, delta * 0.006)
    syncTankVisuals(enemy)

    if (!movedX && !movedY) {
      enemy.moveAngle
        = findOpenMoveAngle(enemy, this.player, this.walls, distance, enemy.moveAngle + Math.PI / 2)
        ?? enemy.moveAngle + Math.PI
      enemy.rethinkAt = time + Phaser.Math.Between(300, 520)
      enemy.hullAngle = Phaser.Math.Angle.RotateTo(enemy.hullAngle, enemy.moveAngle, delta * 0.006)
      syncTankVisuals(enemy)
    }
  }

  private fireFromPlayer(time: number) {
    const fireDelay = this.buffs.overdriveUntil > time
      ? Math.max(68, this.player.fireDelay * 0.62)
      : this.player.fireDelay
    if (time - this.player.lastFire < fireDelay) {
      return
    }

    const baseAngle = this.player.turretAngle
    const angles = this.buffs.tripleShot > 0
      ? [baseAngle - 0.24, baseAngle, baseAngle + 0.24]
      : [baseAngle]
    const offsets = this.buffs.doubleShot > 0 ? [-6, 6] : [0]

    angles.forEach((angle) => {
      offsets.forEach((offset, offsetIndex) => {
        const roll = rollPlayerDamage(
          this.player.damage,
          (type) => this.upgradeLevel(type),
          this.statLevels,
          this.buffs,
          this.time.now,
        )
        this.fireBullet(this.player, true, time, angle, offset, angle === angles[0] && offsetIndex === 0, roll.damage, roll.critical)
      })
    })
  }

  private fireBullet(
    tank: Tank,
    fromPlayer: boolean,
    time: number,
    angleOverride?: number,
    lateralOffset = 0,
    playSound = true,
    damageOverride?: number,
    critical = false,
  ) {
    tank.lastFire = time

    const angle = angleOverride ?? (fromPlayer
      ? tank.turretAngle
      : tank.turretAngle + Phaser.Math.FloatBetween(-tank.accuracy, tank.accuracy))
    const muzzleX = tank.x + Math.cos(angle) * 34 + Math.cos(angle + Math.PI / 2) * lateralOffset
    const muzzleY = tank.y + Math.sin(angle) * 34 + Math.sin(angle + Math.PI / 2) * lateralOffset
    const bulletKey = fromPlayer ? 'bullet-player' : tank.enemyType === 'sniper' ? 'bullet-sniper' : 'bullet-enemy'
    const sprite = this.add.image(muzzleX, muzzleY, bulletKey)
      .setDisplaySize(critical ? 10 : 8, critical ? 22 : 18)
      .setDepth(4)
    if (critical) {
      sprite.setTint(0xf6d365)
    }
    sprite.rotation = angle + TANK_SPRITE_ROTATION_OFFSET
    const velocity = new Phaser.Math.Vector2(Math.cos(angle) * tank.bulletSpeed, Math.sin(angle) * tank.bulletSpeed)

    const piercingLevel = fromPlayer ? this.upgradeLevel('piercingShell') : 0
    const explosiveLevel = fromPlayer ? this.upgradeLevel('explosiveShell') : 0
    this.bullets.push({
      sprite,
      velocity,
      fromPlayer,
      age: 0,
      damage: damageOverride ?? tank.damage,
      critical,
      piercesShield: tank.enemyType === 'sniper',
      piercesLeft: piercingLevel,
      explosiveRadius: explosiveLevel > 0 ? 32 + explosiveLevel * 12 : 0,
    })
    spawnMuzzleFlash(this,muzzleX, muzzleY, angle)
    if (playSound) {
      this.audio.shot()
    }
  }

  private updateBullets(delta: number, time: number) {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index]
      bullet.age += delta
      bullet.sprite.x += bullet.velocity.x * (delta / 1000)
      bullet.sprite.y += bullet.velocity.y * (delta / 1000)

      if (this.shouldRemoveBullet(bullet)) {
        this.removeBullet(index)
        continue
      }

      if (bullet.fromPlayer) {
        const hitIndex = this.enemies.findIndex((enemy) => boundsOverlap(bullet.sprite.getBounds(), tankBounds(enemy)))
        if (hitIndex >= 0) {
          const primary = this.enemies[hitIndex]
          const hitX = primary.x
          const hitY = primary.y
          this.damageEnemy(hitIndex, bullet.damage, bullet.critical === true)
          if (bullet.explosiveRadius && bullet.explosiveRadius > 0) {
            this.applyShellExplosion(hitX, hitY, bullet.explosiveRadius, Math.max(1, Math.floor(bullet.damage * 0.45)), primary)
          }
          if ((bullet.piercesLeft ?? 0) > 0) {
            bullet.piercesLeft = (bullet.piercesLeft ?? 0) - 1
            continue
          }
          this.removeBullet(index)
        }
      } else if (boundsOverlap(bullet.sprite.getBounds(), tankBounds(this.player))) {
        this.damagePlayer(bullet.damage, bullet.piercesShield === true, time)
        this.removeBullet(index)
      }
    }
  }

  private damageEnemy(index: number, damage: number, critical = false) {
    const enemy = this.enemies[index]
    const shieldedDamage = enemy.enemyType === 'shield' && !critical
      ? Math.max(1, Math.floor(damage * 0.72))
      : damage
    const finalDamage = enemy.enemyType === 'boss'
      ? Math.max(1, Math.round(shieldedDamage * this.bossDamageMultiplier()))
      : shieldedDamage
    enemy.health -= finalDamage
    flashTank(this,enemy, 0xff9b72)
    spawnHitSpark(this,enemy.x, enemy.y)
    spawnDamageNumber(this,enemy.x, enemy.y - enemy.size / 2, finalDamage, critical)
    this.audio.hit()

    if (enemy.health > 0) {
      syncTankVisuals(enemy)
      return
    }

    spawnExplosion(this,enemy.x, enemy.y)
    this.cameras.main.shake(enemy.enemyType === 'boss' ? 160 : 45, enemy.enemyType === 'boss' ? 0.006 : 0.002)
    this.powerUpSystem.maybeDrop(enemy.x, enemy.y)
    this.pickupSystem.drop('xp', enemy.x, enemy.y, xpForEnemy(enemy, this.waveIndex, this.buffs, this.time.now))
    this.pickupSystem.drop(
      'gold',
      enemy.x + Phaser.Math.Between(-12, 12),
      enemy.y + Phaser.Math.Between(-12, 12),
      goldForEnemy(enemy, this.waveIndex, bossTier(this.waveIndex + 1), this.buffs, this.time.now),
    )
    enemy.hull.destroy()
    enemy.turret.destroy()
    enemy.healthBar?.destroy()
    this.enemies.splice(index, 1)
    this.score += enemy.scoreValue * (this.multiplier + this.buffs.scoreBonus)
    this.multiplier = Math.min(this.multiplier + 1, 9)
    this.audio.explosion()

    if (this.enemies.length === 0 && this.waveSpawnQueue.length === 0 && this.state === 'playing') {
      this.finishWave()
    }
  }

  private applyShellExplosion(x: number, y: number, radius: number, damage: number, primary?: Tank) {
    spawnBlastRing(this,x, y, radius, 0xf6d365)
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      if (enemy === primary) {
        continue
      }
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius) {
        this.damageEnemy(index, damage)
      }
    }
  }

  private gainXp(amount: number) {
    this.xp += amount
    this.pulseXpText()
    if (this.xp < this.nextLevelXp) {
      return
    }

    this.xp -= this.nextLevelXp
    this.level += 1
    this.nextLevelXp = xpRequiredForLevel(this.level)
    this.showUpgradeOptions('level')
  }

  private pulseXpText() {
    this.tweens.killTweensOf(this.xpText)
    this.xpText.setScale(1)
    this.tweens.add({
      targets: this.xpText,
      scale: 1.08,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  private damagePlayer(damage: number, _piercesShield: boolean, _time: number) {
    this.player.health -= damage
    this.multiplier = 1
    flashTank(this,this.player, 0xffffff)
    spawnHitSpark(this,this.player.x, this.player.y)
    this.cameras.main.shake(90, 0.006)
    this.audio.hit()

    if (this.player.health <= 0) {
      this.endMatch('lost')
    }
  }

  private applyPowerUp(type: PowerUpType) {
    const now = this.time.now
    if (type === 'nuke') {
      this.applyNuke()
    }
    if (type === 'magnet') {
      this.pickupSystem.magnetTo(this.player, (pickup) => this.collectPickup(pickup))
    }
    if (type === 'freeze') {
      this.buffs.freezeUntil = now + 5000
    }
    if (type === 'doubleGold') {
      this.buffs.doubleGoldUntil = now + 12000
    }
    if (type === 'doubleXp') {
      this.buffs.doubleXpUntil = now + 12000
    }
    if (type === 'repair') {
      const healAmount = Math.max(2, Math.ceil(this.player.maxHealth * 0.35))
      this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount)
    }
    if (type === 'overdrive') {
      this.buffs.overdriveUntil = now + 7000
    }
    spawnFloatingText(this, this.player.x, this.player.y - 30, powerUpName(type), powerUpColor(type))
    this.audio.wave()
  }

  private applyNuke() {
    this.cameras.main.shake(110, 0.005)
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      const damage = enemy.enemyType === 'boss'
        ? Math.max(10, Math.floor(enemy.maxHealth * 0.18))
        : Math.max(4, Math.floor(enemy.maxHealth * 0.45))
      this.damageEnemy(index, damage)
    }
  }

  private collectPickup(pickup: PickupDrop) {
    if (!pickup.sprite.active) {
      return
    }
    if (!this.pickupSystem.remove(pickup)) {
      return
    }

    if (pickup.type === 'xp') {
      this.gainXp(pickup.value)
      spawnFloatingText(this, pickup.sprite.x, pickup.sprite.y - 12, `+${pickup.value} XP`, GAME_CONFIG.colors.xp)
    } else {
      this.gold += pickup.value
      saveGold(this.gold)
      spawnFloatingText(this, pickup.sprite.x, pickup.sprite.y - 12, `+${pickup.value}g`, 0xf6d365)
    }
  }

  private updateMines(time: number) {
    this.mineSystem.update(this.player, (mine) => {
      spawnExplosion(this, mine.sprite.x, mine.sprite.y)
      this.damagePlayer(mine.damage, true, time)
    })
  }

  private finishWave() {
    this.applyArmorRegen()
    this.waveIndex += 1
    this.showUpgradeOptions('wave')
  }

  private applyArmorRegen() {
    if (!this.player || this.statLevels.armorRegen <= 0 || this.player.health >= this.player.maxHealth) {
      return
    }

    const healAmount = Math.min(this.statLevels.armorRegen, this.player.maxHealth - this.player.health)
    this.player.health += healAmount
    spawnFloatingText(this,this.player.x, this.player.y - 34, `+${healAmount} HP`, GAME_CONFIG.colors.repair)
  }

  private showUpgradeOptions(reason: 'wave' | 'level') {
    this.state = 'upgrade'
    this.pendingUpgradeReason = reason
    this.upgradeChoices = this.createUpgradeChoices()
    this.clearUpgradeObjects()
    this.clearScreenPanel()
    if (this.upgradeChoices.length === 0) {
      this.continueAfterUpgrade()
      return
    }

    const overlay = this.add.graphics().setDepth(60)
    overlay.fillStyle(0x050706, 0.7)
    overlay.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    overlay.fillStyle(0x0e1612, 0.78)
    overlay.fillRoundedRect(116, 50, 728, 78, 10)
    overlay.lineStyle(1, GAME_CONFIG.colors.xp, 0.34)
    overlay.strokeRoundedRect(116, 50, 728, 78, 10)
    overlay.fillStyle(GAME_CONFIG.colors.xp, 0.9)
    overlay.fillRect(136, 62, 4, 54)
    this.upgradeObjects.push(overlay)

    const eyebrow = reason === 'level' ? `LEVEL ${this.level} REACHED` : `WAVE ${this.waveIndex} CLEARED`
    const title = this.add.text(GAME_CONFIG.width / 2, 80, reason === 'level' ? 'Choose a Field Mod' : 'Supply Drop', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '32px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
    }).setOrigin(0.5).setDepth(70)
    const subtitle = this.add.text(GAME_CONFIG.width / 2, 112, `${eyebrow}  |  Press 1, 2, 3 or click`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
    }).setOrigin(0.5).setDepth(70)
    this.banner.setText('')
    this.helper.setText('')
    this.upgradeObjects.push(title, subtitle)

    this.upgradeChoices.forEach((choice, index) => {
      this.drawUpgradeCard(238 + index * 242, 320, choice, index)
    })
  }

  private drawUpgradeCard(x: number, y: number, choice: UpgradeOption, index: number) {
    const width = 222
    const height = 244
    const left = x - width / 2
    const top = y - height / 2
    const cardColor = rarityColor(choice.rarity)
    const rarityHex = `#${cardColor.toString(16).padStart(6, '0')}`
    const levelText = this.upgradeLevelText(choice.type, true)
    const card = this.add.graphics().setDepth(66)
    const paintCard = (hovered = false) => {
      card.clear()
      card.fillStyle(0x000000, hovered ? 0.34 : 0.22)
      card.fillRoundedRect(left - 5, top + 6, width + 10, height + 12, 10)
      card.fillStyle(0x070908, 0.99)
      card.fillRoundedRect(left, top, width, height, 8)
      card.fillStyle(hovered ? 0x17251f : 0x101815, 1)
      card.fillRoundedRect(left + 8, top + 8, width - 16, height - 16, 5)
      card.fillStyle(cardColor, hovered ? 0.32 : 0.2)
      card.fillRoundedRect(left + 14, top + 14, width - 28, 96, 4)
      card.fillStyle(0x050706, 0.52)
      card.fillRoundedRect(left + 24, top + 26, width - 48, 72, 5)
      card.fillStyle(cardColor, 1)
      card.fillRoundedRect(left + 12, top + 18, 4, height - 36, 2)
      card.fillRoundedRect(left + width - 16, top + 18, 4, height - 36, 2)
      card.fillRect(left + 24, top + 18, width - 48, 3)
      card.fillStyle(0xffffff, hovered ? 0.08 : 0.04)
      card.fillTriangle(left + 16, top + 16, left + width - 18, top + 16, left + width - 54, top + 82)
      card.lineStyle(2, cardColor, hovered ? 1 : 0.88)
      card.strokeRoundedRect(left, top, width, height, 8)
      card.lineStyle(1, 0xffffff, hovered ? 0.2 : 0.13)
      card.strokeRoundedRect(left + 8, top + 8, width - 16, height - 16, 5)
      card.lineStyle(1, 0xffffff, 0.09)
      card.lineBetween(left + 22, top + 122, left + width - 22, top + 122)
      card.lineStyle(2, cardColor, hovered ? 0.82 : 0.5)
      card.lineBetween(left + 20, top + height - 18, left + width - 20, top + height - 18)
    }
    paintCard()
    const hover = this.add.graphics().setDepth(67)
    hover.lineStyle(3, 0xffffff, 0.72)
    hover.strokeRoundedRect(left - 4, top - 4, width + 8, height + 8, 9)
    hover.setAlpha(0)

    const badge = this.add.rectangle(left + 32, top + 34, 36, 28, cardColor, 1).setDepth(68)
    const number = this.add.text(left + 30, top + 32, `${index + 1}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      color: '#0b0f0d',
    }).setOrigin(0.5).setDepth(69)
    number.setPosition(left + 32, top + 34)
    const rarity = this.add.text(left + width - 22, top + 30, choice.rarity.toUpperCase(), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '11px',
      color: rarityHex,
      align: 'right',
    }).setOrigin(1, 0.5).setDepth(69)
    const levelBadge = this.add.text(left + width - 22, top + 55, levelText, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      color: GAME_CONFIG.colors.text,
      align: 'right',
      backgroundColor: '#070908',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5).setDepth(69)
    const category = this.add.text(x, top + 132, upgradeCategory(choice.type), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '11px',
      color: rarityHex,
      align: 'center',
    }).setOrigin(0.5).setDepth(69)
    const title = this.add.text(x, top + 158, choice.title, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '18px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
      wordWrap: { width: 170 },
    }).setOrigin(0.5).setDepth(69)
    const description = this.add.text(x, top + 198, choice.description, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: 166 },
    }).setOrigin(0.5).setDepth(69)
    const chip = this.add.text(x, top + height - 26, `${upgradeImpact(choice.type)}  ${levelText}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      color: '#0b0f0d',
      backgroundColor: rarityHex,
      padding: { x: 8, y: 4 },
      align: 'center',
    }).setOrigin(0.5).setDepth(69)
    const iconObjects = this.drawUpgradeIcon(x, top + 70, choice.type, cardColor)
    const progressObjects = this.drawUpgradeProgressPips(x, top + 111, choice.type, cardColor, true)
    const hitZone = this.add.zone(x, y, width, height).setDepth(80)
    hitZone.setInteractive({ useHandCursor: true })
    hitZone.on('pointerover', () => {
      hover.setAlpha(0.72)
      paintCard(true)
    })
    hitZone.on('pointerout', () => {
      hover.setAlpha(0)
      paintCard()
    })

    this.upgradeCardBounds[index] = new Phaser.Geom.Rectangle(left, top, width, height)
    this.upgradeObjects.push(card, hover, badge, number, rarity, levelBadge, category, title, description, chip, hitZone, ...iconObjects, ...progressObjects)

    const animatedObjects = [card, badge, number, rarity, levelBadge, category, title, description, chip, ...iconObjects, ...progressObjects] as Array<
      Phaser.GameObjects.GameObject & { setAlpha(value: number): unknown; y: number }
    >
    animatedObjects.forEach((object) => {
      object.setAlpha(0)
      object.y += 14
    })
    hover.y += 14
    hitZone.y += 14
    this.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      y: '-=14',
      delay: index * 70,
      duration: 220,
      ease: 'Cubic.easeOut',
    })
    this.tweens.add({
      targets: [hover, hitZone],
      y: '-=14',
      delay: index * 70,
      duration: 220,
      ease: 'Cubic.easeOut',
    })
  }

  private drawUpgradeIcon(x: number, y: number, type: UpgradeType, color: number) {
    const objects: Phaser.GameObjects.GameObject[] = []
    const frame = this.add.graphics().setDepth(68)
    frame.fillStyle(0x050706, 0.62)
    frame.fillRoundedRect(x - 41, y - 35, 82, 70, 6)
    frame.lineStyle(1, color, 0.55)
    frame.strokeRoundedRect(x - 41, y - 35, 82, 70, 6)
    frame.fillStyle(color, 0.16)
    frame.fillCircle(x, y, 28)
    objects.push(frame)

    const addIconImage = (key: string, offsetX = 0, offsetY = 0, size = 48, rotation = 0) => {
      const image = this.add.image(x + offsetX, y + offsetY, key)
        .setDisplaySize(size, size)
        .setDepth(69)
        .setRotation(rotation)
      objects.push(image)
      return image
    }

    if (type === 'armor') {
      addIconImage('decor-barricade-metal', 0, 0, 52)
    } else if (type === 'damage') {
      addIconImage('bullet-player', -8, 0, 48, TANK_SPRITE_ROTATION_OFFSET)
      addIconImage('muzzle-flash', 17, 0, 28, 0.35)
    } else if (type === 'fireRate') {
      addIconImage('muzzle-flash', -14, 0, 30, -0.2)
      addIconImage('muzzle-flash', 14, 0, 30, 0.2)
    } else if (type === 'moveSpeed') {
      addIconImage('tank-scout-body', 0, 0, 52, TANK_SPRITE_ROTATION_OFFSET)
    } else if (type === 'bulletSpeed') {
      addIconImage('bullet-player', 0, 0, 54, TANK_SPRITE_ROTATION_OFFSET)
    } else if (type === 'scoreBonus') {
      addIconImage('decor-crate-metal', 0, 0, 50)
    } else if (type === 'doubleShot') {
      addIconImage('bullet-player', -10, -8, 38, TANK_SPRITE_ROTATION_OFFSET)
      addIconImage('bullet-player', 12, 8, 38, TANK_SPRITE_ROTATION_OFFSET)
    } else if (type === 'tripleShot') {
      addIconImage('bullet-player', -17, 9, 34, TANK_SPRITE_ROTATION_OFFSET - 0.45)
      addIconImage('bullet-player', 0, -2, 36, TANK_SPRITE_ROTATION_OFFSET)
      addIconImage('bullet-player', 17, 9, 34, TANK_SPRITE_ROTATION_OFFSET + 0.45)
    } else if (type === 'piercingShell') {
      addIconImage('bullet-player', -11, 0, 44, TANK_SPRITE_ROTATION_OFFSET)
      addIconImage('bullet-player', 13, 0, 34, TANK_SPRITE_ROTATION_OFFSET)
    } else if (type === 'explosiveShell') {
      addIconImage('muzzle-flash', 0, 0, 54, 0.2)
      addIconImage('bullet-player', -3, -2, 32, TANK_SPRITE_ROTATION_OFFSET)
    } else if (type === 'pickupRadius') {
      addIconImage('decor-crate-wood', 0, 0, 40)
      addIconImage('tile-grass', 18, -16, 24)
    } else if (type === 'bossDamage') {
      addIconImage('tank-heavy-body', 0, 0, 52, TANK_SPRITE_ROTATION_OFFSET)
      addIconImage('muzzle-flash', 18, -16, 26)
    } else if (type === 'critChance' || type === 'critDamage') {
      addIconImage('muzzle-flash', 0, 0, 42, 0)
    } else {
      addIconImage('tile-grass', 0, 0, 52)
    }

    const textLabel = type === 'xpBoost'
      ? 'XP'
      : type === 'pickupRadius'
        ? 'R'
      : type === 'critChance'
        ? 'CR'
        : type === 'critDamage'
          ? 'CD'
          : type === 'bossDamage'
            ? 'B'
          : ''
    const label = textLabel
      ? this.add.text(x, y + 1, textLabel, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '17px',
        color: '#0b0f0d',
      }).setOrigin(0.5).setDepth(70)
      : undefined

    if (label) {
      objects.push(label)
    }
    return objects
  }

  private drawUpgradeProgressPips(x: number, y: number, type: UpgradeType, color: number, next = false) {
    const objects: Phaser.GameObjects.GameObject[] = []
    const cap = this.upgradeCap(type)
    const level = Math.min(this.upgradeLevel(type) + (next ? 1 : 0), cap)
    const pipCount = Math.min(cap, 8)
    const pipWidth = 10
    const gap = 4
    const totalWidth = pipCount * pipWidth + (pipCount - 1) * gap
    const startX = x - totalWidth / 2

    for (let index = 0; index < pipCount; index += 1) {
      const pip = this.add.rectangle(
        startX + index * (pipWidth + gap) + pipWidth / 2,
        y,
        pipWidth,
        4,
        index < level ? color : 0x314039,
        index < level ? 1 : 0.75,
      ).setDepth(69)
      objects.push(pip)
    }

    return objects
  }

  private createUpgradeChoices() {
    const scoreAllowed = Math.random() < 0.18
    const pool = UPGRADE_OPTIONS.filter((option) => {
      if (this.isUpgradeMaxed(option.type)) {
        return false
      }
      if (option.type === 'scoreBonus' && !scoreAllowed) {
        return false
      }
      return true
    })
    const shuffled = Phaser.Utils.Array.Shuffle([...pool])
    return shuffled.slice(0, 3)
  }

  private handleUpgradeHotkeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
      this.applyUpgradeByIndex(0)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
      this.applyUpgradeByIndex(1)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
      this.applyUpgradeByIndex(2)
    }
  }

  private chooseUpgradeAt(x: number, y: number) {
    for (let index = 0; index < this.upgradeCardBounds.length; index += 1) {
      const bounds = this.upgradeCardBounds[index]
      if (Phaser.Geom.Rectangle.Contains(bounds, x, y)) {
        this.applyUpgradeByIndex(index)
      }
    }
  }

  private applyUpgradeByIndex(index: number) {
    const choice = this.upgradeChoices[index]
    if (!choice || this.isUpgradeMaxed(choice.type)) {
      return
    }

    this.upgradeLevels[choice.type] += 1
    if (choice.type === 'armor') {
      this.player.maxHealth += 1
      this.player.health = Math.min(this.player.health + 1, this.player.maxHealth)
    }
    if (choice.type === 'damage') {
      this.player.damage += 1
    }
    if (choice.type === 'fireRate') {
      this.player.fireDelay = Math.max(this.player.fireDelay - 24, 118)
    }
    if (choice.type === 'moveSpeed') {
      this.player.speed += 18
    }
    if (choice.type === 'bulletSpeed') {
      this.player.bulletSpeed += 48
    }
    if (choice.type === 'scoreBonus') {
      this.buffs.scoreBonus += 1
    }
    if (choice.type === 'doubleShot') {
      this.buffs.doubleShot = 1
    }
    if (choice.type === 'tripleShot') {
      this.buffs.tripleShot = 1
    }
    if (choice.type === 'xpBoost') {
      this.buffs.xpBonus += 1
    }

    this.continueAfterUpgrade()
  }

  private continueAfterUpgrade() {
    this.clearUpgradeObjects()
    this.state = 'playing'
    this.banner.setText('')
    this.helper.setText('')
    if (this.pendingUpgradeReason === 'wave') {
      this.startWave()
      return
    }

    if (this.enemies.length === 0) {
      this.finishWave()
    }
  }

  private endMatch(nextState: 'won' | 'lost') {
    this.state = nextState
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.isNewRecord = true
      saveHighScore(this.highScore)
    }
    this.banner.setText('')
    this.helper.setText('')
    this.showScreenPanel({
      eyebrow: nextState === 'won' ? 'MISSION COMPLETE' : 'RUN ENDED',
      title: nextState === 'won' ? 'Sector Clear' : 'Mission Failed',
      subtitle: `Final score ${this.score}  |  Best ${this.highScore}${this.isNewRecord ? '  |  New record' : ''}`,
      primary: 'Click or press R to restart',
      rows: [`Level ${this.level}`, `Map ${this.mapTheme.name}`, `Multiplier x${this.multiplier + this.buffs.scoreBonus}`],
      accent: nextState === 'won' ? GAME_CONFIG.colors.xp : GAME_CONFIG.colors.enemy,
    })

    if (nextState === 'lost') {
      this.audio.fail()
    } else {
      this.audio.wave()
    }
  }

  private shouldRemoveBullet(bullet: Bullet) {
    const outOfBounds = bullet.sprite.x < 0
      || bullet.sprite.x > GAME_CONFIG.width
      || bullet.sprite.y < 0
      || bullet.sprite.y > GAME_CONFIG.height

    return outOfBounds || bullet.age > GAME_CONFIG.bulletLife || hitsWall(bullet.sprite, this.walls)
  }

  private removeBullet(index: number) {
    this.bullets[index].sprite.destroy()
    this.bullets.splice(index, 1)
  }

  private updateHud(time: number) {
    const waveNumber = this.pendingWave?.number ?? this.waveIndex + 1
    const bonusMultiplier = this.multiplier + this.buffs.scoreBonus
    const mods = this.activeHudMods(time)
    const hudLines = [
      `SCORE ${this.score.toLocaleString('en-US')}`,
      `HP ${Math.max(this.player.health, 0)}/${this.player.maxHealth}  WAVE ${waveNumber}`,
      `LV ${this.level}  x${bonusMultiplier}`,
      ...(mods.length > 0 ? ['LOADOUT', ...mods.map((mod) => mod.text)] : []),
    ]
    this.hud.setText(hudLines)
    this.publishHud()

    if (this.waveMessageUntil > time) {
      return
    }

    if (this.state === 'playing') {
      this.banner.setText('')
    }
  }

  private drawHudPanel(
    lineCount = 2,
    mods: HudMod[] = [],
  ) {
    const width = 166
    const height = Phaser.Math.Clamp(20 + lineCount * 13, 50, 166)
    this.hudPanel.clear()
    this.hudPanel.fillStyle(0x050706, 0.42)
    this.hudPanel.fillRoundedRect(7, 17, width, height, 6)
    this.hudPanel.fillStyle(0x17231e, 0.28)
    this.hudPanel.fillRoundedRect(12, 22, width - 10, 28, 4)
    this.hudPanel.lineStyle(1, 0xffffff, 0.1)
    this.hudPanel.strokeRoundedRect(7, 17, width, height, 5)
    this.hudPanel.lineStyle(2, GAME_CONFIG.colors.xp, 0.64)
    this.hudPanel.lineBetween(12, 24, 12, 17 + height - 7)

    mods.forEach((mod, index) => {
      const lineIndex = 4 + index
      const rowY = 18 + lineIndex * 13
      this.hudPanel.fillStyle(0x0f1714, 0.68)
      this.hudPanel.fillRoundedRect(18, rowY + 1, width - 26, 11, 3)
      this.hudPanel.fillStyle(mod.temporary ? 0xf6d365 : GAME_CONFIG.colors.xp, mod.temporary ? 0.95 : 0.75)
      this.hudPanel.fillRoundedRect(21, rowY + 4, 5, 5, 2)

      if (!mod.type) {
        return
      }

      const cap = this.upgradeCap(mod.type)
      const level = this.upgradeLevel(mod.type)
      const pipCount = Math.min(cap, 6)
      const filledPips = Math.ceil((level / cap) * pipCount)
      for (let pip = 0; pip < pipCount; pip += 1) {
        this.hudPanel.fillStyle(
          pip < filledPips ? GAME_CONFIG.colors.xp : 0x2d3833,
          pip < filledPips ? 0.95 : 0.85,
        )
        this.hudPanel.fillRoundedRect(width - 42 + pip * 6, rowY + 5, 4, 4, 1)
      }
    })
  }

  private activeHudMods(time: number): HudMod[] {
    const mods: HudMod[] = []
    if (this.buffs.doubleGoldUntil > time) {
      mods.push({ text: `2X GOLD ${this.remainingBuffTime(this.buffs.doubleGoldUntil, time)}`, temporary: true })
    }
    if (this.buffs.doubleXpUntil > time) {
      mods.push({ text: `2X XP ${this.remainingBuffTime(this.buffs.doubleXpUntil, time)}`, temporary: true })
    }
    if (this.buffs.freezeUntil > time) {
      mods.push({ text: `FREEZE ${this.remainingBuffTime(this.buffs.freezeUntil, time)}`, temporary: true })
    }
    if (this.buffs.overdriveUntil > time) {
      mods.push({ text: `OVERDRIVE ${this.remainingBuffTime(this.buffs.overdriveUntil, time)}`, temporary: true })
    }
    HUD_UPGRADE_LABELS.forEach(([type, label]) => {
      const level = this.upgradeLevel(type)
      if (level <= 0) {
        return
      }
      const cap = this.upgradeCap(type)
      const pipTotal = Math.min(cap, 6)
      const pipFilled = Math.ceil((level / cap) * pipTotal)
      mods.push({
        text: `${label} ${this.upgradeLevelText(type)}`,
        type,
        isMaxed: this.isUpgradeMaxed(type),
        pips: { filled: pipFilled, total: pipTotal },
      })
    })
    return mods
  }

  private remainingBuffTime(until: number, time: number) {
    const seconds = Math.max(1, Math.ceil((until - time) / 1000))
    if (seconds < 60) {
      return `${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
  }

  private buyStatUpgrade(type: StatUpgradeType) {
    const config = STAT_UPGRADES[type]
    const cost = statUpgradeCost(type, this.statLevels[type])
    if (this.gold < cost) {
      if (this.player) {
        spawnFloatingText(this,this.player.x, this.player.y - 36, 'Need gold', 0xff6b6b)
      }
      return
    }

    this.gold -= cost
    this.statLevels[type] += 1
    saveGold(this.gold)
    saveStatLevels(this.statLevels)

    if (this.player && type === 'maxHealth') {
      this.player.maxHealth += 1
      this.player.health += 1
    }
    if (this.player && type === 'damage') {
      this.player.damage += 1
    }
    if (this.player && type === 'fireRate') {
      this.player.fireDelay = this.permanentFireDelay()
    }
    if (this.player && type === 'moveSpeed') {
      this.player.speed = this.permanentMoveSpeed()
    }
    if (this.player && type === 'armorRegen') {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 1)
    }
    if (this.player) {
      spawnFloatingText(this,this.player.x, this.player.y - 36, `${config.title} +1`, 0xf6d365)
    }
    this.publishHud()
  }

  private publishHud() {
    const mods = this.activeHudMods(this.time.now)
    const waveNumber = this.pendingWave?.number ?? this.waveIndex + 1
    const health = this.player ? Math.max(this.player.health, 0) : GAME_CONFIG.player.maxHealth
    const maxHealth = this.player ? this.player.maxHealth : GAME_CONFIG.player.maxHealth

    const hudSnapshot: HudSnapshot = {
      score: this.score,
      highScore: this.highScore,
      hp: health,
      maxHp: maxHealth,
      xp: this.xp,
      nextLevelXp: this.nextLevelXp,
      level: this.level,
      wave: waveNumber,
      multiplier: this.multiplier + this.buffs.scoreBonus,
      zone: this.mapTheme.name,
      gold: this.gold,
      mods,
    }
    this.bus.emit('hud:snapshot', hudSnapshot)

    const shopSnapshot: ShopSnapshot = {
      gold: this.gold,
      statLevels: this.statLevels,
    }
    this.bus.emit('shop:snapshot', shopSnapshot)
  }

  private clearObjects() {
    for (const bullet of this.bullets) {
      bullet.sprite.destroy()
    }
    for (const enemy of this.enemies) {
      enemy.hull.destroy()
      enemy.turret.destroy()
      enemy.healthBar?.destroy()
    }
    this.powerUpSystem?.clear()
    this.pickupSystem?.clear()
    this.mineSystem?.clear()
    if (this.player) {
      this.player.hull.destroy()
      this.player.turret.destroy()
    }

    this.clearUpgradeObjects()
    this.clearScreenPanel()
    this.bullets = []
    this.enemies = []
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.pendingWave = null
    this.waveSpawnAt = 0
  }

  private clearUpgradeObjects() {
    for (const object of this.upgradeObjects) {
      object.destroy()
    }
    this.upgradeObjects = []
    this.upgradeCardBounds = []
  }

}
