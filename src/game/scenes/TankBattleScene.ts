import Phaser from 'phaser'
import { ENEMY_STATS, GAME_CONFIG } from '../config'
import { HUD_UPGRADE_LABELS, UPGRADE_CAPS } from '../upgrade-meta'
import {
  flashTank,
  spawnBlastRing,
  spawnDamageNumber,
  spawnExplosion,
  spawnFloatingText,
  spawnHitSpark,
} from '../effects'
import {
  CLASS_ORDER,
  TANK_CLASSES,
  defaultActiveClassId,
  isClassUnlockedByWave,
  type TankClass,
  type TankClassId,
} from '../classes'
import { GameEventBus, type HudMod, type HudSnapshot, type ShopSnapshot } from '../events'
import {
  defaultSkinFor,
  findSkin,
  type SkinId,
  type TankSkin,
} from '../skins'
import { MapThemeRenderer } from '../map-theme'
import { MineSystem } from '../systems/MineSystem'
import {
  PickupSystem,
  goldForEnemy,
  xpForEnemy,
  xpRequiredForLevel,
} from '../systems/PickupSystem'
import { PowerUpSystem, powerUpColor, powerUpName } from '../systems/PowerUpSystem'
import { BulletSystem } from '../systems/BulletSystem'
import { effectiveDamageOnEnemy, rollPlayerDamage } from '../systems/Combat'
import { createGameKeys, readMovementDirection, type GameKeys } from '../systems/PlayerInput'
import {
  chooseEnemyMove,
  enemySeparation,
  findOpenMoveAngle,
  wallAvoidance,
} from '../systems/EnemyAI'
import { bossTier, createWaveConfig, expandWaveQueue, isBossWave } from '../systems/WaveSystem'
import { findClearSpawn, lineBlocked, moveTankAxis } from '../tank/collision'
import { createTank, syncTankVisuals, tankSizeForType } from '../tank/factory'
import {
  loadActiveClass,
  loadActiveSkins,
  loadGold,
  loadHighScore,
  loadOwnedClasses,
  loadOwnedSkins,
  loadPeakWave,
  loadStatLevels,
  saveActiveClass,
  saveActiveSkins,
  saveGold,
  saveHighScore,
  saveOwnedClasses,
  saveOwnedSkins,
  savePeakWave,
  saveStatLevels,
} from '../persistence'
import { STAT_UPGRADES, createEmptyStatLevels, statUpgradeCost } from '../stats'
import { GameAudio } from '../systems/audio'
import type {
  BossStyle,
  EnemyType,
  GameState,
  PlayerBuffs,
  PickupDrop,
  PowerUpType,
  StatUpgradeType,
  Tank,
  UpgradeType,
  WaveConfig,
} from '../types'
import { HudController } from '../ui/HudController'
import { ScreenPanelRenderer } from '../ui/ScreenPanelRenderer'
import { ShopController } from '../ui/ShopController'
import { UpgradeRenderer } from '../ui/UpgradeRenderer'

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

const BOSS_PROFILES = [
  { style: 'vanguard', title: 'VANGUARD', hullColor: 0x7a2f45, turretColor: 0xffd166, accent: 0xffd166 },
  { style: 'artillery', title: 'ARTILLERY', hullColor: 0x304f80, turretColor: 0x8fd0ff, accent: 0x8fd0ff },
  { style: 'swarm', title: 'SWARM CHIEF', hullColor: 0x4e3a86, turretColor: 0xd6b3ff, accent: 0xd6b3ff },
  { style: 'warden', title: 'WARDEN', hullColor: 0x33674b, turretColor: 0x9ff0b5, accent: 0x9ff0b5 },
  { style: 'blitz', title: 'BLITZ CORE', hullColor: 0x7a4a2c, turretColor: 0xffa35f, accent: 0xffa35f },
] as const

function bossProfileForTier(tier: number) {
  return BOSS_PROFILES[(tier - 1) % BOSS_PROFILES.length]
}

function bossProfileForStyle(style?: BossStyle) {
  return BOSS_PROFILES.find((profile) => profile.style === style) ?? BOSS_PROFILES[0]
}

export class TankBattleScene extends Phaser.Scene {
  private audio = new GameAudio()
  private state: GameState = 'menu'
  private player!: Tank
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: GameKeys
  private bulletSystem!: BulletSystem
  private enemies: Tank[] = []
  private powerUpSystem!: PowerUpSystem
  private pickupSystem!: PickupSystem
  private mineSystem!: MineSystem
  private walls: Phaser.GameObjects.Rectangle[] = []
  private mapTheme!: MapThemeRenderer
  private upgradeRenderer!: UpgradeRenderer
  private screenPanel!: ScreenPanelRenderer
  private bus = new GameEventBus()
  private hudController?: HudController
  private shopController?: ShopController
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
  private ownedClasses: TankClassId[] = [defaultActiveClassId()]
  private activeClassId: TankClassId = defaultActiveClassId()
  private ownedSkins: Record<TankClassId, SkinId[]> = {} as Record<TankClassId, SkinId[]>
  private activeSkins: Record<TankClassId, SkinId> = {} as Record<TankClassId, SkinId>
  private peakWave = 0

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

  private activeClass(): TankClass {
    return TANK_CLASSES[this.activeClassId]
  }

  private activeSkin(): TankSkin {
    const skinId = this.activeSkins[this.activeClassId] ?? defaultSkinFor(this.activeClassId)
    return findSkin(skinId) ?? findSkin(defaultSkinFor(this.activeClassId))!
  }

  private permanentMaxHealth() {
    return this.activeClass().baseStats.maxHealth + this.statLevels.maxHealth
  }

  private permanentDamage() {
    return this.activeClass().baseStats.damage + this.statLevels.damage
  }

  private permanentFireDelay() {
    return Math.max(80, this.activeClass().baseStats.fireDelay - this.statLevels.fireRate * 12)
  }

  private permanentMoveSpeed() {
    return this.activeClass().baseStats.speed + this.statLevels.moveSpeed * 10
  }

  private permanentBulletSpeed() {
    return this.activeClass().baseStats.bulletSpeed
  }

  private pickupCollectRadius() {
    const classBonus = this.activeClass().ability.pickupRadiusBonus ?? 0
    return (
      this.player.size / 2
      + 52
      + classBonus
      + this.upgradeLevel('pickupRadius') * 18
      + this.statLevels.pickupRadius * 12
    )
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
    this.peakWave = loadPeakWave()
    this.ownedClasses = loadOwnedClasses()
    this.activeClassId = loadActiveClass(this.ownedClasses)
    this.ownedSkins = loadOwnedSkins()
    this.activeSkins = loadActiveSkins(this.ownedSkins)
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
    this.bulletSystem?.clear()
    this.enemies = []
    this.powerUpSystem?.clear()
    this.pickupSystem?.clear()
    this.mineSystem?.clear()
    this.upgradeRenderer?.clear()
    this.screenPanel?.clear()
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
    this.screenPanel = new ScreenPanelRenderer(this)
    this.upgradeRenderer = new UpgradeRenderer(this)
    this.bulletSystem = new BulletSystem(this, this.audio, (type) => this.upgradeLevel(type))
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
    this.keys = createGameKeys(this)

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
    this.banner = this.add.text(GAME_CONFIG.width / 2, 176, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '40px',
      color: GAME_CONFIG.colors.text,
      align: 'center',
    }).setOrigin(0.5).setDepth(50)

    this.helper = this.add.text(GAME_CONFIG.width / 2, 246, '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '17px',
      color: GAME_CONFIG.colors.muted,
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(50)

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
    this.bus.on('class:purchase', (id) => this.buyClass(id))
    this.bus.on('class:select', (id) => this.selectClass(id))
    this.bus.on('skin:purchase', (sel) => this.buySkin(sel.classId, sel.skinId))
    this.bus.on('skin:select', (sel) => this.selectSkin(sel.classId, sel.skinId))
  }

  private buyClass(id: TankClassId) {
    if (this.ownedClasses.includes(id)) return
    const cls = TANK_CLASSES[id]
    if (this.gold < cls.unlock.goldCost) {
      if (this.player) {
        spawnFloatingText(this, this.player.x, this.player.y - 36, 'Need gold', 0xff6b6b)
      }
      return
    }
    this.gold -= cls.unlock.goldCost
    this.ownedClasses.push(id)
    saveGold(this.gold)
    saveOwnedClasses(this.ownedClasses)
    if (this.player) {
      spawnFloatingText(this, this.player.x, this.player.y - 36, `${cls.name} unlocked`, 0xf6d365)
    }
    this.publishHud()
  }

  private selectClass(id: TankClassId) {
    if (!this.ownedClasses.includes(id) || this.activeClassId === id) return
    this.activeClassId = id
    saveActiveClass(id)
    if (this.player) {
      spawnFloatingText(this, this.player.x, this.player.y - 36, `${TANK_CLASSES[id].name} ready`, 0x74eeb5)
    }
    this.publishHud()
  }

  private buySkin(classId: TankClassId, skinId: SkinId) {
    const skin = findSkin(skinId)
    if (!skin || skin.classId !== classId) return
    if (this.ownedSkins[classId]?.includes(skinId)) return
    if (this.gold < skin.goldCost) {
      if (this.player) {
        spawnFloatingText(this, this.player.x, this.player.y - 36, 'Need gold', 0xff6b6b)
      }
      return
    }
    this.gold -= skin.goldCost
    if (!this.ownedSkins[classId]) this.ownedSkins[classId] = []
    this.ownedSkins[classId].push(skinId)
    saveGold(this.gold)
    saveOwnedSkins(this.ownedSkins)
    if (this.player) {
      spawnFloatingText(this, this.player.x, this.player.y - 36, `${skin.name} acquired`, 0xf6d365)
    }
    this.publishHud()
  }

  private selectSkin(classId: TankClassId, skinId: SkinId) {
    if (!this.ownedSkins[classId]?.includes(skinId)) return
    this.activeSkins[classId] = skinId
    saveActiveSkins(this.activeSkins)
    if (this.player) {
      spawnFloatingText(this, this.player.x, this.player.y - 30, 'Skin applied', 0x74eeb5)
    }
    this.publishHud()
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
    this.screenPanel.clear()
    this.publishHud()
    this.banner.setText('')
    this.helper.setText('')
    this.screenPanel.show({
      eyebrow: 'ARCADE SURVIVAL',
      title: 'Tank Game',
      subtitle: 'Clear waves, collect XP, build a stronger tank.',
      primary: 'Click or press R to deploy',
      rows: ['WASD / Arrow keys move', 'Mouse aims', 'Click / Space fires', 'Esc pauses'],
      accent: GAME_CONFIG.colors.xp,
    })
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
    this.screenPanel.show({
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
    this.screenPanel.clear()
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
    this.screenPanel.clear()
    this.banner.setText('')
    this.helper.setText('')
    const cls = this.activeClass()
    const skin = this.activeSkin()
    this.player = createTank(this, {
      kind: 'player',
      x: 130,
      y: 280,
      hullColor: skin.hullTint,
      turretColor: skin.turretTint,
      maxHealth: this.permanentMaxHealth(),
      speed: this.permanentMoveSpeed(),
      fireDelay: this.permanentFireDelay(),
      bulletSpeed: this.permanentBulletSpeed(),
      scoreValue: 0,
      damage: this.permanentDamage(),
      preferredRange: 0,
      accuracy: 0,
      separationRadius: 0,
      bodyAssetOverride: cls.bodyAsset,
      barrelAssetOverride: cls.barrelAsset,
    })
    this.startWave()
  }

  private startWave() {
    const wave = createWaveConfig(this.waveIndex)
    this.upgradeRenderer.clear()
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
    const bossProfile = type === 'boss' ? bossProfileForTier(tier) : undefined

    const enemy = createTank(this, {
      kind: 'enemy',
      enemyType: type,
      x: clearSpawn.x,
      y: clearSpawn.y,
      hullColor: bossProfile?.hullColor ?? stats.hullColor,
      turretColor: bossProfile?.turretColor ?? stats.turretColor,
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

    if (bossProfile) {
      enemy.bossStyle = bossProfile.style
      enemy.nextAbilityAt = this.time.now + 2400
      spawnBlastRing(this, enemy.x, enemy.y, 88, bossProfile.accent)
      spawnFloatingText(this, enemy.x, enemy.y - enemy.size / 2 - 22, bossProfile.title, bossProfile.accent)
    }

    return enemy
  }

  private movePlayer(delta: number, _time: number) {
    const direction = readMovementDirection(this.cursors, this.keys)
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
      if (enemy.enemyType === 'boss') {
        this.updateBossState(enemy, time)
      }

      const fireDelay = this.buffs.freezeUntil > time ? enemy.fireDelay * 2 : enemy.fireDelay
      if (time - enemy.lastFire > fireDelay && !lineBlocked(enemy, this.player, this.walls)) {
        if (enemy.enemyType === 'boss') {
          this.fireBossPattern(enemy, time)
        } else if (enemy.enemyType !== 'charger' && enemy.enemyType !== 'bomber') {
          this.bulletSystem.fire(enemy, false, time)
        }
      }
    }
  }

  private updateBossState(enemy: Tank, time: number) {
    const profile = bossProfileForStyle(enemy.bossStyle)
    const tier = bossTier(this.waveIndex + 1)

    if (!enemy.enraged && enemy.health <= enemy.maxHealth * 0.5) {
      enemy.enraged = true
      enemy.speed += 10
      enemy.fireDelay = Math.max(580, enemy.fireDelay * 0.84)
      spawnBlastRing(this, enemy.x, enemy.y, 120, profile.accent)
      spawnFloatingText(this, enemy.x, enemy.y - enemy.size / 2 - 26, 'ENRAGED', profile.accent)
      this.cameras.main.shake(90, 0.0035)
    }

    if (time < (enemy.nextAbilityAt ?? 0)) {
      return
    }

    enemy.nextAbilityAt = time + Math.max(3300, 6200 - tier * 260)
    if (enemy.bossStyle === 'warden') {
      const healAmount = Math.ceil(enemy.maxHealth * 0.05)
      enemy.health = Math.min(enemy.maxHealth, enemy.health + healAmount)
      spawnBlastRing(this, enemy.x, enemy.y, 96, profile.accent)
      spawnFloatingText(this, enemy.x, enemy.y - enemy.size / 2 - 22, `+${healAmount} REPAIR`, profile.accent)
      syncTankVisuals(enemy)
      return
    }

    if (enemy.bossStyle === 'blitz') {
      enemy.moveAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      enemy.rethinkAt = time + 520
      spawnBlastRing(this, enemy.x, enemy.y, 72, profile.accent)
      spawnFloatingText(this, enemy.x, enemy.y - enemy.size / 2 - 22, 'DASH', profile.accent)
      return
    }

    if (enemy.bossStyle === 'artillery' || enemy.bossStyle === 'swarm') {
      spawnBlastRing(this, enemy.x, enemy.y, enemy.bossStyle === 'swarm' ? 110 : 84, profile.accent)
    }
  }

  private fireBossPattern(enemy: Tank, time: number) {
    const baseAngle = enemy.turretAngle
    const tier = bossTier(this.waveIndex + 1)
    const profile = bossProfileForStyle(enemy.bossStyle)
    const style = enemy.bossStyle ?? 'vanguard'

    if (style === 'swarm') {
      const bulletCount = tier >= 4 ? 10 : 8
      spawnBlastRing(this, enemy.x, enemy.y, 94, profile.accent)
      for (let index = 0; index < bulletCount; index += 1) {
        this.bulletSystem.fire(enemy, false, time, {
          angleOverride: baseAngle + (Math.PI * 2 * index) / bulletCount + time * 0.00025,
          playSound: index === 0,
          bulletTint: profile.accent,
        })
      }
      return
    }

    if (style === 'artillery') {
      spawnBlastRing(this, enemy.x, enemy.y, 74, profile.accent)
      const angles = tier >= 3 ? [-0.54, -0.24, 0, 0.24, 0.54] : [-0.36, 0, 0.36]
      angles.forEach((offset, index) => {
        this.bulletSystem.fire(enemy, false, time, {
          angleOverride: baseAngle + offset,
          damageOverride: enemy.damage + 1,
          playSound: index === 0,
          bulletTint: profile.accent,
        })
      })
      return
    }

    if (style === 'warden') {
      spawnBlastRing(this, enemy.x, enemy.y, 78, profile.accent)
      ;[0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((offset, index) => {
        this.bulletSystem.fire(enemy, false, time, {
          angleOverride: baseAngle + offset,
          playSound: index === 0,
          bulletTint: profile.accent,
        })
      })
      return
    }

    const angles = style === 'blitz'
      ? [-0.1, 0, 0.1]
      : tier >= 4
        ? [-0.42, -0.21, 0, 0.21, 0.42]
        : tier >= 2
          ? [-0.3, 0, 0.3]
          : [-0.18, 0, 0.18]

    angles.forEach((offset, index) => {
      this.bulletSystem.fire(enemy, false, time, {
        angleOverride: baseAngle + offset,
        lateralOffset: style === 'blitz' ? 16 * (index - 1) : 0,
        playSound: index === 0,
        bulletTint: profile.accent,
      })
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

    const classCritBonus = this.activeClass().ability.critChanceBonus ?? 0
    const classExplosive = this.activeClass().ability.forceExplosiveRadius ?? 0
    angles.forEach((angle) => {
      offsets.forEach((offset, offsetIndex) => {
        const roll = rollPlayerDamage(
          this.player.damage,
          (type) => this.upgradeLevel(type),
          this.statLevels,
          this.buffs,
          this.time.now,
          classCritBonus,
        )
        this.bulletSystem.fire(this.player, true, time, {
          angleOverride: angle,
          lateralOffset: offset,
          playSound: angle === angles[0] && offsetIndex === 0,
          damageOverride: roll.damage,
          critical: roll.critical,
          baselineExplosiveRadius: classExplosive,
        })
      })
    })
  }

  private updateBullets(delta: number, time: number) {
    this.bulletSystem.update(delta, {
      enemies: this.enemies,
      player: this.player,
      walls: this.walls,
      onEnemyHit: (hitIndex, bullet) => {
        const primary = this.enemies[hitIndex]
        const hitX = primary.x
        const hitY = primary.y
        this.damageEnemy(hitIndex, bullet.damage, bullet.critical === true)
        if (bullet.explosiveRadius && bullet.explosiveRadius > 0) {
          this.applyShellExplosion(
            hitX,
            hitY,
            bullet.explosiveRadius,
            Math.max(1, Math.floor(bullet.damage * 0.45)),
            primary,
          )
        }
      },
      onPlayerHit: (bullet) => {
        this.damagePlayer(bullet.damage, bullet.piercesShield === true, time)
      },
    })
  }

  private damageEnemy(index: number, damage: number, critical = false) {
    const enemy = this.enemies[index]
    const finalDamage = effectiveDamageOnEnemy(damage, enemy, critical, this.bossDamageMultiplier())
    enemy.health -= finalDamage
    flashTank(this, enemy, 0xff9b72)
    spawnHitSpark(this, enemy.x, enemy.y)
    spawnDamageNumber(this, enemy.x, enemy.y - enemy.size / 2, finalDamage, critical)
    if (critical) {
      this.cameras.main.shake(38, 0.002)
    }
    this.audio.hit()

    if (enemy.health > 0) {
      syncTankVisuals(enemy)
      return
    }

    spawnExplosion(this, enemy.x, enemy.y)
    this.cameras.main.shake(enemy.enemyType === 'boss' ? 160 : 45, enemy.enemyType === 'boss' ? 0.006 : 0.002)
    if (enemy.enemyType === 'boss') {
      const profile = bossProfileForStyle(enemy.bossStyle)
      spawnBlastRing(this, enemy.x, enemy.y, 142, profile.accent)
      spawnFloatingText(this, enemy.x, enemy.y - enemy.size / 2 - 30, 'BOSS DOWN', profile.accent)
    }
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
    if (this.xp < this.nextLevelXp) {
      return
    }

    this.xp -= this.nextLevelXp
    this.level += 1
    this.nextLevelXp = xpRequiredForLevel(this.level)
    this.showUpgradeOptions('level')
  }

  private damagePlayer(damage: number, _piercesShield: boolean, _time: number) {
    const classMult = this.activeClass().ability.damageTakenMultiplier ?? 1
    const finalDamage = Math.max(1, Math.round(damage * classMult))
    this.player.health -= finalDamage
    this.multiplier = 1
    flashTank(this, this.player, 0xffffff)
    spawnHitSpark(this, this.player.x, this.player.y)
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
      const goldMult = this.activeClass().ability.goldMultiplier ?? 1
      const earned = Math.max(1, Math.round(pickup.value * goldMult))
      this.gold += earned
      saveGold(this.gold)
      spawnFloatingText(this, pickup.sprite.x, pickup.sprite.y - 12, `+${earned}g`, 0xf6d365)
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
    this.recordWavePeak(this.waveIndex)
    this.showUpgradeOptions('wave')
  }

  private recordWavePeak(wave: number) {
    if (wave <= this.peakWave) {
      return
    }
    this.peakWave = wave
    savePeakWave(this.peakWave)
    const newlyUnlocked: TankClassId[] = []
    CLASS_ORDER.forEach((id) => {
      const cls = TANK_CLASSES[id]
      if (this.ownedClasses.includes(id)) {
        return
      }
      if (isClassUnlockedByWave(cls, this.peakWave)) {
        this.ownedClasses.push(id)
        newlyUnlocked.push(id)
      }
    })
    if (newlyUnlocked.length > 0) {
      saveOwnedClasses(this.ownedClasses)
      newlyUnlocked.forEach((id, index) => {
        const cls = TANK_CLASSES[id]
        const yOffset = -52 - index * 18
        spawnFloatingText(
          this,
          this.player.x,
          this.player.y + yOffset,
          `${cls.name.toUpperCase()} UNLOCKED`,
          0xf6d365,
        )
      })
      this.publishHud()
    }
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
    this.screenPanel.clear()
    this.banner.setText('')
    this.helper.setText('')
    const shown = this.upgradeRenderer.show({
      reason,
      level: this.level,
      waveIndex: this.waveIndex,
      upgradeLevels: this.upgradeLevels,
    })
    if (!shown) {
      this.continueAfterUpgrade()
    }
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
    const index = this.upgradeRenderer.hitTest(x, y)
    if (index >= 0) {
      this.applyUpgradeByIndex(index)
    }
  }

  private applyUpgradeByIndex(index: number) {
    const choice = this.upgradeRenderer.choiceAt(index)
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
    this.upgradeRenderer.clear()
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
    this.screenPanel.show({
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

  private updateHud(time: number) {
    this.publishHud()

    if (this.waveMessageUntil > time) {
      return
    }

    if (this.state === 'playing') {
      this.banner.setText('')
    }
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
      ownedClasses: this.ownedClasses,
      activeClassId: this.activeClassId,
      ownedSkins: this.ownedSkins,
      activeSkins: this.activeSkins,
      peakWave: this.peakWave,
    }
    this.bus.emit('shop:snapshot', shopSnapshot)
  }

  private clearObjects() {
    this.bulletSystem?.clear()
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

    this.upgradeRenderer.clear()
    this.screenPanel.clear()
    this.enemies = []
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.pendingWave = null
    this.waveSpawnAt = 0
  }

}
