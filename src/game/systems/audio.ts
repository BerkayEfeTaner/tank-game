export class GameAudio {
  private context: AudioContext | undefined
  private enabled = false

  unlock() {
    if (this.enabled) {
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return
    }

    this.context = new AudioContextClass()
    this.enabled = true
  }

  shot() {
    this.playTone(180, 0.045, 'square', 0.04)
  }

  hit() {
    this.playTone(90, 0.08, 'sawtooth', 0.05)
  }

  explosion() {
    this.playTone(54, 0.16, 'triangle', 0.07)
  }

  wave() {
    this.playTone(420, 0.11, 'sine', 0.035)
    window.setTimeout(() => this.playTone(620, 0.12, 'sine', 0.035), 90)
  }

  fail() {
    this.playTone(140, 0.16, 'sawtooth', 0.05)
    window.setTimeout(() => this.playTone(84, 0.2, 'sawtooth', 0.045), 120)
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    if (!this.context) {
      return
    }

    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const now = this.context.currentTime

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
