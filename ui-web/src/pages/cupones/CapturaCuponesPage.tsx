import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Ticket, Sparkles, User, Phone, MapPin, Send, CheckCircle2,
  AlertCircle, Search, RefreshCw, Layers, ShieldCheck, MessageSquare,
  DollarSign, Award, Tag, Trash2, ExternalLink, ArrowRight, Zap,
  ShoppingBag, Clock, Brain, ThumbsUp, Copy, Check, Filter
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

function playSuccessBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08) // A5
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
  const [tab, setTab] = useState<"captura" | "tickets" | "clientes" | "ia_insights">("captura")

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

  // Filtros
  const [filtroBarrio, setFiltroBarrio] = useState("")
  const [filtroSearch, setFiltroSearch] = useState("")
  const [filtroSinc, setFiltroSinc] = useState<string>("todos")

  // Estado de análisis IA
  const [analyzingIA, setAnalyzingIA] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const docInputRef = useRef<HTMLInputElement>(null)

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
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (tab === "tickets") loadTickets()
    if (tab === "clientes" || tab === "ia_insights") loadClientes()
  }, [tab, loadTickets, loadClientes])

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
    if (num >= 50000) {
      const calculados = Math.floor(num / 50000)
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
      toast.warning("Campo Requerido", "Ingrese el número de ticket de caja.")
      return
    }

    setSubmitting(true)
    try {
      const fullPhone = telefono.trim() ? `${codigoPais}${telefono.replace(/\D/g, "")}` : undefined
      const montoNum = montoCompra ? Number(montoCompra) : undefined

      const res = await api.cupones.registrar({
        documento: documento.trim(),
        nombre: nombre.trim(),
        telefono: fullPhone,
        direccion: direccion.trim() || undefined,
        barrio: barrio,
        nro_ticket: nroTicket.trim(),
        cantidad: cantidadCupones,
        monto_compra: montoNum,
        usuario_nombre: usuarioNombre,
        enviar_whatsapp: enviarWhatsapp
      })

      playSuccessBeep()
      setUltimoRegistrado({ ticket: res.ticket, cliente: res.cliente })
      toast.success(
        "¡Cupón Registrado con Éxito!",
        `${res.ticket.cantidad} cupón(es) asignados a ${res.cliente.nombre}. ${res.items_cruzados > 0 ? `(${res.items_cruzados} ítems cruzados de la venta)` : ""}`
      )

      // Limpiar para el siguiente cliente
      setDocumento("")
      setNombre("")
      setTelefono("")
      setDireccion("")
      setNroTicket("")
      setMontoCompra("")
      setCantidadCupones(1)
      setClienteExistente(null)
      loadStats()
      docInputRef.current?.focus()
    } catch (err: any) {
      toast.error("Error al registrar cupón", err.detail || err.message || "Verifique los datos e intente nuevamente")
    } finally {
      setSubmitting(false)
    }
  }

  // Ejecutar análisis conductual con Gemini 2.5 Flash
  const handleEjecutarAnalisisIA = async () => {
    setAnalyzingIA(true)
    try {
      const res = await api.cupones.analisisIA({ limite: 25, forzar_reanalisis: false })
      toast.success("¡Análisis Gemini IA Completado!", res.mensaje)
      loadClientes()
      loadStats()
    } catch (err: any) {
      toast.error("Error en Gemini IA", err.detail || err.message || "No se pudo completar el análisis.")
    } finally {
      setAnalyzingIA(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.info("Copiado al Portapapeles", "Texto del gancho de oferta listo para enviar.")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* ── ENCABEZADO PRINCIPAL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/30">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Gran Sorteo Extra · Captura de Cupones & Fidelización IA
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Captura rápida de tickets en salón, cruce automático con ventas y perfilado de clientes con Gemini 2.5 Flash
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de Métricas Rápidas */}
        {stats && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                Total Cupones
              </span>
              <span className="text-lg font-black font-mono text-orange-700 dark:text-orange-300">
                {stats.total_cupones.toLocaleString("es-PY")}
              </span>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                Tickets Registrados
              </span>
              <span className="text-lg font-black font-mono text-blue-700 dark:text-blue-300">
                {stats.total_tickets.toLocaleString("es-PY")}
              </span>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Clientes Fidelizados
              </span>
              <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-300">
                {stats.total_clientes.toLocaleString("es-PY")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── BARRA DE PESTAÑAS ── */}
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
          ⚡ Captura Rápida (Promotora / Caja)
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
          📋 Auditoría & Cupones Emitidos
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
          👥 Directorio de Clientes
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
          🧠 Perfilado Conductual Gemini IA
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. PESTAÑA: CAPTURA RÁPIDA (MODO PROMOTORA / CAJERO)
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "captura" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Formulario Principal de Captura */}
          <form
            onSubmit={handleRegistrarCupon}
            className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border-2 border-orange-500/30 shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-orange-500" />
                  Registro Inmediato de Cupones de Sorteo
                </h2>
                <p className="text-xs text-slate-500">
                  Autocompletado con C.I./CPF y cruce automático de tickets con el sistema de ventas
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold font-mono">
                1 Cupón cada Gs. 50.000
              </span>
            </div>

            {/* SECCIÓN 1: DATOS DEL CLIENTE */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                1. Datos Personales del Participante
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Documento con Auto-Lookup */}
                <div className="sm:col-span-5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    C.I. Paraguaya o CPF Brasil (*):
                  </label>
                  <div className="relative">
                    <input
                      ref={docInputRef}
                      type="text"
                      required
                      autoFocus
                      value={documento}
                      onChange={e => setDocumento(e.target.value)}
                      onBlur={e => handleLookupDocumento(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleLookupDocumento(documento)
                        }
                      }}
                      placeholder="Ej: 4520180 o 08544122"
                      className="w-full p-3 pl-10 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                    />
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    {searchingDoc && (
                      <RefreshCw className="w-4 h-4 absolute right-3.5 top-3.5 text-orange-500 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Nombre Completo */}
                <div className="sm:col-span-7">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nombre Completo del Cliente (*):
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Juan Carlos Romero"
                    className="w-full p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Teléfono con selector de País */}
                <div className="sm:col-span-6">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Teléfono Celular (WhatsApp):
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={codigoPais}
                      onChange={e => setCodigoPais(e.target.value as any)}
                      className="p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                    >
                      <option value="595">🇵🇾 +595</option>
                      <option value="55">🇧🇷 +55</option>
                    </select>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={telefono}
                        onChange={e => setTelefono(e.target.value)}
                        placeholder="Ej: 983123456"
                        className="w-full p-3 pl-10 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                      />
                      <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Dirección */}
                <div className="sm:col-span-6">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Dirección / Calle:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={direccion}
                      onChange={e => setDireccion(e.target.value)}
                      placeholder="Ej: Av. Carlos Antonio López c/ Mariscal"
                      className="w-full p-3 pl-10 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                    />
                    <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Selector Rápido de Barrio */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Barrio de Pedro Juan Caballero / Ponta Porã:
                </label>
                <div className="flex flex-wrap gap-2">
                  {BARRIOS_PJC.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBarrio(b)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        barrio === b
                          ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: DATOS DEL TICKET Y CUPONES */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                2. Comprobante de Compra & Asignación de Cupones
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Número de Ticket */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Número de Ticket / Factura (*):
                  </label>
                  <input
                    type="text"
                    required
                    value={nroTicket}
                    onChange={e => setNroTicket(e.target.value)}
                    placeholder="Ej: 001-011-0004523"
                    className="w-full p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                  />
                </div>

                {/* Monto de Compra */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Monto de la Compra (Gs.):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={montoCompra ? Number(montoCompra).toLocaleString("es-PY") : ""}
                      onChange={e => handleMontoChange(e.target.value)}
                      placeholder="Ej: 150.000"
                      className="w-full p-3 pl-10 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none transition"
                    />
                    <DollarSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Cantidad de Cupones */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cantidad de Cupones a Otorgar:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCantidadCupones(prev => Math.max(1, prev - 1))}
                      className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={cantidadCupones}
                      onChange={e => setCantidadCupones(Math.max(1, Number(e.target.value)))}
                      className="flex-1 p-3 text-center rounded-2xl border-2 border-orange-500/50 bg-orange-50 dark:bg-orange-950/40 font-mono font-black text-lg text-orange-600 dark:text-orange-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCantidadCupones(prev => prev + 1)}
                      className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Checkbox de WhatsApp y Promotora */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enviarWhatsapp}
                    onChange={e => setEnviarWhatsapp(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                  />
                  <span>📲 Enviar confirmación inmediata por WhatsApp al cliente</span>
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Operador:</span>
                  <input
                    type="text"
                    value={usuarioNombre}
                    onChange={e => setUsuarioNombre(e.target.value)}
                    className="p-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* BOTÓN DE GUARDADO GIGANTE */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-base shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Registrando y Cruzando Venta...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>REGISTRAR CUPONES Y FINALIZAR (ENTER)</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Panel Lateral: Ficha del Cliente y Último Cupón */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Ficha de Cliente Reconocido */}
            {clienteExistente && (
              <div className="bg-gradient-to-br from-blue-950/80 via-slate-900 to-blue-950/80 border-2 border-blue-500/40 p-6 rounded-3xl shadow-xl text-white space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-blue-300">Cliente Frecuente</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-bold font-mono">
                    {clienteExistente.cantidad_compras} compras previas
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black">{clienteExistente.nombre}</h3>
                  <p className="text-xs text-slate-300 font-mono">Doc: {clienteExistente.documento} · {clienteExistente.barrio}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5">
                    <span className="text-[10px] text-slate-400 block">Total Gastado</span>
                    <strong className="font-mono text-emerald-400 text-sm font-black">
                      {formatPYG(clienteExistente.total_gastado)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5">
                    <span className="text-[10px] text-slate-400 block">Ticket Promedio</span>
                    <strong className="font-mono text-blue-300 text-sm font-black">
                      {formatPYG(clienteExistente.ticket_promedio)}
                    </strong>
                  </div>
                </div>

                {clienteExistente.ia_analisis && (
                  <div className="p-3 rounded-2xl bg-purple-950/50 border border-purple-500/40 text-xs space-y-1">
                    <div className="flex items-center gap-1 text-purple-300 font-bold">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Perfil Gemini IA:</span>
                    </div>
                    <p className="text-purple-100 font-medium">
                      {clienteExistente.ia_analisis.perfil_comprador || "Comprador Frecuente"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Último Cupón Emitido */}
            {ultimoRegistrado && (
              <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 p-6 rounded-3xl shadow-xl space-y-3 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    ÚLTIMO CUPÓN REGISTRADO
                  </span>
                  <span className="font-mono text-slate-400">
                    {new Date(ultimoRegistrado.ticket.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                  <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {ultimoRegistrado.ticket.cantidad} {ultimoRegistrado.ticket.cantidad === 1 ? "CUPÓN" : "CUPONES"}
                  </span>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {ultimoRegistrado.cliente.nombre}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    Ticket #{ultimoRegistrado.ticket.nro_ticket} · {ultimoRegistrado.cliente.barrio}
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Cruce de Venta: <strong>{ultimoRegistrado.ticket.sincronizado ? "✅ Cruzado" : "⏳ Pendiente"}</strong></span>
                  <span>WhatsApp: <strong>{ultimoRegistrado.ticket.whatsapp_enviado ? "🟢 Enviado" : "⚪ Sin enviar"}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. PESTAÑA: AUDITORÍA & CUPONES EMITIDOS
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

            <button
              onClick={loadTickets}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>

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
              <option value="no">Sin Cruce / Manuales</option>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono">
                      <strong className="text-slate-900 dark:text-white block">#{t.nro_ticket}</strong>
                      <span className="text-[10px] text-slate-400">{new Date(t.fecha_captura).toLocaleString("es-PY")}</span>
                    </td>
                    <td className="p-3">
                      <strong className="text-slate-900 dark:text-white block">{t.cliente?.nombre || "—"}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">Doc: {t.cliente?.documento || "—"}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">{t.cliente?.barrio || "—"}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{t.cliente?.telefono || "Sin tel."}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-mono font-black text-xs">
                        {t.cantidad} {t.cantidad === 1 ? "Cupón" : "Cupones"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatPYG(t.monto_compra)}
                    </td>
                    <td className="p-3 text-center">
                      {t.sincronizado ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px]">
                          ✅ Cruzado ({t.items?.length || 0} ítems)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-[10px]">
                          ⏳ Pendiente
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {t.whatsapp_enviado ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px]">
                          🟢 Enviado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px]">
                          ⚪ {t.whatsapp_status || "Sin enviar"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && !loadingData && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No se encontraron cupones con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. PESTAÑA: DIRECTORIO DE CLIENTES FIDELIZADOS
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "clientes" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Directorio de Clientes Fidelizados (Extra Supermercado)
              </h2>
              <p className="text-xs text-slate-500">
                Historial de compras acumuladas, barrios y estado de perfilado conductual
              </p>
            </div>

            <button
              onClick={loadClientes}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
              Actualizar Lista
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map(c => (
              <div
                key={c.id}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {c.nombre}
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-mono font-bold">
                    {c.documento}
                  </span>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.telefono || "Sin teléfono"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.barrio || "Centro"} ({c.ciudad})</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-750 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Gastado</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                      {formatPYG(c.total_gastado)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ticket Promedio</span>
                    <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {formatPYG(c.ticket_promedio)}
                    </strong>
                  </div>
                </div>

                {c.ia_analisis ? (
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block">
                      Perfil Gemini IA:
                    </span>
                    <p className="text-purple-900 dark:text-purple-200 font-bold">
                      {c.ia_analisis.perfil_comprador || "Comprador Frecuente"}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-[10px] text-slate-400">
                    Pendiente de análisis con Gemini IA
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. PESTAÑA: PERFILADO CONDUCTUAL GEMINI IA
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === "ia_insights" && (
        <div className="space-y-6">
          
          {/* Header con disparador de Gemini */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-2 border-purple-500/40">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/30 border border-purple-400/40 w-fit text-xs font-bold text-purple-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modelo Gemini 2.5 Flash · Análisis en Tiempo Real</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">
                Perfilado Conductual & Ganchos de Oferta para WhatsApp
              </h2>
              <p className="text-xs sm:text-sm text-purple-200 leading-relaxed">
                La IA analiza la canasta de compras de los clientes del sorteo, infiere sus hábitos de consumo y redacta ganchos de oferta hiper-personalizados para fidelizarlos.
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
                  <span>ANALIZAR CLIENTES CON GEMINI IA</span>
                </>
              )}
            </button>
          </div>

          {/* Tarjetas de Clientes Perfilados con sus Ganchos de Oferta */}
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

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <span className="text-[10px] text-slate-400 block font-bold">Días Preferidos:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {ia.dias_preferidos || "Fin de semana"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                          <span className="text-[10px] text-slate-400 block font-bold">Categorías Gancho:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400 truncate block">
                            {Array.isArray(ia.categorias_gancho) ? ia.categorias_gancho.join(", ") : "Carnicería, Bebidas"}
                          </span>
                        </div>
                      </div>

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
                      <span>Total Compras: <strong className="text-slate-700 dark:text-slate-200">{c.cantidad_compras}</strong></span>
                      <span>Total Gastado: <strong className="text-emerald-600 font-mono font-bold">{formatPYG(c.total_gastado)}</strong></span>
                    </div>
                  </div>
                )
              })}
          </div>

          {clientes.filter(c => c.ia_analisis).length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Brain className="w-12 h-12 text-purple-400 mx-auto animate-bounce" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aún no se han perfilado clientes con IA
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Haga clic en el botón "ANALIZAR CLIENTES CON GEMINI IA" para procesar el historial de consumo de los clientes registrados.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
