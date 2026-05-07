import {
  CLASS_ORDER,
  TANK_CLASSES,
  classProfileMeters,
  isClassUnlockedByWave,
  type TankClassId,
} from '../../classes'
import type { GameEventBus, MenuSnapshot, ShopSnapshot } from '../../events'
import { defaultSkinFor, findSkin } from '../../skins'

export class MainMenuController {
  private readonly bus: GameEventBus
  private root?: HTMLElement
  private startButton?: HTMLButtonElement
  private previousClassButton?: HTMLButtonElement
  private nextClassButton?: HTMLButtonElement
  private classCard?: HTMLButtonElement
  private loadoutPanel?: HTMLElement
  private classHeading?: HTMLElement
  private className?: HTMLElement
  private classTagline?: HTMLElement
  private classDescription?: HTMLElement
  private classIcon?: HTMLImageElement
  private skinName?: HTMLElement
  private classCount?: HTMLElement
  private classRole?: HTMLElement
  private classLock?: HTMLElement
  private classStatus?: HTMLElement
  private gold?: HTMLElement
  private best?: HTMLElement
  private peakWave?: HTMLElement
  private meters: Partial<Record<keyof MenuSnapshot['activeClassMeters'], HTMLElement>> = {}
  private ownedClasses: TankClassId[] = ['engineer']
  private activeClassId: TankClassId = 'engineer'
  private previewClassId: TankClassId = 'engineer'
  private activeSkins: ShopSnapshot['activeSkins'] = { engineer: 'engineer-stock', scout: 'scout-stock', heavy: 'heavy-stock', sniper: 'sniper-stock', bomber: 'bomber-stock' }
  private currentGold = 0
  private peakWaveValue = 0
  private switchAnimationTimeout?: number

  private readonly handleSnapshot = (snapshot: MenuSnapshot) => {
    this.currentGold = snapshot.gold
    if (this.gold) this.gold.textContent = `${snapshot.gold.toLocaleString('en-US')}g`
    if (this.best) this.best.textContent = snapshot.highScore.toLocaleString('en-US')
    if (this.peakWave) this.peakWave.textContent = String(snapshot.peakWave)
    this.peakWaveValue = snapshot.peakWave
    this.renderClassPreview()
  }

  private readonly handleShopSnapshot = (snapshot: ShopSnapshot) => {
    this.currentGold = snapshot.gold
    this.ownedClasses = CLASS_ORDER.filter((id) => snapshot.ownedClasses.includes(id))
    this.activeClassId = snapshot.activeClassId
    this.activeSkins = snapshot.activeSkins
    this.peakWaveValue = snapshot.peakWave
    if (!CLASS_ORDER.includes(this.previewClassId)) this.previewClassId = snapshot.activeClassId
    this.renderClassPreview()
  }

  private readonly handleStart = () => {
    this.bus.emit('menu:start')
  }

  private readonly handlePreviousClass = () => {
    this.selectClassByOffset(-1)
  }

  private readonly handleNextClass = () => {
    this.selectClassByOffset(1)
  }

  private readonly handleClassCard = () => {
    const cls = TANK_CLASSES[this.previewClassId]
    if (this.ownedClasses.includes(this.previewClassId)) {
      this.bus.emit('class:select', this.previewClassId)
      return
    }
    if (this.currentGold >= cls.unlock.goldCost) {
      this.bus.emit('class:purchase', this.previewClassId)
    }
  }

  constructor(bus: GameEventBus) {
    this.bus = bus
    this.bind()
    this.bus.on('menu:snapshot', this.handleSnapshot)
    this.bus.on('shop:snapshot', this.handleShopSnapshot)
  }

  show() {
    if (!this.root) return
    this.root.hidden = false
    document.body.classList.add('is-main-menu')
  }

  hide() {
    if (!this.root) return
    this.root.hidden = true
    document.body.classList.remove('is-main-menu')
  }

  destroy() {
    if (this.switchAnimationTimeout) window.clearTimeout(this.switchAnimationTimeout)
    this.startButton?.removeEventListener('click', this.handleStart)
    this.previousClassButton?.removeEventListener('click', this.handlePreviousClass)
    this.nextClassButton?.removeEventListener('click', this.handleNextClass)
    this.classCard?.removeEventListener('click', this.handleClassCard)
    this.bus.off('menu:snapshot', this.handleSnapshot)
    this.bus.off('shop:snapshot', this.handleShopSnapshot)
    document.body.classList.remove('is-main-menu')
  }

  private selectClassByOffset(offset: number) {
    const currentIndex = Math.max(0, CLASS_ORDER.indexOf(this.previewClassId))
    const nextIndex = (currentIndex + offset + CLASS_ORDER.length) % CLASS_ORDER.length
    this.previewClassId = CLASS_ORDER[nextIndex]
    this.renderClassPreview()
    this.animateClassSwitch(offset)
  }

  private animateClassSwitch(offset: number) {
    if (!this.classCard) return
    if (this.switchAnimationTimeout) window.clearTimeout(this.switchAnimationTimeout)
    const directionClass = offset > 0 ? 'is-switching-next' : 'is-switching-previous'
    this.classCard.classList.remove('is-switching-next', 'is-switching-previous')
    void this.classCard.offsetWidth
    this.classCard.classList.add(directionClass)
    this.switchAnimationTimeout = window.setTimeout(() => {
      this.classCard?.classList.remove(directionClass)
    }, 280)
  }

  private renderClassPreview() {
    const cls = TANK_CLASSES[this.previewClassId]
    const owned = this.ownedClasses.includes(this.previewClassId)
    const active = this.activeClassId === this.previewClassId
    const waveLocked = !owned && !isClassUnlockedByWave(cls, this.peakWaveValue) && !cls.unlock.freeFromStart
    const canAfford = this.currentGold >= cls.unlock.goldCost
    const classIndex = CLASS_ORDER.indexOf(this.previewClassId) + 1
    const skin = findSkin(this.activeSkins[this.previewClassId] ?? defaultSkinFor(this.previewClassId))
    const status = active ? 'Active' : owned ? 'Owned' : `${cls.unlock.goldCost.toLocaleString('en-US')}g`

    if (this.className) this.className.textContent = cls.name
    if (this.classHeading) this.classHeading.textContent = active ? 'Active Class' : 'Class Preview'
    if (this.classTagline) this.classTagline.textContent = cls.tagline
    if (this.classDescription) {
      this.classDescription.textContent = owned
        ? cls.description
        : waveLocked
          ? `Reach wave ${cls.unlock.waveMilestone} or unlock now for ${cls.unlock.goldCost.toLocaleString('en-US')}g. ${cls.description}`
          : `Unlock for ${cls.unlock.goldCost.toLocaleString('en-US')}g. ${cls.description}`
    }
    if (this.classIcon) this.classIcon.src = cls.iconUrl
    if (this.skinName) this.skinName.textContent = skin?.name ?? `${cls.name} stock`
    if (this.classCount) this.classCount.textContent = `Class ${classIndex} / ${CLASS_ORDER.length}`
    if (this.classRole) this.classRole.textContent = classRoleLabel(this.previewClassId)
    if (this.classLock) {
      this.classLock.hidden = !waveLocked
      this.classLock.textContent = `Wave ${cls.unlock.waveMilestone}`
    }
    if (this.classStatus) this.classStatus.textContent = status
    if (this.previousClassButton) this.previousClassButton.disabled = CLASS_ORDER.length <= 1
    if (this.nextClassButton) this.nextClassButton.disabled = CLASS_ORDER.length <= 1
    if (this.classCard) {
      this.classCard.disabled = !owned && !canAfford
      this.classCard.classList.toggle('is-active', active)
      this.classCard.classList.toggle('is-owned', owned)
      this.classCard.classList.toggle('is-locked', !owned)
      this.classCard.classList.toggle('is-affordable', !owned && canAfford)
      this.classCard.classList.toggle('is-too-expensive', !owned && !canAfford)
      this.classCard.setAttribute(
        'aria-label',
        owned
          ? `Select ${cls.name} class`
          : canAfford
            ? `Unlock ${cls.name} class for ${cls.unlock.goldCost} gold`
            : `Locked ${cls.name} class. Costs ${cls.unlock.goldCost} gold.`,
      )
    }
    this.loadoutPanel?.classList.toggle('is-preview-locked', !owned)
    this.renderMeters(classProfileMeters(cls))
  }

  private renderMeters(meters: MenuSnapshot['activeClassMeters']) {
    Object.entries(meters).forEach(([key, value]) => {
      const meter = this.meters[key as keyof MenuSnapshot['activeClassMeters']]
      if (!meter) return
      meter.style.setProperty('--meter', `${value}%`)
      meter.setAttribute('aria-valuenow', String(value))
      meter.title = `${capitalize(key)} ${value}/100`
    })
  }

  private bind() {
    this.root = document.querySelector<HTMLElement>('[data-menu-root]') ?? undefined
    this.startButton = document.querySelector<HTMLButtonElement>('[data-menu-start]') ?? undefined
    this.previousClassButton = document.querySelector<HTMLButtonElement>('[data-menu-class-prev]') ?? undefined
    this.nextClassButton = document.querySelector<HTMLButtonElement>('[data-menu-class-next]') ?? undefined
    this.classCard = document.querySelector<HTMLButtonElement>('[data-menu-class-card]') ?? undefined
    this.loadoutPanel = document.querySelector<HTMLElement>('.menu-loadout') ?? undefined
    this.classHeading = document.querySelector<HTMLElement>('[data-menu-class-heading]') ?? undefined
    this.className = document.querySelector<HTMLElement>('[data-menu-class-name]') ?? undefined
    this.classTagline = document.querySelector<HTMLElement>('[data-menu-class-tagline]') ?? undefined
    this.classDescription = document.querySelector<HTMLElement>('[data-menu-class-description]') ?? undefined
    this.classIcon = document.querySelector<HTMLImageElement>('[data-menu-class-icon]') ?? undefined
    this.skinName = document.querySelector<HTMLElement>('[data-menu-skin]') ?? undefined
    this.classCount = document.querySelector<HTMLElement>('[data-menu-class-count]') ?? undefined
    this.classRole = document.querySelector<HTMLElement>('[data-menu-class-role]') ?? undefined
    this.classLock = document.querySelector<HTMLElement>('[data-menu-class-lock]') ?? undefined
    this.classStatus = document.querySelector<HTMLElement>('[data-menu-class-status]') ?? undefined
    this.gold = document.querySelector<HTMLElement>('[data-menu-gold]') ?? undefined
    this.best = document.querySelector<HTMLElement>('[data-menu-best]') ?? undefined
    this.peakWave = document.querySelector<HTMLElement>('[data-menu-peak-wave]') ?? undefined
    this.meters = {
      armor: document.querySelector<HTMLElement>('[data-menu-meter="armor"]') ?? undefined,
      damage: document.querySelector<HTMLElement>('[data-menu-meter="damage"]') ?? undefined,
      control: document.querySelector<HTMLElement>('[data-menu-meter="control"]') ?? undefined,
    }
    this.startButton?.addEventListener('click', this.handleStart)
    this.previousClassButton?.addEventListener('click', this.handlePreviousClass)
    this.nextClassButton?.addEventListener('click', this.handleNextClass)
    this.classCard?.addEventListener('click', this.handleClassCard)
  }
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function classRoleLabel(classId: TankClassId) {
  const labels: Record<TankClassId, string> = {
    engineer: 'Balanced',
    scout: 'Mobility',
    heavy: 'Armor',
    sniper: 'Critical',
    bomber: 'Explosive',
  }
  return labels[classId]
}
