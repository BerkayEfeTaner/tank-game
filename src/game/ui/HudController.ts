import type { GameEventBus, HudMod, HudSnapshot } from '../events'

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

    this.elements = { score, best, hpTop, hpBar, xpBar, xpText, wave, level, multiplier, zone, mods, gold }
  }

  private render(snapshot: HudSnapshot) {
    const el = this.elements
    if (!el) {
      return
    }

    const healthProgress = snapshot.maxHp > 0 ? clamp(snapshot.hp / snapshot.maxHp, 0, 1) : 0
    const xpProgress = snapshot.nextLevelXp > 0 ? clamp(snapshot.xp / snapshot.nextLevelXp, 0, 1) : 0
    el.score.textContent = formatNumber(snapshot.score)
    el.best.textContent = formatNumber(snapshot.highScore)
    el.hpTop.textContent = `${snapshot.hp}/${snapshot.maxHp}`
    el.hpBar.style.width = `${healthProgress * 100}%`
    el.xpBar.style.height = `${xpProgress * 100}%`
    el.xpText.textContent = `${snapshot.xp} / ${snapshot.nextLevelXp} XP`
    el.wave.textContent = `${snapshot.wave}`
    el.level.textContent = `${snapshot.level}`
    el.multiplier.textContent = `x${snapshot.multiplier}`
    el.zone.textContent = snapshot.zone
    el.gold.textContent = formatNumber(snapshot.gold)
    el.mods.replaceChildren(...snapshot.mods.map((mod) => createModElement(mod)))
  }
}

function createModElement(mod: HudMod) {
  const item = document.createElement('div')
  item.className = [
    'hud-mod',
    mod.temporary ? 'hud-mod--temporary' : '',
    mod.isMaxed ? 'is-maxed' : '',
  ].filter(Boolean).join(' ')

  const label = document.createElement('span')
  label.textContent = mod.text
  item.appendChild(label)

  const pipsContainer = document.createElement('span')
  pipsContainer.className = 'hud-pips'
  if (mod.pips) {
    for (let index = 0; index < mod.pips.total; index += 1) {
      const pip = document.createElement('span')
      pip.className = index < mod.pips.filled ? 'hud-pip is-filled' : 'hud-pip'
      pipsContainer.appendChild(pip)
    }
  }
  item.appendChild(pipsContainer)

  return item
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}
