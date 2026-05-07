import { UPGRADE_OPTIONS } from '../../config'
import type { UpgradeOption, UpgradeType } from '../../types'
import {
  RARITY_WEIGHTS,
  UPGRADE_CAPS,
  UPGRADE_DESCRIPTIONS,
  UPGRADE_ICON_URL,
  upgradeCategory,
  upgradeImpact,
} from '../../upgrade-meta'

export type UpgradeReason = 'wave' | 'level'

export type ShowUpgradeOptions = {
  reason: UpgradeReason
  level: number
  waveIndex: number
  upgradeLevels: Record<UpgradeType, number>
}

export class UpgradeRenderer {
  private overlay?: HTMLElement
  private grid?: HTMLElement
  private titleEl?: HTMLElement
  private subtitleEl?: HTMLElement
  private choices: UpgradeOption[] = []
  private onSelectHandler?: (index: number) => void

  constructor() {
    this.overlay = document.querySelector<HTMLElement>('[data-upgrade-overlay]') ?? undefined
    this.grid = document.querySelector<HTMLElement>('[data-upgrade-grid]') ?? undefined
    this.titleEl = document.querySelector<HTMLElement>('[data-upgrade-title]') ?? undefined
    this.subtitleEl = document.querySelector<HTMLElement>('[data-upgrade-subtitle]') ?? undefined
    this.grid?.addEventListener('click', (event) => this.handleClick(event))
  }

  setOnSelect(handler: (index: number) => void) {
    this.onSelectHandler = handler
  }

  hasChoices() {
    return this.choices.length > 0
  }

  choiceAt(index: number): UpgradeOption | undefined {
    return this.choices[index]
  }

  hitTest(_x: number, _y: number): number {
    return -1
  }

  show(opts: ShowUpgradeOptions): boolean {
    this.clear()
    this.choices = pickChoices(opts.upgradeLevels)
    if (this.choices.length === 0) return false
    if (this.titleEl) {
      this.titleEl.textContent = opts.reason === 'level' ? 'Field Mod' : 'Supply Drop'
    }
    if (this.subtitleEl) {
      const eyebrow = opts.reason === 'level'
        ? `Level ${opts.level} reached`
        : `Wave ${opts.waveIndex} cleared`
      this.subtitleEl.textContent = `${eyebrow} · Press 1, 2, 3 or click`
    }
    if (this.grid) {
      this.choices.forEach((choice, index) => {
        const card = this.buildCard(choice, index, opts.upgradeLevels[choice.type] ?? 0)
        this.grid!.appendChild(card)
      })
    }
    if (this.overlay) this.overlay.hidden = false
    return true
  }

  clear() {
    this.choices = []
    if (this.grid) this.grid.replaceChildren()
    if (this.overlay) this.overlay.hidden = true
  }

  private handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    const card = target?.closest<HTMLButtonElement>('[data-upgrade-index]')
    if (!card) return
    const index = Number.parseInt(card.dataset.upgradeIndex ?? '-1', 10)
    if (index >= 0) this.onSelectHandler?.(index)
  }

  private buildCard(choice: UpgradeOption, index: number, currentLevel: number): HTMLButtonElement {
    const cap = UPGRADE_CAPS[choice.type]
    const nextLevel = Math.min(currentLevel + 1, cap)
    const levelText = `+${nextLevel}/${cap}`
    const iconUrl = UPGRADE_ICON_URL[choice.type]
    const description = UPGRADE_DESCRIPTIONS[choice.type] ?? choice.description
    const category = upgradeCategory(choice.type)
    const impact = upgradeImpact(choice.type)

    const card = document.createElement('button')
    card.type = 'button'
    card.className = `upg-card upg-card--${choice.rarity}`
    card.dataset.upgradeIndex = String(index)
    card.dataset.upgradeType = choice.type
    card.style.setProperty('--card-frame', `url('/assets/cards/${choice.rarity}-card.png')`)

    card.innerHTML = `
      <div class="upg-card__frame" aria-hidden="true"></div>
      <div class="upg-card__rarity">${escapeHtml(choice.rarity.toUpperCase())}</div>
      <div class="upg-card__upper">
        <div class="upg-card__icon" aria-hidden="true">
          <span class="upg-card__icon-mask" style="--icon: url('${iconUrl}')"></span>
        </div>
        <div class="upg-card__category">${escapeHtml(category)}</div>
        <h3 class="upg-card__title">${escapeHtml(choice.title)}</h3>
      </div>
      <div class="upg-card__lower">
        <p class="upg-card__desc">${escapeHtml(description)}</p>
        <div class="upg-card__chip">
          <span>${escapeHtml(impact)}</span>
          <strong>${escapeHtml(levelText)}</strong>
        </div>
      </div>
    `
    return card
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}


function pickChoices(upgradeLevels: Record<UpgradeType, number>): UpgradeOption[] {
  const pool = UPGRADE_OPTIONS.filter((option) => {
    const cap = UPGRADE_CAPS[option.type]
    return (upgradeLevels[option.type] ?? 0) < cap
  })

  const result: UpgradeOption[] = []
  const remaining = [...pool]
  for (let pick = 0; pick < 3 && remaining.length > 0; pick += 1) {
    const totalWeight = remaining.reduce((sum, option) => sum + RARITY_WEIGHTS[option.rarity], 0)
    let roll = Math.random() * totalWeight
    let chosenIndex = 0
    for (let index = 0; index < remaining.length; index += 1) {
      roll -= RARITY_WEIGHTS[remaining[index].rarity]
      if (roll <= 0) {
        chosenIndex = index
        break
      }
    }
    result.push(remaining[chosenIndex])
    remaining.splice(chosenIndex, 1)
  }
  return result
}
