import { UPGRADE_OPTIONS } from '../config'
import type { GameEventBus, HudMod, HudSnapshot } from '../events'
import {
  UPGRADE_CAPS,
  UPGRADE_DESCRIPTIONS,
  UPGRADE_ICON_URL,
  rarityColor,
  rarityLabel,
} from '../upgrade-meta'
import type { UpgradeRarity, UpgradeType } from '../types'

const TITLE_BY_TYPE: Map<UpgradeType, string> = new Map(
  UPGRADE_OPTIONS.map((option) => [option.type, option.title]),
)

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
  walletStrip?: HTMLElement
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
      walletStrip: document.querySelector<HTMLElement>('.hud-wallet') ?? undefined,
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
    if (el.walletStrip) {
      const hideStore = snapshot.state === 'playing' || snapshot.state === 'upgrade'
      el.walletStrip.classList.toggle('hud-wallet--no-store', hideStore)
    }
    el.mods.replaceChildren(...snapshot.mods.map((mod) => createChipElement(mod)))
  }
}

function createChipElement(mod: HudMod) {
  const chip = document.createElement('div')
  chip.className = ['hud-chip', mod.temporary ? 'is-temporary' : '', mod.isMaxed ? 'is-maxed' : '']
    .filter(Boolean).join(' ')

  let rarity: UpgradeRarity | undefined
  if (!mod.temporary && mod.type) {
    rarity = RARITY_BY_TYPE.get(mod.type)
    if (rarity) {
      chip.style.setProperty('--rarity', tintHex(rarity))
    }
  }

  const [, valueText] = splitModText(mod.text)

  if (mod.temporary) {
    const abbr = document.createElement('span')
    abbr.className = 'hud-chip__abbr'
    abbr.textContent = mod.text.split(' ')[0].slice(0, 5)
    chip.appendChild(abbr)
    const lvl = document.createElement('span')
    lvl.className = 'hud-chip__lvl'
    lvl.textContent = valueText
    chip.appendChild(lvl)
    chip.title = mod.text
    return chip
  }

  if (mod.type && UPGRADE_ICON_URL[mod.type]) {
    const icon = document.createElement('img')
    icon.className = 'hud-chip__icon'
    icon.src = UPGRADE_ICON_URL[mod.type]
    icon.alt = ''
    icon.draggable = false
    chip.appendChild(icon)
  } else {
    const abbr = document.createElement('span')
    abbr.className = 'hud-chip__abbr'
    abbr.textContent = mod.text.split(' ')[0].slice(0, 5)
    chip.appendChild(abbr)
  }

  const lvl = document.createElement('span')
  lvl.className = 'hud-chip__lvl'
  lvl.textContent = mod.isMaxed ? 'MAX' : valueText
  chip.appendChild(lvl)

  if (mod.type) {
    const tip = document.createElement('div')
    tip.className = 'hud-chip__tip'
    const cap = UPGRADE_CAPS[mod.type] ?? 0
    const currentLevel = mod.pips?.filled ?? (Number.parseInt(valueText, 10) || 0)
    const title = TITLE_BY_TYPE.get(mod.type) ?? mod.type
    const description = UPGRADE_DESCRIPTIONS[mod.type] ?? ''
    const rarityText = rarity ? rarityLabel(rarity) : ''
    tip.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <em>${escapeHtml(rarityText)} - Lv ${currentLevel}/${cap}</em>
      <span>${escapeHtml(description)}</span>
    `
    chip.appendChild(tip)
  }

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
