import Phaser from 'phaser'
import type { TankClassId } from './classes'
import type { SkinId } from './skins'
import type { StatUpgradeType, UpgradeType } from './types'

export type HudMod = {
  text: string
  type?: UpgradeType
  temporary?: boolean
  isMaxed?: boolean
  pips?: { filled: number; total: number }
}

export type HudSnapshot = {
  score: number
  highScore: number
  hp: number
  maxHp: number
  xp: number
  nextLevelXp: number
  level: number
  wave: number
  multiplier: number
  zone: string
  gold: number
  mods: HudMod[]
}

export type ShopSnapshot = {
  gold: number
  statLevels: Record<StatUpgradeType, number>
  ownedClasses: TankClassId[]
  activeClassId: TankClassId
  ownedSkins: Record<TankClassId, SkinId[]>
  activeSkins: Record<TankClassId, SkinId>
  peakWave: number
}

export type MenuSnapshot = {
  gold: number
  highScore: number
  peakWave: number
  activeClassName: string
  activeClassTagline: string
  activeClassIconUrl: string
  activeSkinName: string
}

export type SkinSelection = {
  classId: TankClassId
  skinId: SkinId
}

export type GameEventMap = {
  'hud:snapshot': HudSnapshot
  'shop:snapshot': ShopSnapshot
  'menu:snapshot': MenuSnapshot
  'menu:start': void
  'shop:open': void
  'shop:close': void
  'shop:purchase': StatUpgradeType
  'class:purchase': TankClassId
  'class:select': TankClassId
  'skin:purchase': SkinSelection
  'skin:select': SkinSelection
}

type EventArgs<K extends keyof GameEventMap> = GameEventMap[K] extends void
  ? []
  : [GameEventMap[K]]

type EventListener<K extends keyof GameEventMap> = GameEventMap[K] extends void
  ? () => void
  : (payload: GameEventMap[K]) => void

export class GameEventBus {
  private emitter = new Phaser.Events.EventEmitter()

  on<K extends keyof GameEventMap>(event: K, handler: EventListener<K>): this {
    this.emitter.on(event, handler as (...args: unknown[]) => void)
    return this
  }

  off<K extends keyof GameEventMap>(event: K, handler: EventListener<K>): this {
    this.emitter.off(event, handler as (...args: unknown[]) => void)
    return this
  }

  emit<K extends keyof GameEventMap>(event: K, ...args: EventArgs<K>): boolean {
    return this.emitter.emit(event, ...args)
  }

  destroy() {
    this.emitter.removeAllListeners()
  }
}
