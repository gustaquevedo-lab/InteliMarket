export interface TerminalLock {
  /** Devuelve un token (monotonico) si consiguio el candado, o null si la IP esta ocupada. */
  tryAcquire(ip: string): number | null
  /** Libera solo si `token` es el del titular actual (un release tardio tras el timeout no pisa al nuevo). */
  release(ip: string, token: number): void
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
  // IP -> titular actual: token e instante (ms) en que el candado vence por timeout
  const vencimientos = new Map<string, { token: number; vence: number }>()
  let ultimoToken = 0
  const suscriptores = new Set<() => void>()

  const notificar = () => {
    suscriptores.forEach((fn) => fn())
  }

  const estaOcupada = (ip: string): boolean => {
    const titular = vencimientos.get(ip)
    if (titular === undefined) return false
    if (now() >= titular.vence) {
      vencimientos.delete(ip)
      return false
    }
    return true
  }

  return {
    tryAcquire(ip: string): number | null {
      if (estaOcupada(ip)) return null
      const token = ++ultimoToken
      vencimientos.set(ip, { token, vence: now() + timeoutMs })
      notificar()
      return token
    },
    release(ip: string, token: number): void {
      const titular = vencimientos.get(ip)
      if (titular === undefined || titular.token !== token) return
      vencimientos.delete(ip)
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
