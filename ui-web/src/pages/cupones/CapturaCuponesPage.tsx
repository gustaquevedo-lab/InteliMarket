import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Ticket, Sparkles, User, Phone, MapPin, Send, CheckCircle2,
  AlertCircle, Search, RefreshCw, Layers, ShieldCheck, MessageSquare,
  DollarSign, Award, Tag, Trash2, ExternalLink, ArrowRight, Zap,
  ShoppingBag, Clock, Brain, ThumbsUp, Copy, Check, Filter,
  Settings, Sliders, Printer, Wand2, Scissors, Save, HelpCircle,
  Plus, Edit3, X, CheckSquare, Gift, Store, BarChart3, ChevronRight,
  Package, ToggleLeft, ToggleRight, Receipt, Percent, Star, ArrowUpRight
} from "lucide-react"
import { api, type CuponTicket, type CuponCliente, type CuponStats, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

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
        toast.info("Cliente encontrado", `Datos autocompletados desde ${res.origen === "cupones" ? "Cupones" : "Directorio de Clientes"}`)
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
      toast.warning("Campos requeridos", "Por favor completa el documento, nombre, teléfono y número de ticket.")
      return
    }

    const valorMonto = parseFloat(montoCompra.replace(/\D/g, "")) || 0
    if (cantidadCupones <= 0) {
      toast.warning("Cantidad inválida", "Debe asignarse al menos 1 cupón.")
      return
    }

    setSubmitting(true)
    const telCompleto = `${codigoPais}${telefono.replace(/\D/g, "")}`

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
      toast.warning("Nombre obligatorio", "Ingrese el nombre del sorteo o campaña.")
      return
    }

    setSavingCampana(true)
    try {
      const payload: any = {
        nombre: campanaEditando.nombre.trim(),
        codigo: campanaEditando.codigo?.trim() || undefined,
        descripcion: campanaEditando.descripcion?.trim() || undefined,
        patrocinador: campanaEditando.patrocinador?.trim() || "Extra Supermercado",
        premio_destacado: campanaEditando.premio_destacado?.trim() || undefined,
        tipo_trigger: campanaEditando.tipo_trigger || "MONTO_GLOBAL",
        criterio_evaluacion: campanaEditando.criterio_evaluacion || "MONTO_ACUMULADO",
        valor_umbral: Number(campanaEditando.valor_umbral) || 50000,
        productos_participantes: campanaEditando.productos_participantes || [],
        marcas_participantes: campanaEditando.marcas_participantes || [],
        categorias_participantes: campanaEditando.categorias_participantes || [],
        fecha_inicio: campanaEditando.fecha_inicio ? new Date(campanaEditando.fecha_inicio).toISOString() : undefined,
        fecha_fin: campanaEditando.fecha_fin ? new Date(campanaEditando.fecha_fin).toISOString() : undefined,
        activo: campanaEditando.activo !== false,
        whatsapp_activo: campanaEditando.whatsapp_activo !== false,
        whatsapp_template: campanaEditando.whatsapp_template?.trim() || undefined,
        ticket_encabezado: campanaEditando.ticket_encabezado?.trim() || "EXTRA SUPERMERCADO",
        ticket_subtitulo: campanaEditando.ticket_subtitulo?.trim() || undefined,
        ticket_pie_urna: campanaEditando.ticket_pie_urna?.trim() || "¡Deposita este cupon en la urna de la sucursal!",
      }

      if (campanaEditando.id) {
        await api.cupones.updateCampana(campanaEditando.id, payload)
        toast.success("Campaña Actualizada", "Los parámetros del sorteo se guardaron correctamente.")
      } else {
        await api.cupones.createCampana(payload)
        toast.success("Campaña Creada", "Nueva promoción activa y lista en las cajas.")
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
      toast.warning("Ya seleccionado", "Este artículo ya forma parte de los aceleradores.")
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
      toast.info("Sincronización iniciada", "Procesando lotes de tickets en segundo plano...")
    } catch (err: any) {
      toast.error("Error iniciando sync", err.message)
      setSyncBatchLoading(false)
    }
  }

  const handleSyncTicket = async (ticketId: string) => {
    try {
      const res = await api.cupones.syncTicket(ticketId)
      if (res.sincronizado) {
        toast.success("Venta Sincronizada", `Monto cruzado: Gs. ${res.monto_compra.toLocaleString("es-PY")}`)
      } else {
        toast.info("Sin Venta Encontrada", res.mensaje)
      }
      loadTickets()
      loadStats()
    } catch (err: any) {
      toast.error("Error en sincronización", err.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      
      {/* ──────────────────────────────────────────────────────────────────────────
          🌟 LUXURY COMMAND DECK HEADER (ALINEADO AL SISTEMA DE DISEÑO)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-6 sm:p-8 border border-amber-500/20 shadow-2xl shadow-amber-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 border border-amber-400/30 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <Ticket className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    FIDELIZACIÓN & MARKETING · MOTOR MULTI-CAMPAÑA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Extra Supermercado (Central)
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Sorteos Comerciales & Cupones
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Sorteos de tienda, promociones de proveedores con electrodomésticos, aceleradores por producto e impresión térmica con corte en cajas.
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏆 {campanas.filter(c => c.activo).length} Campañas activas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                🎟️ {stats?.total_cupones?.toLocaleString("es-PY") || 0} Cupones emitidos
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                ⚡ Detección automática en POS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => {
                loadCampanas()
                loadStats()
                if (tab === "tickets") loadTickets()
                if (tab === "clientes") loadClientes()
              }}
              disabled={campanasLoading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${campanasLoading ? "animate-spin text-amber-400" : ""}`} />
            </button>

            <button
              onClick={handleAbrirCrearCampana}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Campaña de Sorteo</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Total Cupones", val: stats?.total_cupones?.toLocaleString("es-PY") || "0", color: "text-amber-400", icon: Award },
            { label: "Clientes Fidelizados", val: stats?.total_clientes?.toLocaleString("es-PY") || "0", color: "text-blue-300", icon: User },
            { label: "Tickets Auditados", val: `${stats?.tickets_sincronizados || 0} / ${stats?.total_tickets || 0}`, color: "text-emerald-400", icon: ShieldCheck },
            { label: "Campañas en Caja", val: campanas.length, color: "text-purple-300", icon: Layers },
          ].map((kpi) => (
            <div key={kpi.label} className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-xl font-black font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { key: "campanas", label: `Campañas & Sorteos Multi-Proveedor (${campanas.length})`, icon: Award },
          { key: "captura", label: "Captura Rápida en Mostrador", icon: Zap },
          { key: "tickets", label: `Historial & Auditoría (${tickets.length})`, icon: Ticket },
          { key: "clientes", label: `Directorio de Clientes & RFM (${clientes.length})`, icon: User },
          { key: "ia_insights", label: "Copilot IA & WhatsApp", icon: Brain },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 1: GESTOR DE CAMPAÑAS MULTI-PROVEEDOR
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "campanas" && (
        <div className="space-y-6 animate-fade-in">
          {/* Banner de Información */}
          <div className="card p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 rounded-2xl">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase text-[11px] tracking-wider text-amber-950 dark:text-amber-200 mb-0.5">
                Coexistencia Multi-Campaña en el Punto de Venta
              </p>
              <p className="text-amber-800 dark:text-amber-300/80 leading-relaxed">
                Puedes tener activos el Sorteo General de la Tienda y promociones comerciales de proveedores (ej. Unilever con sorteo de lavarropas por compra de shampoos, o Coca-Cola sorteando Smart TVs). Las cajas evaluarán cada ticket y emitirán los cupones correspondientes con corte automático individual.
              </p>
            </div>
          </div>

          {/* Grid de Campañas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {campanas.map((camp) => (
              <div
                key={camp.id}
                className={`card p-6 bg-white dark:bg-slate-900 border rounded-3xl space-y-4 transition-all duration-300 ${
                  camp.activo
                    ? "border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-500/30"
                    : "border-slate-200/60 dark:border-slate-800/60 opacity-60 bg-slate-50/50 dark:bg-slate-950/50"
                }`}
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono ${
                        camp.tipo_trigger === "MONTO_GLOBAL"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : camp.tipo_trigger === "PRODUCTOS_ESPECIFICOS"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}>
                        {camp.tipo_trigger === "MONTO_GLOBAL" && "🌐 Cesta Global"}
                        {camp.tipo_trigger === "PRODUCTOS_ESPECIFICOS" && "📦 Acelerador SKU"}
                        {camp.tipo_trigger === "MARCA_PROVEEDOR" && "🏷️ Marca/Proveedor"}
                        {camp.tipo_trigger === "CATEGORIA" && "📁 Categoría"}
                      </span>

                      {camp.activo ? (
                        <span className="badge-success text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="badge-gray text-[10px]">
                          Pausado
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 dark:text-white truncate pt-1">
                      {camp.nombre}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleToggleActivoCampana(camp)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={camp.activo ? "Pausar campaña" : "Activar campaña"}
                  >
                    {camp.activo ? (
                      <ToggleRight className="w-7 h-7 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Detalles de Patrocinador y Premio */}
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span className="text-[10px] font-bold uppercase">Patrocinador:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{camp.patrocinador}</span>
                    </div>

                    {camp.premio_destacado && (
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-[10px] font-bold uppercase">Premio Mayor:</span>
                        <span className="font-black text-amber-600 dark:text-amber-400 truncate max-w-[180px]">
                          🎁 {camp.premio_destacado}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Regla de Disparo */}
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 px-1">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Criterio:</span>
                    <span className="font-black font-posMono text-slate-900 dark:text-white">
                      {camp.criterio_evaluacion === "MONTO_ACUMULADO" ? (
                        <>1 Cupón c/ {formatPYG(camp.valor_umbral)}</>
                      ) : (
                        <>1 Cupón c/ {camp.valor_umbral} Unidades</>
                      )}
                    </span>
                  </div>

                  {/* Artículos participantes */}
                  {camp.tipo_trigger === "PRODUCTOS_ESPECIFICOS" && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 px-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Productos:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {camp.productos_participantes?.length || 0} SKUs configurados
                      </span>
                    </div>
                  )}
                </div>

                {/* KPIs & Acciones */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Emitidos</div>
                    <div className="text-base font-black font-posMono text-slate-900 dark:text-white">
                      {camp.total_cupones_emitidos?.toLocaleString("es-PY") || 0}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAbrirEditarCampana(camp)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                      title="Editar parámetros y diseñador"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleEliminarCampana(camp.id, camp.nombre)}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition cursor-pointer"
                      title="Eliminar campaña"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 2: CAPTURA RÁPIDA DE MOSTRADOR
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "captura" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Formulario Principal de Registro */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleRegistrarCupon} className="card p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span>Emisión Manual de Cupones</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Registro rápido para promotoras en mostrador o servicio de atención al cliente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Operador:</span>
                  <input
                    type="text"
                    value={usuarioNombre}
                    onChange={(e) => setUsuarioNombre(e.target.value)}
                    className="input-field text-xs font-bold py-1.5 w-36"
                  />
                </div>
              </div>

              {/* Selector de Campaña Destino */}
              <div>
                <label className="input-label">
                  Sorteo / Campaña a la que Aplica *
                </label>
                <select
                  value={campanaCapturaId}
                  onChange={(e) => setCampanaCapturaId(e.target.value)}
                  className="input-field font-bold text-xs"
                >
                  {campanas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.patrocinador}) {c.premio_destacado ? `· Premio: ${c.premio_destacado}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fila 1: Documento y Nombre */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5">
                  <label className="input-label">
                    Documento (C.I. / CPF) *
                  </label>
                  <div className="relative">
                    <input
                      ref={docInputRef}
                      type="text"
                      required
                      autoFocus
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      onBlur={() => handleLookupCliente()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleLookupCliente()
                        }
                      }}
                      placeholder="Ej: 4567890 o CPF"
                      className="input-field font-mono font-bold text-sm pl-4 pr-10"
                    />
                    {searchingDoc ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLookupCliente()}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 cursor-pointer"
                        title="Buscar cliente registrado"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-7">
                  <label className="input-label">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre completo del cliente"
                    className="input-field font-bold text-sm"
                  />
                </div>
              </div>

              {/* Fila 2: Teléfono WhatsApp y Barrio */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6">
                  <label className="input-label">
                    WhatsApp (Disparo de Confirmación) *
                  </label>
                  <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition">
                    <select
                      value={codigoPais}
                      onChange={(e) => setCodigoPais(e.target.value as "595" | "55")}
                      className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
                    >
                      <option value="595">🇵🇾 +595</option>
                      <option value="55">🇧🇷 +55</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
                      placeholder={codigoPais === "595" ? "981 123456" : "67 991234567"}
                      className="w-full bg-transparent px-3 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="input-label">
                    Barrio / Ciudad
                  </label>
                  <select
                    value={barrio}
                    onChange={(e) => setBarrio(e.target.value)}
                    className="input-field font-bold text-xs cursor-pointer"
                  >
                    {BARRIOS_PJC.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila 3: Dirección (Opcional) */}
              <div>
                <label className="input-label">
                  Dirección Domiciliaria (Opcional)
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, número de casa, referencias"
                  className="input-field text-xs"
                />
              </div>

              {/* Fila 4: Ticket y Monto de Compra */}
              <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5">
                  <label className="input-label text-amber-950 dark:text-amber-200">
                    Nro. de Factura / Ticket *
                  </label>
                  <input
                    type="text"
                    required
                    value={nroTicket}
                    onChange={(e) => setNroTicket(e.target.value)}
                    placeholder="001-002-0001234"
                    className="input-field font-mono font-bold text-sm bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="input-label text-amber-950 dark:text-amber-200">
                    Monto Compra (Gs.)
                  </label>
                  <input
                    type="text"
                    value={montoCompra}
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, "")
                      const num = parseInt(rawVal, 10) || 0
                      setMontoCompra(num > 0 ? num.toLocaleString("es-PY") : "")
                      if (num > 0) {
                        const campanaActual = campanas.find(c => c.id === campanaCapturaId)
                        const divisor = (campanaActual && campanaActual.valor_umbral) || 50000
                        const c = Math.max(1, Math.floor(num / divisor))
                        setCantidadCupones(c)
                      }
                    }}
                    placeholder="150.000"
                    className="input-field font-mono font-black text-sm bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="sm:col-span-3 text-center sm:text-right">
                  <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                    Cupones Ganados
                  </div>
                  <div className="flex items-center justify-center sm:justify-end gap-2 mt-1">
                    <input
                      type="number"
                      min={1}
                      value={cantidadCupones}
                      onChange={(e) => setCantidadCupones(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 text-center bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl py-2 text-2xl font-black font-posMono text-amber-600 dark:text-amber-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enviarWhatsapp}
                    onChange={(e) => setEnviarWhatsapp(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 focus:ring-2 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-500" />
                    Enviar comprobante digital y cupones por WhatsApp al registrar
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-none shadow-xl shadow-amber-500/25 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registrando Cupones...</span>
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4" />
                      <span>Generar {cantidadCupones} {cantidadCupones === 1 ? "Cupón" : "Cupones"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Panel Lateral: Perfil y Último Comprobante */}
          <div className="space-y-6">
            {clienteExistente && (
              <div className="card p-6 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-3xl shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="badge-info text-[10px]">
                    Cliente Frecuente
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {clienteExistente.id.slice(0, 8)}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {clienteExistente.nombre}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {clienteExistente.barrio || "Centro"}, Pedro Juan Caballero
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Compras</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                      {clienteExistente.cantidad_compras || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Total Gs.</div>
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      {formatPYG(clienteExistente.total_gastado || 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Promedio</div>
                    <div className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono truncate">
                      {formatPYG(clienteExistente.ticket_promedio || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ultimoRegistrado && (
              <div className="card p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl shadow-sm space-y-4 animate-scale-in">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Último Registro Exitoso</span>
                </div>

                <div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">Cliente:</div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {ultimoRegistrado.cliente.nombre}
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Doc: {ultimoRegistrado.cliente.documento} · Tel: +{ultimoRegistrado.cliente.telefono}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Factura / Ticket</div>
                    <div className="text-xs font-mono font-black text-slate-800 dark:text-slate-200">
                      #{ultimoRegistrado.ticket.nro_ticket}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Emitidos</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-posMono">
                      {ultimoRegistrado.ticket.cantidad} Cupones
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 3: HISTORIAL & AUDITORÍA DE TICKETS
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "tickets" && (
        <div className="space-y-4 animate-fade-in">
          {/* Barra de Filtros */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filtroSearch}
                  onChange={(e) => setFiltroSearch(e.target.value)}
                  placeholder="Buscar documento o ticket..."
                  className="input-field pl-9 text-xs"
                />
              </div>

              <select
                value={filtroBarrio}
                onChange={(e) => setFiltroBarrio(e.target.value)}
                className="input-field text-xs font-bold w-auto"
              >
                <option value="">Todos los barrios</option>
                {BARRIOS_PJC.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <select
                value={filtroSinc}
                onChange={(e) => setFiltroSinc(e.target.value)}
                className="input-field text-xs font-bold w-auto"
              >
                <option value="todos">Todos los estados</option>
                <option value="si">Solo Sincronizados</option>
                <option value="no">Pendientes de Sync</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleStartBatchSync}
                disabled={syncBatchLoading}
                className="btn-primary text-xs flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncBatchLoading ? "animate-spin" : ""}`} />
                <span>{syncBatchLoading ? "Sincronizando..." : "Sincronizar con Ventas"}</span>
              </button>

              <button
                onClick={loadTickets}
                className="btn-outline p-2.5"
                title="Refrescar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabla de Tickets */}
          <div className="card bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="table-header">
                  <tr>
                    <th className="table-cell">Fecha / Hora</th>
                    <th className="table-cell">Nro. Ticket</th>
                    <th className="table-cell">Sorteo / Campaña</th>
                    <th className="table-cell">Cliente</th>
                    <th className="table-cell">WhatsApp</th>
                    <th className="table-cell text-center">Cupones</th>
                    <th className="table-cell text-right">Monto Compra</th>
                    <th className="table-cell text-center">Auditoría Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingData ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Cargando registros de cupones...
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No se encontraron tickets con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.id} className="table-row">
                        <td className="table-td font-mono text-[11px] text-slate-400">
                          {t.fecha_captura ? new Date(t.fecha_captura).toLocaleString("es-PY") : "-"}
                        </td>
                        <td className="table-td font-mono font-bold text-slate-900 dark:text-white">
                          #{t.nro_ticket}
                        </td>
                        <td className="table-td font-bold text-slate-800 dark:text-slate-200">
                          {t.campana_nombre || "Gran Sorteo Aniversario"}
                        </td>
                        <td className="table-td font-bold text-slate-900 dark:text-white">
                          {t.cliente?.nombre || "Consumidor Final"}
                          <div className="text-[10px] font-normal text-slate-400">
                            Doc: {t.cliente?.documento} · {t.cliente?.barrio || "Centro"}
                          </div>
                        </td>
                        <td className="table-td font-mono">
                          +{t.cliente?.telefono}
                        </td>
                        <td className="table-td text-center">
                          <span className="badge-accent font-posMono text-xs font-black">
                            {t.cantidad}
                          </span>
                        </td>
                        <td className="table-td text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatPYG(t.monto_compra || 0)}
                        </td>
                        <td className="table-td text-center">
                          {t.sincronizado ? (
                            <span className="badge-success">
                              <ShieldCheck className="w-3 h-3" /> Verificado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncTicket(t.id)}
                              className="btn-outline px-2 py-1 text-[10px]"
                              title="Buscar en base de ventas"
                            >
                              Verificar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 4: DIRECTORIO DE CLIENTES & RFM
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "clientes" && (
        <div className="space-y-4 animate-fade-in">
          {/* Header de clientes */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Base Fidelizada & Segmentación RFM
                </h3>
                <p className="text-[11px] text-slate-400">
                  {clientes.length} clientes participantes acumulando historial de compras en Extra Supermercado.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAnalizarIA}
                disabled={analyzingIA}
                className="btn-primary bg-purple-600 hover:bg-purple-700 text-xs shadow-purple-500/20"
              >
                <Brain className={`w-3.5 h-3.5 ${analyzingIA ? "animate-spin" : ""}`} />
                <span>{analyzingIA ? "Analizando con Gemini..." : "Perfilar con Gemini 2.5 Flash"}</span>
              </button>

              <button
                onClick={loadClientes}
                className="btn-outline p-2.5"
                title="Refrescar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cards de Clientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map((c) => (
              <div key={c.id} className="card p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    {c.documento}
                  </span>
                  <span className="badge-accent font-posMono text-[10px] font-black">
                    {c.total_cupones} Cupones
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {c.nombre}
                  </h4>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>+{c.telefono}</span>
                    <span>·</span>
                    <span>{c.barrio || "Centro"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Compras</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                      {c.cantidad_compras || 0}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Total Gs.</div>
                    <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      {formatPYG(c.total_gastado || 0)}
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Promedio</div>
                    <div className="text-[11px] font-black text-blue-600 dark:text-blue-400 font-mono truncate">
                      {formatPYG(c.ticket_promedio || 0)}
                    </div>
                  </div>
                </div>

                {c.segmentos && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {c.segmentos.split(",").map((s: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
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

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 5: COPILOT IA & REDACTOR DE MENSAJES WHATSAPP
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "ia_insights" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Controles de la Campaña IA */}
          <div className="lg:col-span-5 card p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-purple-500/20">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Generador de Campañas WhatsApp
                </h3>
                <p className="text-xs text-slate-400">
                  Potenciado con Google Gemini 2.5 Flash
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="input-label">
                  Segmento Objetivo
                </label>
                <select
                  value={campanaSegmento}
                  onChange={(e) => setCampanaSegmento(e.target.value)}
                  className="input-field text-xs font-bold cursor-pointer"
                >
                  <option value="VIP">⭐ Clientes VIP / Alto Consumo</option>
                  <option value="Frecuente">🛒 Compradores Frecuentes</option>
                  <option value="En Riesgo">⚠️ En Riesgo de Abandono (Inactivos)</option>
                  <option value="Nuevo">🌱 Clientes Nuevos</option>
                  <option value="General">📢 Todos los Clientes</option>
                </select>
              </div>

              <div>
                <label className="input-label">
                  Tono del Mensaje
                </label>
                <select
                  value={campanaTono}
                  onChange={(e) => setCampanaTono(e.target.value)}
                  className="input-field text-xs font-bold cursor-pointer"
                >
                  <option value="Persuasivo">🔥 Persuasivo & Promocional</option>
                  <option value="Urgente">⚡ Urgencia & Cierre de Sorteo</option>
                  <option value="Amigable">🤝 Cercano & Familiar</option>
                  <option value="Exclusivo">💎 Exclusivo & VIP</option>
                </select>
              </div>

              <div>
                <label className="input-label">
                  Oferta / Gancho Específico (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={campanaOferta}
                  onChange={(e) => setCampanaOferta(e.target.value)}
                  placeholder="Ej: Este fin de semana doble cupón en carnes y bebidas para el Gran Sorteo Aniversario."
                  className="input-field text-xs"
                />
              </div>

              <button
                onClick={handleGenerarCampanaIA}
                disabled={campanaLoading}
                className="btn-primary w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25"
              >
                {campanaLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Redactando con Gemini 2.5 Flash...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Redactar Campaña de WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Resultado del Mensaje */}
          <div className="lg:col-span-7 space-y-4">
            {campanaResultado ? (
              <div className="card p-6 sm:p-8 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 rounded-3xl shadow-sm space-y-4 animate-scale-in">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="badge-info text-[10px]">
                      Audiencia Estimada: {campanaResultado.audiencia_estimada} Clientes
                    </span>
                    <div className="text-xs text-slate-400 mt-1">
                      Segmento: <strong>{campanaResultado.segmento}</strong> · Tono: <strong>{campanaResultado.tono}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopiarTexto(campanaResultado.mensaje_generado, "campana")}
                    className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === "campana" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Mensaje</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Previsualización en Burbuja WhatsApp */}
                <div className="p-4 rounded-2xl bg-[#efeae2] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-lg">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-xs space-y-2 text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-sans leading-relaxed">
                    {campanaResultado.mensaje_generado}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right mt-1.5 font-mono">
                    {new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })} ✓✓
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400 space-y-3">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  Ninguna campaña generada aún
                </div>
                <p className="text-xs max-w-sm mx-auto">
                  Selecciona el segmento de clientes y el tono a la izquierda para que Gemini redacte una campaña de alto impacto.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL / DRAWER: CREAR O EDITAR CAMPAÑA DE SORTEO (DISEÑADOR INCLUIDO)
      ────────────────────────────────────────────────────────────────────────── */}
      {showCampanaModal && campanaEditando && (
        <div className="modal-overlay">
          <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-600 text-white rounded-2xl shadow-md shadow-amber-500/20">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {campanaEditando.id ? "Configurar Campaña de Sorteo" : "Nueva Campaña de Sorteo / Promoción"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define la regla de emisión de cupones, productos aceleradores y el formato del ticket térmico.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCampanaModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Parámetros y Reglas */}
              <div className="lg:col-span-7 space-y-4">
                {/* Nombre y Patrocinador */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Nombre del Sorteo *</label>
                    <input
                      type="text"
                      required
                      value={campanaEditando.nombre || ""}
                      onChange={(e) => setCampanaEditando({ ...campanaEditando, nombre: e.target.value })}
                      placeholder="Ej: Gran Sorteo Lavarropas Unilever"
                      className="input-field text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="input-label">Patrocinador / Marca *</label>
                    <input
                      type="text"
                      required
                      value={campanaEditando.patrocinador || ""}
                      onChange={(e) => setCampanaEditando({ ...campanaEditando, patrocinador: e.target.value })}
                      placeholder="Ej: Unilever / OMO / Sedal"
                      className="input-field text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Premio Destacado */}
                <div>
                  <label className="input-label">Premio Destacado (Visible en Cupones) *</label>
                  <input
                    type="text"
                    value={campanaEditando.premio_destacado || ""}
                    onChange={(e) => setCampanaEditando({ ...campanaEditando, premio_destacado: e.target.value })}
                    placeholder="Ej: Lavarropas Automático 10kg + Kit de Productos"
                    className="input-field text-xs font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>

                {/* Vigencia de la Campaña (Opcional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Fecha de Inicio (Opcional)</label>
                    <input
                      type="date"
                      value={campanaEditando.fecha_inicio ? campanaEditando.fecha_inicio.slice(0, 10) : ""}
                      onChange={(e) => setCampanaEditando({ ...campanaEditando, fecha_inicio: e.target.value || undefined })}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="input-label">Fecha de Cierre / Sorteo (Opcional)</label>
                    <input
                      type="date"
                      value={campanaEditando.fecha_fin ? campanaEditando.fecha_fin.slice(0, 10) : ""}
                      onChange={(e) => setCampanaEditando({ ...campanaEditando, fecha_fin: e.target.value || undefined })}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Tipo de Disparador (Trigger) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="input-label text-slate-800 dark:text-slate-200">Tipo de Promoción / Disparador</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "MONTO_GLOBAL", label: "🌐 Cesta Global", desc: "Total de la compra" },
                        { id: "PRODUCTOS_ESPECIFICOS", label: "📦 Por Productos", desc: "SKUs aceleradores" },
                        { id: "MARCA_PROVEEDOR", label: "🏷️ Por Marca", desc: "Consumo de marcas" },
                        { id: "CATEGORIA", label: "📁 Por Categoría", desc: "Secciones del súper" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCampanaEditando({ ...campanaEditando, tipo_trigger: t.id as any })}
                          className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                            campanaEditando.tipo_trigger === t.id
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          <div>{t.label}</div>
                          <div className={`text-[10px] font-normal ${campanaEditando.tipo_trigger === t.id ? "text-amber-100" : "text-slate-400"}`}>
                            {t.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Criterio y Umbral */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="input-label">Criterio de Evaluación</label>
                      <select
                        value={campanaEditando.criterio_evaluacion || "MONTO_ACUMULADO"}
                        onChange={(e) => setCampanaEditando({ ...campanaEditando, criterio_evaluacion: e.target.value as any })}
                        className="input-field text-xs font-bold"
                      >
                        <option value="MONTO_ACUMULADO">Monto en Guaraníes (Gs.)</option>
                        <option value="CANTIDAD_UNIDADES">Cantidad de Unidades (Items)</option>
                      </select>
                    </div>

                    <div>
                      <label className="input-label">
                        {campanaEditando.criterio_evaluacion === "MONTO_ACUMULADO" ? "Monto p/ 1 Cupón (Gs.) *" : "Unidades p/ 1 Cupón *"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={campanaEditando.valor_umbral || 50000}
                        onChange={(e) => setCampanaEditando({ ...campanaEditando, valor_umbral: parseFloat(e.target.value) || 1 })}
                        className="input-field text-xs font-mono font-black text-amber-600 dark:text-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Si es por Productos: Selector de Productos Aceleradores */}
                {campanaEditando.tipo_trigger === "PRODUCTOS_ESPECIFICOS" && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="input-label text-amber-950 dark:text-amber-200">
                        Productos Aceleradores Participantes ({campanaEditando.productos_participantes?.length || 0})
                      </label>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                        Detección en tiempo real en POS
                      </span>
                    </div>

                    {/* Buscador de Producto en Catálogo */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={busquedaProducto}
                        onChange={(e) => setBusquedaProducto(e.target.value)}
                        placeholder="Buscar producto por nombre o código de barras para agregar..."
                        className="input-field pl-9 text-xs"
                      />
                    </div>

                    {/* Sugerencias Rápidas */}
                    {busquedaProducto.trim().length > 1 && (
                      <div className="max-h-36 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-lg space-y-1">
                        {catalogoProductos
                          .filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || (p.codigo_barra && p.codigo_barra.includes(busquedaProducto)))
                          .slice(0, 6)
                          .map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleAgregarProductoACampana(p)}
                              className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{p.nombre}</div>
                                <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku} · {formatPYG(p.precio_venta)}</div>
                              </div>
                              <Plus className="w-4 h-4 text-amber-600" />
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Lista de Productos ya Agregados */}
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                      {(campanaEditando.productos_participantes || []).map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-slate-800 dark:text-slate-200 shadow-2xs"
                        >
                          <span className="truncate max-w-[180px]">{p.nombre}</span>
                          <button
                            type="button"
                            onClick={() => handleQuitarProductoDeCampana(idx)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personalización de Tickets Térmicos */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-amber-500" />
                    <span>Textos del Ticket Térmico de Sorteo</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="input-label">Encabezado Ticket</label>
                      <input
                        type="text"
                        value={campanaEditando.ticket_encabezado || ""}
                        onChange={(e) => setCampanaEditando({ ...campanaEditando, ticket_encabezado: e.target.value })}
                        placeholder="EXTRA SUPERMERCADO"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="input-label">Subtítulo de Sorteo</label>
                      <input
                        type="text"
                        value={campanaEditando.ticket_subtitulo || ""}
                        onChange={(e) => setCampanaEditando({ ...campanaEditando, ticket_subtitulo: e.target.value })}
                        placeholder="*** GRAN SORTEO ***"
                        className="input-field text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Pie de Urna</label>
                    <input
                      type="text"
                      value={campanaEditando.ticket_pie_urna || ""}
                      onChange={(e) => setCampanaEditando({ ...campanaEditando, ticket_pie_urna: e.target.value })}
                      placeholder="¡Deposita este cupon en la urna de la sucursal!"
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Diseñador / Vista Previa Monocromo ESC/POS */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="input-label flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5" />
                    Vista Previa Ticket Físico (80mm)
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">ESC/POS Thermal</span>
                </div>

                {/* Visualizador Monocromo Fidedigno de Rollo Térmico 80mm */}
                <div className="relative select-none filter drop-shadow-md">
                  {/* Borde dentado superior */}
                  <div 
                    className="h-2 w-full bg-[#FAFAF7]" 
                    style={{
                      clipPath: "polygon(0% 100%, 3% 0%, 6% 100%, 9% 0%, 12% 100%, 15% 0%, 18% 100%, 21% 0%, 24% 100%, 27% 0%, 30% 100%, 33% 0%, 36% 100%, 39% 0%, 42% 100%, 45% 0%, 48% 100%, 51% 0%, 54% 100%, 57% 0%, 60% 100%, 63% 0%, 66% 100%, 69% 0%, 72% 100%, 75% 0%, 78% 100%, 81% 0%, 84% 100%, 87% 0%, 90% 100%, 93% 0%, 96% 100%, 100% 0%)"
                    }}
                  />

                  <div className="bg-[#FAFAF7] text-black px-4 py-3 font-mono text-[11px] leading-tight border-x border-slate-300 space-y-2">
                    {/* Encabezado */}
                    <div className="text-center font-black text-xs uppercase tracking-wide">
                      {campanaEditando.ticket_encabezado?.trim() || "EXTRA SUPERMERCADO MAYORISTA"}
                    </div>
                    <div className="text-center text-[9.5px]">
                      Pedro Juan Caballero · Paraguay
                    </div>

                    <div className="border-t border-dashed border-black pt-1 text-center font-bold text-xs">
                      {campanaEditando.ticket_subtitulo?.trim() || `*** ${campanaEditando.nombre?.toUpperCase() || "GRAN SORTEO"} ***`}
                    </div>

                    {campanaEditando.premio_destacado && (
                      <div className="text-center text-[10px] font-bold text-slate-900">
                        Premio: {campanaEditando.premio_destacado}
                      </div>
                    )}
                    {campanaEditando.patrocinador && campanaEditando.patrocinador !== "Extra Supermercado" && (
                      <div className="text-center text-[9.5px]">
                        Patrocinador: {campanaEditando.patrocinador}
                      </div>
                    )}

                    <div className="border-t-2 border-black py-1 text-center font-black text-sm tracking-wider">
                      CUPON 1 DE 3
                    </div>

                    <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[9.5px]">
                      <div className="flex justify-between">
                        <span>Ticket Venta: #001-012-0048291</span>
                        <span className="font-bold">Gs. 150.000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fecha: {new Date().toLocaleDateString("es-PY")} {new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>Boca: 012</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[9.5px]">
                      <div className="font-bold">DATOS DEL PARTICIPANTE:</div>
                      <div>CLIENTE:  PEDRO RAMIREZ GONZALEZ</div>
                      <div>DOC / CI: 3.657.834       TEL: +595 981 123456</div>
                      <div>BARRIO:   San Gerardo</div>
                      <div>CIUDAD:   Pedro Juan Caballero</div>
                    </div>

                    <div className="border-t border-dashed border-black pt-1 text-center space-y-0.5">
                      <div className="font-black text-[9.5px]">
                        {campanaEditando.ticket_pie_urna?.trim() || "¡Deposita este cupon en la urna de la sucursal!"}
                      </div>
                      <div className="text-[8.5px] text-slate-700">Valido para los sorteos de la campana</div>
                    </div>
                  </div>

                  {/* Borde dentado inferior */}
                  <div 
                    className="h-2 w-full bg-[#FAFAF7]" 
                    style={{
                      clipPath: "polygon(0% 0%, 3% 100%, 6% 0%, 9% 100%, 12% 0%, 15% 100%, 18% 0%, 21% 100%, 24% 0%, 27% 100%, 30% 0%, 33% 100%, 36% 0%, 39% 100%, 42% 0%, 45% 100%, 48% 0%, 51% 100%, 54% 0%, 57% 100%, 60% 0%, 63% 100%, 66% 0%, 69% 100%, 72% 0%, 75% 100%, 78% 0%, 81% 100%, 84% 0%, 87% 100%, 90% 0%, 93% 100%, 96% 0%, 100% 100%)"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowCampanaModal(false)}
                className="btn-outline text-xs px-5 py-2.5 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleGuardarCampana}
                disabled={savingCampana}
                className="btn-primary text-xs px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25 cursor-pointer"
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
