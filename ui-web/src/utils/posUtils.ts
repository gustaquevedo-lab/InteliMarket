/** Keyboard shortcuts hook for POS — maximum speed for cashiers */

import { useEffect } from "react"

export interface POSShortcuts {
  onSearch: () => void
  onPayment: () => void
  onCustomer: () => void
  onDiscount: () => void
  onHold: () => void
  onRecover: () => void
  onUndo: () => void
  onBarcode: () => void
  onNewSale: () => void
  onQuantityDouble: () => void
  onQuantityTriple: () => void
  onEfectivo: () => void
  onTarjeta: () => void
  onCancelar: () => void
}

export function usePOSKeyboard(shortcuts: POSShortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case "F1": e.preventDefault(); shortcuts.onEfectivo(); break
        case "F2": e.preventDefault(); shortcuts.onTarjeta(); break
        case "F3": e.preventDefault(); shortcuts.onCustomer(); break
        case "F4": e.preventDefault(); shortcuts.onSearch(); break
        case "F5": e.preventDefault(); shortcuts.onHold(); break
        case "F6": e.preventDefault(); shortcuts.onRecover(); break
        case "F7": e.preventDefault(); shortcuts.onBarcode(); break
        case "F8": e.preventDefault(); shortcuts.onDiscount(); break
        case "F12": e.preventDefault(); shortcuts.onNewSale(); break
        case "Escape": shortcuts.onCancelar(); break
        case "F9": e.preventDefault(); shortcuts.onQuantityDouble(); break
        case "F10": e.preventDefault(); shortcuts.onQuantityTriple(); break
        case "z":
        case "Z":
          if (e.ctrlKey) { e.preventDefault(); shortcuts.onUndo(); }
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [shortcuts])
}

/** Guaraní rounding — PY has no cents, round to nearest 50 */
export function roundPY(amount: number): number {
  return Math.round(amount / 50) * 50
}

/** Sound effects */
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

export function playBeep(freq = 800, duration = 80) {
  try {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = freq
    gain.gain.value = 0.1
    osc.start()
    osc.stop(audioCtx.currentTime + duration / 1000)
  } catch {}
}

export function playSuccess() {
  playBeep(1200, 100)
  setTimeout(() => playBeep(1600, 150), 100)
}

export function playError() {
  playBeep(200, 300)
}

/** Session timeout — auto-lock POS after inactivity */
export function useSessionTimeout(minutes: number, onTimeout: () => void) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(onTimeout, minutes * 60 * 1000)
    }
    const events = ["mousedown", "keydown", "touchstart", "scroll"]
    events.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [minutes, onTimeout])
}
