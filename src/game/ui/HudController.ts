import { UPGRADE_OPTIONS } from '../config'
import type { GameEventBus, HudMod, HudSnapshot } from '../events'
import { rarityColor } from '../upgrade-meta'
import type { UpgradeRarity, UpgradeType } from '../types'

const RARITY_BY_TYPE: Map<UpgradeType, UpgradeRarity> = new Map(
  UPGRADE_OPTIONS.map((option) => [option.type, option.rarity]),
)

type HudElements = {
  score: HTMLElement
  best: HTMLElement
  hpTop: HTMLElement
  hpBar: HTMLElement
  xpBar: HTMLElement
  xpText: HTMLElement
  wave: HTMLElement
  level: HTMLElement
  multiplier: HTMLElement
  zone: HTMLElement
  mods: HTMLElement
  modCount?: HTMLElement
  gold: HTMLElement
}

export class HudController {
  private readonly bus: GameEventBus
  private elements?: HudElements
  private readonly handleSnapshot = (snapshot: HudSnapshot) => this.render(snapshot)

  constructor(bus: GameEventBus) {
    this.bus = bus
    this.bind()
    this.bus.on('hud:snapshot', this.handleSnapshot)
  }

  destroy() {
    this.bus.off('hud:snapshot', this.handleSnapshot)
  }

  private bind() {
    const get = (key: string) => document.querySelector<HTMLElement>(`[data-hud="${key}"]`)
    const score = get('score')
    const best = get('best')
    const hpTop = get('hp-top')
    const hpBar = get('hp-bar')
    const xpBar = get('xp-bar')
    const xpText = get('xp-text')
    const wave = get('wave')
    const level = get('level')
    const multiplier = get('multiplier')
    const zone = get('zone')
    const mods = get('mods')
    const gold = get('gold')

    if (
      !score || !best || !hpTop || !hpBar || !xpBar || !xpText
      || !wave || !level || !multiplier || !zone || !mods || !gold
    ) {
      return
    }

    this.elements = {
      score, best, hpTop, hpBar, xpBar, xpText, wave, level, multiplier, zone,
      mods, modCount: get('mod-count') ?? undefined, gold,
    }
  }

  private render(snapshot: HudSnapshot) {
    const el = this.elements
    if (!el) return

    const healthProgress = snapshot.maxHp > 0 ? clamp(snapshot.hp / snapshot.maxHp, 0, 1) : 0
    const xpProgress = snapshot.nextLevelXp > 0 ? clamp(snapshot.xp / snapshot.nextLevelXp, 0, 1) : 0
    el.score.textContent = formatNumber(snapshot.score)
    el.best.textContent = formatNumber(snapshot.highScore)
    el.hpTop.textContent = `${snapshot.hp}/${snapshot.maxHp}`
    el.hpBar.style.width = `${healthProgress * 100}%`
    el.xpBar.style.width = `${xpProgress * 100}%`
    el.xpText.textContent = `${snapshot.xp} / ${snapshot.nextLevelXp} XP`
    el.wave.textContent = `${snapshot.wave}`
    el.level.textContent = `${snapshot.level}`
    el.multiplier.textContent = `${snapshot.multiplier}`
    el.zone.textContent = snapshot.zone
    el.gold.textContent = formatNumber(snapshot.gold)
    if (el.modCount) {
      el.modCount.textContent = snapshot.mods.length > 0 ? `${snapshot.mods.length}` : ''
    }
    el.mods.replaceChildren(...snapshot.mods.map((mod) => createChipElement(mod)))
  }
}

function createChipElement(mod: HudMod) {
  const chip = document.createElement('div')
  chip.className = ['hud-chip', mod.temporary ? 'is-temporary' : '', mod.isMaxed ? 'is-maxed' : '']
    .filter(Boolean).join(' ')
  chip.title = mod.text

  if (!mod.temporary && mod.type) {
    const rarity = RARITY_BY_TYPE.get(mod.type)
    if (rarity) {
      chip.style.setProperty('--rarity', tintHex(rarity))
    }
  }

  const [abbrText, valueText] = splitModText(mod.text)
  const abbr = document.createElement('span')
  abbr.className = 'hud-chip__abbr'
  abbr.textContent = abbrText
  chip.appendChild(abbr)

  const lvl = document.createElement('span')
  lvl.className = 'hud-chip__lvl'
  lvl.textContent = valueText
  chip.appendChild(lvl)

  return chip
}

function splitModText(text: string): [string, string] {
  const idx = text.indexOf(' ')
  if (idx < 0) return [text.slice(0, 4), '']
  const head = text.slice(0, idx).slice(0, 5)
  const tail = text.slice(idx + 1)
  const cleanedTail = tail.replace(/^\+/, '').replace(/\/(\d+)$/, '')
  return [head, cleanedTail.slice(0, 5)]
}

function tintHex(rarity: UpgradeRarity): string {
  return `#${rarityColor(rarity).toString(16).padStart(6, '0')}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}
