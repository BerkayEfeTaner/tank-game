import type { StatUpgradeType } from './types'
import { createEmptyStatLevels } from './stats'

const HIGH_SCORE_KEY = 'tank-game.high-score'
const GOLD_KEY = 'tank-game.gold'
const STAT_LEVELS_KEY = 'tank-game.stat-levels'

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
