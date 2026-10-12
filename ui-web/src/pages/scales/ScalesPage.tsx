import React, { useState, useEffect } from "react"
import { api, type ScaleConfig, type ScaleLabelTemplate, type ConnectionTestResult, type ScaleSyncStatus, type ScaleSyncLogRow } from "../../api"
import { useToast } from "../../context/ToastContext"
import {
  Search, Plus, Loader2, Plug, Wifi, Printer, Weight, FileText,
  Settings2, Trash2, CheckCircle2, XCircle, AlertTriangle, Download,
  Usb, Scale, RefreshCw, Terminal, Activity, ArrowRight, Zap, Play,
  Layers, TrendingUp
} from "lucide-react"
import { formatPYG } from "../../utils/format"

type Tab = "configs" | "usb_checkout" | "plu_sync" | "sync_log" | "labels" | "logs"

interface ScaleConfigForm {
  nombre: string
  marca: string
  modelo: string
  protocolo: string
  conexion: string
  host: string
  puerto_tcp: number
  puerto_com: string
  baudrate: number
  timeout_segundos: number
  sync_automatico: boolean
  etiqueta_formato: string
  etiqueta_cabecera: string
}

// ── Helpers de estado de transmisión (vigilante de precios) ──────────────
const hace = (iso?: string | null): string => {
  if (!iso) return "nunca"
  const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seg < 60) return `hace ${seg} s`
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h ${Math.floor((seg % 3600) / 60)} min`
  return `hace ${Math.floor(seg / 86400)} d`
}

const fechaHora = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"

const gs = (n: number | null | undefined): string => (n == null ? "—" : n.toLocaleString("es-PY", { maximumFractionDigits: 0 }))

type EstadoTx = "al_dia" | "error" | "inactivo" | "sin_datos"
const estadoTransmision = (st?: ScaleSyncStatus): EstadoTx => {
  if (!st || (!st.last_ok_at && !st.last_error)) return "sin_datos"
  if (st.last_error) return "error"
  const sinChequeo = !st.last_check_at || Date.now() - new Date(st.last_check_at).getTime() > 3 * 60 * 1000
  return sinChequeo ? "inactivo" : "al_dia"
}

const ORIGEN_LABEL: Record<string, string> = {
  evento: "Cambio detectado",
  tiempo: "Chequeo programado",
  respaldo: "Respaldo (cron)",
  respaldo_completa: "Carga completa (cron)",
}

export default function ScalesPage() {
  const [tab, setTab] = useState<Tab>("configs")
  const [loading, setLoading] = useState(true)
  const [scales, setScales] = useState<ScaleConfig[]>([])
  const [selectedScale, setSelectedScale] = useState<string>("")
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [templates, setTemplates] = useState<ScaleLabelTemplate[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [pingResults, setPingResults] = useState<Record<string, ConnectionTestResult>>({})
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [syncingPlu, setSyncingPlu] = useState(false)
  const [syncStatus, setSyncStatus] = useState<ScaleSyncStatus[]>([])
  const [syncLog, setSyncLog] = useState<ScaleSyncLogRow[]>([])
  const [logScale, setLogScale] = useState<string>("")
  const [logEstado, setLogEstado] = useState<"" | "ok" | "error">("")
  const [, setTick] = useState(0)

  // ── ESTADOS DE DIAGNÓSTICO WEB SERIAL USB (BALMAK BCK30 CHECKOUT) ────────
  const [usbConnected, setUsbConnected] = useState(false)
  const [usbWeight, setUsbWeight] = useState<number>(0.000)
  const [usbStable, setUsbStable] = useState<boolean>(true)
  const [rawUsbLogs, setRawUsbLogs] = useState<string[]>([])
  const [usbPort, setUsbPort] = useState<any>(null)

  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, t, l] = await Promise.all([
        api.scales.configs.list(),
        api.scales.labelTemplates.list(),
        api.scales.weightLogs(),
      ])
      setScales(s || [])
      setTemplates(t || [])
      setLogs(l || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchSync = async () => {
    try {
      const [st, lg] = await Promise.all([
        api.scales.syncStatus(),
        api.scales.syncLog({ limit: 100, scale_id: logScale || undefined, estado: logEstado || undefined }),
      ])
      setSyncStatus(st || [])
      setSyncLog(lg || [])
    } catch {
      // se reintenta en el siguiente ciclo
    }
    setTick((t) => t + 1)
  }

  useEffect(() => {
    fetchSync()
    const id = setInterval(fetchSync, 10000)
    return () => clearInterval(id)
  }, [logScale, logEstado])

  const statusDe = (scaleId: string) => syncStatus.find((x) => x.scale_id === scaleId)
  const conError = syncStatus.filter((x) => x.last_error)
  const alDia = syncStatus.filter((x) => estadoTransmision(x) === "al_dia").length
  const pluMax = syncStatus.reduce((m, x) => Math.max(m, x.plu_cargados || 0), 0)

  const testScale = async (scale: ScaleConfig) => {
    setPingingId(scale.id)
    try {
      const result = await api.scales.test(scale.id)
      setPingResults((prev) => ({ ...prev, [scale.id]: result }))
      if (result.conectada) {
        toast.success(`${scale.nombre}: conectada`, `${result.mensaje}${result.latencia_ms != null ? ` · ${result.latencia_ms}ms` : ""}`)
      } else {
        toast.error(`${scale.nombre}: sin conexión`, result.mensaje)
      }
    } catch (err: any) {
      toast.error(`${scale.nombre}: error`, err?.message || "No se pudo probar la conexión")
    } finally {
      setPingingId(null)
    }
  }

  const syncAllPLU = async () => {
    const objetivo = scales.filter((s) => s.activa && s.host)
    if (objetivo.length === 0) {
      toast.warning("Sin balanzas configuradas", "Ninguna balanza tiene host/IP cargado todavía.")
      return
    }
    setSyncingPlu(true)
    try {
      const resultados = await Promise.all(
        objetivo.map((s) => api.scales.syncPLU(s.id, { producto_ids: [], modo: "completo" }).catch((err: any) => ({
          scale_nombre: s.nombre, exitosos: 0, fallidos: 0, total_productos: 0, error: err?.message,
        })))
      )
      const totalExitosos = resultados.reduce((acc: number, r: any) => acc + (r.exitosos || 0), 0)
      const totalFallidos = resultados.reduce((acc: number, r: any) => acc + (r.fallidos || 0), 0)
      const conError = resultados.filter((r: any) => r.error)
      if (conError.length > 0) {
        toast.error("Sincronización con errores", conError.map((r: any) => `${r.scale_nombre}: ${r.error}`).join(" · "))
      } else {
        toast.success("PLUs enviados", `${totalExitosos} productos transmitidos a ${objetivo.length} balanzas${totalFallidos ? ` (${totalFallidos} sin plu_balanza asignado)` : ""}`)
      }
      fetchAll()
    } finally {
      setSyncingPlu(false)
    }
  }

  const startUsbSerialTest = async () => {
    if (!("serial" in navigator)) {
      toast.warning(
        "Navegador sin Web Serial",
        "Abra el sistema en Google Chrome o Edge para conectarse directamente a la Balmak BCK30 por USB."
      )
      return
    }

    try {
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" })
      setUsbPort(port)
      setUsbConnected(true)
      toast.success("Balanza USB Conectada", "Escuchando flujo de peso continuo Balmak BCK30 a 9600 baudios.")

      const decoder = new TextDecoderStream()
      port.readable.pipeTo(decoder.writable)
      const reader = decoder.readable.getReader()

      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          reader.releaseLock()
          break
        }
        if (value) {
          buffer += value
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.trim()) {
              setRawUsbLogs((prev) => [
                `[${new Date().toLocaleTimeString()}] RAW: "${line}"`,
                ...prev.slice(0, 30),
              ])

              const match = line.match(/([0-9]+\.[0-9]{2,3})/)
              if (match && match[1]) {
                const parsed = parseFloat(match[1])
                if (!isNaN(parsed)) {
                  setUsbWeight(parsed)
                  setUsbStable(!line.includes("US"))
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        toast.error("Error en conexión USB", err.message)
      }
      setUsbConnected(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/90 text-white p-7 border border-cyan-500/20 shadow-2xl shadow-cyan-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 border border-cyan-400/30 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Scale className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                    HARDWARE · BÁSCULAS & BALANZAS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Drivers Toledo / Systel / Balmak Activos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Básculas & Balanzas de Supermercado
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Pesaje continuo en checkout USB y sincronización de PLUs pesables para carnicería, panadería y fiambrería
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado Matriz
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                ⚖️ 6 Balanzas de Mostrador + 10 Checkouts
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚡ Web Serial API 9600 Baudios
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={syncAllPLU}
              disabled={syncingPlu}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingPlu ? "animate-spin" : ""}`} />
              Sincronizar PLUs
            </button>
            <button
              onClick={startUsbSerialTest}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-black shadow-lg shadow-cyan-500/25 transition cursor-pointer active:scale-95"
            >
              <Usb className="w-4 h-4" />
              Test Balanza USB Checkout
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Balanzas Mostrador</span>
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
            {syncStatus.length} balanzas
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Transmisión: <strong className="text-slate-700 dark:text-slate-200 font-mono">{alDia} de {syncStatus.length} al día</strong></span>
            <span className={`font-bold font-mono ${conError.length ? "text-rose-600" : "text-cyan-600"}`}>{conError.length ? `${conError.length} con error` : "Etiquetadoras"}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Checkouts Balanza</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Usb className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            10 Cajas POS
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Protocolo: <strong className="text-slate-700 dark:text-slate-200 font-mono">Web Serial 9600</strong></span>
            <span className="text-blue-600 font-bold font-mono">0ms Latencia</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Catálogo PLU Pesable</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Weight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {pluMax} ítems
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cargados en cada balanza (último envío confirmado)</span>
            <span className={`font-bold font-mono ${conError.length ? "text-amber-600" : "text-purple-600"}`}>{conError.length ? "Pendiente" : "Sincronizado"}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prefijo EAN Embebido</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            Prefijo 20 / 21
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Formato: <strong className="text-slate-700 dark:text-slate-200 font-mono">20PPPPPVVVVVC</strong></span>
            <span className="text-emerald-600 font-bold font-mono">Auto-lectura</span>
          </div>
        </div>
      </div>

      {/* ── ALERTA: balanzas con envío pendiente ── */}
      {conError.length > 0 && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-black text-rose-800 dark:text-rose-200">
              {conError.length === 1 ? "Una balanza tiene precios pendientes de transmitir" : `${conError.length} balanzas tienen precios pendientes de transmitir`}
            </p>
            {conError.map((x) => (
              <p key={x.scale_id} className="text-rose-700 dark:text-rose-300">
                <strong>{x.nombre}</strong>: {x.last_error} · desde {fechaHora(x.last_error_at)} ({hace(x.last_error_at)}). Se reintenta sola apenas la balanza vuelva a estar en línea.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS BAR ── */}
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {[
          { key: "configs", label: "Balanzas de Red & IP", icon: Wifi },
          { key: "usb_checkout", label: "Diagnóstico USB Checkout", icon: Usb },
          { key: "plu_sync", label: "Sincronización de PLUs", icon: Weight },
          { key: "sync_log", label: "Registro de transmisiones", icon: Activity },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow-md text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CONFIGS ── */}
      {tab === "configs" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Balanzas Etiquetadoras de Mostrador</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Equipos de pesaje conectados vía TCP/IP en los sectores de venta asistida</p>
            </div>
            <button
              onClick={() => toast.info("Nueva Balanza", "Asistente de configuración de balanza TCP/IP")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-300 dark:border-teal-800 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Balanza
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400">Cargando balanzas...</p>
          ) : scales.length === 0 ? (
            <p className="text-xs text-gray-400">No hay balanzas configuradas todavía.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scales.map(b => {
                const ping = pingResults[b.id]
                return (
                  <div key={b.id} className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-750/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-gray-900 dark:text-white">{b.nombre}</p>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full font-mono ${
                        ping ? (ping.conectada ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300")
                          : b.activa ? "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300" : "bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-gray-500"
                      }`}>
                        {ping ? (ping.conectada ? "online" : "sin conexión") : (b.activa ? "sin probar" : "inactiva")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Modelo: <strong>{b.marca}{b.modelo ? ` · ${b.modelo}` : ""}</strong></p>
                    <p className="text-[11px] text-gray-500 font-mono">
                      {b.host ? `${b.host}:${b.puerto_tcp}` : b.puerto_com || "sin conexión configurada"}
                    </p>
                    {ping && <p className="text-[11px] text-gray-400">{ping.mensaje}{ping.latencia_ms != null ? ` · ${ping.latencia_ms}ms` : ""}</p>}
                    {(() => {
                      const st = statusDe(b.id)
                      const est = estadoTransmision(st)
                      const estilo = {
                        al_dia: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300",
                        error: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300",
                        inactivo: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300",
                        sin_datos: "bg-gray-100 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300",
                      }[est]
                      const titulo = { al_dia: "Precios al día", error: "Envío pendiente (sin conexión)", inactivo: "Vigilante sin actividad reciente", sin_datos: "Sin transmisiones registradas" }[est]
                      return (
                        <div className={`mt-1 p-2.5 rounded-lg border text-[11px] space-y-0.5 ${estilo}`}>
                          <p className="font-black text-xs">{titulo}</p>
                          <p>Último envío exitoso: <strong>{hace(st?.last_ok_at)}</strong>{st?.last_ok_at ? ` (${fechaHora(st.last_ok_at)})` : ""}</p>
                          {st?.last_error && <p>Error: {st.last_error} · desde {hace(st.last_error_at)}</p>}
                          <p>PLU cargados: <strong>{st?.plu_cargados ?? 0}</strong> · Último chequeo del vigilante: {hace(st?.last_check_at)}</p>
                        </div>
                      )
                    })()}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      <span className="text-gray-400 font-mono text-[11px]">{b.sync_automatico ? "Auto-sync ON" : "Auto-sync OFF"}</span>
                      <button
                        onClick={() => testScale(b)}
                        disabled={pingingId === b.id}
                        className="text-xs font-bold text-teal-600 hover:underline disabled:opacity-50"
                      >
                        {pingingId === b.id ? "Probando..." : "Test Ping"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: USB CHECKOUT ── */}
      {tab === "usb_checkout" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Lectura de Peso en Tiempo Real (Checkout POS)</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Conexión directa por puerto serial/USB a la balanza del cajero</p>
            </div>
            <button
              onClick={startUsbSerialTest}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Usb className="w-3.5 h-3.5" />
              {usbConnected ? "Reconectar Balanza USB" : "Conectar Balanza USB"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">Display Digital de Caja</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${usbStable ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {usbStable ? "PESO ESTABLE" : "EN MOVIMIENTO"}
                </span>
              </div>
              <div className="text-center py-4">
                <span className="text-6xl font-black font-mono tracking-tight text-teal-400">
                  {usbWeight.toFixed(3)}
                </span>
                <span className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate ml-2 text-gray-400 font-mono">kg</span>
              </div>
              <p className="text-[11px] text-gray-400 text-center font-mono">
                {usbConnected ? "● Flujo Serial Activo (9600 baud, 8N1)" : "○ Desconectado — Haga clic en Conectar Balanza USB"}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-750/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monitor de Datos Crudos (Serial Log)</p>
              <div className="h-40 overflow-y-auto bg-slate-900 rounded-lg p-3 text-[11px] font-mono text-emerald-400 space-y-1">
                {rawUsbLogs.length > 0 ? (
                  rawUsbLogs.map((log, i) => <div key={i}>{log}</div>)
                ) : (
                  <div className="text-gray-500 italic">Sin datos recibidos aún. Conecte la balanza para capturar tramas de peso.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PLU SYNC ── */}
      {tab === "plu_sync" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Sincronización de Catálogo PLU</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Transmisión de productos pesables, códigos de balanza y precios a las memorias de las básculas</p>
            </div>
            <button
              onClick={syncAllPLU}
              disabled={syncingPlu}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingPlu ? "animate-spin" : ""}`} />
              {syncingPlu ? "Enviando..." : "Enviar PLUs a Todas las Balanzas"}
            </button>
          </div>
          <div className="space-y-1.5">
            {scales.filter(s => s.host).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50/50 dark:bg-slate-750/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-gray-700 dark:text-gray-200">{s.nombre}</span>
                <span className="text-gray-400 font-mono">{s.host}:{s.puerto_tcp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: REGISTRO DE TRANSMISIONES ── */}
      {tab === "sync_log" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Registro de transmisiones a balanzas</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cada envío de precios (cambios detectados, promociones que entran o salen, cargas completas) y su resultado. Se actualiza solo cada 10 s · se conservan 30 días.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={logScale}
                onChange={(e) => setLogScale(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
              >
                <option value="">Todas las balanzas</option>
                {syncStatus.map((x) => <option key={x.scale_id} value={x.scale_id}>{x.nombre}</option>)}
              </select>
              <select
                value={logEstado}
                onChange={(e) => setLogEstado(e.target.value as "" | "ok" | "error")}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
              >
                <option value="">Exitosos y fallidos</option>
                <option value="ok">Solo exitosos</option>
                <option value="error">Solo fallidos</option>
              </select>
              <button onClick={fetchSync} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-300 dark:border-teal-800">
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </div>
          </div>

          {syncLog.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Todavía no hay transmisiones registradas con este filtro.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-slate-900/60 text-left text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Balanza</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Resultado</th>
                    <th className="px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {syncLog.map((r) => {
                    const items = r.detalle || []
                    return (
                      <tr key={r.id} className="align-top hover:bg-gray-50/60 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {fechaHora(r.ultimo_intento)}
                          <div className="text-[10px] text-gray-400">{hace(r.ultimo_intento)}</div>
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100">{r.scale_nombre}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{ORIGEN_LABEL[r.origen] || r.origen}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.estado === "ok" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Exitoso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <XCircle className="w-3 h-3" /> Fallido{r.repeticiones > 1 ? ` ×${r.repeticiones}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200 max-w-xl">
                          {r.estado === "error" ? (
                            <div className="space-y-0.5">
                              <p className="font-bold text-rose-700 dark:text-rose-300">{r.error}</p>
                              <p className="text-gray-500">
                                {r.total} PLU pendientes · primer fallo {fechaHora(r.created_at)}{r.repeticiones > 1 ? ` · ${r.repeticiones} intentos, último ${hace(r.ultimo_intento)}` : ""}
                              </p>
                            </div>
                          ) : (
                            <p className="font-bold">
                              {r.tipo === "completa" ? `Carga completa: ${r.total} PLU transmitidos` : `${r.total} PLU transmitidos`}
                            </p>
                          )}
                          {items.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-teal-700 dark:text-teal-400 font-bold">
                                {r.estado === "error" ? "Ver precios pendientes" : r.tipo === "completa" ? "Ver cambios incluidos" : "Ver precios"} ({items.length}{items.length >= 100 ? "+" : ""})
                              </summary>
                              <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                                {items.map((it) => (
                                  <li key={it.plu}>
                                    <span className="text-gray-400">PLU {it.plu}</span> {it.nombre.trim()}:{" "}
                                    {it.antes == null ? <span className="text-gray-500">nuevo → </span> : <span className="text-gray-500">{gs(it.antes)} → </span>}
                                    <strong className={it.antes != null && it.ahora < it.antes ? "text-emerald-600" : "text-gray-900 dark:text-white"}>{gs(it.ahora)}</strong>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
