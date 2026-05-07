import Phaser from 'phaser'
import type { PlayerBuffs, StatUpgradeType, UpgradeType } from '../types'

type LevelGetter = (type: UpgradeType) => number

export function playerCritChance(
  upgradeLevel: LevelGetter,
  statLevels: Record<StatUpgradeType, number>,
  buffs: PlayerBuffs,
  now: number,
) {
  const overdriveBonus = buffs.overdriveUntil > now ? 0.18 : 0
  return Phaser.Math.Clamp(
    0.05 + upgradeLevel('critChance') * 0.035 + statLevels.critChance * 0.025 + overdriveBonus,
    0,
    0.65,
  )
}

export function playerCritDamageMultiplier(
  upgradeLevel: LevelGetter,
  statLevels: Record<StatUpgradeType, number>,
  buffs: PlayerBuffs,
  now: number,
) {
  const overdriveBonus = buffs.overdriveUntil > now ? 0.22 : 0
  return 1.5 + upgradeLevel('critDamage') * 0.18 + statLevels.critDamage * 0.15 + overdriveBonus
}

export function rollPlayerDamage(
  baseDamage: number,
  upgradeLevel: LevelGetter,
  statLevels: Record<StatUpgradeType, number>,
  buffs: PlayerBuffs,
  now: number,
) {
  const overdriveActive = buffs.overdriveUntil > now
  const critical = Math.random() < playerCritChance(upgradeLevel, statLevels, buffs, now)
  const effectiveBase = baseDamage + (overdriveActive ? 1 : 0)
  const damage = critical
    ? Math.round(effectiveBase * playerCritDamageMultiplier(upgradeLevel, statLevels, buffs, now))
    : effectiveBase
  return { damage, critical }
}
