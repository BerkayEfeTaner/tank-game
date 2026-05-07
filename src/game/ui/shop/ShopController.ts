import {
  CLASS_ORDER,
  TANK_CLASSES,
  type TankClass,
  type TankClassId,
} from '../../classes'
import type { GameEventBus, ShopSnapshot } from '../../events'
import { TANK_SKINS, skinsForClass, type TankSkin } from '../../skins'
import { STAT_UPGRADES, statUpgradeCost } from '../../stats'
import type { StatUpgradeType } from '../../types'

type StoreTab = 'stats' | 'classes' | 'skins'

export class ShopController {
  private readonly bus: GameEventBus
  private toggle?: HTMLButtonElement
  private panel?: HTMLElement
  private body?: HTMLElement
  private goldEl?: HTMLElement
  private tabButtons: HTMLButtonElement[] = []
  private snapshot?: ShopSnapshot
  private activeTab: StoreTab = 'stats'
  private readonly handleSnapshot = (snapshot: ShopSnapshot) => {
    this.snapshot = snapshot
    if (this.isOpen()) this.render()
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
    this.body = document.querySelector<HTMLElement>('[data-store-body]') ?? undefined
    this.goldEl = document.querySelector<HTMLElement>('[data-store-gold]') ?? undefined

    this.toggle?.addEventListener('click', () => this.setOpen(!this.isOpen()))
    document.querySelectorAll<HTMLElement>('[data-shop-close]').forEach((element) => {
      element.addEventListener('click', () => this.setOpen(false))
    })

    this.tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-store-tab]'))
    this.tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.storeTab as StoreTab | undefined
        if (!tab) return
        this.activeTab = tab
        this.render()
      })
    })

    this.body?.addEventListener('click', (event) => this.handleBodyClick(event))
  }

  private setOpen(open: boolean) {
    if (!this.panel || !this.toggle) return
    const wasOpen = this.isOpen()
    this.panel.hidden = !open
    this.toggle.setAttribute('aria-expanded', String(open))
    if (open && !wasOpen) this.bus.emit('shop:open')
    else if (!open && wasOpen) this.bus.emit('shop:close')
    if (open) this.render()
  }

  private handleBodyClick(event: MouseEvent) {
    if (!this.snapshot) return
    const target = event.target as HTMLElement | null
    const card = target?.closest<HTMLButtonElement>('[data-store-action]')
    if (!card || card.disabled) return
    const action = card.dataset.storeAction
    const id = card.dataset.storeId ?? ''
    const classId = (card.dataset.storeClass ?? '') as TankClassId
    if (action === 'stat-buy') this.bus.emit('shop:purchase', id as StatUpgradeType)
    else if (action === 'class-buy') this.bus.emit('class:purchase', id as TankClassId)
    else if (action === 'class-select') this.bus.emit('class:select', id as TankClassId)
    else if (action === 'skin-buy') this.bus.emit('skin:purchase', { classId, skinId: id })
    else if (action === 'skin-select') this.bus.emit('skin:select', { classId, skinId: id })
  }

  private render() {
    if (!this.snapshot || !this.body) return
    if (this.goldEl) this.goldEl.textContent = `${this.snapshot.gold.toLocaleString('en-US')}g`
    this.tabButtons.forEach((button) => {
      const tab = button.dataset.storeTab as StoreTab | undefined
      const active = tab === this.activeTab
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-selected', String(active))
    })
    this.body.replaceChildren()
    if (this.activeTab === 'stats') this.renderStats()
    else if (this.activeTab === 'classes') this.renderClasses()
    else this.renderSkins()
  }

  private renderStats() {
    if (!this.snapshot || !this.body) return
    const { gold, statLevels } = this.snapshot
    Object.entries(STAT_UPGRADES).forEach(([key, config]) => {
      const type = key as StatUpgradeType
      const level = statLevels[type] ?? 0
      const cost = statUpgradeCost(type, level)
      const canAfford = gold >= cost
      this.body!.appendChild(createCardButton({
        action: 'stat-buy', id: type,
        name: config.title,
        description: `${config.description} - Lv ${level}`,
        priceLabel: `${cost}g`, stateLabel: `Lv ${level}`,
        iconUrl: config.iconUrl, disabled: !canAfford,
        states: { affordable: canAfford, expensive: !canAfford, poor: !canAfford },
      }))
    })
  }

  private renderClasses() {
    if (!this.snapshot || !this.body) return
    const { gold, ownedClasses, activeClassId, peakWave } = this.snapshot
    CLASS_ORDER.forEach((classId) => {
      const cls = TANK_CLASSES[classId]
      const owned = ownedClasses.includes(classId)
      const isActive = activeClassId === classId
      const waveLocked
        = !owned && cls.unlock.waveMilestone > 0 && peakWave < cls.unlock.waveMilestone
      const canAfford = gold >= cls.unlock.goldCost
      const meta = computeClassCardMeta({ cls, owned, isActive, waveLocked, canAfford })
      const description = waveLocked
        ? `Reach wave ${cls.unlock.waveMilestone} or buy - ${cls.tagline}`
        : `${cls.tagline} - ${cls.description}`
      this.body!.appendChild(createCardButton({
        action: meta.action, id: classId,
        name: cls.name, description,
        priceLabel: meta.priceLabel, stateLabel: meta.stateLabel,
        iconUrl: cls.iconUrl, disabled: meta.disabled, states: meta.states,
      }))
    })
  }

  private renderSkins() {
    if (!this.snapshot || !this.body) return
    const { gold, activeClassId, ownedSkins, activeSkins } = this.snapshot
    const cls = TANK_CLASSES[activeClassId]
    const skins = skinsForClass(activeClassId)
    const heading = document.createElement('div')
    heading.className = 'store-skin-heading'
    heading.innerHTML = `<span>Active class</span><strong>${cls.name}</strong><em>${TANK_SKINS.length} liveries total</em>`
    this.body.appendChild(heading)
    skins.forEach((skin) => {
      const owned = ownedSkins[activeClassId]?.includes(skin.id) ?? false
      const isActive = activeSkins[activeClassId] === skin.id
      const canAfford = gold >= skin.goldCost
      const meta = computeSkinCardMeta({ skin, owned, isActive, canAfford })
      const isStock = skin.hullTint === 0xffffff
      this.body!.appendChild(createCardButton({
        action: meta.action, id: skin.id,
        name: skin.name, description: skin.description,
        priceLabel: meta.priceLabel, stateLabel: meta.stateLabel,
        iconUrl: cls.iconUrl,
        iconBackground: isStock
          ? undefined
          : `linear-gradient(135deg, ${tintToCss(skin.hullTint, 0.6)}, ${tintToCss(skin.turretTint, 0.4)})`,
        iconFilter: skin.previewFilter,
        disabled: meta.disabled, states: meta.states,
        classId: activeClassId,
      }))
    })
  }
}

type CardStateFlags = {
  active?: boolean; locked?: boolean; maxed?: boolean
  affordable?: boolean; expensive?: boolean; poor?: boolean
}

type CreateCardOptions = {
  action: string; id: string; classId?: TankClassId
  name: string; description: string
  priceLabel: string; stateLabel: string
  iconUrl: string; iconBackground?: string
  iconTintCss?: string
  iconFilter?: string
  disabled?: boolean; states?: CardStateFlags
}

function createCardButton(options: CreateCardOptions): HTMLButtonElement {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'store-card'
  card.dataset.storeAction = options.action
  card.dataset.storeId = options.id
  if (options.classId) card.dataset.storeClass = options.classId
  if (options.disabled) card.disabled = true
  const states = options.states ?? {}
  card.classList.toggle('is-active', !!states.active)
  card.classList.toggle('is-locked', !!states.locked)
  card.classList.toggle('is-maxed', !!states.maxed)
  card.classList.toggle('is-expensive',
    !!states.expensive && !states.locked && !states.active && !states.maxed)

  const art = document.createElement('div')
  art.className = 'store-card__art'
  if (options.iconBackground) art.style.background = options.iconBackground
  const img = document.createElement('img')
  img.src = options.iconUrl
  img.alt = ''
  img.draggable = false
  if (options.iconFilter) {
    img.style.filter = options.iconFilter
  }
  art.appendChild(img)
  if (options.iconTintCss) {
    const tintLayer = document.createElement('div')
    tintLayer.className = 'store-card__art-tint'
    tintLayer.style.background = options.iconTintCss
    art.appendChild(tintLayer)
  }
  card.appendChild(art)

  const nameEl = document.createElement('div')
  nameEl.className = 'store-card__name'
  nameEl.textContent = options.name
  const price = document.createElement('div')
  price.className = 'store-card__price'
  if (options.priceLabel === '-' || options.priceLabel === 'Free') price.classList.add('is-free')
  price.textContent = options.priceLabel

  const info = document.createElement('div')
  info.className = 'store-card__info'
  info.appendChild(nameEl)
  info.appendChild(price)
  card.appendChild(info)

  const descEl = document.createElement('div')
  descEl.className = 'store-card__desc'
  descEl.textContent = options.description
  const state = document.createElement('div')
  state.className = 'store-card__state'
  if (states.locked) state.classList.add('is-locked')
  if (states.active) state.classList.add('is-active')
  if (states.maxed) state.classList.add('is-maxed')
  if (states.poor && !states.locked && !states.active && !states.maxed) state.classList.add('is-poor')
  state.textContent = options.stateLabel

  const meta = document.createElement('div')
  meta.className = 'store-card__meta'
  meta.appendChild(descEl)
  meta.appendChild(state)
  card.appendChild(meta)
  return card
}

type ClassCardMetaInput = {
  cls: TankClass; owned: boolean; isActive: boolean
  waveLocked: boolean; canAfford: boolean
}

function computeClassCardMeta(input: ClassCardMetaInput) {
  if (input.isActive) return {
    action: 'class-noop', priceLabel: '-', stateLabel: 'Active',
    disabled: true, states: { active: true } as CardStateFlags,
  }
  if (input.owned) return {
    action: 'class-select', priceLabel: '-', stateLabel: 'Equip',
    disabled: false, states: { affordable: true } as CardStateFlags,
  }
  if (input.waveLocked && !input.canAfford) return {
    action: 'class-locked',
    priceLabel: `${input.cls.unlock.goldCost}g`,
    stateLabel: `Wave ${input.cls.unlock.waveMilestone}`,
    disabled: true, states: { locked: true } as CardStateFlags,
  }
  return {
    action: 'class-buy', priceLabel: `${input.cls.unlock.goldCost}g`,
    stateLabel: input.canAfford ? 'Buy' : 'Need gold',
    disabled: !input.canAfford,
    states: { affordable: input.canAfford, expensive: !input.canAfford, poor: !input.canAfford } as CardStateFlags,
  }
}

type SkinCardMetaInput = { skin: TankSkin; owned: boolean; isActive: boolean; canAfford: boolean }

function computeSkinCardMeta(input: SkinCardMetaInput) {
  if (input.isActive) return {
    action: 'skin-noop',
    priceLabel: input.skin.goldCost > 0 ? `${input.skin.goldCost}g` : '-',
    stateLabel: 'Equipped', disabled: true,
    states: { active: true } as CardStateFlags,
  }
  if (input.owned) return {
    action: 'skin-select',
    priceLabel: input.skin.goldCost > 0 ? `${input.skin.goldCost}g` : '-',
    stateLabel: 'Apply', disabled: false,
    states: { affordable: true } as CardStateFlags,
  }
  return {
    action: 'skin-buy', priceLabel: `${input.skin.goldCost}g`,
    stateLabel: input.canAfford ? 'Buy' : 'Need gold',
    disabled: !input.canAfford,
    states: { affordable: input.canAfford, expensive: !input.canAfford, poor: !input.canAfford } as CardStateFlags,
  }
}

function tintToCss(tint: number, alpha = 0.18): string {
  const r = (tint >> 16) & 0xff
  const g = (tint >> 8) & 0xff
  const b = tint & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
