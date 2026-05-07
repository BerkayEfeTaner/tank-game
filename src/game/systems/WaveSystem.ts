import Phaser from 'phaser'
import { WAVES } from '../config'
import type { EnemyType, WaveConfig } from '../types'

export function isBossWave(waveNumber: number): boolean {
  return waveNumber > 0 && waveNumber % 5 === 0
}

export function bossTier(waveNumber: number): number {
  return Math.max(1, Math.floor(waveNumber / 5))
}

export function createWaveConfig(waveIndex: number): WaveConfig {
  const waveNumber = waveIndex + 1
  if (isBossWave(waveNumber)) {
    const tier = bossTier(waveNumber)
    return {
      number: waveNumber,
      enemies: [
        { type: 'boss', count: 1 },
        { type: 'scout', count: 4 + tier * 2 },
        ...(tier >= 2 ? [{ type: 'heavy' as const, count: 1 + Math.floor(tier / 2) }] : []),
        ...(tier >= 2 ? [{ type: 'charger' as const, count: 1 + tier }] : []),
        ...(tier >= 3 ? [{ type: 'bomber' as const, count: 1 + Math.floor(tier / 2) }] : []),
        ...(tier >= 3 ? [{ type: 'sniper' as const, count: 1 + Math.floor(tier / 3) }] : []),
        ...(tier >= 4 ? [{ type: 'shield' as const, count: 1 + Math.floor(tier / 2) }] : []),
      ],
    }
  }

  const preset = WAVES[waveIndex]
  if (preset) {
    return {
      number: waveNumber,
      enemies: preset.enemies.map((group) => ({ type: group.type, count: group.count })),
    }
  }

  const extra = waveIndex - WAVES.length + 1
  const tier = Math.floor(extra / 3)
  return {
    number: waveNumber,
    enemies: [
      { type: 'scout', count: 8 + Math.floor(extra * 1.05) },
      { type: 'heavy', count: 1 + Math.floor(extra * 0.34) },
      ...(waveNumber >= 6 ? [{ type: 'charger' as const, count: 1 + Math.floor(tier * 0.65) }] : []),
      ...(waveNumber >= 7 ? [{ type: 'bomber' as const, count: 1 + Math.floor(tier * 0.45) }] : []),
      ...(waveNumber >= 7 ? [{ type: 'sniper' as const, count: 1 + Math.floor(tier * 0.45) }] : []),
      ...(waveNumber >= 9 ? [{ type: 'shield' as const, count: 1 + Math.floor(tier * 0.35) }] : []),
    ],
  }
}

export function expandWaveQueue(wave: WaveConfig): EnemyType[] {
  return Phaser.Utils.Array.Shuffle(
    wave.enemies.flatMap((group) => Array(group.count).fill(group.type) as EnemyType[]),
  )
}
