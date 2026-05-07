import { CLASS_ORDER, type TankClassId } from '../../classes'
import type { GameEventBus, MenuSnapshot, ShopSnapshot } from '../../events'

export class MainMenuController {
  private readonly bus: GameEventBus
  private root?: HTMLElement
  private startButton?: HTMLButtonElement
  private previousClassButton?: HTMLButtonElement
  private nextClassButton?: HTMLButtonElement
  private className?: HTMLElement
  private classTagline?: HTMLElement
  private classIcon?: HTMLImageElement
  private skinName?: HTMLElement
  private classCount?: HTMLElement
  private gold?: HTMLElement
  private best?: HTMLElement
  private peakWave?: HTMLElement
  private meters: Partial<Record<keyof MenuSnapshot['activeClassMeters'], HTMLElement>> = {}
  private playableClasses: TankClassId[] = ['engineer']
  private activeClassId: TankClassId = 'engineer'

  private readonly handleSnapshot = (snapshot: MenuSnapshot) => {
    if (this.className) this.className.textContent = snapshot.activeClassName
    if (this.classTagline) this.classTagline.textContent = snapshot.activeClassTagline
    if (this.classIcon) this.classIcon.src = snapshot.activeClassIconUrl
    if (this.skinName) this.skinName.textContent = snapshot.activeSkinName
    if (this.gold) this.gold.textContent = `${snapshot.gold.toLocaleString('en-US')}g`
    if (this.best) this.best.textContent = snapshot.highScore.toLocaleString('en-US')
    if (this.peakWave) this.peakWave.textContent = String(snapshot.peakWave)
    this.renderMeters(snapshot.activeClassMeters)
  }

  private readonly handleShopSnapshot = (snapshot: ShopSnapshot) => {
    this.playableClasses = CLASS_ORDER.filter((id) => snapshot.ownedClasses.includes(id))
    this.activeClassId = snapshot.activeClassId
    this.renderClassStepper()
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
    this.startButton?.removeEventListener('click', this.handleStart)
    this.previousClassButton?.removeEventListener('click', this.handlePreviousClass)
    this.nextClassButton?.removeEventListener('click', this.handleNextClass)
    this.bus.off('menu:snapshot', this.handleSnapshot)
    this.bus.off('shop:snapshot', this.handleShopSnapshot)
    document.body.classList.remove('is-main-menu')
  }

  private selectClassByOffset(offset: number) {
    if (this.playableClasses.length <= 1) return
    const currentIndex = Math.max(0, this.playableClasses.indexOf(this.activeClassId))
    const nextIndex = (currentIndex + offset + this.playableClasses.length) % this.playableClasses.length
    this.bus.emit('class:select', this.playableClasses[nextIndex])
  }

  private renderClassStepper() {
    const total = this.playableClasses.length
    const currentIndex = Math.max(0, this.playableClasses.indexOf(this.activeClassId))
    const disabled = total <= 1
    if (this.classCount) this.classCount.textContent = `Class ${currentIndex + 1} / ${total}`
    if (this.previousClassButton) this.previousClassButton.disabled = disabled
    if (this.nextClassButton) this.nextClassButton.disabled = disabled
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
    this.className = document.querySelector<HTMLElement>('[data-menu-class-name]') ?? undefined
    this.classTagline = document.querySelector<HTMLElement>('[data-menu-class-tagline]') ?? undefined
    this.classIcon = document.querySelector<HTMLImageElement>('[data-menu-class-icon]') ?? undefined
    this.skinName = document.querySelector<HTMLElement>('[data-menu-skin]') ?? undefined
    this.classCount = document.querySelector<HTMLElement>('[data-menu-class-count]') ?? undefined
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
  }
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
