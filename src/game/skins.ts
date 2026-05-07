import type { TankClassId } from './classes'

export type SkinId = string

export type TankSkin = {
  id: SkinId
  classId: TankClassId
  name: string
  description: string
  hullTint: number
  turretTint: number
  previewFilter?: string
  goldCost: number
  freeFromStart: boolean
}

const STOCK_TINT = 0xffffff

export const TANK_SKINS: TankSkin[] = [
  // Engineer
  {
    id: 'engineer-stock',
    classId: 'engineer',
    name: 'Engineer · Stock',
    description: 'Standard issue blue plating.',
    hullTint: STOCK_TINT,
    turretTint: STOCK_TINT,
    goldCost: 0,
    freeFromStart: true,
  },
  {
    id: 'engineer-carbon',
    classId: 'engineer',
    name: 'Engineer · Carbon',
    description: 'Matte midnight finish with cyan accents.',
    hullTint: 0x4f5d68,
    turretTint: 0x9ee2ff,
    previewFilter: 'brightness(0.45) contrast(1.4) hue-rotate(180deg)',
    goldCost: 600,
    freeFromStart: false,
  },

  // Scout
  {
    id: 'scout-stock',
    classId: 'scout',
    name: 'Scout · Forest',
    description: 'Default green camo plating.',
    hullTint: STOCK_TINT,
    turretTint: STOCK_TINT,
    goldCost: 0,
    freeFromStart: true,
  },
  {
    id: 'scout-neon',
    classId: 'scout',
    name: 'Scout · Neon',
    description: 'Lime fluorescent skin for high visibility runs.',
    hullTint: 0x9eff5e,
    turretTint: 0xfffea7,
    previewFilter: 'hue-rotate(70deg) saturate(2.4) brightness(1.3)',
    goldCost: 700,
    freeFromStart: false,
  },

  // Heavy
  {
    id: 'heavy-stock',
    classId: 'heavy',
    name: 'Heavy · Iron',
    description: 'Default reinforced steel chassis.',
    hullTint: STOCK_TINT,
    turretTint: STOCK_TINT,
    goldCost: 0,
    freeFromStart: true,
  },
  {
    id: 'heavy-magma',
    classId: 'heavy',
    name: 'Heavy · Magma',
    description: 'Battle-scarred orange and ember accents.',
    hullTint: 0xff7a3d,
    turretTint: 0xffd166,
    previewFilter: 'hue-rotate(-25deg) saturate(2.2) brightness(1.25)',
    goldCost: 900,
    freeFromStart: false,
  },

  // Sniper
  {
    id: 'sniper-stock',
    classId: 'sniper',
    name: 'Sniper · Crimson',
    description: 'Standard red sharpshooter livery.',
    hullTint: STOCK_TINT,
    turretTint: STOCK_TINT,
    goldCost: 0,
    freeFromStart: true,
  },
  {
    id: 'sniper-violet',
    classId: 'sniper',
    name: 'Sniper · Violet',
    description: 'Stealth purple coating with chrome barrel.',
    hullTint: 0xa46bff,
    turretTint: 0xeaeaea,
    previewFilter: 'hue-rotate(80deg) saturate(1.5) brightness(1.15)',
    goldCost: 1000,
    freeFromStart: false,
  },

  // Bomber
  {
    id: 'bomber-stock',
    classId: 'bomber',
    name: 'Bomber · Sand',
    description: 'Default desert demolition rig.',
    hullTint: STOCK_TINT,
    turretTint: STOCK_TINT,
    goldCost: 0,
    freeFromStart: true,
  },
  {
    id: 'bomber-onyx',
    classId: 'bomber',
    name: 'Bomber · Onyx',
    description: 'Pitch black armor with gold filigree.',
    hullTint: 0x2a2a2a,
    turretTint: 0xf6d365,
    previewFilter: 'brightness(0.3) contrast(1.6)',
    goldCost: 1200,
    freeFromStart: false,
  },
]

export function skinsForClass(classId: TankClassId): TankSkin[] {
  return TANK_SKINS.filter((skin) => skin.classId === classId)
}

export function findSkin(skinId: SkinId): TankSkin | undefined {
  return TANK_SKINS.find((skin) => skin.id === skinId)
}

export function defaultSkinFor(classId: TankClassId): SkinId {
  const stock = TANK_SKINS.find((skin) => skin.classId === classId && skin.freeFromStart)
  return stock?.id ?? `${classId}-stock`
}
