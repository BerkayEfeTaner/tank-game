import type { UpgradeRarity, UpgradeType } from './types'

export const UPGRADE_CAPS: Record<UpgradeType, number> = {
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
  bulletGirth: 4,
  vampireBite: 1,
  ricochet: 1,
  adrenalineRush: 1,
  berserker: 1,
  phaseShift: 1,
  omegaShell: 1,
  healPack: 5,
  shieldBoost: 3,
  goldRush: 3,
}

export const HUD_UPGRADE_LABELS: Array<[UpgradeType, string]> = [
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
  ['bulletGirth', 'GIRTH'],
  ['vampireBite', 'VAMP'],
  ['ricochet', 'BOUNCE'],
  ['adrenalineRush', 'ADREN'],
  ['berserker', 'BSRK'],
  ['phaseShift', 'PHASE'],
  ['omegaShell', 'OMEGA'],
]

export const RARITY_WEIGHTS: Record<UpgradeRarity, number> = {
  common: 40,
  uncommon: 25,
  rare: 16,
  epic: 10,
  legendary: 6,
  mythic: 3,
}

export const RARITY_ORDER: UpgradeRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
]

export function rarityColor(rarity: UpgradeRarity): number {
  if (rarity === 'mythic') return 0xff5d5d
  if (rarity === 'legendary') return 0xf6d365
  if (rarity === 'epic') return 0xb48cff
  if (rarity === 'rare') return 0x6fb3ff
  if (rarity === 'uncommon') return 0x6fdf7d
  return 0xe6e8eb
}

export function rarityLabel(rarity: UpgradeRarity): string {
  return rarity.toUpperCase()
}

export function upgradeCategory(type: UpgradeType): string {
  if (type === 'armor' || type === 'shieldBoost' || type === 'phaseShift') return 'DEFENSE'
  if (type === 'moveSpeed') return 'MOBILITY'
  if (type === 'scoreBonus' || type === 'goldRush') return 'ECONOMY'
  if (type === 'xpBoost') return 'TRAINING'
  if (type === 'healPack' || type === 'vampireBite') return 'MEDIC'
  if (type === 'pickupRadius') return 'SUPPORT'
  return 'WEAPON'
}

export function upgradeImpact(type: UpgradeType): string {
  if (type === 'armor') return '+1 ARMOR'
  if (type === 'damage') return '+DAMAGE'
  if (type === 'fireRate') return '+RATE'
  if (type === 'moveSpeed') return '+SPEED'
  if (type === 'bulletSpeed') return '+VELOCITY'
  if (type === 'scoreBonus') return '+SCORE'
  if (type === 'doubleShot') return '2X SHELLS'
  if (type === 'tripleShot') return '3-WAY'
  if (type === 'critChance') return '+CRIT %'
  if (type === 'critDamage') return '+CRIT DMG'
  if (type === 'xpBoost') return '+XP GAIN'
  if (type === 'piercingShell') return '+PIERCE'
  if (type === 'explosiveShell') return '+SPLASH'
  if (type === 'pickupRadius') return '+MAGNET'
  if (type === 'bossDamage') return '+BOSS DMG'
  if (type === 'bulletGirth') return '+GIRTH'
  if (type === 'vampireBite') return 'VAMPIRIC'
  if (type === 'ricochet') return 'BOUNCE'
  if (type === 'adrenalineRush') return 'WAVE BUFF'
  if (type === 'berserker') return 'LOW HP'
  if (type === 'phaseShift') return 'INVULN'
  if (type === 'omegaShell') return 'MEGA'
  if (type === 'healPack') return '+3 HP'
  if (type === 'shieldBoost') return '+1 MAX'
  if (type === 'goldRush') return '+60% GOLD'
  return '+POWER'
}
