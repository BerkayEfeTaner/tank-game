import type { EnemyType, PowerUpType, UpgradeOption } from './types'

export const GAME_CONFIG = {
  width: 960,
  height: 540,
  player: {
    speed: 245,
    maxHealth: 6,
    fireDelay: 210,
    bulletSpeed: 560,
    damage: 2,
  },
  bulletLife: 1500,
  powerUpDropChance: 0.28,
  colors: {
    ground: '#19201d',
    panel: '#0e1311',
    text: '#f4efe6',
    muted: '#aab6a9',
    player: 0x5fd08f,
    playerTurret: 0xd8f7de,
    enemy: 0xc95757,
    enemyTurret: 0xffd166,
    wall: 0x4f5b4d,
    nuke: 0xff6b6b,
    magnet: 0xa78bfa,
    doubleGold: 0xf6d365,
    doubleXp: 0x7cf6c9,
    freeze: 0xa7dcff,
    repair: 0x74eeb5,
    overdrive: 0xff9f43,
    xp: 0x7cf6c9,
    xpTrack: 0x26342d,
  },
}

export const ENEMY_STATS: Record<EnemyType, {
  hullColor: number
  turretColor: number
  health: number
  speed: number
  fireDelay: number
  bulletSpeed: number
  scoreValue: number
  damage: number
  preferredRange: number
  accuracy: number
  separationRadius: number
}> = {
  scout: {
    hullColor: 0xd66a4e,
    turretColor: 0xffd166,
    health: 5,
    speed: 92,
    fireDelay: 980,
    bulletSpeed: 300,
    scoreValue: 115,
    damage: 1,
    preferredRange: 185,
    accuracy: 0.18,
    separationRadius: 54,
  },
  heavy: {
    hullColor: 0x9b4d5c,
    turretColor: 0xffb26f,
    health: 10,
    speed: 44,
    fireDelay: 1280,
    bulletSpeed: 255,
    scoreValue: 190,
    damage: 2,
    preferredRange: 230,
    accuracy: 0.12,
    separationRadius: 68,
  },
  sniper: {
    hullColor: 0x6e7fd6,
    turretColor: 0xd7e3ff,
    health: 6,
    speed: 58,
    fireDelay: 1550,
    bulletSpeed: 390,
    scoreValue: 170,
    damage: 2,
    preferredRange: 330,
    accuracy: 0.08,
    separationRadius: 62,
  },
  charger: {
    hullColor: 0xff8a3d,
    turretColor: 0xffd166,
    health: 7,
    speed: 122,
    fireDelay: 1380,
    bulletSpeed: 260,
    scoreValue: 135,
    damage: 1,
    preferredRange: 62,
    accuracy: 0.18,
    separationRadius: 58,
  },
  bomber: {
    hullColor: 0xe85d75,
    turretColor: 0xf6d365,
    health: 6,
    speed: 76,
    fireDelay: 1800,
    bulletSpeed: 230,
    scoreValue: 155,
    damage: 2,
    preferredRange: 42,
    accuracy: 0.18,
    separationRadius: 62,
  },
  shield: {
    hullColor: 0x6bb58f,
    turretColor: 0xbff7d5,
    health: 14,
    speed: 46,
    fireDelay: 1250,
    bulletSpeed: 250,
    scoreValue: 210,
    damage: 1,
    preferredRange: 180,
    accuracy: 0.15,
    separationRadius: 76,
  },
  boss: {
    hullColor: 0x5f3140,
    turretColor: 0xffd166,
    health: 28,
    speed: 34,
    fireDelay: 1180,
    bulletSpeed: 310,
    scoreValue: 900,
    damage: 2,
    preferredRange: 250,
    accuracy: 0.1,
    separationRadius: 96,
  },
}

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  nuke: 'NUKE',
  magnet: 'MAG',
  freeze: 'ICE',
  doubleGold: '2X G',
  doubleXp: '2X XP',
  repair: 'HP',
  overdrive: 'CRIT+',
}

export const UPGRADE_OPTIONS: UpgradeOption[] = [
  // common — basic frontline tweaks
  { type: 'armor', title: 'Reinforced Armor', description: '+1 max armor and repair 1', rarity: 'common' },
  { type: 'damage', title: 'Heavy Shells', description: '+1 damage per shell', rarity: 'common' },
  { type: 'fireRate', title: 'Fast Loader', description: 'Fire rate improves', rarity: 'common' },
  { type: 'moveSpeed', title: 'Tuned Engine', description: 'Move speed improves', rarity: 'common' },
  { type: 'bulletSpeed', title: 'High Velocity', description: 'Bullets travel faster', rarity: 'common' },
  { type: 'pickupRadius', title: 'Signal Magnet', description: 'Collect XP and gold from farther away', rarity: 'common' },
  { type: 'healPack', title: 'Field Med Pack', description: 'Instantly restore 3 armor', rarity: 'common' },

  // uncommon — quality of life buffs
  { type: 'xpBoost', title: 'Field Training', description: 'Gain more XP from kills', rarity: 'uncommon' },
  { type: 'critChance', title: 'Targeting Optics', description: 'Critical chance improves', rarity: 'uncommon' },
  { type: 'scoreBonus', title: 'Combat Streak', description: 'Permanent score bonus', rarity: 'uncommon' },
  { type: 'bulletGirth', title: 'Battalion Caliber', description: 'Bigger shells, +5% damage per stack', rarity: 'uncommon' },
  { type: 'shieldBoost', title: 'Shield Booster', description: '+1 max armor and full repair', rarity: 'uncommon' },

  // rare — tactical edge
  { type: 'critDamage', title: 'Weak Point Rounds', description: 'Critical hits hurt more', rarity: 'rare' },
  { type: 'piercingShell', title: 'Piercing Shells', description: 'Shells pass through extra targets', rarity: 'rare' },
  { type: 'bossDamage', title: 'Commander Breaker', description: 'Deal bonus damage to boss tanks', rarity: 'rare' },
  { type: 'vampireBite', title: 'Vampire Bite', description: 'Heal 1 HP every 6 kills', rarity: 'rare' },
  { type: 'goldRush', title: 'Gold Rush', description: '+60% gold drops for 60 seconds', rarity: 'rare' },

  // epic — game-shaping
  { type: 'explosiveShell', title: 'Explosive Rounds', description: 'Shells splash nearby enemies', rarity: 'epic' },
  { type: 'doubleShot', title: 'Twin Cannons', description: 'Fire an extra parallel shell', rarity: 'epic' },
  { type: 'ricochet', title: 'Ricochet Plating', description: 'Shells bounce off walls once', rarity: 'epic' },
  { type: 'adrenalineRush', title: 'Adrenaline Rush', description: 'Free 5s overdrive after each wave', rarity: 'epic' },

  // legendary — rare power spikes
  { type: 'tripleShot', title: 'Scatter Barrel', description: 'Fire forward and diagonal shells', rarity: 'legendary' },
  { type: 'berserker', title: 'Berserker Reactor', description: '+35% damage when below 30% HP', rarity: 'legendary' },
  { type: 'phaseShift', title: 'Phase Shift Field', description: '0.7s invulnerability after a hit', rarity: 'legendary' },

  // mythic — game-altering
  { type: 'omegaShell', title: 'Omega Shell', description: 'Every 10th shot is a mega-blast', rarity: 'mythic' },
]

export const WAVES = [
  { number: 1, enemies: [{ type: 'scout', count: 6 }] },
  { number: 2, enemies: [{ type: 'scout', count: 8 }] },
  { number: 3, enemies: [{ type: 'scout', count: 8 }, { type: 'charger', count: 1 }, { type: 'heavy', count: 1 }] },
  { number: 4, enemies: [{ type: 'scout', count: 9 }, { type: 'charger', count: 2 }, { type: 'heavy', count: 2 }, { type: 'sniper', count: 1 }] },
] as const
