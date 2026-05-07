import { GAME_CONFIG } from './config'

export type TankClassId = 'engineer' | 'scout' | 'heavy' | 'sniper' | 'bomber'

export type TankClassAbility = {
  goldMultiplier?: number
  pickupRadiusBonus?: number
  damageTakenMultiplier?: number
  critChanceBonus?: number
  forceExplosiveRadius?: number
}

export type TankClass = {
  id: TankClassId
  name: string
  tagline: string
  description: string
  bodyAsset: string
  barrelAsset: string
  iconUrl: string
  baseStats: {
    maxHealth: number
    speed: number
    fireDelay: number
    bulletSpeed: number
    damage: number
  }
  ability: TankClassAbility
  unlock: {
    waveMilestone: number
    goldCost: number
    freeFromStart: boolean
  }
}

export const TANK_CLASSES: Record<TankClassId, TankClass> = {
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    tagline: 'Loadout veteran',
    description: 'Balanced profile with bonus gold from every kill.',
    bodyAsset: 'tank-player-body',
    barrelAsset: 'tank-player-barrel',
    iconUrl: '/assets/kenney-tanks/tankBody_blue.png',
    baseStats: {
      maxHealth: GAME_CONFIG.player.maxHealth,
      speed: GAME_CONFIG.player.speed,
      fireDelay: GAME_CONFIG.player.fireDelay,
      bulletSpeed: GAME_CONFIG.player.bulletSpeed,
      damage: GAME_CONFIG.player.damage,
    },
    ability: { goldMultiplier: 1.5 },
    unlock: { waveMilestone: 0, goldCost: 0, freeFromStart: true },
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    tagline: 'Glass cannon runner',
    description: 'Fast chassis with extended pickup magnet, paper armor.',
    bodyAsset: 'tank-scout-body',
    barrelAsset: 'tank-scout-barrel',
    iconUrl: '/assets/kenney-tanks/tankBody_green.png',
    baseStats: {
      maxHealth: 4,
      speed: 305,
      fireDelay: 175,
      bulletSpeed: 600,
      damage: 2,
    },
    ability: { pickupRadiusBonus: 32 },
    unlock: { waveMilestone: 6, goldCost: 600, freeFromStart: false },
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    tagline: 'Walking bunker',
    description: 'Massive armor, slower but takes 25% less damage.',
    bodyAsset: 'tank-heavy-body',
    barrelAsset: 'tank-heavy-barrel',
    iconUrl: '/assets/kenney-tanks/tankBody_darkLarge.png',
    baseStats: {
      maxHealth: 10,
      speed: 195,
      fireDelay: 280,
      bulletSpeed: 520,
      damage: 3,
    },
    ability: { damageTakenMultiplier: 0.75 },
    unlock: { waveMilestone: 14, goldCost: 1800, freeFromStart: false },
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    tagline: 'Long-range surgeon',
    description: 'Slow fire, deadly crits. +20% baseline critical chance.',
    bodyAsset: 'tank-sniper-body',
    barrelAsset: 'tank-sniper-barrel',
    iconUrl: '/assets/kenney-tanks/tankBody_red.png',
    baseStats: {
      maxHealth: 5,
      speed: 230,
      fireDelay: 360,
      bulletSpeed: 720,
      damage: 3,
    },
    ability: { critChanceBonus: 0.2 },
    unlock: { waveMilestone: 22, goldCost: 2800, freeFromStart: false },
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    tagline: 'Demolition specialist',
    description: 'Every shell detonates. Smaller magazine of pain.',
    bodyAsset: 'tank-heavy-body',
    barrelAsset: 'tank-heavy-barrel',
    iconUrl: '/assets/kenney-tanks/tankBody_darkLarge.png',
    baseStats: {
      maxHealth: 6,
      speed: 220,
      fireDelay: 260,
      bulletSpeed: 540,
      damage: 2,
    },
    ability: { forceExplosiveRadius: 36 },
    unlock: { waveMilestone: 32, goldCost: 4500, freeFromStart: false },
  },
}

export const CLASS_ORDER: TankClassId[] = ['engineer', 'scout', 'heavy', 'sniper', 'bomber']

export function defaultActiveClassId(): TankClassId {
  return 'engineer'
}

export function isClassUnlockedByWave(classDef: TankClass, peakWave: number) {
  return classDef.unlock.waveMilestone > 0 && peakWave >= classDef.unlock.waveMilestone
}
