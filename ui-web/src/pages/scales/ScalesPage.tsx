import React, { useState, useEffect } from "react"
import { api, type ScaleConfig, type ScaleLabelTemplate, type ConnectionTestResult } from "../../api"
import { useToast } from "../../context/ToastContext"
import {
  Search, Plus, Loader2, Plug, Wifi, Printer, Weight, FileText,
  Settings2, Trash2, CheckCircle2, XCircle, AlertTriangle, Download,
  Usb, Scale, RefreshCw, Terminal, Activity, ArrowRight, Zap, Play,
  Layers, TrendingUp
} from "lucide-react"
import { formatPYG } from "../../utils/format"

type Tab = "configs" | "usb_checkout" | "plu_sync" | "labels" | "logs"

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
            6 balanzas
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Modelos: <strong className="text-slate-700 dark:text-slate-200 font-mono">Toledo P03 / Systel</strong></span>
            <span className="text-cyan-600 font-bold font-mono">Etiquetadoras</span>
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
            342 ítems
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Secciones: <strong className="text-slate-700 dark:text-slate-200 font-mono">Carnes, Fiambres</strong></span>
            <span className="text-purple-600 font-bold font-mono">Sincronizado</span>
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

      {/* ── TABS BAR ── */}
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {[
          { key: "configs", label: "Balanzas de Red & IP", icon: Wifi },
          { key: "usb_checkout", label: "Diagnóstico USB Checkout", icon: Usb },
          { key: "plu_sync", label: "Sincronización de PLUs", icon: Weight },
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
    </div>
  )
}
