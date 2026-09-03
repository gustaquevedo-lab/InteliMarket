// ── SISTEMA DE ALERTAS SONORAS & HÁPTICAS PROFESIONALES (WEB AUDIO API & CAPACITOR HAPTICS) ──
// Diseñado para floor operations / colectores de salón en supermercados.
// Cero dependencias externas, latencia ultra-baja y 100% offline.

class SoundAlertManager {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  // Vibración táctil para móviles
  private vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern)
      } catch {}
    }
  }

  // 1. Beep Positivo de Escaneo Exitoso (880Hz -> 1200Hz rápido y brillante)
  playScanSuccess() {
    this.vibrate(40)
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      const now = ctx.currentTime
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08)

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12)

      osc.start(now)
      osc.stop(now + 0.12)
    } catch {}
  }

  // 2. Alarma de Discrepancia de Precio (Tono doble grave y penetrante de error)
  playPriceMismatchAlert() {
    this.vibrate([150, 80, 150])
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type = "sawtooth"
        osc.frequency.setValueAtTime(freq, start)

        gain.gain.setValueAtTime(0.35, start)
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration)

        osc.start(start)
        osc.stop(start + duration)
      }

      const now = ctx.currentTime
      playTone(320, now, 0.15)
      playTone(240, now + 0.18, 0.25)
    } catch {}
  }

  // 3. Alarma Crítica HACCP de Frío (Sirena de advertencia de 3 pulsos)
  playHaccpWarning() {
    this.vibrate([200, 100, 200, 100, 300])
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      for (let i = 0; i < 3; i++) {
        const start = now + i * 0.18
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type = "triangle"
        osc.frequency.setValueAtTime(587.33, start) // D5
        osc.frequency.linearRampToValueAtTime(880, start + 0.07) // A5
        osc.frequency.linearRampToValueAtTime(587.33, start + 0.14)

        gain.gain.setValueAtTime(0.4, start)
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.14)

        osc.start(start)
        osc.stop(start + 0.15)
      }
    } catch {}
  }

  // 4. Campana Armónica de Reposición / Quiebre
  playRestockChime() {
    this.vibrate([80, 40, 80])
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const chord = [523.25, 659.25, 783.99] // Do - Mi - Sol (Mayor)
      const now = ctx.currentTime

      chord.forEach((freq, idx) => {
        const start = now + idx * 0.05
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, start)

        gain.gain.setValueAtTime(0.25, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)

        osc.start(start)
        osc.stop(start + 0.5)
      })
    } catch {}
  }
}

export const soundAlerts = new SoundAlertManager()
