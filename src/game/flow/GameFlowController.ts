import type { GameState } from '../types'

export class GameFlowController {
  private current: GameState = 'menu'
  private shopPausedRun = false

  get state() {
    return this.current
  }

  is(state: GameState) {
    return this.current === state
  }

  enterMenu() {
    this.current = 'menu'
    this.shopPausedRun = false
  }

  enterPlaying() {
    this.current = 'playing'
    this.shopPausedRun = false
  }

  enterPaused() {
    if (this.current !== 'playing') {
      return false
    }

    this.current = 'paused'
    this.shopPausedRun = false
    return true
  }

  resumePaused() {
    if (this.current !== 'paused' || this.shopPausedRun) {
      return false
    }

    this.current = 'playing'
    this.shopPausedRun = false
    return true
  }

  pauseForShop() {
    if (this.current !== 'playing') {
      return false
    }

    this.current = 'paused'
    this.shopPausedRun = true
    return true
  }

  resumeAfterShop() {
    if (!this.shopPausedRun || this.current !== 'paused') {
      return false
    }

    this.current = 'playing'
    this.shopPausedRun = false
    return true
  }

  enterUpgrade() {
    this.current = 'upgrade'
    this.shopPausedRun = false
  }

  finishUpgrade() {
    this.current = 'playing'
    this.shopPausedRun = false
  }

  endMatch(nextState: 'won' | 'lost') {
    this.current = nextState
    this.shopPausedRun = false
  }
}
