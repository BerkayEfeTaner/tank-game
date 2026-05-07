import type { GameEventBus, ShopSnapshot } from '../events'
import { STAT_UPGRADES, statUpgradeCost } from '../stats'
import type { StatUpgradeType } from '../types'

export class ShopController {
  private readonly bus: GameEventBus
  private toggle?: HTMLButtonElement
  private panel?: HTMLElement
  private snapshot?: ShopSnapshot
  private readonly handleSnapshot = (snapshot: ShopSnapshot) => {
    this.snapshot = snapshot
    this.render()
  }

  constructor(bus: GameEventBus) {
    this.bus = bus
    this.bind()
    this.bus.on('shop:snapshot', this.handleSnapshot)
  }

  destroy() {
    this.bus.off('shop:snapshot', this.handleSnapshot)
  }

  isOpen() {
    return this.panel ? !this.panel.hidden : false
  }

  close() {
    this.setOpen(false)
  }

  private bind() {
    this.toggle = document.querySelector<HTMLButtonElement>('[data-shop-toggle]') ?? undefined
    this.panel = document.querySelector<HTMLElement>('[data-shop-panel]') ?? undefined

    this.toggle?.addEventListener('click', () => this.setOpen(!this.isOpen()))
    document.querySelectorAll<HTMLElement>('[data-shop-close]').forEach((element) => {
      element.addEventListener('click', () => this.setOpen(false))
    })

    document.querySelectorAll<HTMLButtonElement>('[data-shop]').forEach((button) => {
      const type = button.dataset.shop as StatUpgradeType | undefined
      if (!type || !(type in STAT_UPGRADES)) {
        return
      }
      button.addEventListener('click', () => this.bus.emit('shop:purchase', type))
    })
  }

  private setOpen(open: boolean) {
    if (!this.panel || !this.toggle) {
      return
    }

    const wasOpen = this.isOpen()
    this.panel.hidden = !open
    this.toggle.setAttribute('aria-expanded', String(open))

    if (open && !wasOpen) {
      this.bus.emit('shop:open')
    } else if (!open && wasOpen) {
      this.bus.emit('shop:close')
    }

    this.render()
  }

  private render() {
    if (!this.snapshot) {
      return
    }

    const { gold, statLevels } = this.snapshot
    Object.keys(STAT_UPGRADES).forEach((key) => {
      const type = key as StatUpgradeType
      const level = statLevels[type] ?? 0
      const cost = statUpgradeCost(type, level)
      const levelEl = document.querySelector<HTMLElement>(`[data-shop-level="${type}"]`)
      const costEl = document.querySelector<HTMLElement>(`[data-shop-cost="${type}"]`)
      const button = document.querySelector<HTMLButtonElement>(`[data-shop="${type}"]`)
      if (levelEl) {
        levelEl.textContent = `Lv ${level}`
      }
      if (costEl) {
        costEl.textContent = `${cost}g`
      }
      if (button) {
        button.disabled = gold < cost
      }
    })
  }
}
