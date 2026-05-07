import Phaser from 'phaser'
import { ENEMY_STATS, GAME_CONFIG, POWER_UP_LABELS, UPGRADE_OPTIONS, WAVES } from '../config'
import { GameAudio } from '../systems/audio'
import type {
  Bullet,
  EnemyType,
  GameState,
  Mine,
  PlayerBuffs,
  PickupDrop,
  PowerUp,
  PowerUpType,
  StatUpgradeType,
  Tank,
  UpgradeOption,
  UpgradeRarity,
  UpgradeType,
  WaveConfig,
} from '../types'

const HIGH_SCORE_KEY = 'tank-game.high-score'
const GOLD_KEY = 'tank-game.gold'
const STAT_LEVELS_KEY = 'tank-game.stat-levels'
const ASSET_BASE_PATH = '/assets/kenney-tanks'
const TANK_SPRITE_ROTATION_OFFSET = Math.PI / 2
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

const MAP_THEMES = [
  { name: 'Iron Yard', floor: 0x1b2420, grid: 0x304037, panel: 0x26342d, accent: 0xf6d365, stain: 0x0c1110 },
  { name: 'Dust Depot', floor: 0x2b2720, grid: 0x4a412f, panel: 0x3a3328, accent: 0xe2b36c, stain: 0x17120e },
  { name: 'Frost Line', floor: 0x202933, grid: 0x354657, panel: 0x2b3a47, accent: 0x8ec5ff, stain: 0x101923 },
  { name: 'Hazard Grid', floor: 0x211f24, grid: 0x383641, panel: 0x2f2b36, accent: 0xff7b72, stain: 0x110f13 },
  { name: 'Overgrown Base', floor: 0x18241d, grid: 0x2e4535, panel: 0x233829, accent: 0x73e2a7, stain: 0x0b140f },
] as const

const UPGRADE_CAPS: Record<UpgradeType, number> = {
  armor: 6,
  damage: 8,
  fireRate: 5,
  moveSpeed: 4,
  bulletSpeed: 4,
  critChance: 6,
  critDamage: 5,
  scoreBonus: 3,
  doubleShot: 1,
  tripleShot: 1,
  xpBoost: 8,
  piercingShell: 3,
  explosiveShell: 3,
  pickupRadius: 5,
  bossDamage: 5,
}

const HUD_UPGRADE_LABELS: Array<[UpgradeType, string]> = [
  ['armor', 'ARMOR'],
  ['damage', 'DMG'],
  ['fireRate', 'RATE'],
  ['moveSpeed', 'SPEED'],
  ['bulletSpeed', 'SHELL'],
  ['critChance', 'CRIT'],
  ['critDamage', 'C-DMG'],
  ['doubleShot', '2X'],
  ['tripleShot', 'TRIPLE'],
  ['xpBoost', 'XP'],
  ['pickupRadius', 'MAGNET'],
  ['piercingShell', 'PIERCE'],
  ['explosiveShell', 'BLAST'],
  ['bossDamage', 'BOSS'],
  ['scoreBonus', 'SCORE'],
]

type HudMod = {
  text: string
  type?: UpgradeType
  temporary?: boolean
}

const STAT_UPGRADES: Record<StatUpgradeType, { title: string; baseCost: number; costStep: number }> = {
  maxHealth: { title: 'Max HP', baseCost: 60, costStep: 38 },
  damage: { title: 'Damage', baseCost: 80, costStep: 55 },
  fireRate: { title: 'Fire Rate', baseCost: 70, costStep: 48 },
  critChance: { title: 'Crit %', baseCost: 90, costStep: 62 },
  critDamage: { title: 'Crit DMG', baseCost: 100, costStep: 72 },
  moveSpeed: { title: 'Move Speed', baseCost: 85, costStep: 58 },
  pickupRadius: { title: 'Pickup Range', baseCost: 75, costStep: 50 },
  armorRegen: { title: 'Armor Regen', baseCost: 120, costStep: 78 },
  bossDamage: { title: 'Boss DMG', baseCost: 130, costStep: 85 },
}

export class TankBattleScene extends Phaser.Scene {
  private audio = new GameAudio()
  private state: GameState = 'menu'
  private player!: Tank
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private bullets: Bullet[] = []
  private enemies: Tank[] = []
  private powerUps: PowerUp[] = []
  private pickups: PickupDrop[] = []
  private mines: Mine[] = []
  private walls: Phaser.GameObjects.Rectangle[] = []
  private battlefield!: Phaser.GameObjects.Graphics
  private mapDecorations: Phaser.GameObjects.GameObject[] = []
  private upgradeObjects: Phaser.GameObjects.GameObject[] = []
  private upgradeCardBounds: Phaser.Geom.Rectangle[] = []
  private upgradeChoices: UpgradeOption[] = []
  private screenPanelObjects: Phaser.GameObjects.GameObject[] = []
  private uiLayer!: Phaser.GameObjects.Container
  private hudPanel!: Phaser.GameObjects.Graphics
  private hud!: Phaser.GameObjects.Text
  private sideHud?: {
    score: HTMLElement
    best: HTMLElement
    hpTop: HTMLElement
    hpBar: HTMLElement
    xpBar: HTMLElement
    xpText: HTMLElement
    wave: HTMLElement
    level: HTMLElement
    multiplier: HTMLElement
    zone: HTMLElement
    mods: HTMLElement
    gold: HTMLElement
  }
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
  private currentMapName: string = MAP_THEMES[0].name
  private upgradeLevels: Record<UpgradeType, number> = this.createEmptyUpgradeLevels()
  private statLevels: Record<StatUpgradeType, number> = this.createEmptyStatLevels()
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

  private createEmptyStatLevels(): Record<StatUpgradeType, number> {
    return {
      maxHealth: 0,
      damage: 0,
      fireRate: 0,
      critChance: 0,
      critDamage: 0,
      moveSpeed: 0,
      pickupRadius: 0,
      armorRegen: 0,
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
    this.highScore = this.loadHighScore()
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
    this.updatePowerUps()
    this.updatePickups()
    this.updateMines(time)
    this.updateWavePreparation(time)
    this.updateWaveSpawns(time)
    this.updateHud(time)
  }

  private resetRuntime() {
    this.bullets = []
    this.enemies = []
    this.powerUps = []
    this.pickups = []
    this.mines = []
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
    this.gold = this.loadGold()
    this.xp = 0
    this.level = 1
    this.nextLevelXp = 120
    this.pendingUpgradeReason = 'wave'
    this.upgradeLevels = this.createEmptyUpgradeLevels()
    this.statLevels = this.loadStatLevels()
    this.buffs = this.createDefaultBuffs()
    this.state = 'menu'
  }

  private createBattlefield() {
    this.cameras.main.setBackgroundColor(GAME_CONFIG.colors.ground)
    this.battlefield = this.add.graphics()
    this.battlefield.setDepth(-30)
    this.drawBattlefield(MAP_THEMES[0])
  }

  private drawBattlefield(theme: (typeof MAP_THEMES)[number]) {
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

  private applyMapTheme(waveIndex: number) {
    const theme = MAP_THEMES[waveIndex % MAP_THEMES.length]
    this.currentMapName = theme.name
    this.drawBattlefield(theme)
    this.clearMapDecorations()
    this.walls.forEach((wall) => {
      wall.setFillStyle(theme.panel)
      wall.setStrokeStyle(2, theme.accent, 0.46)
    })

    const decorationData = [
      [92, 102, 'crate'], [846, 94, 'barrel'], [115, 438, 'stain'],
      [610, 94, 'stripe'], [820, 440, 'crate'], [358, 438, 'barrel'],
      [310, 72, 'stain'], [662, 360, 'stripe'],
    ] as const

    decorationData.forEach(([baseX, baseY, type], index) => {
      const x = baseX + ((waveIndex * 37 + index * 11) % 28) - 14
      const y = baseY + ((waveIndex * 29 + index * 7) % 24) - 12
      if (type === 'crate') {
        this.addCrateDecoration(x, y, theme.accent)
      }
      if (type === 'barrel') {
        this.addBarrelDecoration(x, y, theme.accent)
      }
      if (type === 'stain') {
        this.addStainDecoration(x, y, theme.stain)
      }
      if (type === 'stripe') {
        this.addStripeDecoration(x, y, theme.accent)
      }
    })
  }

  private addCrateDecoration(x: number, y: number, accent: number) {
    const crate = this.add.image(x, y, accent === 0xe2b36c ? 'decor-crate-wood' : 'decor-crate-metal')
      .setDisplaySize(40, 40)
      .setDepth(-8)
      .setAlpha(0.9)
    crate.rotation = Phaser.Math.DegToRad((x + y) % 18)
    this.mapDecorations.push(crate)
  }

  private addBarrelDecoration(x: number, y: number, accent: number) {
    const barrel = this.add.image(x, y, accent === 0xff7b72 ? 'decor-barrel-red' : 'decor-barrel-dark')
      .setDisplaySize(34, 34)
      .setDepth(-8)
      .setAlpha(0.9)
    this.mapDecorations.push(barrel)
  }

  private addStainDecoration(x: number, y: number, color: number) {
    const stain = this.add.image(x, y, 'decor-oil').setDisplaySize(70, 44).setDepth(-9)
    stain.setTint(color).setAlpha(0.46)
    stain.rotation = Phaser.Math.DegToRad((x + y) % 42)
    this.mapDecorations.push(stain)
  }

  private addStripeDecoration(x: number, y: number, accent: number) {
    const barricade = this.add.image(x, y, accent === 0xf6d365 ? 'decor-barricade-metal' : 'decor-barricade-wood')
      .setDisplaySize(72, 24)
      .setDepth(-8)
      .setAlpha(0.88)
    barricade.rotation = Phaser.Math.DegToRad(((x + y) % 24) - 12)
    this.mapDecorations.push(barricade)
  }

  private clearMapDecorations() {
    for (const object of this.mapDecorations) {
      object.destroy()
    }
    this.mapDecorations = []
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
    this.resolveSideHud()
    this.bindShopControls()
  }

  private showMenu() {
    this.state = 'menu'
    this.clearScreenPanel()
    this.hud.setText(`Best Score: ${this.highScore}`)
    this.drawHudPanel()
    this.publishSideHud([])
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
    this.gold = this.loadGold()
    this.xp = 0
    this.level = 1
    this.nextLevelXp = 120
    this.pendingUpgradeReason = 'wave'
    this.upgradeLevels = this.createEmptyUpgradeLevels()
    this.statLevels = this.loadStatLevels()
    this.buffs = this.createDefaultBuffs()
    this.state = 'playing'
    this.clearScreenPanel()
    this.banner.setText('')
    this.helper.setText('')
    this.player = this.createTank({
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
    const wave = this.createWaveConfig(this.waveIndex)
    this.clearUpgradeObjects()
    this.applyMapTheme(this.waveIndex)
    this.clearMines()
    this.spawnWaveMines(wave)
    this.enemies = []
    this.waveSpawnQueue = []
    this.nextEnemySpawnAt = 0
    this.pendingWave = wave
    this.waveSpawnAt = this.time.now + 3000
    this.waveMessageUntil = this.waveSpawnAt + 1200
    this.banner.setText(`${this.isBossWave(wave.number) ? 'Boss wave' : `Wave ${wave.number}`} in 3`)
    this.helper.setText(this.isBossWave(wave.number) ? 'Destroy the commander' : 'Get ready')
    this.audio.wave()
  }

  private createWaveConfig(waveIndex: number): WaveConfig {
    const waveNumber = waveIndex + 1
    if (this.isBossWave(waveNumber)) {
      const tier = this.bossTier(waveNumber)
      return {
        number: waveNumber,
        enemies: [
          { type: 'boss', count: 1 },
          { type: 'scout', count: 4 + tier * 2 },
          ...(tier >= 2 ? [{ type: 'heavy' as const, count: 1 + Math.floor(tier / 2) }] : []),
          ...(tier >= 2 ? [{ type: 'charger' as const, count: 1 + tier }] : []),
          ...(tier >= 3 ? [{ type: 'bomber' as const, count: 1 + Math.floor(tier / 2) }] : []),
          ...(tier >= 3 ? [{ type: 'sniper' as const, count: 1 + Math.floor(tier / 3) }] : []),
          ...(tier >= 4 ? [{ type: 'shield' as const, count: 1 + Math.floor(tier / 2) }] : []),
        ],
      }
    }

    const preset = WAVES[waveIndex]
    if (preset) {
      return {
        number: waveNumber,
        enemies: preset.enemies.map((group) => ({ type: group.type, count: group.count })),
      }
    }

    const extra = waveIndex - WAVES.length + 1
    const tier = Math.floor(extra / 3)
    return {
      number: waveNumber,
      enemies: [
        { type: 'scout', count: 8 + Math.floor(extra * 1.05) },
        { type: 'heavy', count: 1 + Math.floor(extra * 0.34) },
        ...(waveNumber >= 6 ? [{ type: 'charger' as const, count: 1 + Math.floor(tier * 0.65) }] : []),
        ...(waveNumber >= 7 ? [{ type: 'bomber' as const, count: 1 + Math.floor(tier * 0.45) }] : []),
        ...(waveNumber >= 7 ? [{ type: 'sniper' as const, count: 1 + Math.floor(tier * 0.45) }] : []),
        ...(waveNumber >= 9 ? [{ type: 'shield' as const, count: 1 + Math.floor(tier * 0.35) }] : []),
      ],
    }
  }

  private isBossWave(waveNumber: number) {
    return waveNumber > 0 && waveNumber % 5 === 0
  }

  private bossTier(waveNumber: number) {
    return Math.max(1, Math.floor(waveNumber / 5))
  }

  private updateWavePreparation(time: number) {
    if (!this.pendingWave) {
      return
    }

    const remaining = Math.max(0, Math.ceil((this.waveSpawnAt - time) / 1000))
    if (remaining > 0) {
      const title = this.isBossWave(this.pendingWave.number) ? 'Boss wave' : `Wave ${this.pendingWave.number}`
      this.banner.setText(`${title} in ${remaining}`)
      return
    }

    const wave = this.pendingWave
    this.pendingWave = null
    this.waveSpawnAt = 0
    this.waveSpawnQueue = this.expandWaveQueue(wave)
    this.nextEnemySpawnAt = time
    this.banner.setText(this.isBossWave(wave.number) ? 'Boss wave' : `Wave ${wave.number}`)
    this.helper.setText('')
  }

  private expandWaveQueue(wave: WaveConfig) {
    return Phaser.Utils.Array.Shuffle(wave.enemies.flatMap((group) => Array(group.count).fill(group.type) as EnemyType[]))
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
    const clearSpawn = this.findClearSpawn(spawn[0], spawn[1], this.tankSizeForType(type))
    const bossTier = type === 'boss' ? this.bossTier(waveNumber) : 0

    return this.createTank({
      kind: 'enemy',
      enemyType: type,
      x: clearSpawn.x,
      y: clearSpawn.y,
      hullColor: stats.hullColor,
      turretColor: stats.turretColor,
      maxHealth: type === 'boss'
        ? stats.health + bossTier * 10
        : stats.health + Math.floor(this.waveIndex / 3),
      speed: type === 'boss'
        ? Math.min(stats.speed + bossTier * 3, 54)
        : stats.speed + Math.min(this.waveIndex * 2.2, 42),
      fireDelay: type === 'boss'
        ? Math.max(stats.fireDelay - bossTier * 70, 760)
        : Math.max(stats.fireDelay - this.waveIndex * 35, 760),
      bulletSpeed: type === 'boss'
        ? stats.bulletSpeed + bossTier * 18
        : stats.bulletSpeed + Math.min(this.waveIndex * 10, 140),
      scoreValue: type === 'boss' ? stats.scoreValue + bossTier * 250 : stats.scoreValue,
      damage: type === 'boss' && bossTier >= 3 ? stats.damage + 1 : stats.damage,
      preferredRange: stats.preferredRange,
      accuracy: stats.accuracy,
      separationRadius: stats.separationRadius,
    })
  }

  private createTank(options: {
    kind: 'player' | 'enemy'
    enemyType?: EnemyType
    x: number
    y: number
    hullColor: number
    turretColor: number
    maxHealth: number
    speed: number
    fireDelay: number
    bulletSpeed: number
    scoreValue: number
    damage: number
    preferredRange: number
    accuracy: number
    separationRadius: number
  }): Tank {
    const size = this.tankSizeForType(options.enemyType)
    const hull = this.add.image(options.x, options.y, this.tankBodyAsset(options.kind, options.enemyType))
      .setDisplaySize(size, size)
    const barrelWidth = options.enemyType === 'boss' ? 17 : options.enemyType === 'sniper' ? 14 : 12
    const barrelHeight = options.enemyType === 'boss' ? 58 : options.enemyType === 'sniper' ? 52 : 44
    const turret = this.add.image(options.x, options.y, this.tankBarrelAsset(options.kind, options.enemyType))
      .setDisplaySize(barrelWidth, barrelHeight)
      .setOrigin(0.5, 0.78)
    hull.setDepth(5)
    turret.setDepth(6)
    const healthBar = options.kind === 'enemy'
      ? this.add.graphics().setDepth(8)
      : undefined
    const tank: Tank = {
      kind: options.kind,
      enemyType: options.enemyType,
      x: options.x,
      y: options.y,
      size,
      hull,
      turret,
      hullAngle: 0,
      turretAngle: 0,
      health: options.maxHealth,
      maxHealth: options.maxHealth,
      lastFire: 0,
      moveAngle: Phaser.Math.FloatBetween(0, Math.PI * 2),
      rethinkAt: 0,
      speed: options.speed,
      fireDelay: options.fireDelay,
      bulletSpeed: options.bulletSpeed,
      scoreValue: options.scoreValue,
      damage: options.damage,
      preferredRange: options.preferredRange,
      accuracy: options.accuracy,
      separationRadius: options.separationRadius,
      strafeDirection: Phaser.Math.Between(0, 1) === 0 ? -1 : 1,
      healthBar,
    }
    this.syncTankVisuals(tank)
    return tank
  }

  private tankBodyAsset(kind: 'player' | 'enemy', enemyType?: EnemyType) {
    if (kind === 'player') {
      return 'tank-player-body'
    }
    if (enemyType === 'heavy' || enemyType === 'shield' || enemyType === 'bomber') {
      return 'tank-heavy-body'
    }
    if (enemyType === 'boss') {
      return 'tank-heavy-body'
    }
    if (enemyType === 'sniper') {
      return 'tank-sniper-body'
    }
    return 'tank-scout-body'
  }

  private tankBarrelAsset(kind: 'player' | 'enemy', enemyType?: EnemyType) {
    if (kind === 'player') {
      return 'tank-player-barrel'
    }
    if (enemyType === 'heavy' || enemyType === 'shield' || enemyType === 'bomber') {
      return 'tank-heavy-barrel'
    }
    if (enemyType === 'boss') {
      return 'tank-heavy-barrel'
    }
    if (enemyType === 'sniper') {
      return 'tank-sniper-barrel'
    }
    return 'tank-scout-barrel'
  }

  private tankSizeForType(enemyType?: EnemyType) {
    if (enemyType === 'boss') {
      return 66
    }
    if (enemyType === 'shield') {
      return 52
    }
    if (enemyType === 'heavy') {
      return 48
    }
    if (enemyType === 'bomber') {
      return 44
    }
    if (enemyType === 'charger' || enemyType === 'scout') {
      return 36
    }
    return 42
  }

  private findClearSpawn(x: number, y: number, size: number) {
    const offsets = [
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

    for (const [offsetX, offsetY] of offsets) {
      const candidate = this.clampTankPosition(x + offsetX, y + offsetY, size)
      if (this.spawnIsClear(candidate.x, candidate.y, size)) {
        return candidate
      }
    }

    return this.clampTankPosition(x, y, size)
  }

  private spawnIsClear(x: number, y: number, size: number) {
    const bounds = this.squareBounds(x, y, size)
    const hitsWall = this.walls.some((wall) => this.boundsOverlapRectangle(bounds, wall.getBounds()))
    const hitsPlayer = this.player && this.boundsOverlapRectangle(bounds, this.tankBounds(this.player))
    return !hitsWall && !hitsPlayer
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

    this.moveTankAxis(this.player, direction.x * distance, 0)
    this.moveTankAxis(this.player, 0, direction.y * distance)
    this.player.hullAngle = direction.angle()
    this.syncTankVisuals(this.player)
  }

  private aimTankAtPointer(tank: Tank) {
    const pointer = this.input.activePointer
    tank.turretAngle = Phaser.Math.Angle.Between(tank.x, tank.y, pointer.worldX, pointer.worldY)
    this.syncTankVisuals(tank)
  }

  private updateEnemies(time: number, delta: number) {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index]
      const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      if (enemy.enemyType === 'bomber' && distanceToPlayer < 54) {
        this.detonateBomber(index, time)
        continue
      }

      this.chooseEnemyMove(enemy, time)
      this.moveEnemy(enemy, delta, time)
      enemy.turretAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y)
      this.syncTankVisuals(enemy)

      const fireDelay = this.buffs.freezeUntil > time ? enemy.fireDelay * 2 : enemy.fireDelay
      if (time - enemy.lastFire > fireDelay && !this.lineBlocked(enemy, this.player)) {
        if (enemy.enemyType === 'boss') {
          this.fireBossPattern(enemy, time)
        } else if (enemy.enemyType !== 'charger' && enemy.enemyType !== 'bomber') {
          this.fireBullet(enemy, false, time)
        }
      }
    }
  }

  private chooseEnemyMove(enemy: Tank, time: number) {
    if (time < enemy.rethinkAt) {
      return
    }

    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y)
    const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y)
    const canSeePlayer = !this.lineBlocked(enemy, this.player)

    enemy.rethinkAt = time + Phaser.Math.Between(170, 430)

    if (!canSeePlayer) {
      enemy.moveAngle = this.findPressureAngle(enemy, angleToPlayer)
      return
    }

    if (enemy.enemyType === 'charger') {
      enemy.moveAngle = distanceToPlayer < 78 ? angleToPlayer + Math.PI : angleToPlayer
      enemy.rethinkAt = time + Phaser.Math.Between(90, 150)
      return
    }

    if (enemy.enemyType === 'bomber') {
      enemy.moveAngle = angleToPlayer
      enemy.rethinkAt = time + Phaser.Math.Between(120, 190)
      return
    }

    if (enemy.enemyType === 'shield' && distanceToPlayer > enemy.preferredRange + 25) {
      enemy.moveAngle = angleToPlayer
      return
    }

    if (enemy.enemyType === 'sniper' && distanceToPlayer < enemy.preferredRange - 55) {
      enemy.moveAngle = angleToPlayer + Math.PI
      return
    }

    if (enemy.enemyType === 'scout' && distanceToPlayer < enemy.preferredRange + 80) {
      enemy.strafeDirection = Phaser.Math.Between(0, 100) > 8
        ? enemy.strafeDirection
        : enemy.strafeDirection === 1 ? -1 : 1
      enemy.moveAngle = angleToPlayer + (Math.PI / 2) * enemy.strafeDirection
      return
    }

    if (distanceToPlayer > enemy.preferredRange + 35) {
      enemy.moveAngle = angleToPlayer
      return
    }

    if (distanceToPlayer < enemy.preferredRange - 45) {
      enemy.moveAngle = angleToPlayer + Math.PI
      return
    }

    enemy.strafeDirection = Phaser.Math.Between(0, 100) > 18
      ? enemy.strafeDirection
      : enemy.strafeDirection === 1 ? -1 : 1
    enemy.moveAngle = angleToPlayer + (Math.PI / 2) * enemy.strafeDirection
  }

  private fireBossPattern(enemy: Tank, time: number) {
    const baseAngle = enemy.turretAngle
    const tier = this.bossTier(this.waveIndex + 1)
    const pattern = Math.floor(time / 2200) % (tier >= 3 ? 4 : 3)

    if (tier >= 2 && pattern === 1) {
      this.spawnBlastRing(enemy.x, enemy.y, 92, 0xffd166)
      const bulletCount = tier >= 4 ? 8 : 6
      for (let index = 0; index < bulletCount; index += 1) {
        this.fireBullet(enemy, false, time, baseAngle + (Math.PI * 2 * index) / bulletCount, 0, index === 0)
      }
      return
    }

    if (tier >= 3 && pattern === 2) {
      this.spawnBlastRing(enemy.x, enemy.y, 68, 0xff7b72)
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

    this.spawnExplosion(enemy.x, enemy.y)
    this.spawnBlastRing(enemy.x, enemy.y, 82, 0xff8a3d)
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

  private findPressureAngle(enemy: Tank, angleToPlayer: number) {
    const candidates = [
      angleToPlayer,
      angleToPlayer + Math.PI / 6,
      angleToPlayer - Math.PI / 6,
      angleToPlayer + Math.PI / 4,
      angleToPlayer - Math.PI / 4,
      angleToPlayer + Math.PI / 2,
      angleToPlayer - Math.PI / 2,
      angleToPlayer + Math.PI * 0.72,
      angleToPlayer - Math.PI * 0.72,
    ]

    const best = candidates.find((angle) => {
      const probe = {
        x: enemy.x + Math.cos(angle) * 72,
        y: enemy.y + Math.sin(angle) * 72,
      }
      const line = new Phaser.Geom.Line(probe.x, probe.y, this.player.x, this.player.y)
      return this.canTankMove(enemy, Math.cos(angle) * 18, Math.sin(angle) * 18)
        && this.walls.every((wall) => !Phaser.Geom.Intersects.LineToRectangle(line, wall.getBounds()))
    })

    return best ?? angleToPlayer + Phaser.Math.FloatBetween(-0.85, 0.85)
  }

  private moveEnemy(enemy: Tank, delta: number, time: number) {
    const freezeMultiplier = this.buffs.freezeUntil > time ? 0.45 : 1
    const distance = enemy.speed * freezeMultiplier * (delta / 1000)
    const separation = this.enemySeparation(enemy)
    const wallAvoidance = this.wallAvoidance(enemy)
    const steeredAngle = this.findOpenMoveAngle(enemy, distance, enemy.moveAngle) ?? enemy.moveAngle
    const moveX = (Math.cos(steeredAngle) + separation.x + wallAvoidance.x) * distance
    const moveY = (Math.sin(steeredAngle) + separation.y + wallAvoidance.y) * distance

    const movedX = this.moveTankAxis(enemy, moveX, 0)
    const movedY = this.moveTankAxis(enemy, 0, moveY)
    enemy.hullAngle = Phaser.Math.Angle.RotateTo(enemy.hullAngle, steeredAngle, delta * 0.006)
    this.syncTankVisuals(enemy)

    if (!movedX && !movedY) {
      enemy.moveAngle = this.findOpenMoveAngle(enemy, distance, enemy.moveAngle + Math.PI / 2) ?? enemy.moveAngle + Math.PI
      enemy.rethinkAt = time + Phaser.Math.Between(300, 520)
      enemy.hullAngle = Phaser.Math.Angle.RotateTo(enemy.hullAngle, enemy.moveAngle, delta * 0.006)
      this.syncTankVisuals(enemy)
    }
  }

  private findOpenMoveAngle(enemy: Tank, distance: number, preferredAngle = enemy.moveAngle) {
    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y)
    const candidates = [
      preferredAngle,
      preferredAngle + Math.PI / 8,
      preferredAngle - Math.PI / 8,
      preferredAngle + Math.PI / 4,
      preferredAngle - Math.PI / 4,
      preferredAngle + Math.PI / 2,
      preferredAngle - Math.PI / 2,
      angleToPlayer + Math.PI / 2,
      angleToPlayer - Math.PI / 2,
      preferredAngle + Math.PI,
    ]

    const probeDistance = Math.max(26, distance * 4.5)
    return candidates.find((angle) => this.canTankMove(enemy, Math.cos(angle) * probeDistance, Math.sin(angle) * probeDistance))
  }

  private enemySeparation(enemy: Tank) {
    const force = new Phaser.Math.Vector2(0, 0)
    for (const other of this.enemies) {
      if (other === enemy) {
        continue
      }
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y)
      if (distance > 0 && distance < enemy.separationRadius) {
        force.x += (enemy.x - other.x) / distance
        force.y += (enemy.y - other.y) / distance
      }
    }

    if (force.lengthSq() > 0) {
      force.normalize().scale(0.55)
    }
    return force
  }

  private wallAvoidance(enemy: Tank) {
    const force = new Phaser.Math.Vector2(0, 0)
    const buffer = enemy.size / 2 + 38
    for (const wall of this.walls) {
      const bounds = wall.getBounds()
      const closestX = Phaser.Math.Clamp(enemy.x, bounds.left, bounds.right)
      const closestY = Phaser.Math.Clamp(enemy.y, bounds.top, bounds.bottom)
      const dx = enemy.x - closestX
      const dy = enemy.y - closestY
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= 0 || distanceSq > buffer * buffer) {
        continue
      }

      const distance = Math.sqrt(distanceSq)
      const strength = (buffer - distance) / buffer
      force.x += (dx / distance) * strength
      force.y += (dy / distance) * strength
    }

    if (force.lengthSq() > 0) {
      force.normalize().scale(0.7)
    }
    return force
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
        const roll = this.rollPlayerDamage()
        this.fireBullet(this.player, true, time, angle, offset, angle === angles[0] && offsetIndex === 0, roll.damage, roll.critical)
      })
    })
  }

  private rollPlayerDamage() {
    const overdriveActive = this.buffs.overdriveUntil > this.time.now
    const critical = Math.random() < this.playerCritChance()
    const baseDamage = this.player.damage + (overdriveActive ? 1 : 0)
    const damage = critical
      ? Math.round(baseDamage * this.playerCritDamageMultiplier())
      : baseDamage
    return { damage, critical }
  }

  private playerCritChance() {
    const overdriveBonus = this.buffs.overdriveUntil > this.time.now ? 0.18 : 0
    return Phaser.Math.Clamp(
      0.05 + this.upgradeLevel('critChance') * 0.035 + this.statLevels.critChance * 0.025 + overdriveBonus,
      0,
      0.65,
    )
  }

  private playerCritDamageMultiplier() {
    const overdriveBonus = this.buffs.overdriveUntil > this.time.now ? 0.22 : 0
    return 1.5 + this.upgradeLevel('critDamage') * 0.18 + this.statLevels.critDamage * 0.15 + overdriveBonus
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
    this.spawnMuzzleFlash(muzzleX, muzzleY, angle)
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
        const hitIndex = this.enemies.findIndex((enemy) => this.boundsOverlapRectangle(bullet.sprite.getBounds(), this.tankBounds(enemy)))
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
      } else if (this.boundsOverlapRectangle(bullet.sprite.getBounds(), this.tankBounds(this.player))) {
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
    this.flashTank(enemy, 0xff9b72)
    this.spawnHitSpark(enemy.x, enemy.y)
    this.spawnDamageNumber(enemy.x, enemy.y - enemy.size / 2, finalDamage, critical)
    this.audio.hit()

    if (enemy.health > 0) {
      this.syncTankVisuals(enemy)
      return
    }

    this.spawnExplosion(enemy.x, enemy.y)
    this.cameras.main.shake(enemy.enemyType === 'boss' ? 160 : 45, enemy.enemyType === 'boss' ? 0.006 : 0.002)
    this.maybeDropPowerUp(enemy.x, enemy.y)
    this.dropPickup('xp', enemy.x, enemy.y, this.xpForEnemy(enemy))
    this.dropPickup('gold', enemy.x + Phaser.Math.Between(-12, 12), enemy.y + Phaser.Math.Between(-12, 12), this.goldForEnemy(enemy))
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
    this.spawnBlastRing(x, y, radius, 0xf6d365)
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

  private xpForEnemy(enemy: Tank) {
    const waveBonus = 1 + Math.floor(this.waveIndex / 5) * 0.12
    const upgradeBonus = 1 + this.buffs.xpBonus * 0.14
    const temporaryBonus = this.buffs.doubleXpUntil > this.time.now ? 2 : 1
    const baseRate = this.xpRateForEnemy(enemy)
    const minimum = enemy.enemyType === 'boss' ? 18 : 3
    return Math.max(minimum, Math.round(enemy.scoreValue * baseRate * waveBonus * upgradeBonus * temporaryBonus))
  }

  private xpRateForEnemy(enemy: Tank) {
    if (enemy.enemyType === 'boss') {
      return 0.16
    }
    if (enemy.enemyType === 'shield' || enemy.enemyType === 'sniper') {
      return 0.1
    }
    if (enemy.enemyType === 'heavy' || enemy.enemyType === 'bomber') {
      return 0.09
    }
    if (enemy.enemyType === 'charger') {
      return 0.085
    }
    return 0.08
  }

  private goldForEnemy(enemy: Tank) {
    const temporaryBonus = this.buffs.doubleGoldUntil > this.time.now ? 2 : 1
    let amount = 0
    if (enemy.enemyType === 'boss') {
      amount = 55 + this.bossTier(this.waveIndex + 1) * 16
    } else {
      const base = enemy.enemyType === 'heavy'
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
      amount = base + Math.floor(this.waveIndex / 4)
    }
    return amount * temporaryBonus
  }

  private gainXp(amount: number) {
    this.xp += amount
    this.pulseXpText()
    if (this.xp < this.nextLevelXp) {
      return
    }

    this.xp -= this.nextLevelXp
    this.level += 1
    this.nextLevelXp = this.xpRequiredForLevel(this.level)
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

  private xpRequiredForLevel(level: number) {
    return Math.round(120 + (level - 1) * 62 + (level - 1) ** 2 * 18)
  }

  private damagePlayer(damage: number, _piercesShield: boolean, _time: number) {
    this.player.health -= damage
    this.multiplier = 1
    this.flashTank(this.player, 0xffffff)
    this.spawnHitSpark(this.player.x, this.player.y)
    this.cameras.main.shake(90, 0.006)
    this.audio.hit()

    if (this.player.health <= 0) {
      this.endMatch('lost')
    }
  }

  private maybeDropPowerUp(x: number, y: number) {
    if (Math.random() > GAME_CONFIG.powerUpDropChance) {
      return
    }

    const type = this.rollPowerUpType()
    const color = this.powerUpColor(type)
    const size = type === 'nuke' ? 38 : type === 'magnet' ? 34 : 30
    const ring = this.add.circle(x, y, size * 0.72, color, 0.16).setStrokeStyle(2, color, 0.9).setDepth(3)
    const sprite = this.add.rectangle(x, y, size, size, color, 0.94).setStrokeStyle(3, 0x101411).setDepth(4)
    sprite.rotation = Math.PI / 4
    const label = this.add.text(x, y - 1, POWER_UP_LABELS[type], {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: type === 'doubleXp' || type === 'doubleGold' ? '10px' : '12px',
      color: '#101411',
      fontStyle: '900',
    }).setOrigin(0.5).setDepth(5)
    const subLabel = this.add.text(x, y + 22, this.powerUpName(type), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '9px',
      color: '#f4efe6',
      fontStyle: '900',
    }).setOrigin(0.5).setDepth(5)

    this.tweens.add({
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

  private rollPowerUpType(): PowerUpType {
    const roll = Math.random()
    if (roll < 0.14) {
      return 'repair'
    }
    if (roll < 0.25) {
      return 'doubleGold'
    }
    if (roll < 0.36) {
      return 'doubleXp'
    }
    if (roll < 0.56) {
      return 'magnet'
    }
    if (roll < 0.74) {
      return 'freeze'
    }
    if (roll < 0.9) {
      return 'overdrive'
    }
    return 'nuke'
  }

  private powerUpName(type: PowerUpType) {
    if (type === 'nuke') {
      return 'Nuke'
    }
    if (type === 'magnet') {
      return 'Magnet'
    }
    if (type === 'freeze') {
      return 'Freeze'
    }
    if (type === 'doubleGold') {
      return '2x Gold'
    }
    if (type === 'doubleXp') {
      return '2x XP'
    }
    if (type === 'repair') {
      return 'Repair'
    }
    return 'Overdrive'
  }

  private powerUpColor(type: PowerUpType) {
    if (type === 'nuke') {
      return GAME_CONFIG.colors.nuke
    }
    if (type === 'magnet') {
      return GAME_CONFIG.colors.magnet
    }
    if (type === 'freeze') {
      return GAME_CONFIG.colors.freeze
    }
    if (type === 'doubleGold') {
      return GAME_CONFIG.colors.doubleGold
    }
    if (type === 'doubleXp') {
      return GAME_CONFIG.colors.doubleXp
    }
    if (type === 'repair') {
      return GAME_CONFIG.colors.repair
    }
    return GAME_CONFIG.colors.overdrive
  }

  private updatePowerUps() {
    for (let index = this.powerUps.length - 1; index >= 0; index -= 1) {
      const powerUp = this.powerUps[index]
      if (!this.boundsOverlapRectangle(powerUp.sprite.getBounds(), this.tankBounds(this.player))) {
        continue
      }

      this.applyPowerUp(powerUp.type)
      powerUp.sprite.destroy()
      powerUp.label.destroy()
      powerUp.subLabel.destroy()
      powerUp.ring.destroy()
      this.powerUps.splice(index, 1)
    }
  }

  private applyPowerUp(type: PowerUpType) {
    const now = this.time.now
    if (type === 'nuke') {
      this.applyNuke()
    }
    if (type === 'magnet') {
      this.applyMagnet()
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
    this.spawnFloatingText(this.player.x, this.player.y - 30, this.powerUpName(type), this.powerUpColor(type))
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

  private applyMagnet() {
    for (const pickup of [...this.pickups]) {
      this.tweens.killTweensOf([pickup.sprite, pickup.label])
      this.tweens.add({
        targets: [pickup.sprite, pickup.label],
        x: this.player.x,
        y: this.player.y,
        duration: 260,
        ease: 'Cubic.easeIn',
        onComplete: () => this.collectPickup(pickup),
      })
    }
  }

  private dropPickup(type: 'xp' | 'gold', x: number, y: number, value: number) {
    const color = type === 'xp' ? GAME_CONFIG.colors.xp : 0xf6d365
    const labelText = type === 'xp' ? 'XP' : 'G'
    const sprite = this.add.circle(x, y, type === 'xp' ? 8 : 9, color, 0.9)
      .setStrokeStyle(2, 0x050706, 0.85)
      .setDepth(3)
    const label = this.add.text(x, y, labelText, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: type === 'xp' ? '8px' : '9px',
      color: '#101411',
      fontStyle: '900',
    }).setOrigin(0.5).setDepth(4)

    this.tweens.add({
      targets: [sprite, label],
      y: `+=${Phaser.Math.Between(-5, 5)}`,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.pickups.push({ type, value, sprite, label })
  }

  private updatePickups() {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index]
      const distance = Phaser.Math.Distance.Between(pickup.sprite.x, pickup.sprite.y, this.player.x, this.player.y)
      if (distance > this.pickupCollectRadius()) {
        continue
      }

      this.collectPickup(pickup)
    }
  }

  private collectPickup(pickup: PickupDrop) {
    const index = this.pickups.indexOf(pickup)
    if (index < 0 || !pickup.sprite.active) {
      return
    }

    if (pickup.type === 'xp') {
      this.gainXp(pickup.value)
      this.spawnFloatingText(pickup.sprite.x, pickup.sprite.y - 12, `+${pickup.value} XP`, GAME_CONFIG.colors.xp)
    } else {
      this.gold += pickup.value
      this.saveGold()
      this.spawnFloatingText(pickup.sprite.x, pickup.sprite.y - 12, `+${pickup.value}g`, 0xf6d365)
    }

    pickup.sprite.destroy()
    pickup.label.destroy()
    this.pickups.splice(index, 1)
  }

  private clearMines() {
    for (const mine of this.mines) {
      mine.sprite.destroy()
      mine.label.destroy()
    }
    this.mines = []
  }

  private spawnWaveMines(wave: WaveConfig) {
    if (wave.number < 4) {
      return
    }

    const mineCount = Phaser.Math.Between(1, Math.min(2 + Math.floor(wave.number / 4), 6))
    for (let index = 0; index < mineCount; index += 1) {
      for (let attempt = 0; attempt < 22; attempt += 1) {
        const x = Phaser.Math.Between(170, GAME_CONFIG.width - 72)
        const y = Phaser.Math.Between(66, GAME_CONFIG.height - 58)
        if (!this.minePositionIsClear(x, y)) {
          continue
        }

        const sprite = this.add.circle(x, y, 16, 0x171a17, 0.96)
          .setStrokeStyle(3, 0xff5d5d, 0.98)
          .setDepth(3)
        const label = this.add.text(x, y, 'MINE', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '7px',
          color: '#ffdf7e',
          fontStyle: '900',
        }).setOrigin(0.5).setDepth(4)
        this.tweens.add({
          targets: sprite,
          scale: 1.1,
          alpha: 0.72,
          duration: 560,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        this.mines.push({ sprite, label, damage: 2 + Math.floor(wave.number / 6), radius: 20 })
        break
      }
    }
  }

  private minePositionIsClear(x: number, y: number) {
    const bounds = this.squareBounds(x, y, 42)
    const farFromPlayer = !this.player || Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 130
    const awayFromMines = this.mines.every((mine) => Phaser.Math.Distance.Between(x, y, mine.sprite.x, mine.sprite.y) > 96)
    return farFromPlayer
      && awayFromMines
      && this.walls.every((wall) => !this.boundsOverlapRectangle(bounds, wall.getBounds()))
  }

  private updateMines(time: number) {
    for (let index = this.mines.length - 1; index >= 0; index -= 1) {
      const mine = this.mines[index]
      if (Phaser.Math.Distance.Between(mine.sprite.x, mine.sprite.y, this.player.x, this.player.y) > this.player.size / 2 + mine.radius) {
        continue
      }

      this.spawnExplosion(mine.sprite.x, mine.sprite.y)
      this.damagePlayer(mine.damage, true, time)
      mine.sprite.destroy()
      mine.label.destroy()
      this.mines.splice(index, 1)
    }
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
    this.spawnFloatingText(this.player.x, this.player.y - 34, `+${healAmount} HP`, GAME_CONFIG.colors.repair)
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
    const rarityColor = this.rarityColor(choice.rarity)
    const rarityHex = `#${rarityColor.toString(16).padStart(6, '0')}`
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
      card.fillStyle(rarityColor, hovered ? 0.32 : 0.2)
      card.fillRoundedRect(left + 14, top + 14, width - 28, 96, 4)
      card.fillStyle(0x050706, 0.52)
      card.fillRoundedRect(left + 24, top + 26, width - 48, 72, 5)
      card.fillStyle(rarityColor, 1)
      card.fillRoundedRect(left + 12, top + 18, 4, height - 36, 2)
      card.fillRoundedRect(left + width - 16, top + 18, 4, height - 36, 2)
      card.fillRect(left + 24, top + 18, width - 48, 3)
      card.fillStyle(0xffffff, hovered ? 0.08 : 0.04)
      card.fillTriangle(left + 16, top + 16, left + width - 18, top + 16, left + width - 54, top + 82)
      card.lineStyle(2, rarityColor, hovered ? 1 : 0.88)
      card.strokeRoundedRect(left, top, width, height, 8)
      card.lineStyle(1, 0xffffff, hovered ? 0.2 : 0.13)
      card.strokeRoundedRect(left + 8, top + 8, width - 16, height - 16, 5)
      card.lineStyle(1, 0xffffff, 0.09)
      card.lineBetween(left + 22, top + 122, left + width - 22, top + 122)
      card.lineStyle(2, rarityColor, hovered ? 0.82 : 0.5)
      card.lineBetween(left + 20, top + height - 18, left + width - 20, top + height - 18)
    }
    paintCard()
    const hover = this.add.graphics().setDepth(67)
    hover.lineStyle(3, 0xffffff, 0.72)
    hover.strokeRoundedRect(left - 4, top - 4, width + 8, height + 8, 9)
    hover.setAlpha(0)

    const badge = this.add.rectangle(left + 32, top + 34, 36, 28, rarityColor, 1).setDepth(68)
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
    const category = this.add.text(x, top + 132, this.upgradeCategory(choice.type), {
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
    const chip = this.add.text(x, top + height - 26, `${this.upgradeImpact(choice.type)}  ${levelText}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '12px',
      color: '#0b0f0d',
      backgroundColor: rarityHex,
      padding: { x: 8, y: 4 },
      align: 'center',
    }).setOrigin(0.5).setDepth(69)
    const iconObjects = this.drawUpgradeIcon(x, top + 70, choice.type, rarityColor)
    const progressObjects = this.drawUpgradeProgressPips(x, top + 111, choice.type, rarityColor, true)
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

  private upgradeCategory(type: UpgradeType) {
    if (type === 'armor') {
      return 'DEFENSE'
    }
    if (type === 'moveSpeed') {
      return 'MOBILITY'
    }
    if (type === 'scoreBonus') {
      return 'ECONOMY'
    }
    if (type === 'xpBoost') {
      return 'TRAINING'
    }
    return 'WEAPON'
  }

  private upgradeImpact(type: UpgradeType) {
    if (type === 'armor') {
      return '+1 ARMOR'
    }
    if (type === 'damage') {
      return '+DAMAGE'
    }
    if (type === 'fireRate') {
      return '+RATE'
    }
    if (type === 'moveSpeed') {
      return '+SPEED'
    }
    if (type === 'bulletSpeed') {
      return '+VELOCITY'
    }
    if (type === 'scoreBonus') {
      return '+SCORE'
    }
    if (type === 'doubleShot') {
      return '2X SHELLS'
    }
    if (type === 'tripleShot') {
      return '3-WAY'
    }
    if (type === 'critChance') {
      return '+CRIT %'
    }
    if (type === 'critDamage') {
      return '+CRIT DMG'
    }
    return '+XP'
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

  private rarityColor(rarity: UpgradeRarity) {
    if (rarity === 'epic') {
      return 0xb48cff
    }
    if (rarity === 'rare') {
      return 0xf6d365
    }
    return 0x7fb08f
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
    this.saveHighScore()
    this.banner.setText('')
    this.helper.setText('')
    this.showScreenPanel({
      eyebrow: nextState === 'won' ? 'MISSION COMPLETE' : 'RUN ENDED',
      title: nextState === 'won' ? 'Sector Clear' : 'Mission Failed',
      subtitle: `Final score ${this.score}  |  Best ${this.highScore}${this.isNewRecord ? '  |  New record' : ''}`,
      primary: 'Click or press R to restart',
      rows: [`Level ${this.level}`, `Map ${this.currentMapName}`, `Multiplier x${this.multiplier + this.buffs.scoreBonus}`],
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

    return outOfBounds || bullet.age > GAME_CONFIG.bulletLife || this.hitsWall(bullet.sprite)
  }

  private removeBullet(index: number) {
    this.bullets[index].sprite.destroy()
    this.bullets.splice(index, 1)
  }

  private hitsWall(object: { getBounds: () => Phaser.Geom.Rectangle }) {
    return this.walls.some((wall) => this.boundsOverlapRectangle(object.getBounds(), wall.getBounds()))
  }

  private boundsOverlapRectangle(
    first: Phaser.Geom.Rectangle,
    second: Phaser.Geom.Rectangle,
  ) {
    return Phaser.Geom.Intersects.RectangleToRectangle(first, second)
  }

  private lineBlocked(from: Tank, to: Tank) {
    const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y)
    return this.walls.some((wall) => Phaser.Geom.Intersects.LineToRectangle(line, wall.getBounds()))
  }

  private syncTankVisuals(tank: Tank) {
    tank.hull.setPosition(tank.x, tank.y)
    tank.turret.setPosition(tank.x, tank.y)
    tank.hull.rotation = tank.hullAngle + TANK_SPRITE_ROTATION_OFFSET
    tank.turret.rotation = tank.turretAngle + TANK_SPRITE_ROTATION_OFFSET
    this.drawEnemyHealthBar(tank)
  }

  private drawEnemyHealthBar(tank: Tank) {
    if (tank.kind !== 'enemy' || !tank.healthBar) {
      return
    }

    const width = tank.size * 0.86
    const height = 5
    const x = tank.x - width / 2
    const y = tank.y - tank.size / 2 - 10
    const progress = Phaser.Math.Clamp(tank.health / tank.maxHealth, 0, 1)
    const fill = progress > 0.45 ? 0x74eeb5 : progress > 0.2 ? 0xf6d365 : 0xff6b6b
    tank.healthBar.clear()
    tank.healthBar.fillStyle(0x050706, 0.86)
    tank.healthBar.fillRoundedRect(x, y, width, height, 2)
    tank.healthBar.fillStyle(fill, 0.96)
    tank.healthBar.fillRoundedRect(x, y, Math.max(1, width * progress), height, 2)
  }

  private moveTankAxis(tank: Tank, dx: number, dy: number) {
    if (dx === 0 && dy === 0) {
      return true
    }

    const previousX = tank.x
    const previousY = tank.y
    const nextPosition = this.clampTankPosition(tank.x + dx, tank.y + dy, tank.size)
    tank.x = nextPosition.x
    tank.y = nextPosition.y

    if (this.tankBlocked(tank)) {
      tank.x = previousX
      tank.y = previousY
      return false
    }

    return tank.x !== previousX || tank.y !== previousY
  }

  private canTankMove(tank: Tank, dx: number, dy: number) {
    const nextPosition = this.clampTankPosition(tank.x + dx, tank.y + dy, tank.size)
    return !this.tankBlockedAt(tank, nextPosition.x, nextPosition.y)
  }

  private clampTankPosition(x: number, y: number, size: number) {
    const halfSize = size / 2
    return {
      x: Phaser.Math.Clamp(x, halfSize + 10, GAME_CONFIG.width - halfSize - 10),
      y: Phaser.Math.Clamp(y, halfSize + 10, GAME_CONFIG.height - halfSize - 10),
    }
  }

  private tankBlocked(tank: Tank) {
    return this.tankBlockedAt(tank, tank.x, tank.y)
  }

  private tankBlockedAt(tank: Tank, x: number, y: number) {
    const bounds = this.tankBoundsAt(tank, x, y)
    if (this.walls.some((wall) => this.boundsOverlapRectangle(bounds, wall.getBounds()))) {
      return true
    }

    if (tank.kind === 'enemy' && this.player && this.boundsOverlapRectangle(bounds, this.tankBounds(this.player))) {
      return true
    }

    return false
  }

  private tankBounds(tank: Tank) {
    return this.tankBoundsAt(tank, tank.x, tank.y)
  }

  private tankBoundsAt(tank: Tank, x: number, y: number) {
    return this.squareBounds(x, y, tank.size)
  }

  private squareBounds(x: number, y: number, size: number) {
    return new Phaser.Geom.Rectangle(
      x - size / 2,
      y - size / 2,
      size,
      size,
    )
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
    this.publishSideHud(mods)

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
      if (this.upgradeLevel(type) > 0) {
        mods.push({ text: `${label} ${this.upgradeLevelText(type)}`, type })
      }
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

  private resolveSideHud() {
    const getElement = (key: string) => document.querySelector<HTMLElement>(`[data-hud="${key}"]`)
    const score = getElement('score')
    const best = getElement('best')
    const hpTop = getElement('hp-top')
    const hpBar = getElement('hp-bar')
    const xpBar = getElement('xp-bar')
    const xpText = getElement('xp-text')
    const wave = getElement('wave')
    const level = getElement('level')
    const multiplier = getElement('multiplier')
    const zone = getElement('zone')
    const mods = getElement('mods')
    const gold = getElement('gold')

    if (!score || !best || !hpTop || !hpBar || !xpBar || !xpText || !wave || !level || !multiplier || !zone || !mods || !gold) {
      return
    }

    this.sideHud = { score, best, hpTop, hpBar, xpBar, xpText, wave, level, multiplier, zone, mods, gold }
  }

  private bindShopControls() {
    const toggle = document.querySelector<HTMLButtonElement>('[data-shop-toggle]')
    const panel = document.querySelector<HTMLElement>('[data-shop-panel]')
    const setOpen = (open: boolean) => {
      if (!panel || !toggle) {
        return
      }
      if (open && this.state === 'playing') {
        this.shopPausedRun = true
        this.state = 'paused'
      }
      if (!open && this.shopPausedRun && this.state === 'paused') {
        this.state = 'playing'
        this.shopPausedRun = false
      }
      panel.hidden = !open
      toggle.setAttribute('aria-expanded', String(open))
      this.updateShopHud()
    }
    toggle?.addEventListener('click', () => setOpen(panel ? panel.hidden === true : true))
    document.querySelectorAll<HTMLElement>('[data-shop-close]').forEach((element) => {
      element.addEventListener('click', () => setOpen(false))
    })

    document.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((button) => {
      const type = button.dataset.shop as StatUpgradeType | undefined
      if (!type || !(type in STAT_UPGRADES)) {
        return
      }
      button.addEventListener('click', () => this.buyStatUpgrade(type))
    })
  }

  private buyStatUpgrade(type: StatUpgradeType) {
    const config = STAT_UPGRADES[type]
    const cost = this.statUpgradeCost(type)
    if (this.gold < cost) {
      if (this.player) {
        this.spawnFloatingText(this.player.x, this.player.y - 36, 'Need gold', 0xff6b6b)
      }
      return
    }

    this.gold -= cost
    this.statLevels[type] += 1
    this.saveGold()
    this.saveStatLevels()

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
      this.spawnFloatingText(this.player.x, this.player.y - 36, `${config.title} +1`, 0xf6d365)
    }
    this.publishSideHud(this.activeHudMods(this.time.now))
  }

  private statUpgradeCost(type: StatUpgradeType) {
    const config = STAT_UPGRADES[type]
    const level = this.statLevels[type]
    return Math.round((config.baseCost + level * config.costStep) * (1 + level * 0.08))
  }

  private publishSideHud(mods: HudMod[]) {
    if (!this.sideHud) {
      return
    }

    const waveNumber = this.pendingWave?.number ?? this.waveIndex + 1
    const health = this.player ? Math.max(this.player.health, 0) : GAME_CONFIG.player.maxHealth
    const maxHealth = this.player ? this.player.maxHealth : GAME_CONFIG.player.maxHealth
    const healthProgress = maxHealth > 0 ? Phaser.Math.Clamp(health / maxHealth, 0, 1) : 0
    const xpProgress = this.nextLevelXp > 0 ? Phaser.Math.Clamp(this.xp / this.nextLevelXp, 0, 1) : 0
    this.sideHud.score.textContent = this.score.toLocaleString('en-US')
    this.sideHud.best.textContent = this.highScore.toLocaleString('en-US')
    this.sideHud.hpTop.textContent = `${health}/${maxHealth}`
    this.sideHud.hpBar.style.width = `${healthProgress * 100}%`
    this.sideHud.xpBar.style.height = `${xpProgress * 100}%`
    this.sideHud.xpText.textContent = `${this.xp} / ${this.nextLevelXp} XP`
    this.sideHud.wave.textContent = `${waveNumber}`
    this.sideHud.level.textContent = `${this.level}`
    this.sideHud.multiplier.textContent = `x${this.multiplier + this.buffs.scoreBonus}`
    this.sideHud.zone.textContent = this.currentMapName
    this.sideHud.gold.textContent = this.gold.toLocaleString('en-US')
    this.sideHud.mods.replaceChildren(...mods.map((mod) => this.createHudModElement(mod)))
    this.updateShopHud()
  }

  private updateShopHud() {
    Object.keys(STAT_UPGRADES).forEach((key) => {
      const type = key as StatUpgradeType
      const level = this.statLevels[type]
      const cost = this.statUpgradeCost(type)
      const levelElement = document.querySelector<HTMLElement>(`[data-shop-level="${type}"]`)
      const costElement = document.querySelector<HTMLElement>(`[data-shop-cost="${type}"]`)
      const button = document.querySelector<HTMLButtonElement>(`[data-shop="${type}"]`)
      if (levelElement) {
        levelElement.textContent = `Lv ${level}`
      }
      if (costElement) {
        costElement.textContent = `${cost}g`
      }
      if (button) {
        button.disabled = this.gold < cost
      }
    })
  }

  private createHudModElement(mod: HudMod) {
    const item = document.createElement('div')
    const isMaxed = mod.type ? this.isUpgradeMaxed(mod.type) : false
    item.className = [
      'hud-mod',
      mod.temporary ? 'hud-mod--temporary' : '',
      isMaxed ? 'is-maxed' : '',
    ].filter(Boolean).join(' ')

    const label = document.createElement('span')
    label.textContent = mod.text
    item.appendChild(label)

    const pips = document.createElement('span')
    pips.className = 'hud-pips'
    if (mod.type) {
      const cap = this.upgradeCap(mod.type)
      const level = this.upgradeLevel(mod.type)
      const pipCount = Math.min(cap, 6)
      const filledPips = Math.ceil((level / cap) * pipCount)
      for (let index = 0; index < pipCount; index += 1) {
        const pip = document.createElement('span')
        pip.className = index < filledPips ? 'hud-pip is-filled' : 'hud-pip'
        pips.appendChild(pip)
      }
    }
    item.appendChild(pips)

    return item
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
    for (const powerUp of this.powerUps) {
      powerUp.sprite.destroy()
      powerUp.label.destroy()
      powerUp.subLabel.destroy()
      powerUp.ring.destroy()
    }
    for (const pickup of this.pickups) {
      pickup.sprite.destroy()
      pickup.label.destroy()
    }
    this.clearMines()
    if (this.player) {
      this.player.hull.destroy()
      this.player.turret.destroy()
    }

    this.clearUpgradeObjects()
    this.clearScreenPanel()
    this.bullets = []
    this.enemies = []
    this.powerUps = []
    this.pickups = []
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

  private flashTank(tank: Tank, color: number) {
    tank.hull.setTint(color)
    tank.turret.setTint(color)
    this.time.delayedCall(90, () => {
      if (tank.hull.active) {
        tank.hull.clearTint()
        tank.turret.clearTint()
      }
    })
  }

  private spawnMuzzleFlash(x: number, y: number, angle: number) {
    const flash = this.add.image(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, 'muzzle-flash')
      .setDisplaySize(24, 24)
      .setDepth(7)
      .setAlpha(0.9)
    flash.rotation = angle + TANK_SPRITE_ROTATION_OFFSET
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.4,
      duration: 90,
      onComplete: () => flash.destroy(),
    })
  }

  private spawnHitSpark(x: number, y: number) {
    for (let index = 0; index < 7; index += 1) {
      const spark = this.add.rectangle(x, y, 8, 2, 0xffd166)
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const distance = Phaser.Math.Between(18, 36)
      spark.rotation = angle
      this.tweens.add({
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

  private spawnBlastRing(x: number, y: number, radius: number, color: number) {
    const ring = this.add.circle(x, y, 8, color, 0.12)
      .setStrokeStyle(3, color, 0.8)
      .setDepth(7)
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 210,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  private spawnDamageNumber(x: number, y: number, damage: number, critical = false) {
    const text = this.add.text(x, y, critical ? `${damage}!` : `${damage}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: critical ? '18px' : '14px',
      color: critical ? '#f6d365' : '#fff8dd',
      fontStyle: '900',
      stroke: '#050706',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12)
    this.tweens.add({
      targets: text,
      y: y - 24,
      alpha: 0,
      duration: critical ? 520 : 380,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  private spawnFloatingText(x: number, y: number, message: string, color: number) {
    const text = this.add.text(x, y, message, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: '900',
      stroke: '#050706',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12)
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  private spawnExplosion(x: number, y: number) {
    this.cameras.main.shake(110, 0.004)
    const blast = this.add.image(x, y, 'explosion-1').setDisplaySize(58, 58).setDepth(9)
    for (let frame = 2; frame <= 5; frame += 1) {
      this.time.delayedCall((frame - 1) * 42, () => {
        if (blast.active) {
          blast.setTexture(`explosion-${frame}`)
        }
      })
    }
    this.tweens.add({
      targets: blast,
      scale: 1.35,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => blast.destroy(),
    })
    for (let index = 0; index < 12; index += 1) {
      const shard = this.add.rectangle(x, y, 12, 4, index % 2 === 0 ? 0xff6b6b : 0xf6d365)
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const distance = Phaser.Math.Between(34, 72)
      shard.rotation = angle
      this.tweens.add({
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

  private loadHighScore() {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY)
    return stored ? Number.parseInt(stored, 10) || 0 : 0
  }

  private saveHighScore() {
    if (this.score <= this.highScore) {
      return
    }

    this.highScore = this.score
    this.isNewRecord = true
    window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore))
  }

  private loadGold() {
    const stored = window.localStorage.getItem(GOLD_KEY)
    return stored ? Math.max(0, Number.parseInt(stored, 10) || 0) : 0
  }

  private saveGold() {
    window.localStorage.setItem(GOLD_KEY, String(Math.max(0, Math.floor(this.gold))))
  }

  private loadStatLevels(): Record<StatUpgradeType, number> {
    const levels = this.createEmptyStatLevels()
    const stored = window.localStorage.getItem(STAT_LEVELS_KEY)
    if (!stored) {
      return levels
    }

    try {
      const parsed = JSON.parse(stored) as Partial<Record<StatUpgradeType, number>>
      Object.keys(levels).forEach((key) => {
        const type = key as StatUpgradeType
        const value = parsed[type]
        if (typeof value === 'number' && Number.isFinite(value)) {
          levels[type] = Math.max(0, Math.floor(value))
        }
      })
    } catch {
      return levels
    }

    return levels
  }

  private saveStatLevels() {
    window.localStorage.setItem(STAT_LEVELS_KEY, JSON.stringify(this.statLevels))
  }
}
