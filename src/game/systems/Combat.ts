import Phaser from 'phaser'
import type { PlayerBuffs, StatUpgradeType, Tank, UpgradeType } from '../types'

type LevelGetter = (type: UpgradeType) => number

export function playerCritChance(
  upgradeLevel: LevelGetter,
  statLevels: Record<StatUpgradeType, number>,
  buffs: PlayerBuffs,
  now: number,
  classBonus = 0,
) {
  const overdriveBonus = buffs.overdriveUntil > now ? 0.18 : 0
  return Phaser.Math.Clamp(
    0.05
      + classBonus
      + upgradeLevel('critChance') * 0.035
      + statLevels.critChance * 0.025
      + overdriveBonus,
    0,
    0.85,
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

export function effectiveDamageOnEnemy(
  rawDamage: number,
  enemy: Tank,
  critical: boolean,
  bossDamageMult: number,
): number {
  const shielded
    = enemy.enemyType === 'shield' && !critical ? Math.max(1, Math.floor(rawDamage * 0.72)) : rawDamage
  return enemy.enemyType === 'boss'
    ? Math.max(1, Math.round(shielded * bossDamageMult))
    : shielded
}

export function rollPlayerDamage(
  baseDamage: number,
  upgradeLevel: LevelGetter,
  statLevels: Record<StatUpgradeType, number>,
  buffs: PlayerBuffs,
  now: number,
  classCritBonus = 0,
) {
  const overdriveActive = buffs.overdriveUntil > now
  const critical = Math.random() < playerCritChance(upgradeLevel, statLevels, buffs, now, classCritBonus)
  const effectiveBase = baseDamage + (overdriveActive ? 1 : 0)
  const damage = critical
    ? Math.round(effectiveBase * playerCritDamageMultiplier(upgradeLevel, statLevels, buffs, now))
    : effectiveBase
  return { damage, critical }
}
