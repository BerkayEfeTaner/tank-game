import type { StatUpgradeType } from './types'
import { createEmptyStatLevels } from './stats'
import {
  CLASS_ORDER,
  TANK_CLASSES,
  defaultActiveClassId,
  type TankClassId,
} from './classes'
import { TANK_SKINS, defaultSkinFor, findSkin, type SkinId } from './skins'

const HIGH_SCORE_KEY = 'tank-game.high-score'
const GOLD_KEY = 'tank-game.gold'
const STAT_LEVELS_KEY = 'tank-game.stat-levels'
const OWNED_CLASSES_KEY = 'tank-game.owned-classes'
const ACTIVE_CLASS_KEY = 'tank-game.active-class'
const OWNED_SKINS_KEY = 'tank-game.owned-skins'
const ACTIVE_SKIN_KEY = 'tank-game.active-skin'
const PEAK_WAVE_KEY = 'tank-game.peak-wave'

export function loadHighScore(): number {
  const stored = window.localStorage.getItem(HIGH_SCORE_KEY)
  return stored ? Number.parseInt(stored, 10) || 0 : 0
}

export function saveHighScore(score: number) {
  window.localStorage.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
}

export function loadGold(): number {
  const stored = window.localStorage.getItem(GOLD_KEY)
  return stored ? Math.max(0, Number.parseInt(stored, 10) || 0) : 0
}

export function saveGold(gold: number) {
  window.localStorage.setItem(GOLD_KEY, String(Math.max(0, Math.floor(gold))))
}

export function loadStatLevels(): Record<StatUpgradeType, number> {
  const levels = createEmptyStatLevels()
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

export function saveStatLevels(levels: Record<StatUpgradeType, number>) {
  window.localStorage.setItem(STAT_LEVELS_KEY, JSON.stringify(levels))
}

export function loadOwnedClasses(): TankClassId[] {
  const owned = new Set<TankClassId>()
  CLASS_ORDER.forEach((id) => {
    if (TANK_CLASSES[id].unlock.freeFromStart) {
      owned.add(id)
    }
  })

  const stored = window.localStorage.getItem(OWNED_CLASSES_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (typeof value === 'string' && value in TANK_CLASSES) {
            owned.add(value as TankClassId)
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return CLASS_ORDER.filter((id) => owned.has(id))
}

export function saveOwnedClasses(owned: TankClassId[]) {
  window.localStorage.setItem(OWNED_CLASSES_KEY, JSON.stringify(owned))
}

export function loadActiveClass(ownedFallback: TankClassId[]): TankClassId {
  const stored = window.localStorage.getItem(ACTIVE_CLASS_KEY)
  if (stored && stored in TANK_CLASSES && ownedFallback.includes(stored as TankClassId)) {
    return stored as TankClassId
  }
  return ownedFallback[0] ?? defaultActiveClassId()
}

export function saveActiveClass(classId: TankClassId) {
  window.localStorage.setItem(ACTIVE_CLASS_KEY, classId)
}

export function loadOwnedSkins(): Record<TankClassId, SkinId[]> {
  const owned = {} as Record<TankClassId, SkinId[]>
  CLASS_ORDER.forEach((classId) => {
    owned[classId] = []
  })
  TANK_SKINS.forEach((skin) => {
    if (skin.freeFromStart) {
      owned[skin.classId].push(skin.id)
    }
  })

  const stored = window.localStorage.getItem(OWNED_SKINS_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>
      Object.entries(parsed).forEach(([classId, ids]) => {
        if (!(classId in TANK_CLASSES) || !Array.isArray(ids)) {
          return
        }
        for (const id of ids) {
          if (typeof id !== 'string') {
            continue
          }
          const skin = findSkin(id)
          if (!skin || skin.classId !== classId) {
            continue
          }
          if (!owned[classId as TankClassId].includes(id)) {
            owned[classId as TankClassId].push(id)
          }
        }
      })
    } catch {
      /* ignore */
    }
  }

  return owned
}

export function saveOwnedSkins(owned: Record<TankClassId, SkinId[]>) {
  window.localStorage.setItem(OWNED_SKINS_KEY, JSON.stringify(owned))
}

export function loadActiveSkins(
  ownedSkins: Record<TankClassId, SkinId[]>,
): Record<TankClassId, SkinId> {
  const active = {} as Record<TankClassId, SkinId>
  CLASS_ORDER.forEach((classId) => {
    active[classId] = defaultSkinFor(classId)
  })

  const stored = window.localStorage.getItem(ACTIVE_SKIN_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>
      Object.entries(parsed).forEach(([classId, skinId]) => {
        if (
          classId in TANK_CLASSES
          && typeof skinId === 'string'
          && ownedSkins[classId as TankClassId]?.includes(skinId)
        ) {
          active[classId as TankClassId] = skinId
        }
      })
    } catch {
      /* ignore */
    }
  }

  return active
}

export function saveActiveSkins(active: Record<TankClassId, SkinId>) {
  window.localStorage.setItem(ACTIVE_SKIN_KEY, JSON.stringify(active))
}

export function loadPeakWave(): number {
  const stored = window.localStorage.getItem(PEAK_WAVE_KEY)
  return stored ? Math.max(0, Number.parseInt(stored, 10) || 0) : 0
}

export function savePeakWave(wave: number) {
  window.localStorage.setItem(PEAK_WAVE_KEY, String(Math.max(0, Math.floor(wave))))
}
