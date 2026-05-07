import type Phaser from 'phaser'

export type GameState = 'menu' | 'playing' | 'paused' | 'upgrade' | 'won' | 'lost'
export type TankKind = 'player' | 'enemy'
export type EnemyType = 'scout' | 'heavy' | 'sniper' | 'charger' | 'bomber' | 'shield' | 'boss'
export type BossStyle = 'vanguard' | 'artillery' | 'swarm' | 'warden' | 'blitz'
export type PowerUpType = 'nuke' | 'magnet' | 'freeze' | 'doubleGold' | 'doubleXp' | 'repair' | 'overdrive'
export type UpgradeRarity = 'common' | 'rare' | 'epic'
export type UpgradeType =
  | 'armor'
  | 'damage'
  | 'fireRate'
  | 'moveSpeed'
  | 'bulletSpeed'
  | 'critChance'
  | 'critDamage'
  | 'scoreBonus'
  | 'doubleShot'
  | 'tripleShot'
  | 'xpBoost'
  | 'piercingShell'
  | 'explosiveShell'
  | 'pickupRadius'
  | 'bossDamage'
export type StatUpgradeType =
  | 'maxHealth'
  | 'damage'
  | 'fireRate'
  | 'critChance'
  | 'critDamage'
  | 'moveSpeed'
  | 'pickupRadius'
  | 'armorRegen'
  | 'bossDamage'
export type PickupType = 'xp' | 'gold'

export type Tank = {
  kind: TankKind
  enemyType?: EnemyType
  x: number
  y: number
  size: number
  hull: Phaser.GameObjects.Image
  turret: Phaser.GameObjects.Image
  hullAngle: number
  turretAngle: number
  health: number
  maxHealth: number
  lastFire: number
  moveAngle: number
  rethinkAt: number
  speed: number
  fireDelay: number
  bulletSpeed: number
  scoreValue: number
  damage: number
  preferredRange: number
  accuracy: number
  separationRadius: number
  strafeDirection: -1 | 1
  bossStyle?: BossStyle
  nextAbilityAt?: number
  enraged?: boolean
  healthBar?: Phaser.GameObjects.Graphics
}

export type Bullet = {
  sprite: Phaser.GameObjects.Image
  velocity: Phaser.Math.Vector2
  fromPlayer: boolean
  age: number
  damage: number
  critical?: boolean
  piercesShield?: boolean
  piercesLeft?: number
  explosiveRadius?: number
}

export type PowerUp = {
  type: PowerUpType
  sprite: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  subLabel: Phaser.GameObjects.Text
  ring: Phaser.GameObjects.Arc
}

export type PickupDrop = {
  type: PickupType
  value: number
  sprite: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  attracting?: boolean
}

export type Mine = {
  sprite: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  damage: number
  radius: number
}

export type PlayerBuffs = {
  doubleGoldUntil: number
  doubleXpUntil: number
  freezeUntil: number
  overdriveUntil: number
  scoreBonus: number
  doubleShot: number
  tripleShot: number
  xpBonus: number
}

export type UpgradeOption = {
  type: UpgradeType
  title: string
  description: string
  rarity: UpgradeRarity
}

export type WaveEnemy = {
  type: EnemyType
  count: number
}

export type WaveConfig = {
  number: number
  enemies: WaveEnemy[]
}
