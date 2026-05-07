import type { GameEventBus, MenuSnapshot } from '../../events'

export class MainMenuController {
  private readonly bus: GameEventBus
  private root?: HTMLElement
  private startButton?: HTMLButtonElement
  private className?: HTMLElement
  private classTagline?: HTMLElement
  private classIcon?: HTMLImageElement
  private skinName?: HTMLElement
  private gold?: HTMLElement
  private best?: HTMLElement
  private peakWave?: HTMLElement

  private readonly handleSnapshot = (snapshot: MenuSnapshot) => {
    if (this.className) this.className.textContent = snapshot.activeClassName
    if (this.classTagline) this.classTagline.textContent = snapshot.activeClassTagline
    if (this.classIcon) this.classIcon.src = snapshot.activeClassIconUrl
    if (this.skinName) this.skinName.textContent = snapshot.activeSkinName
    if (this.gold) this.gold.textContent = `${snapshot.gold.toLocaleString('en-US')}g`
    if (this.best) this.best.textContent = snapshot.highScore.toLocaleString('en-US')
    if (this.peakWave) this.peakWave.textContent = String(snapshot.peakWave)
  }

  private readonly handleStart = () => {
    this.bus.emit('menu:start')
  }

  constructor(bus: GameEventBus) {
    this.bus = bus
    this.bind()
    this.bus.on('menu:snapshot', this.handleSnapshot)
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
    this.bus.off('menu:snapshot', this.handleSnapshot)
    document.body.classList.remove('is-main-menu')
  }

  private bind() {
    this.root = document.querySelector<HTMLElement>('[data-menu-root]') ?? undefined
    this.startButton = document.querySelector<HTMLButtonElement>('[data-menu-start]') ?? undefined
    this.className = document.querySelector<HTMLElement>('[data-menu-class-name]') ?? undefined
    this.classTagline = document.querySelector<HTMLElement>('[data-menu-class-tagline]') ?? undefined
    this.classIcon = document.querySelector<HTMLImageElement>('[data-menu-class-icon]') ?? undefined
    this.skinName = document.querySelector<HTMLElement>('[data-menu-skin]') ?? undefined
    this.gold = document.querySelector<HTMLElement>('[data-menu-gold]') ?? undefined
    this.best = document.querySelector<HTMLElement>('[data-menu-best]') ?? undefined
    this.peakWave = document.querySelector<HTMLElement>('[data-menu-peak-wave]') ?? undefined
    this.startButton?.addEventListener('click', this.handleStart)
  }
}
