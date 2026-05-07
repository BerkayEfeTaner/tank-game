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
]

export function rarityColor(rarity: UpgradeRarity): number {
  if (rarity === 'epic') return 0xb48cff
  if (rarity === 'rare') return 0xf6d365
  return 0x7fb08f
}

export function upgradeCategory(type: UpgradeType): string {
  if (type === 'armor') return 'DEFENSE'
  if (type === 'moveSpeed') return 'MOBILITY'
  if (type === 'scoreBonus') return 'ECONOMY'
  if (type === 'xpBoost') return 'TRAINING'
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
  return '+XP'
}
