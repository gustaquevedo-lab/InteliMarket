import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Ticket, Sparkles, User, Phone, MapPin, Send, CheckCircle2,
  AlertCircle, Search, RefreshCw, Layers, ShieldCheck, MessageSquare,
  DollarSign, Award, Tag, Trash2, ExternalLink, ArrowRight, Zap,
  ShoppingBag, Clock, Brain, ThumbsUp, Copy, Check, Filter,
  Settings, Sliders, Printer, Wand2, Scissors, Save, HelpCircle,
  Plus, Edit3, X, CheckSquare, Gift, Store, BarChart3, ChevronRight,
  Package, ToggleLeft, ToggleRight, Receipt
} from "lucide-react"
import { api, type CuponTicket, type CuponCliente, type CuponStats, type Product } from "../../api"
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

export interface SorteoCampanaUI {
  id: string
  nombre: string
  codigo?: string
  descripcion?: string
  patrocinador: string
  premio_destacado?: string
  tipo_trigger: "MONTO_GLOBAL" | "PRODUCTOS_ESPECIFICOS" | "MARCA_PROVEEDOR" | "CATEGORIA"
  criterio_evaluacion: "MONTO_ACUMULADO" | "CANTIDAD_UNIDADES"
  valor_umbral: number
  productos_participantes: Array<{
    id?: string
    producto_id?: string
    sku?: string
    nombre?: string
    codigo_barra?: string
    precio_unitario?: number
  }>
  marcas_participantes: string[]
  categorias_participantes: string[]
  fecha_inicio?: string
  fecha_fin?: string
  activo: boolean
  whatsapp_template?: string
  whatsapp_activo: boolean
  ticket_encabezado?: string
  ticket_subtitulo?: string
  ticket_pie_urna?: string
  total_cupones_emitidos?: number
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
  const [tab, setTab] = useState<"campanas" | "captura" | "tickets" | "clientes" | "ia_insights">("campanas")

  // Campañas
  const [campanas, setCampanas] = useState<SorteoCampanaUI[]>([])
  const [campanasLoading, setCampanasLoading] = useState(false)
  
  // Modal de Edición / Creación de Campaña
  const [showCampanaModal, setShowCampanaModal] = useState(false)
  const [campanaEditando, setCampanaEditando] = useState<Partial<SorteoCampanaUI> | null>(null)
  const [savingCampana, setSavingCampana] = useState(false)

  // Catálogo de Productos para Asignación a Campaña
  const [catalogoProductos, setCatalogoProductos] = useState<Product[]>([])
  const [busquedaProducto, setBusquedaProducto] = useState("")

  // Formulario de Captura Rápida
  const [documento, setDocumento] = useState("")
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [codigoPais, setCodigoPais] = useState<"595" | "55">("595")
  const [direccion, setDireccion] = useState("")
  const [barrio, setBarrio] = useState("Centro")
  const [nroTicket, setNroTicket] = useState("")
  const [montoCompra, setMontoCompra] = useState<string>("")
  const [cantidadCupones, setCantidadCupones] = useState<number>(1)
  const [campanaCapturaId, setCampanaCapturaId] = useState<string>("")
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

  // ── CARGA DE DATOS ────────────────────────────────────────────────────────
  const loadCampanas = useCallback(async () => {
    setCampanasLoading(true)
    try {
      const data = await api.cupones.listCampanas()
      setCampanas(data || [])
      if (data && data.length > 0 && !campanaCapturaId) {
        setCampanaCapturaId(data[0].id)
      }
    } catch (err) {
      console.warn("Error cargando campañas:", err)
    } finally {
      setCampanasLoading(false)
    }
  }, [campanaCapturaId])

  const loadProductosCatalogo = useCallback(async () => {
    try {
      const prods = await api.products.list({ limit: 500 })
      setCatalogoProductos(prods || [])
    } catch (err) {
      console.warn("Error cargando productos de catálogo:", err)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const s = await api.cupones.stats()
      setStats(s)
    } catch {}
  }, [])

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
      setTickets(list || [])
    } catch (e: any) {
      toast.error("Error al cargar tickets", e.message)
    } finally {
      setLoadingData(false)
    }
  }, [filtroBarrio, filtroSearch, filtroSinc, toast])

  const loadClientes = useCallback(async () => {
    setLoadingData(true)
    try {
      const list = await api.cupones.clientes({
        barrio: filtroBarrio || undefined,
        search: filtroSearch || undefined,
        limit: 100
      })
      setClientes(list || [])
    } catch (e: any) {
      toast.error("Error al cargar clientes", e.message)
    } finally {
      setLoadingData(false)
    }
  }, [filtroBarrio, filtroSearch, toast])

  useEffect(() => {
    loadCampanas()
    loadProductosCatalogo()
    loadStats()
  }, [loadCampanas, loadProductosCatalogo, loadStats])

  useEffect(() => {
    if (tab === "tickets") loadTickets()
    if (tab === "clientes") loadClientes()
  }, [tab, loadTickets, loadClientes])

  // Polling de sincronización por lotes
  useEffect(() => {
    let timer: any
    if (syncBatchLoading) {
      timer = setInterval(async () => {
        try {
          const prog = await api.cupones.getSyncBatchProgress()
          setSyncBatchProgress(prog)
          if (!prog.activo) {
            setSyncBatchLoading(false)
            toast.success("Sincronización Finalizada", `Éxitos: ${prog.exitos}, Fallas: ${prog.fallas}`)
            loadTickets()
            loadStats()
          }
        } catch {
          setSyncBatchLoading(false)
        }
      }, 1500)
    }
    return () => clearInterval(timer)
  }, [syncBatchLoading, loadTickets, loadStats, toast])

  // ── BUSCADOR DE CLIENTE POR DOCUMENTO EN CAPTURA ──────────────────────────
  const handleLookupCliente = async (docToSearch?: string) => {
    const d = docToSearch || documento
    if (!d.trim()) return

    setSearchingDoc(true)
    try {
      const res = await api.cupones.lookupCliente(d.trim())
      if (res && res.existe && res.cliente) {
        const c = res.cliente
        setClienteExistente(c)
        setNombre(c.nombre || "")
        if (c.telefono) {
          let cleanTel = c.telefono.replace(/\D/g, "")
          if (cleanTel.startsWith("595")) {
            setCodigoPais("595")
            setTelefono(cleanTel.slice(3))
          } else if (cleanTel.startsWith("55")) {
            setCodigoPais("55")
            setTelefono(cleanTel.slice(2))
          } else {
            setTelefono(cleanTel)
          }
        }
        if (c.barrio) setBarrio(c.barrio)
        if (c.direccion) setDireccion(c.direccion)
        toast.info("Cliente encontrado", `Datos autocompletados desde ${res.origen === "cupones" ? "Cupones" : "Clientes General"}`)
      } else {
        setClienteExistente(null)
      }
    } catch {
      setClienteExistente(null)
    } finally {
      setSearchingDoc(false)
    }
  }

  // ── REGISTRAR CUPÓN MANUALMENTE ───────────────────────────────────────────
  const handleRegistrarCupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documento.trim() || !nombre.trim() || !telefono.trim() || !nroTicket.trim()) {
      toast.warning("Campos obligatorios", "Documento, Nombre, Teléfono y Nro. Ticket son requeridos.")
      return
    }

    const valorMonto = parseFloat(montoCompra.replace(/\D/g, "")) || 0
    if (cantidadCupones <= 0) {
      toast.warning("Cantidad inválida", "Debe asignarse al menos 1 cupón.")
      return
    }

    setSubmitting(true)
    const telCompleto = `${codigoPais}${telefono.replace(/\D/g, "")}`

    // Buscar nombre de campaña
    const campanaSeleccionada = campanas.find(c => c.id === campanaCapturaId)
    const campanaNombre = campanaSeleccionada ? campanaSeleccionada.nombre : "Gran Sorteo Aniversario"

    try {
      const res = await api.cupones.registrar({
        documento: documento.trim(),
        nombre: nombre.trim(),
        telefono: telCompleto,
        direccion: direccion.trim() || undefined,
        barrio: barrio || "Centro",
        ciudad: "Pedro Juan Caballero",
        nro_ticket: nroTicket.trim(),
        monto_compra: valorMonto,
        cantidad: cantidadCupones,
        usuario_nombre: usuarioNombre,
        campana_id: campanaCapturaId || undefined,
        campana_nombre: campanaNombre,
        enviar_whatsapp: enviarWhatsapp
      })

      playSuccessBeep()
      toast.success("¡Cupón Registrado!", `Se emitieron ${cantidadCupones} cupón(es) para ${campanaNombre}.`)
      setUltimoRegistrado(res)

      // Limpiar formulario para el siguiente cliente
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
      toast.error("Error al registrar cupón", err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── GESTIÓN DE CAMPAÑAS ───────────────────────────────────────────────────
  const handleAbrirCrearCampana = () => {
    setCampanaEditando({
      nombre: "",
      codigo: "",
      descripcion: "",
      patrocinador: "Extra Supermercado",
      premio_destacado: "",
      tipo_trigger: "MONTO_GLOBAL",
      criterio_evaluacion: "MONTO_ACUMULADO",
      valor_umbral: 50000,
      productos_participantes: [],
      marcas_participantes: [],
      categorias_participantes: [],
      activo: true,
      whatsapp_activo: true,
      whatsapp_template: "¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* (Premio: {{premio}}) con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
      ticket_encabezado: "EXTRA SUPERMERCADO",
      ticket_subtitulo: "*** GRAN SORTEO ***",
      ticket_pie_urna: "¡Deposita este cupon en la urna de la sucursal!"
    })
    setShowCampanaModal(true)
  }

  const handleAbrirEditarCampana = (camp: SorteoCampanaUI) => {
    setCampanaEditando({ ...camp })
    setShowCampanaModal(true)
  }

  const handleGuardarCampana = async () => {
    if (!campanaEditando || !campanaEditando.nombre?.trim()) {
      toast.warning("Nombre obligatorio", "Ingrese el nombre de la campaña.")
      return
    }

    setSavingCampana(true)
    try {
      if (campanaEditando.id) {
        await api.cupones.updateCampana(campanaEditando.id, campanaEditando)
        toast.success("Campaña Actualizada", "Los cambios se aplicaron exitosamente.")
      } else {
        await api.cupones.createCampana(campanaEditando)
        toast.success("Campaña Creada", "La nueva campaña de sorteo está lista y activa.")
      }
      setShowCampanaModal(false)
      setCampanaEditando(null)
      loadCampanas()
    } catch (err: any) {
      toast.error("Error al guardar campaña", err.message)
    } finally {
      setSavingCampana(false)
    }
  }

  const handleEliminarCampana = async (id: string, nombre: string) => {
    if (!confirm(`¿Está seguro de eliminar la campaña "${nombre}"?`)) return
    try {
      await api.cupones.deleteCampana(id)
      toast.success("Campaña Eliminada", `"${nombre}" fue removida.`)
      loadCampanas()
    } catch (err: any) {
      toast.error("No se pudo eliminar", err.message)
    }
  }

  const handleToggleActivoCampana = async (camp: SorteoCampanaUI) => {
    try {
      await api.cupones.updateCampana(camp.id, { activo: !camp.activo })
      toast.info(camp.activo ? "Campaña Pausada" : "Campaña Activada", camp.nombre)
      loadCampanas()
    } catch (err: any) {
      toast.error("Error al cambiar estado", err.message)
    }
  }

  // ── GESTIÓN DE PRODUCTOS PARTICIPANTES EN LA CAMPAÑA ──────────────────────
  const handleAgregarProductoACampana = (prod: Product) => {
    if (!campanaEditando) return
    const actual = campanaEditando.productos_participantes || []
    const yaExiste = actual.some(p => p.id === prod.id || p.sku === prod.sku)
    if (yaExiste) {
      toast.warning("Ya seleccionado", "Este producto ya está en la lista de participantes.")
      return
    }
    const nuevo = [
      ...actual,
      {
        id: prod.id,
        producto_id: prod.id,
        sku: prod.sku,
        nombre: prod.nombre,
        codigo_barra: prod.codigo_barra,
        precio_unitario: prod.precio_venta
      }
    ]
    setCampanaEditando({ ...campanaEditando, productos_participantes: nuevo })
    setBusquedaProducto("")
  }

  const handleQuitarProductoDeCampana = (index: number) => {
    if (!campanaEditando) return
    const actual = [...(campanaEditando.productos_participantes || [])]
    actual.splice(index, 1)
    setCampanaEditando({ ...campanaEditando, productos_participantes: actual })
  }

  // ── GENERADOR DE CAMPAÑAS CON GEMINI IA ────────────────────────────────────
  const handleGenerarCampanaIA = async () => {
    setCampanaLoading(true)
    setCampanaResultado(null)
    try {
      const res = await api.cupones.generarCampana({
        segmento: campanaSegmento,
        tono: campanaTono,
        oferta_especifica: campanaOferta.trim() || undefined
      })
      setCampanaResultado(res)
      toast.success("Mensaje Generado", `Optimizado para ${res.audiencia_estimada} clientes del segmento ${campanaSegmento}`)
    } catch (err: any) {
      toast.error("Error generando mensaje", err.message)
    } finally {
      setCampanaLoading(false)
    }
  }

  const handleCopiarTexto = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto)
    setCopiedId(id)
    toast.info("Copiado al portapapeles", "Listo para enviar por WhatsApp")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAnalizarIA = async () => {
    setAnalyzingIA(true)
    try {
      const res = await api.cupones.analizarIA({ limite: 30 })
      toast.success("Perfilado IA Finalizado", `Analizados ${res.analizados} clientes con Gemini 2.5 Flash.`)
      loadClientes()
    } catch (err: any) {
      toast.error("Error en perfilado", err.message)
    } finally {
      setAnalyzingIA(false)
    }
  }

  const handleStartBatchSync = async () => {
    setSyncBatchLoading(true)
    try {
      await api.cupones.syncBatch({ limite: 50, delay_ms: 150 })
      toast.info("Sincronización iniciada", "Procesando lotes en segundo plano...")
    } catch (err: any) {
      toast.error("Error iniciando sync", err.message)
      setSyncBatchLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in font-sans">
      
      {/* ── ENCABEZADO Y HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Motor Multi-Campaña de Sorteos & Cupones
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  Extra Supermercado
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sorteos globales, promociones de proveedores con electrodomésticos, aceleradores por producto e impresión térmica con corte.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAbrirCrearCampana}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Campaña de Sorteo</span>
          </button>

          <button
            onClick={() => { loadCampanas(); loadStats(); if (tab === "tickets") loadTickets(); if (tab === "clientes") loadClientes(); }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${campanasLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── RESUMEN DE MÉTRICAS GLOBALES (KPIS) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">Campañas Activas</span>
            <Gift className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-posMono">
            {campanas.filter(c => c.activo).length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {campanas.length} campañas configuradas
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">Cupones Emitidos</span>
            <Ticket className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-posMono">
            {stats?.total_cupones?.toLocaleString("es-PY") || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            En {stats?.total_tickets || 0} ventas cruzadas
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">Clientes Participantes</span>
            <User className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-posMono">
            {stats?.total_clientes?.toLocaleString("es-PY") || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Base de datos fidelizada
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-bold">Monto Total de Compras</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-posMono truncate">
            {formatPYG(stats?.monto_total_compras || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Ventas con participación en sorteos
          </div>
        </div>
      </div>

      {/* ── BARRA DE PESTAÑAS ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTab("campanas")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            tab === "campanas"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>🏆 Campañas & Sorteos Multi-Proveedor</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">
            {campanas.length}
          </span>
        </button>

        <button
          onClick={() => setTab("captura")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            tab === "captura"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>⚡ Captura Rápida de Mostrador</span>
        </button>

        <button
          onClick={() => setTab("tickets")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            tab === "tickets"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>📋 Historial & Auditoría</span>
        </button>

        <button
          onClick={() => setTab("clientes")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            tab === "clientes"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <User className="w-4 h-4" />
          <span>👥 Clientes & RFM</span>
        </button>

        <button
          onClick={() => setTab("ia_insights")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            tab === "ia_insights"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>🧠 Analítica IA & Campañas</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 1: GESTIÓN DE CAMPAÑAS Y SORTEOS MULTI-PROVEEDOR               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {tab === "campanas" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Sorteos y Promociones Activas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada sorteo evalúa automáticamente el carrito al cobrar en el POS e imprime sus propios cupones individuales.
              </p>
            </div>
            <button
              onClick={handleAbrirCrearCampana}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Sorteo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campanas.map(c => {
              const esGlobal = c.tipo_trigger === "MONTO_GLOBAL"
              const esProductos = c.tipo_trigger === "PRODUCTOS_ESPECIFICOS"
              const esMarca = c.tipo_trigger === "MARCA_PROVEEDOR"

              return (
                <div
                  key={c.id}
                  className={`p-5 rounded-3xl border transition flex flex-col justify-between ${
                    c.activo
                      ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md"
                      : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Tags y Estado */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        esGlobal
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : esProductos
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {esGlobal ? "🌐 Cesta Global" : esProductos ? "📦 Productos Aceleradores" : "🏷️ Por Marca/Proveedor"}
                      </span>

                      <button
                        onClick={() => handleToggleActivoCampana(c)}
                        className={`text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          c.activo ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {c.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        <span>{c.activo ? "Activo" : "Pausado"}</span>
                      </button>
                    </div>

                    {/* Título y Patrocinador */}
                    <div>
                      <div className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        Patrocinado por: {c.patrocinador || "Extra Supermercado"}
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                        {c.nombre}
                      </h3>
                    </div>

                    {/* Premio Destacado */}
                    {c.premio_destacado && (
                      <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                        <Gift className="w-4 h-4 shrink-0 text-amber-500" />
                        <span className="truncate">Premio: {c.premio_destacado}</span>
                      </div>
                    )}

                    {/* Regla de Disparo */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl space-y-1">
                      <div className="font-bold text-[11px] text-slate-400 uppercase">Regla de Emisión:</div>
                      {esGlobal && (
                        <div>
                          1 cupón por cada <strong>{formatPYG(c.valor_umbral)}</strong> de compra general.
                        </div>
                      )}
                      {esProductos && (
                        <div>
                          1 cupón por cada{" "}
                          <strong>
                            {c.criterio_evaluacion === "CANTIDAD_UNIDADES"
                              ? `${c.valor_umbral} unidades`
                              : formatPYG(c.valor_umbral)}
                          </strong>{" "}
                          en los <strong>{c.productos_participantes?.length || 0} productos participantes</strong>.
                        </div>
                      )}
                      {esMarca && (
                        <div>
                          1 cupón por cada <strong>{formatPYG(c.valor_umbral)}</strong> en marcas participantes.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer con Métricas y Botones */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">Cupones Emitidos</div>
                      <div className="text-sm font-black text-slate-900 dark:text-white font-posMono">
                        {c.total_cupones_emitidos?.toLocaleString("es-PY") || 0}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAbrirEditarCampana(c)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                        title="Diseñar Ticket & Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEliminarCampana(c.id, c.nombre)}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                        title="Eliminar campaña"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 2: CAPTURA RÁPIDA EN VENTANILLA / MOSTRADOR                    */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {tab === "captura" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleRegistrarCupon} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span>Emisión Manual de Cupones</span>
                </h3>
                <span className="text-xs text-slate-400">PJC - Paraguay</span>
              </div>

              {/* Selector de Campaña Destino */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Campaña / Sorteo Destino *
                </label>
                <select
                  value={campanaCapturaId}
                  onChange={e => setCampanaCapturaId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {campanas.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} (Patrocinador: {c.patrocinador})
                    </option>
                  ))}
                </select>
              </div>

              {/* Documento y Búsqueda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    C.I. / CPF / RUC *
                  </label>
                  <div className="relative">
                    <input
                      ref={docInputRef}
                      type="text"
                      required
                      value={documento}
                      onChange={e => setDocumento(e.target.value)}
                      onBlur={() => handleLookupCliente()}
                      placeholder="Ej: 4567890 o CPF"
                      className="w-full p-2.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    {searchingDoc && (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-400 absolute right-2.5 top-3" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Teléfono y País */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={codigoPais}
                      onChange={e => setCodigoPais(e.target.value as "595" | "55")}
                      className="p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="595">🇵🇾 +595</option>
                      <option value="55">🇧🇷 +55</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={telefono}
                      onChange={e => setTelefono(e.target.value.replace(/\D/g, ""))}
                      placeholder={codigoPais === "595" ? "981 123456" : "67 991234567"}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Barrio / Ciudad
                  </label>
                  <select
                    value={barrio}
                    onChange={e => setBarrio(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {BARRIOS_PJC.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Datos de Compra */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nro. de Ticket / Venta *
                  </label>
                  <input
                    type="text"
                    required
                    value={nroTicket}
                    onChange={e => setNroTicket(e.target.value)}
                    placeholder="001-002-0001234"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Monto de Compra (Gs.)
                  </label>
                  <input
                    type="text"
                    value={montoCompra}
                    onChange={e => {
                      const num = parseInt(e.target.value.replace(/\D/g, "") || "0", 10)
                      setMontoCompra(num > 0 ? num.toLocaleString("es-PY") : "")
                      // Auto cálculo con base en la campaña seleccionada
                      const camp = campanas.find(c => c.id === campanaCapturaId)
                      if (camp && camp.valor_umbral > 0) {
                        setCantidadCupones(Math.max(1, Math.floor(num / camp.valor_umbral)))
                      }
                    }}
                    placeholder="150.000"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cantidad de Cupones *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cantidadCupones}
                    onChange={e => setCantidadCupones(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enviarWhatsapp}
                    onChange={e => setEnviarWhatsapp(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4"
                  />
                  <span>Disparar confirmación de WhatsApp al registrar</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs shadow-lg shadow-orange-500/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{submitting ? "Registrando..." : `Emitir ${cantidadCupones} Cupones`}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Panel Lateral: Resumen del Último Cupón */}
          <div>
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Último Comprobante Emitido</span>
              </h3>

              {ultimoRegistrado ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-xs space-y-2">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                    {ultimoRegistrado.cliente?.nombre}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    Doc: <strong>{ultimoRegistrado.cliente?.documento}</strong> · Tel: <strong>{ultimoRegistrado.cliente?.telefono}</strong>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    Ticket: <strong>#{ultimoRegistrado.ticket?.nro_ticket}</strong>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between">
                    <span className="font-black text-emerald-700 dark:text-emerald-400">
                      {ultimoRegistrado.ticket?.cantidad} Cupones Generados
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No hay comprobantes emitidos en esta sesión todavía.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 3: HISTORIAL & AUDITORÍA                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {tab === "tickets" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar CI / Documento..."
                  value={filtroSearch}
                  onChange={e => setFiltroSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>

              <select
                value={filtroBarrio}
                onChange={e => setFiltroBarrio(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="">Todos los barrios</option>
                {BARRIOS_PJC.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleStartBatchSync}
              disabled={syncBatchLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncBatchLoading ? "animate-spin" : ""}`} />
              <span>{syncBatchLoading ? "Sincronizando..." : "Sincronizar Lote con Ventas"}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Campaña / Sorteo</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4 text-center">Cupones</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-500">
                        {t.fecha_captura ? new Date(t.fecha_captura).toLocaleDateString("es-PY") : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{t.nro_ticket}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                          {t.campana_nombre || "Gran Sorteo Aniversario"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {t.cliente?.nombre || "Consumidor Final"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {t.cliente?.telefono || "-"}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-orange-600 dark:text-orange-400 font-posMono text-sm">
                        {t.cantidad}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatPYG(t.monto_compra || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.whatsapp_enviado
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {t.whatsapp_enviado ? "Enviado" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 4: CLIENTES & RFM                                              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {tab === "clientes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Directorio Fidelizado de Clientes
              </h2>
              <p className="text-xs text-slate-400">
                Segmentación conductual y acumulación de compras para campañas dirigidas.
              </p>
            </div>
            <button
              onClick={handleAnalizarIA}
              disabled={analyzingIA}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Brain className={`w-4 h-4 ${analyzingIA ? "animate-spin" : ""}`} />
              <span>{analyzingIA ? "Perfilando con IA..." : "Perfilar con Gemini 2.5 Flash"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map(cli => (
              <div key={cli.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {cli.nombre}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {cli.documento}
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cli.telefono || "Sin teléfono"}</span>
                  <span>·</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cli.barrio || "Centro"}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Compras</div>
                    <div className="font-black text-xs text-slate-900 dark:text-white font-posMono">
                      {cli.cantidad_compras || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Total</div>
                    <div className="font-black text-xs text-emerald-600 dark:text-emerald-400 font-posMono truncate">
                      {formatPYG(cli.total_gastado || 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] text-slate-400 uppercase font-bold">Promedio</div>
                    <div className="font-black text-xs text-blue-600 dark:text-blue-400 font-posMono truncate">
                      {formatPYG(cli.ticket_promedio || 0)}
                    </div>
                  </div>
                </div>

                {cli.segmentos && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {cli.segmentos.split(",").map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
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

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* PESTAÑA 5: ANALÍTICA IA & GENERADOR DE CAMPAÑAS WHATSAPP               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {tab === "ia_insights" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <span>Redactor de Campañas WhatsApp con Gemini 2.5 Flash</span>
            </h3>
            <p className="text-xs text-slate-500">
              Genera copys de alta conversión adaptados al perfil del segmento para potenciar las ventas de los sorteos.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Segmento Objetivo</label>
                <select
                  value={campanaSegmento}
                  onChange={e => setCampanaSegmento(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="VIP">⭐ Clientes VIP / Alto Consumo</option>
                  <option value="Frecuente">🛒 Compradores Frecuentes</option>
                  <option value="En Riesgo">⚠️ En Riesgo de Abandono (Inactivos)</option>
                  <option value="Nuevo">🌱 Nuevos Clientes</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tono del Mensaje</label>
                <select
                  value={campanaTono}
                  onChange={e => setCampanaTono(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  <option value="Persuasivo">🔥 Persuasivo / Exclusivo</option>
                  <option value="Urgente">⏳ Urgencia / Últimos Días</option>
                  <option value="Amigable">🤝 Amigable y Cercano</option>
                  <option value="Formal">👔 Formal e Institucional</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Oferta / Gancho Específico</label>
                <input
                  type="text"
                  value={campanaOferta}
                  onChange={e => setCampanaOferta(e.target.value)}
                  placeholder="Ej: Promo Unilever - Lavarropas Automático con 2 Dove"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                />
              </div>

              <button
                onClick={handleGenerarCampanaIA}
                disabled={campanaLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                <span>{campanaLoading ? "Redactando con IA..." : "Generar Copy con Gemini 2.5 Flash"}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span>Mensaje Listo para Difusión</span>
                </h3>
                {campanaResultado && (
                  <button
                    onClick={() => handleCopiarTexto(campanaResultado.mensaje_generado, "campana")}
                    className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    {copiedId === "campana" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === "campana" ? "¡Copiado!" : "Copiar"}</span>
                  </button>
                )}
              </div>

              {campanaResultado ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {campanaResultado.mensaje_generado}
                  </div>
                  <div className="text-[11px] text-slate-400 text-right">
                    Audiencia estimada: <strong>{campanaResultado.audiencia_estimada} clientes</strong>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Configura los parámetros a la izquierda y presiona Generar Copy.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL / DRAWER DE CREACIÓN Y EDICIÓN DE CAMPAÑA DE SORTEO              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showCampanaModal && campanaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-4xl w-full shadow-2xl space-y-6 my-8">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {campanaEditando.id ? "Diseñador & Editor de Sorteo" : "Nueva Campaña de Sorteo"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configuración de reglas, productos participantes, plantilla de WhatsApp y diseño de ticket térmico.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCampanaModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cuerpo del Formulario en 2 Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Columna Izquierda: Parámetros y Reglas */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nombre del Sorteo / Campaña *
                  </label>
                  <input
                    type="text"
                    required
                    value={campanaEditando.nombre || ""}
                    onChange={e => setCampanaEditando({ ...campanaEditando, nombre: e.target.value })}
                    placeholder="Ej: Promo Unilever te equipa tu Hogar"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Patrocinador / Marca *
                    </label>
                    <input
                      type="text"
                      required
                      value={campanaEditando.patrocinador || ""}
                      onChange={e => setCampanaEditando({ ...campanaEditando, patrocinador: e.target.value })}
                      placeholder="Ej: Unilever, Coca-Cola, Extra"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Premio Destacado
                    </label>
                    <input
                      type="text"
                      value={campanaEditando.premio_destacado || ""}
                      onChange={e => setCampanaEditando({ ...campanaEditando, premio_destacado: e.target.value })}
                      placeholder="Ej: Lavarropas Samsung, Smart TV"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                </div>

                {/* Tipo de Regla de Activación */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tipo de Activador (Trigger) *
                  </label>
                  <select
                    value={campanaEditando.tipo_trigger || "MONTO_GLOBAL"}
                    onChange={e => setCampanaEditando({ ...campanaEditando, tipo_trigger: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="MONTO_GLOBAL">🌐 Cesta Global (Por monto total de la compra)</option>
                    <option value="PRODUCTOS_ESPECIFICOS">📦 Por Productos Específicos (SKUs Aceleradores)</option>
                    <option value="MARCA_PROVEEDOR">🏷️ Por Marca / Proveedor</option>
                    <option value="CATEGORIA">🏬 Por Categoría de Supermercado</option>
                  </select>
                </div>

                {/* Parámetro de Umbral */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Criterio de Evaluación
                    </label>
                    <select
                      value={campanaEditando.criterio_evaluacion || "MONTO_ACUMULADO"}
                      onChange={e => setCampanaEditando({ ...campanaEditando, criterio_evaluacion: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    >
                      <option value="MONTO_ACUMULADO">Monto Acumulado (Gs.)</option>
                      <option value="CANTIDAD_UNIDADES">Cantidad de Unidades</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Valor Requerido (Por Cupón) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={campanaEditando.valor_umbral || 50000}
                      onChange={e => setCampanaEditando({ ...campanaEditando, valor_umbral: parseFloat(e.target.value) || 1 })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold font-mono"
                    />
                  </div>
                </div>

                {/* Si es por productos específicos: Selector y Lista de Productos */}
                {campanaEditando.tipo_trigger === "PRODUCTOS_ESPECIFICOS" && (
                  <div className="space-y-2 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <label className="font-bold text-amber-900 dark:text-amber-300 block">
                      Seleccionar Productos Participantes ({campanaEditando.productos_participantes?.length || 0})
                    </label>

                    {/* Buscador de catálogo */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre o código de barra..."
                        value={busquedaProducto}
                        onChange={e => setBusquedaProducto(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>

                    {/* Resultados de búsqueda */}
                    {busquedaProducto.trim() && (
                      <div className="max-h-36 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        {catalogoProductos
                          .filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || p.codigo_barra?.includes(busquedaProducto))
                          .slice(0, 5)
                          .map(p => (
                            <div
                              key={p.id}
                              onClick={() => handleAgregarProductoACampana(p)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between text-xs"
                            >
                              <span className="font-bold truncate">{p.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono">+{formatPYG(p.precio_venta)}</span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Lista de seleccionados */}
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {campanaEditando.productos_participantes?.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                          <span className="truncate font-bold text-slate-800 dark:text-slate-200">{p.nombre}</span>
                          <button
                            onClick={() => handleQuitarProductoDeCampana(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plantilla de WhatsApp */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Plantilla de WhatsApp del Sorteo
                  </label>
                  <textarea
                    rows={3}
                    value={campanaEditando.whatsapp_template || ""}
                    onChange={e => setCampanaEditando({ ...campanaEditando, whatsapp_template: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Tags disponibles: <code className="text-orange-500">{"{{nombre}}"}</code>, <code className="text-orange-500">{"{{cantidad}}"}</code>, <code className="text-orange-500">{"{{sorteo}}"}</code>, <code className="text-orange-500">{"{{premio}}"}</code>, <code className="text-orange-500">{"{{ticket}}"}</code>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Diseñador de Ticket Térmico con Vista Previa */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Printer className="w-4 h-4" />
                    <span>Diseñador del Ticket Térmico</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">ESC/POS 80mm</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Encabezado Ticket</label>
                    <input
                      type="text"
                      value={campanaEditando.ticket_encabezado || "EXTRA SUPERMERCADO"}
                      onChange={e => setCampanaEditando({ ...campanaEditando, ticket_encabezado: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Subtítulo del Sorteo</label>
                    <input
                      type="text"
                      value={campanaEditando.ticket_subtitulo || `*** ${campanaEditando.nombre?.toUpperCase() || "SORTEO"} ***`}
                      onChange={e => setCampanaEditando({ ...campanaEditando, ticket_subtitulo: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Texto de Urna</label>
                    <input
                      type="text"
                      value={campanaEditando.ticket_pie_urna || "¡Deposita este cupon en la urna de la sucursal!"}
                      onChange={e => setCampanaEditando({ ...campanaEditando, ticket_pie_urna: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                </div>

                {/* Visualizador Monocromo Fidedigno */}
                <div className="bg-[#f7f6f2] text-black p-5 rounded-2xl shadow-inner border border-slate-300 font-mono text-[11px] leading-tight select-none space-y-2">
                  <div className="text-center font-bold text-sm">
                    {campanaEditando.ticket_encabezado || "EXTRA SUPERMERCADO"}
                  </div>
                  <div className="text-center text-[10px]">
                    Pedro Juan Caballero - Paraguay
                  </div>
                  <div className="text-center font-bold text-xs pt-1">
                    {campanaEditando.ticket_subtitulo || `*** ${campanaEditando.nombre?.toUpperCase() || "SORTEO"} ***`}
                  </div>
                  {campanaEditando.premio_destacado && (
                    <div className="text-center font-bold text-[10px]">
                      Premio: {campanaEditando.premio_destacado}
                    </div>
                  )}

                  <div className="border-t border-dashed border-black my-1 pt-1 text-center font-black text-sm">
                    CUPON 1 DE 3
                  </div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>Ticket Venta:</span>
                      <span>#001-002-0004567</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fecha:</span>
                      <span>{new Date().toLocaleDateString("es-PY")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Patrocinador:</span>
                      <span>{campanaEditando.patrocinador || "Extra Supermercado"}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-black my-1 pt-1 space-y-0.5 text-[10px]">
                    <div>CLIENTE: JUAN PÉREZ</div>
                    <div>DOC: 4.567.890</div>
                    <div>TEL: +595 981 123456</div>
                    <div>BARRIO: San Gerardo</div>
                  </div>

                  <div className="border-t border-dashed border-black my-1 pt-2 text-center space-y-0.5">
                    <div className="font-bold text-[10px]">
                      {campanaEditando.ticket_pie_urna || "¡Deposita este cupon en la urna de la sucursal!"}
                    </div>
                    <div className="text-[9px]">Valido para los sorteos de la campana</div>
                  </div>

                  <div className="border-t-2 border-dotted border-red-500 pt-1 text-center text-[9px] text-red-600 font-sans font-bold flex items-center justify-center gap-1">
                    <Scissors className="w-3 h-3" />
                    <span>CORTE AUTOMÁTICO DE PAPEL ENTRE CUPONES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowCampanaModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleGuardarCampana}
                disabled={savingCampana}
                className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-lg shadow-orange-500/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingCampana ? "Guardando..." : "Guardar Campaña de Sorteo"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
