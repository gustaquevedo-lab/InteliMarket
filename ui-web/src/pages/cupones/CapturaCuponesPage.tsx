import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Ticket, Sparkles, User, Phone, MapPin, Send, CheckCircle2,
  AlertCircle, Search, RefreshCw, Layers, ShieldCheck, MessageSquare,
  DollarSign, Award, Tag, Trash2, ExternalLink, ArrowRight, Zap,
  ShoppingBag, Clock, Brain, ThumbsUp, Copy, Check, Filter,
  Settings, Sliders, Printer, Wand2, Scissors, Save, HelpCircle
} from "lucide-react"
import { api, type CuponTicket, type CuponCliente, type CuponStats } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const BARRIOS_PJC = [
  "San Gerardo",
  "Obrero",
  "Guaraní",
  "Jardín Aurora",
  "Centro",
  "San Blas",
  "Defensores del Chaco",
  "Mariscal Estigarribia",
  "Reyes Católicos",
  "María Victoria",
  "Fração del Parque",
  "Ponta Porã (BR)",
]

interface CuponConfigState {
  id?: string
  monto_por_cupon: number
  sorteo_nombre: string
  whatsapp_mensaje_template: string
  disparo_whatsapp_activo: boolean
  activo: boolean
}

function playSuccessBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {}
}

export default function CapturaCuponesPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"captura" | "tickets" | "clientes" | "ia_insights" | "configurador">("captura")

  // Estado del formulario de captura
  const [documento, setDocumento] = useState("")
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [codigoPais, setCodigoPais] = useState<"595" | "55">("595")
  const [direccion, setDireccion] = useState("")
  const [barrio, setBarrio] = useState("Centro")
  const [nroTicket, setNroTicket] = useState("")
  const [montoCompra, setMontoCompra] = useState<string>("")
  const [cantidadCupones, setCantidadCupones] = useState<number>(1)
  const [enviarWhatsapp, setEnviarWhatsapp] = useState<boolean>(true)
  const [usuarioNombre, setUsuarioNombre] = useState<string>("Promotora Central")

  // Estados de carga y búsqueda
  const [searchingDoc, setSearchingDoc] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clienteExistente, setClienteExistente] = useState<CuponCliente | null>(null)
  const [ultimoRegistrado, setUltimoRegistrado] = useState<{ ticket: CuponTicket; cliente: CuponCliente } | null>(null)

  // Datos de listados y auditoría
  const [tickets, setTickets] = useState<CuponTicket[]>([])
  const [clientes, setClientes] = useState<CuponCliente[]>([])
  const [stats, setStats] = useState<CuponStats | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Configuración del módulo
  const [config, setConfig] = useState<CuponConfigState>({
    monto_por_cupon: 50000,
    sorteo_nombre: "Gran Sorteo Aniversario Extra Supermercado",
    whatsapp_mensaje_template: "¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
    disparo_whatsapp_activo: true,
    activo: true
  })
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  // Sincronización por Lotes
  const [syncBatchLoading, setSyncBatchLoading] = useState(false)
  const [syncBatchProgress, setSyncBatchProgress] = useState<any>(null)

  // Campañas de WhatsApp con Gemini
  const [campanaSegmento, setCampanaSegmento] = useState("VIP")
  const [campanaTono, setCampanaTono] = useState("Persuasivo")
  const [campanaOferta, setCampanaOferta] = useState("")
  const [campanaLoading, setCampanaLoading] = useState(false)
  const [campanaResultado, setCampanaResultado] = useState<any>(null)

  // Filtros
  const [filtroBarrio, setFiltroBarrio] = useState("")
  const [filtroSearch, setFiltroSearch] = useState("")
  const [filtroSinc, setFiltroSinc] = useState<string>("todos")

  // Estado de análisis IA
  const [analyzingIA, setAnalyzingIA] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const docInputRef = useRef<HTMLInputElement>(null)

  // Cargar configuración de sorteo
  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const cfg = await api.cupones.getConfig()
      if (cfg) {
        setConfig({
          id: cfg.id,
          monto_por_cupon: Number(cfg.monto_por_cupon) || 50000,
          sorteo_nombre: cfg.sorteo_nombre || "Gran Sorteo Aniversario Extra Supermercado",
          whatsapp_mensaje_template: cfg.whatsapp_mensaje_template || "",
          disparo_whatsapp_activo: cfg.disparo_whatsapp_activo ?? true,
          activo: cfg.activo ?? true
        })
      }
    } catch (e: any) {
      console.warn("No se pudo cargar la configuración de cupones:", e)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  // Cargar estadísticas globales
  const loadStats = useCallback(async () => {
    try {
      const s = await api.cupones.stats()
      setStats(s)
    } catch {}
  }, [])

  // Cargar tickets de cupones
  const loadTickets = useCallback(async () => {
    setLoadingData(true)
    try {
      const sincParam = filtroSinc === "si" ? true : filtroSinc === "no" ? false : undefined
      const list = await api.cupones.tickets({
        barrio: filtroBarrio || undefined,
        documento: filtroSearch || undefined,
        sincronizado: sincParam,
        limit: 100
      })
      setTickets(list)
    } catch (e: any) {
      toast.error("Error", "No se pudieron cargar los tickets de cupones")
    } finally {
      setLoadingData(false)
    }
  }, [filtroBarrio, filtroSearch, filtroSinc, toast])

  // Cargar clientes fidelizados
  const loadClientes = useCallback(async () => {
    setLoadingData(true)
    try {
      const list = await api.cupones.clientes({
        search: filtroSearch || undefined,
        barrio: filtroBarrio || undefined,
        limit: 100
      })
      setClientes(list)
    } catch (e: any) {
      toast.error("Error", "No se pudieron cargar los clientes")
    } finally {
      setLoadingData(false)
    }
  }, [filtroSearch, filtroBarrio, toast])

  useEffect(() => {
    loadConfig()
    loadStats()
  }, [loadConfig, loadStats])

  useEffect(() => {
    if (tab === "tickets") loadTickets()
    if (tab === "clientes" || tab === "ia_insights") loadClientes()
    if (tab === "configurador") loadConfig()
  }, [tab, loadTickets, loadClientes, loadConfig])

  // Búsqueda instantánea de cliente por documento
  const handleLookupDocumento = async (docVal: string) => {
    const clean = docVal.replace(/[^\w\d]/g, "").trim()
    if (!clean || clean.length < 4) {
      setClienteExistente(null)
      return
    }
    setSearchingDoc(true)
    try {
      const res = await api.cupones.lookupCliente(clean)
      if (res.existe && res.cliente) {
        setClienteExistente(res.cliente)
        setNombre(res.cliente.nombre || "")
        if (res.cliente.telefono) {
          const t = res.cliente.telefono
          if (t.startsWith("55")) {
            setCodigoPais("55")
            setTelefono(t.slice(2))
          } else if (t.startsWith("595")) {
            setCodigoPais("595")
            setTelefono(t.slice(3))
          } else {
            setTelefono(t)
          }
        }
        if (res.cliente.direccion) setDireccion(res.cliente.direccion)
        if (res.cliente.barrio) setBarrio(res.cliente.barrio)
        toast.info("Cliente Encontrado", `Datos autocompletados para ${res.cliente.nombre}`)
      } else {
        setClienteExistente(null)
      }
    } catch {
      setClienteExistente(null)
    } finally {
      setSearchingDoc(false)
    }
  }

  // Recalcular cupones según monto de compra
  const handleMontoChange = (valStr: string) => {
    const raw = valStr.replace(/\D/g, "")
    setMontoCompra(raw)
    const num = Number(raw) || 0
    const divisor = config.monto_por_cupon > 0 ? config.monto_por_cupon : 50000
    if (num >= divisor) {
      const calculados = Math.floor(num / divisor)
      setCantidadCupones(calculados)
    } else {
      setCantidadCupones(1)
    }
  }

  // Registrar cupón
  const handleRegistrarCupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documento.trim()) {
      toast.warning("Campo Requerido", "Ingrese el número de C.I. o CPF del cliente.")
      docInputRef.current?.focus()
      return
    }
    if (!nombre.trim()) {
      toast.warning("Campo Requerido", "Ingrese el nombre del cliente.")
      return
    }
    if (!nroTicket.trim()) {
      toast.warning("Campo Requerido", "Ingrese el número o código de ticket fiscal.")
      return
    }

    setSubmitting(true)
    try {
      const telFull = telefono.trim() ? `${codigoPais}${telefono.trim()}` : undefined
      const montoNum = montoCompra ? Number(montoCompra) : undefined

      const payload = {
        documento: documento.trim(),
        nombre: nombre.trim(),
        telefono: telFull,
        direccion: direccion.trim() || undefined,
        barrio: barrio.trim() || "Centro",
        ciudad: "Pedro Juan Caballero",
        nro_ticket: nroTicket.trim(),
        cantidad: cantidadCupones,
        monto_compra: montoNum,
        usuario_nombre: usuarioNombre,
        enviar_whatsapp: enviarWhatsapp && config.disparo_whatsapp_activo
      }

      const res = await api.cupones.registrar(payload)
      playSuccessBeep()

      setUltimoRegistrado({
        ticket: res.ticket,
        cliente: res.cliente
      })

      toast.success(
        "¡Cupón Registrado con Éxito!",
        `${res.ticket.cantidad} cupón(es) generados para ${res.cliente.nombre}.` +
        (res.items_cruzados > 0 ? ` Se cruzaron ${res.items_cruzados} ítems de venta.` : "")
      )

      // Resetear formulario para siguiente cliente
      setDocumento("")
      setNombre("")
      setTelefono("")
      setDireccion("")
      setNroTicket("")
      setMontoCompra("")
      setCantidadCupones(1)
      setClienteExistente(null)
      loadStats()

      setTimeout(() => {
        docInputRef.current?.focus()
      }, 100)

    } catch (err: any) {
      toast.error("Error al Registrar", err?.message || "No se pudo registrar el cupón.")
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar configuración de sorteo
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSaving(true)
    try {
      const updated = await api.cupones.updateConfig({
        monto_por_cupon: Number(config.monto_por_cupon),
        sorteo_nombre: config.sorteo_nombre.trim(),
        whatsapp_mensaje_template: config.whatsapp_mensaje_template.trim(),
        disparo_whatsapp_activo: config.disparo_whatsapp_activo,
        activo: config.activo
      })
      setConfig({
        id: updated.id,
        monto_por_cupon: Number(updated.monto_por_cupon) || 50000,
        sorteo_nombre: updated.sorteo_nombre,
        whatsapp_mensaje_template: updated.whatsapp_mensaje_template,
        disparo_whatsapp_activo: updated.disparo_whatsapp_activo,
        activo: updated.activo
      })
      toast.success("Configuración Guardada", "Las reglas del sorteo y plantilla se actualizaron correctamente.")
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo guardar la configuración.")
    } finally {
      setConfigSaving(false)
    }
  }

  // Sincronizar un ticket individual
  const handleSyncTicket = async (ticketId: string) => {
    try {
      await api.cupones.syncTicket(ticketId)
      toast.success("Sincronización Exitosa", "Ticket cruzado con la base de datos de ventas.")
      loadTickets()
      loadStats()
    } catch (e: any) {
      toast.error("Sin Coincidencia", e?.message || "No se encontró una venta con ese número de ticket.")
    }
  }

  // Iniciar lote de sincronización
  const handleStartSyncBatch = async () => {
    setSyncBatchLoading(true)
    try {
      await api.cupones.syncBatch({ limite: 100, delay_ms: 100, force: true })
      toast.info("Sincronización Iniciada", "Procesando cupones pendientes en segundo plano...")

      const interval = setInterval(async () => {
        try {
          const prog = await api.cupones.getSyncBatchProgress()
          setSyncBatchProgress(prog)
          if (!prog.activo) {
            clearInterval(interval)
            setSyncBatchLoading(false)
            toast.success("Lote Finalizado", `Se procesaron ${prog.procesados} cupones (${prog.exitos} exitosos, ${prog.fallas} sin coincidencia).`)
            loadTickets()
            loadStats()
          }
        } catch {
          clearInterval(interval)
          setSyncBatchLoading(false)
        }
      }, 800)
    } catch (e: any) {
      setSyncBatchLoading(false)
      toast.error("Error", e?.message || "No se pudo iniciar la sincronización por lote.")
    }
  }

  // Ejecutar análisis IA en lote con Gemini
  const handleEjecutarAnalisisIA = async () => {
    setAnalyzingIA(true)
    try {
      const res = await api.cupones.analizarIA({ limite: 30, forzar_reanalisis: false })
      toast.success("Análisis IA Completado", res.mensaje)
      loadClientes()
    } catch (err: any) {
      toast.error("Error en Gemini IA", err?.message || "No se pudo completar el análisis.")
    } finally {
      setAnalyzingIA(false)
    }
  }

  // Generar copy de WhatsApp con IA
  const handleGenerarCampana = async () => {
    setCampanaLoading(true)
    try {
      const res = await api.cupones.generarCampana({
        segmento: campanaSegmento,
        tono: campanaTono,
        oferta_especifica: campanaOferta.trim() || undefined
      })
      setCampanaResultado(res)
      toast.success("Copy Generado con Éxito", `Gemini redactó el mensaje para el segmento ${campanaSegmento}.`)
    } catch (e: any) {
      toast.error("Error con Gemini", e?.message || "No se pudo generar la campaña.")
    } finally {
      setCampanaLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Copiado al Portapapeles", "Mensaje listo para enviar por WhatsApp.")
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* ── HEADER Y BRANDING ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <span>Fidelización & Marketing Extra Supermercado</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {config.sorteo_nombre}
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 max-w-2xl">
            Captura ágil de cupones en línea de cajas, perfilado conductual con Gemini 2.5 Flash y confirmaciones automáticas de WhatsApp.
          </p>
        </div>

        {/* Badge de Regla de Negocio */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shrink-0">
          <div className="p-3 bg-white text-orange-600 rounded-xl shadow-md">
            <Ticket className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-orange-200 block">Regla Activa:</span>
            <div className="text-lg font-black tracking-tight">
              1 Cupón c/ {formatPYG(config.monto_por_cupon)}
            </div>
            <span className="text-[10px] text-orange-100 flex items-center gap-1 font-semibold">
              <Sparkles className="w-3 h-3 text-yellow-300" /> Sorteo + Cruce Automático
            </span>
          </div>
        </div>
      </div>

      {/* ── KPIS GLOBALES ─────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 rounded-xl">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase">Total Cupones</span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {stats.total_cupones?.toLocaleString() || 0}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase">Tickets de Venta</span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {stats.total_tickets?.toLocaleString() || 0}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase">Clientes Únicos</span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {stats.total_clientes?.toLocaleString() || 0}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-bold uppercase">Monto Total Compras</span>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono truncate">
                {formatPYG(stats.monto_total_compras || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NAVEGACIÓN POR PESTAÑAS ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab("captura")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            tab === "captura"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/50"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Zap className="w-4 h-4" />
          ⚡ Captura Rápida
        </button>

        <button
          onClick={() => setTab("tickets")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            tab === "tickets"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/50"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Ticket className="w-4 h-4" />
          📋 Historial & Sincronización
        </button>

        <button
          onClick={() => setTab("clientes")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            tab === "clientes"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/50"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <User className="w-4 h-4" />
          👥 Clientes & RFM
        </button>

        <button
          onClick={() => setTab("ia_insights")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            tab === "ia_insights"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/50"
              : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          }`}
        >
          <Brain className="w-4 h-4" />
          🧠 Analítica IA & Campañas
        </button>

        <button
          onClick={() => setTab("configurador")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            tab === "configurador"
              ? "bg-slate-800 text-white dark:bg-slate-700 shadow-lg ring-2 ring-slate-400/50"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Settings className="w-4 h-4" />
          ⚙️ Diseñador & Sorteo
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. PESTAÑA: CAPTURA RÁPIDA DE CUPONES
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "captura" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-500/30">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Formulario de Registro de Cupones
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ingrese el documento del cliente y el ticket para registrar y otorgar cupones.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRegistrarCupon} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Documento C.I. o CPF */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Documento C.I. / CPF *</span>
                    {searchingDoc && (
                      <span className="text-[10px] text-orange-500 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Buscando...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      ref={docInputRef}
                      type="text"
                      required
                      value={documento}
                      onChange={e => {
                        setDocumento(e.target.value)
                        handleLookupDocumento(e.target.value)
                      }}
                      placeholder="Ej: 4589201 o CPF"
                      className="w-full p-3 pl-10 text-sm font-mono font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                  {clienteExistente && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Cliente registrado previamente ({clienteExistente.cantidad_compras || 0} compras)</span>
                    </div>
                  )}
                </div>

                {/* Nombre y Apellido */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Nombre y Apellido Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Carlos Benítez"
                    className="w-full p-3 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Teléfono con Bandera SVG */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Teléfono / WhatsApp *
                </label>
                <div className="flex gap-2">
                  <div className="relative">
                    <select
                      value={codigoPais}
                      onChange={e => setCodigoPais(e.target.value as "595" | "55")}
                      className="p-3 text-xs font-black rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="595">🇵🇾 +595 (PY)</option>
                      <option value="55">🇧🇷 +55 (BR)</option>
                    </select>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={telefono}
                      onChange={e => setTelefono(e.target.value.replace(/\D/g, ""))}
                      placeholder={codigoPais === "595" ? "981 123456" : "67 991234567"}
                      className="w-full p-3 pl-10 text-sm font-mono font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Barrio y Dirección */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Barrio
                  </label>
                  <select
                    value={barrio}
                    onChange={e => setBarrio(e.target.value)}
                    className="w-full p-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  >
                    {BARRIOS_PJC.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Dirección (Opcional)
                  </label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={e => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Carlos A. López c/ Mcal. Estigarribia"
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Número de Ticket y Monto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Nº Ticket / Factura *
                  </label>
                  <input
                    type="text"
                    required
                    value={nroTicket}
                    onChange={e => setNroTicket(e.target.value)}
                    placeholder="Ej: 001-001-0012345"
                    className="w-full p-3 text-xs font-mono font-bold uppercase rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Monto Compra (Gs.)
                  </label>
                  <input
                    type="text"
                    value={montoCompra ? Number(montoCompra).toLocaleString("es-PY") : ""}
                    onChange={e => handleMontoChange(e.target.value)}
                    placeholder="Ej: 150.000"
                    className="w-full p-3 text-xs font-mono font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-orange-600 dark:text-orange-400 flex items-center justify-between">
                    <span>Cupones Calculados</span>
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={cantidadCupones}
                    onChange={e => setCantidadCupones(Number(e.target.value) || 1)}
                    className="w-full p-3 text-center text-sm font-black text-orange-600 dark:text-orange-400 rounded-2xl border-2 border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20"
                  />
                </div>
              </div>

              {/* Toggle de WhatsApp */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Confirmación de Cupones por WhatsApp
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Disparo automático con saludo humanizado y número de ticket
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enviarWhatsapp && config.disparo_whatsapp_activo}
                    disabled={!config.disparo_whatsapp_activo}
                    onChange={e => setEnviarWhatsapp(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>REGISTRANDO CUPÓN...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>REGISTRAR CUPÓN & DISPARAR WHATSAPP (F12)</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Panel Lateral: Vista Previa y Último Registro */}
          <div className="lg:col-span-5 space-y-6">
            {ultimoRegistrado ? (
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/40 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ÚLTIMO CUPÓN GENERADO EXITOSAMENTE</span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-3 border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">CLIENTE</span>
                      <strong className="text-sm text-slate-900 dark:text-white">
                        {ultimoRegistrado.cliente.nombre}
                      </strong>
                    </div>
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 text-xs font-black rounded-full font-mono">
                      {ultimoRegistrado.ticket.cantidad} Cupon(es)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Documento:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ultimoRegistrado.cliente.documento}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Teléfono:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ultimoRegistrado.cliente.telefono || "Sin registrar"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Nº Ticket:</span>
                      <span className="font-mono font-bold text-orange-600">
                        {ultimoRegistrado.ticket.nro_ticket}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">WhatsApp:</span>
                      <span className="font-bold text-emerald-600">
                        {ultimoRegistrado.ticket.whatsapp_status === "enviado" ? "✅ Enviado" : "⏳ Procesando"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3">
                <Ticket className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Listo para Capturar Cupones
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Al completar el formulario, el sistema creará los cupones y disparará el WhatsApp al cliente en segundo plano.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. PESTAÑA: HISTORIAL & AUDITORÍA
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "tickets" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Historial de Cupones Emitidos para Sorteo
              </h2>
              <p className="text-xs text-slate-500">
                Auditoría completa de comprobantes registrados, montos asociados y confirmaciones de WhatsApp
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleStartSyncBatch}
                disabled={syncBatchLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncBatchLoading ? "animate-spin" : ""}`} />
                <span>{syncBatchLoading ? "Sincronizando Lote..." : "Sincronizar Pendientes con Ventas"}</span>
              </button>

              <button
                onClick={loadTickets}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Barra de Progreso de Sincronización Batch */}
          {syncBatchProgress && syncBatchProgress.activo && (
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                <span>Sincronizando cupones con ventas en base de datos...</span>
                <span>{syncBatchProgress.porcentaje}% ({syncBatchProgress.procesados}/{syncBatchProgress.total})</span>
              </div>
              <div className="w-full h-2.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${syncBatchProgress.porcentaje}%` }}
                />
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <input
                type="text"
                value={filtroSearch}
                onChange={e => setFiltroSearch(e.target.value)}
                placeholder="Buscar por Documento C.I./CPF..."
                className="w-full p-2.5 pl-9 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <Search className="w-3.5 h-3.5 absolute left-3 top-3.5 text-slate-400" />
            </div>

            <select
              value={filtroBarrio}
              onChange={e => setFiltroBarrio(e.target.value)}
              className="p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="">Todos los Barrios</option>
              {BARRIOS_PJC.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={filtroSinc}
              onChange={e => setFiltroSinc(e.target.value)}
              className="p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="todos">Todos los Estados de Cruce</option>
              <option value="si">Solo Cruzados con Venta en DB</option>
              <option value="no">Sin Cruce / Pendientes</option>
            </select>
          </div>

          {/* Tabla de Tickets */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Ticket / Fecha</th>
                  <th className="p-3">Cliente / Documento</th>
                  <th className="p-3">Barrio / Teléfono</th>
                  <th className="p-3 text-center">Cupones</th>
                  <th className="p-3 text-right">Monto Compra</th>
                  <th className="p-3 text-center">Cruce Venta</th>
                  <th className="p-3 text-center">WhatsApp</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {t.nro_ticket}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.fecha_captura).toLocaleString("es-PY")}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {t.cliente?.nombre || "Sin nombre"}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Doc: {t.cliente?.documento}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-700 dark:text-slate-300">
                        {t.cliente?.barrio || "Centro"}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {t.cliente?.telefono || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-black font-mono">
                        {t.cantidad}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatPYG(t.monto_compra || 0)}
                    </td>
                    <td className="p-3 text-center">
                      {t.sincronizado ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                          ✅ Cruzado ({t.items?.length || 0} ítems)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                          ⏳ Pendiente
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {t.whatsapp_status === "enviado" ? (
                        <span className="text-emerald-600 font-bold text-[11px]">✅ Enviado</span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">⏳ Pendiente</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {!t.sincronizado && (
                        <button
                          onClick={() => handleSyncTicket(t.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
                        >
                          Sincronizar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. PESTAÑA: DIRECTORIO DE CLIENTES & SEGMENTACIÓN RFM
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "clientes" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Directorio de Clientes Fidelizados & RFM
              </h2>
              <p className="text-xs text-slate-500">
                Segmentación por frecuencia de compra, ticket promedio y perfilado de consumo
              </p>
            </div>

            <button
              onClick={loadClientes}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clientes.map(c => (
              <div
                key={c.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {c.nombre}
                    </h3>
                    <span className="text-xs font-mono text-slate-400">
                      Doc: {c.documento} · {c.barrio}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-black">
                    {c.cantidad_compras || 0} Compras
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Gastado:</span>
                    <strong className="text-emerald-600 font-mono">
                      {formatPYG(c.total_gastado || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ticket Promedio:</span>
                    <strong className="text-slate-700 dark:text-slate-300 font-mono">
                      {formatPYG(c.ticket_promedio || 0)}
                    </strong>
                  </div>
                </div>

                {c.segmentos && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.segmentos.split(",").map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] rounded-md font-bold">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. PESTAÑA: PERFILADO CONDUCTUAL GEMINI IA & GENERADOR DE CAMPAÑAS
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "ia_insights" && (
        <div className="space-y-6">
          {/* Header con disparador de Gemini */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-2 border-purple-500/40">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/30 border border-purple-400/40 w-fit text-xs font-bold text-purple-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modelo Gemini 2.5 Flash · Análisis Conductual</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">
                Perfilado IA & Redactor de Campañas para WhatsApp
              </h2>
              <p className="text-xs sm:text-sm text-purple-200 leading-relaxed">
                Analiza las canastas de compras de los clientes del sorteo, clasifica sus hábitos y redacta copys de alta conversión para difusión por WhatsApp.
              </p>
            </div>

            <button
              onClick={handleEjecutarAnalisisIA}
              disabled={analyzingIA}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-500/40 flex items-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {analyzingIA ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analizando Canastas con Gemini...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>PERFILAR CLIENTES CON GEMINI IA</span>
                </>
              )}
            </button>
          </div>

          {/* Generador de Copys de WhatsApp con IA */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Generador de Campañas Segmentadas con Gemini 2.5 Flash
                </h3>
                <p className="text-xs text-slate-500">
                  Selecciona un segmento objetivo y deja que la IA redacte un mensaje de WhatsApp optimizado para tu audiencia.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Segmento Objetivo
                </label>
                <select
                  value={campanaSegmento}
                  onChange={e => setCampanaSegmento(e.target.value)}
                  className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="VIP">Clientes VIP & Alto Valor</option>
                  <option value="Comprador Finde">Parrilleros & Compradores Fin de Semana</option>
                  <option value="Abastecimiento Familiar">Abastecimiento Familiar Mensual</option>
                  <option value="Comprador Frecuente">Compradores Habituales de Salón</option>
                  <option value="Inactivo">Clientes a Reactivar</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Tono del Mensaje
                </label>
                <select
                  value={campanaTono}
                  onChange={e => setCampanaTono(e.target.value)}
                  className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Persuasivo">Persuasivo & Entusiasta</option>
                  <option value="Amigable">Cercano & Amigable</option>
                  <option value="Urgente">Urgencia / Oferta por Tiempo Limitado</option>
                  <option value="Exclusivo">Exclusivo / Club de Beneficios</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Oferta / Producto Específico
                </label>
                <input
                  type="text"
                  value={campanaOferta}
                  onChange={e => setCampanaOferta(e.target.value)}
                  placeholder="Ej: Costilla Premium con 20% OFF + Doble Cupón"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleGenerarCampana}
              disabled={campanaLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {campanaLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Redactando Mensaje con Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Copy de WhatsApp</span>
                </>
              )}
            </button>

            {campanaResultado && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2 mt-3">
                <div className="flex justify-between items-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span>Mensaje Redactado para WhatsApp (Audiencia estimada: {campanaResultado.audiencia_estimada} clientes)</span>
                  <button
                    onClick={() => copyToClipboard(campanaResultado.mensaje_generado, "campana")}
                    className="p-1 px-2.5 bg-emerald-200 dark:bg-emerald-900 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-100 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === "campana" ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar Mensaje</span>
                  </button>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl">
                  {campanaResultado.mensaje_generado}
                </p>
              </div>
            )}
          </div>

          {/* Tarjetas de Clientes Perfilados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clientes
              .filter(c => c.ia_analisis)
              .map(c => {
                const ia = c.ia_analisis
                return (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-purple-500/30 p-6 space-y-4 shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {c.nombre}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                            Doc: {c.documento} · {c.barrio}
                          </span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-xs font-black font-mono">
                          {ia.perfil_comprador || "Comprador Frecuente"}
                        </span>
                      </div>

                      {ia.resumen_conductual && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                          "{ia.resumen_conductual}"
                        </p>
                      )}

                      {/* Gancho de Oferta para WhatsApp */}
                      {ia.gancho_oferta_whatsapp && (
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Gancho Personalizado de WhatsApp:
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(ia.gancho_oferta_whatsapp, c.id)}
                              className="p-1 px-2 rounded-lg bg-emerald-200/60 dark:bg-emerald-900/60 hover:bg-emerald-300 text-emerald-900 dark:text-emerald-200 flex items-center gap-1 text-[10px] transition cursor-pointer"
                            >
                              {copiedId === c.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar Texto</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                            {ia.gancho_oferta_whatsapp}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Compras: <strong className="text-slate-700 dark:text-slate-200">{c.cantidad_compras}</strong></span>
                      <span>Total: <strong className="text-emerald-600 font-mono font-bold">{formatPYG(c.total_gastado)}</strong></span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. PESTAÑA: CONFIGURACIÓN DEL SORTEO & DISEÑADOR DE CUPONES
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "configurador" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario de Configuración */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-slate-800 text-white rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Reglas de Campaña & Mensajería
                </h2>
                <p className="text-xs text-slate-500">
                  Personalice el monto para ganar cupones, el nombre del sorteo y la plantilla de WhatsApp.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-5">
              {/* Título de Sorteo */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Nombre de la Campaña / Sorteo *
                </label>
                <input
                  type="text"
                  required
                  value={config.sorteo_nombre}
                  onChange={e => setConfig({ ...config, sorteo_nombre: e.target.value })}
                  placeholder="Ej: Gran Sorteo Aniversario Extra Supermercado"
                  className="w-full p-3 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Monto por Cupón */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Monto Mínimo por Cupón (Gs.) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={1000}
                      min={1000}
                      required
                      value={config.monto_por_cupon}
                      onChange={e => setConfig({ ...config, monto_por_cupon: Number(e.target.value) || 50000 })}
                      className="w-full p-3 pl-10 text-sm font-mono font-bold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                    <DollarSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Actualmente: 1 cupón cada {formatPYG(config.monto_por_cupon)} de compra
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Simulador Rápido de Caja
                  </label>
                  <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Compra de Gs. 150.000:</span>
                      <strong className="text-orange-600 font-mono font-black">
                        {Math.floor(150000 / (config.monto_por_cupon || 50000))} cupones
                      </strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-600 dark:text-slate-300">Compra de Gs. 300.000:</span>
                      <strong className="text-orange-600 font-mono font-black">
                        {Math.floor(300000 / (config.monto_por_cupon || 50000))} cupones
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plantilla de WhatsApp */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Plantilla de Mensaje de WhatsApp
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setConfig({
                        ...config,
                        whatsapp_mensaje_template: "¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨"
                      })
                    }}
                    className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer"
                  >
                    Restaurar Predeterminado
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={config.whatsapp_mensaje_template}
                  onChange={e => setConfig({ ...config, whatsapp_mensaje_template: e.target.value })}
                  className="w-full p-3 text-xs font-mono rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 leading-relaxed"
                />

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">Tags dinámicos clickeables:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["{{nombre}}", "{{cantidad}}", "{{sorteo}}", "{{ticket}}", "{{empresa}}"].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setConfig({
                            ...config,
                            whatsapp_mensaje_template: config.whatsapp_mensaje_template + " " + tag
                          })
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono rounded-md border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Sorteo Habilitado en POS</span>
                    <span className="text-[10px] text-slate-500">Preguntar al cajero al liquidar</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.activo}
                    onChange={e => setConfig({ ...config, activo: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Disparo de WhatsApp</span>
                    <span className="text-[10px] text-slate-500">Enviar mensaje automático</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.disparo_whatsapp_activo}
                    onChange={e => setConfig({ ...config, disparo_whatsapp_activo: e.target.checked })}
                    className="w-4 h-4 text-emerald-500 rounded"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={configSaving}
                className="w-full py-3.5 rounded-2xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {configSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando Configuración...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>GUARDAR REGLAS DE SORTEO</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Vista Previa del Ticket Térmico de Cupón */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Printer className="w-4 h-4 text-orange-500" />
              <span>DISEÑO TÉRMICO DE IMPRESIÓN (POS ELECTRON)</span>
            </div>

            {/* Simulación fidedigna de ticket térmico monocromo */}
            <div className="bg-amber-50 text-slate-900 border-2 border-dashed border-amber-300 p-6 rounded-2xl font-mono text-xs shadow-md max-w-sm mx-auto space-y-3">
              <div className="text-center border-b border-dashed border-slate-400 pb-2 space-y-0.5">
                <div className="font-black text-sm uppercase">EXTRA SUPERMERCADO</div>
                <div className="text-[10px] text-slate-600">Pedro Juan Caballero - Paraguay</div>
                <div className="font-bold text-[11px] pt-1 text-orange-800 uppercase">
                  *** {config.sorteo_nombre} ***
                </div>
              </div>

              <div className="text-center py-1 bg-amber-100/70 rounded border border-amber-200">
                <div className="text-[10px] font-bold text-slate-500">COMPROBANTE DE SORTEO</div>
                <div className="text-base font-black tracking-wider">CUPON 1 DE 3</div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket Venta:</span>
                  <span className="font-bold">#001-001-0012345</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha / Hora:</span>
                  <span>{new Date().toLocaleDateString("es-PY")} {new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Monto Compra:</span>
                  <span className="font-bold">Gs. 150.000</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
                <div>
                  <span className="text-[10px] text-slate-500 block">CLIENTE:</span>
                  <strong className="text-xs">CARLOS BENITEZ</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">C.I. / CPF:</span>
                  <span className="font-bold">4.589.201</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Telefono:</span>
                  <span className="font-bold">+595 981 123456</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Barrio/Ciudad:</span>
                  <span>San Gerardo · PJC</span>
                </div>
              </div>

              <div className="text-center pt-1 space-y-1">
                <div className="font-bold text-[10px]">
                  ¡Deposita este cupon en la urna de la sucursal!
                </div>
                <div className="text-[9px] text-slate-500">
                  Valido para todos los sorteos del aniversario
                </div>
              </div>

              {/* Línea de Corte Automático */}
              <div className="text-center pt-3 border-t border-dashed border-slate-400 text-[9px] text-slate-500 flex items-center justify-center gap-1 font-bold">
                <Scissors className="w-3 h-3" />
                <span>CORTE AUTOMATICO DE PAPEL (ESC/POS GS V 1)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
