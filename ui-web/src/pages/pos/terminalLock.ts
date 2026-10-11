export interface TerminalLock {
  tryAcquire(ip: string): boolean
  release(ip: string): void
  isBusy(ip: string): boolean
  subscribe(fn: () => void): () => void
}

export interface TerminalLockOptions {
  timeoutMs?: number
  now?: () => number
}

// Un cobro Bancard son dos llamadas de hasta 90 s (/pos/venta-ux y /pos/descuento).
const TIMEOUT_POR_DEFECTO_MS = 190_000

export function createTerminalLock(opts: TerminalLockOptions = {}): TerminalLock {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS
  const now = opts.now ?? (() => Date.now())
  // IP -> instante (ms) en que el candado vence por timeout
  const vencimientos = new Map<string, number>()
  const suscriptores = new Set<() => void>()

  const notificar = () => {
    suscriptores.forEach((fn) => fn())
  }

  const estaOcupada = (ip: string): boolean => {
    const vence = vencimientos.get(ip)
    if (vence === undefined) return false
    if (now() >= vence) {
      vencimientos.delete(ip)
      return false
    }
    return true
  }

  return {
    tryAcquire(ip: string): boolean {
      if (estaOcupada(ip)) return false
      vencimientos.set(ip, now() + timeoutMs)
      notificar()
      return true
    },
    release(ip: string): void {
      if (!vencimientos.delete(ip)) return
      notificar()
    },
    isBusy(ip: string): boolean {
      return estaOcupada(ip)
    },
    subscribe(fn: () => void): () => void {
      suscriptores.add(fn)
      return () => {
        suscriptores.delete(fn)
      }
    },
  }
}

export const terminalLock: TerminalLock = createTerminalLock()
