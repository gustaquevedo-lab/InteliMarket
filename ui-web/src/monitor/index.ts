/**
 * Monitor de errores e incidencias de InteliMarket (el "Sentry propio").
 *
 * Corre en el navegador y en la app de caja (Electron). Captura errores no
 * atrapados, promesas rechazadas, caidas de pantalla, fallas de conexion con el
 * servidor y fallas de los terminales de cobro, y manda todo a /monitor/ingest
 * junto con las ultimas acciones del usuario ("migas de pan") para poder
 * reconstruir que paso.
 *
 * Reglas:
 *  - Nunca rompe la app: todo va en try/catch y sin await en el camino del usuario.
 *  - Nunca guarda lo que se escribe en los campos (ni contrasenas ni tarjetas):
 *    las migas solo registran el texto de botones, rutas y llamadas al API.
 *  - Si no hay red, los eventos esperan y se reenvian solos.
 */
import { API_BASE } from "../api"

type Level = "fatal" | "error" | "warning" | "info"
type Source = "frontend" | "electron" | "integration"

interface Crumb { t: string; type: string; msg: string }
interface MonEvent {
  source: Source
  level: Level
  kind?: string
  message: string
  stack?: string
  url?: string
  route?: string
  provider?: string
  op?: string
  code?: string
  release?: string
  hostname?: string
  punto_emision?: string
  app_version?: string
  http_status?: number
  http_method?: string
  duration_ms?: number
  breadcrumbs?: Crumb[]
  extra?: Record<string, unknown>
}

export const RELEASE: string = (import.meta.env.VITE_RELEASE as string | undefined) || "dev"

const QUEUE_KEY = "im_mon_queue"
const MAX_QUEUE = 40
const crumbs: Crumb[] = []
const ctx: { hostname?: string; punto_emision?: string; app_version?: string; electron_version?: string; capabilities?: string[] } = {}
const recent = new Map<string, { n: number; t: number }>()
let queue: MonEvent[] = []
let started = false
let flushing = false

const isElectron = () => typeof window !== "undefined" && !!(window as any).electronAPI

function hhmmss() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

export function addBreadcrumb(type: string, msg: string) {
  try {
    crumbs.push({ t: hhmmss(), type, msg: String(msg).slice(0, 200) })
    if (crumbs.length > 30) crumbs.shift()
  } catch { /* nada */ }
}

/** Ruta del API sin ids ni query, para agrupar: /v1/sales/3f2a... -> /v1/sales/:id */
function pathTemplate(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    return u.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:n")
  } catch {
    return url.split("?")[0]
  }
}

function token(): string | null {
  try { return localStorage.getItem("access_token") } catch { return null }
}

function loadStored(): MonEvent[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") } catch { return [] }
}
function storeQueue() {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))) } catch { /* sin storage */ }
}

function enqueue(ev: MonEvent) {
  try {
    const key = `${ev.source}|${ev.kind}|${ev.provider}|${ev.op}|${ev.code}|${ev.message.slice(0, 80)}`
    const now = Date.now()
    const r = recent.get(key)
    if (r && now - r.t < 60_000) {
      if (++r.n > 3) return // el mismo error en bucle: el servidor ya lo cuenta con los primeros
    } else {
      recent.set(key, { n: 1, t: now })
      if (recent.size > 200) recent.clear()
    }
    ev.release = RELEASE
    ev.hostname = ctx.hostname
    ev.punto_emision = ctx.punto_emision
    ev.app_version = ctx.app_version
    ev.url = ev.url || window.location.pathname + window.location.hash
    ev.breadcrumbs = crumbs.slice()
    queue.push(ev)
    if (queue.length > MAX_QUEUE) queue.shift()
    storeQueue()
    void flush()
  } catch { /* nada */ }
}

export async function flush(keepalive = false) {
  if (flushing || !queue.length) return
  const tk = token()
  if (!tk) return
  flushing = true
  const batch = queue.slice(0, 20)
  try {
    const res = await fetch(`${API_BASE}/v1/monitor/ingest`, {
      method: "POST",
      keepalive,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ events: batch }),
    })
    if (res.ok || res.status === 400 || res.status === 413 || res.status === 422) {
      queue = queue.slice(batch.length)
      storeQueue()
    }
  } catch { /* sin red: queda en la cola y se reintenta */ } finally {
    flushing = false
  }
}

function errText(e: unknown): { kind: string; message: string; stack?: string } {
  if (e instanceof Error) {
    const kind = e.name || "Error"
    const message = (e.message || String(e)).replace(new RegExp(`^${kind}:\\s*`), "")
    return { kind, message, stack: e.stack }
  }
  if (typeof e === "string") return { kind: "Error", message: e }
  try { return { kind: "Error", message: JSON.stringify(e).slice(0, 500) } } catch { return { kind: "Error", message: String(e) } }
}

export function captureException(e: unknown, extra?: Record<string, unknown>, level: Level = "error") {
  const { kind, message, stack } = errText(e)
  enqueue({ source: isElectron() ? "electron" : "frontend", level, kind, message, stack, extra })
}

export function captureMessage(message: string, level: Level = "warning", extra?: Record<string, unknown>, kind = "Message") {
  enqueue({ source: isElectron() ? "electron" : "frontend", level, kind, message, extra })
}

export function captureIntegration(p: {
  provider: string; op: string; code?: string; message: string; level?: Level; duration_ms?: number; extra?: Record<string, unknown>
}) {
  enqueue({ source: "integration", level: p.level || "error", kind: "Integration", provider: p.provider, op: p.op, code: p.code,
    message: p.message, duration_ms: p.duration_ms, extra: p.extra })
}

export function setContext(c: { punto_emision?: string }) {
  if (c.punto_emision) ctx.punto_emision = c.punto_emision
}

// ── latidos: "esta caja esta viva, con esta version" ──────────────────────────
async function heartbeat() {
  const tk = token()
  if (!tk) return
  try {
    await fetch(`${API_BASE}/v1/monitor/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify({
        hostname: ctx.hostname, punto_emision: ctx.punto_emision, release: RELEASE, app_version: ctx.app_version,
        electron_version: ctx.electron_version, capabilities: ctx.capabilities, url: window.location.pathname,
      }),
    })
  } catch { /* nada */ }
}

// ── arranque ────────────────────────────────────────────────────────────────
export function initMonitor() {
  if (started || typeof window === "undefined") return
  started = true
  queue = loadStored()

  // Errores no atrapados y promesas rechazadas
  window.addEventListener("error", (ev) => {
    if (!ev.error && /ResizeObserver loop/i.test(ev.message || "")) return
    if (!ev.error && (ev.message === "Script error." || !ev.message)) return
    captureException(ev.error || ev.message, { file: (ev.filename || "").split("/").pop(), line: ev.lineno })
  })
  window.addEventListener("unhandledrejection", (ev) => {
    const r: any = ev.reason
    if (r && (r.name === "AbortError" || /aborted/i.test(String(r.message || "")))) return
    captureException(r, { tipo: "promesa rechazada" })
  })

  // Migas de pan: navegacion, clics en botones/links, llamadas al API, console.error
  const hist = window.history
  for (const fn of ["pushState", "replaceState"] as const) {
    const orig = hist[fn].bind(hist)
    ;(hist as any)[fn] = (...a: any[]) => { const r = (orig as any)(...a); addBreadcrumb("nav", window.location.pathname); return r }
  }
  window.addEventListener("popstate", () => addBreadcrumb("nav", window.location.pathname))
  document.addEventListener("click", (ev) => {
    try {
      const el = (ev.target as HTMLElement | null)?.closest?.("button,a,[role=button]") as HTMLElement | null
      if (!el) return
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
      if (label) addBreadcrumb("click", label)
    } catch { /* nada */ }
  }, true)

  const origFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url
    const mine = url.includes("/monitor/")
    const isApi = url.startsWith(API_BASE) || url.includes("/api/")
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET") || "GET").toUpperCase()
    const t0 = performance.now()
    try {
      const res = await origFetch(input, init)
      if (isApi && !mine) addBreadcrumb("api", `${method} ${pathTemplate(url)} -> ${res.status} (${Math.round(performance.now() - t0)} ms)`)
      return res
    } catch (e: any) {
      if (isApi && !mine && e?.name !== "AbortError") {
        addBreadcrumb("api", `${method} ${pathTemplate(url)} -> SIN CONEXION`)
        enqueue({ source: isElectron() ? "electron" : "frontend", level: "error", kind: "NetworkError", provider: undefined,
          message: `Sin conexión con el servidor: ${method} ${pathTemplate(url)}`, http_method: method, route: pathTemplate(url),
          duration_ms: Math.round(performance.now() - t0) })
      }
      throw e
    }
  }

  const origConsoleError = console.error.bind(console)
  console.error = (...args: any[]) => {
    origConsoleError(...args)
    try {
      // El ErrorBoundary ya reporta el error real via captureException (nivel fatal);
      // su propio console.error es solo para la consola del navegador, no una incidencia nueva.
      if (typeof args[0] === "string" && args[0].includes("[InteliMarket ErrorBoundary")) return
      const text = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })())).join(" ").slice(0, 300)
      addBreadcrumb("console", text)
      const err = args.find((a) => a instanceof Error) as Error | undefined
      enqueue({ source: isElectron() ? "electron" : "frontend", level: "warning", kind: err?.name || "console.error", message: text, stack: err?.stack })
    } catch { /* nada */ }
  }

  // Contexto de la maquina (nombre de la PC, versiones, funciones disponibles en la app de caja)
  const api = (window as any).electronAPI
  if (api) {
    ctx.capabilities = Object.keys(api).sort()
    Promise.resolve(api.getStatus?.()).then((s: any) => {
      if (s) { ctx.hostname = s.hostname; ctx.app_version = s.appVersion; ctx.electron_version = s.electronVersion }
    }).catch(() => {}).finally(() => { void heartbeat() })
  } else {
    void heartbeat()
  }

  setInterval(() => { void heartbeat() }, 60_000)
  setInterval(() => { void flush() }, 8_000)
  window.addEventListener("pagehide", () => { void flush(true) })
  window.addEventListener("online", () => { void flush() })
  addBreadcrumb("nav", window.location.pathname)
}
