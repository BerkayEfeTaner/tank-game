import type { StatUpgradeType } from './types'

export const STAT_UPGRADES: Record<
  StatUpgradeType,
  { title: string; baseCost: number; costStep: number }
> = {
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

export function createEmptyStatLevels(): Record<StatUpgradeType, number> {
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

export function statUpgradeCost(type: StatUpgradeType, currentLevel: number) {
  const config = STAT_UPGRADES[type]
  return Math.round((config.baseCost + currentLevel * config.costStep) * (1 + currentLevel * 0.08))
}
