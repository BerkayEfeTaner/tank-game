import type { StatUpgradeType } from './types'

export const STAT_UPGRADES: Record<
  StatUpgradeType,
  { title: string; description: string; baseCost: number; costStep: number; iconUrl: string }
> = {
  maxHealth: {
    title: 'Max HP',
    description: '+1 maximum armor segment',
    baseCost: 60,
    costStep: 38,
    iconUrl: '/assets/kenney-tanks/barricadeMetal.png',
  },
  damage: {
    title: 'Damage',
    description: '+1 damage per shell',
    baseCost: 80,
    costStep: 55,
    iconUrl: '/assets/kenney-tanks/bulletBlue3_outline.png',
  },
  fireRate: {
    title: 'Fire Rate',
    description: '−12 ms reload window',
    baseCost: 70,
    costStep: 48,
    iconUrl: '/assets/kenney-tanks/shotOrange.png',
  },
  critChance: {
    title: 'Crit Chance',
    description: '+2.5% critical hit chance',
    baseCost: 90,
    costStep: 62,
    iconUrl: '/assets/kenney-tanks/shotOrange.png',
  },
  critDamage: {
    title: 'Crit Damage',
    description: '+15% critical multiplier',
    baseCost: 100,
    costStep: 72,
    iconUrl: '/assets/kenney-tanks/shotOrange.png',
  },
  moveSpeed: {
    title: 'Move Speed',
    description: '+10 base speed',
    baseCost: 85,
    costStep: 58,
    iconUrl: '/assets/kenney-tanks/tankBody_green.png',
  },
  pickupRadius: {
    title: 'Pickup Range',
    description: '+12 magnet radius',
    baseCost: 75,
    costStep: 50,
    iconUrl: '/assets/kenney-tanks/crateWood.png',
  },
  armorRegen: {
    title: 'Armor Regen',
    description: '+1 HP after each wave',
    baseCost: 120,
    costStep: 78,
    iconUrl: '/assets/kenney-tanks/barricadeMetal.png',
  },
  bossDamage: {
    title: 'Boss Damage',
    description: '+6% damage to bosses',
    baseCost: 130,
    costStep: 85,
    iconUrl: '/assets/kenney-tanks/tankBody_darkLarge.png',
  },
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
