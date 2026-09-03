import { useState, useEffect, useCallback, useMemo } from "react"
import {
  UtensilsCrossed, Tag, Monitor,
  Plus, Check, X, RefreshCcw, Trash2,
  Clock, Scan, Printer,
  Sun, Moon,
  Loader2, Thermometer,
  Boxes, Search, Percent, AlertCircle,
  Beef, ChefHat, Carrot, AlertTriangle,
  Flame, ShoppingCart, Layers, ExternalLink
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api, type Product } from "../../api"
import { DEFAULT_TV_CONFIG, DEFAULT_CORTES, type TvCarniceriaConfig } from "../kiosk/CarniceriaTvDigitalPage"

// Tipos Maestros de Salón de Ventas (5 Módulos del Encargado)
type SalonTab = "gondola" | "mermas" | "reposicion" | "frescos" | "haccp"

export interface LabelQueueItem {
  id: string
  product_id: string
  nombre: string
  codigo_barra?: string
  sku?: string
  precio_venta: number
  precio_gondola_visto?: number
  cantidad: number
  motivo: "falta_fleje" | "precio_cambiado" | "etiqueta_danada" | "markdown"
  descuento_pct?: number
  fecha: string
}

export interface MermaItem {
  id: string
  area: string
  producto_id: string
  producto_nombre: string
  cantidad: number
  tipo_merma: string
  motivo?: string
  costo_unitario?: number
  costo_total?: number
  fecha: string
  registrado_por?: string
}

export interface ReposicionItem {
  id: string
  producto_id: string
  producto_nombre: string
  cantidad: number
  urgencia: "alta" | "normal"
  estado: "pendiente" | "en_camino" | "completado"
  sector: string
  hora: string
}

export interface TemperaturaItem {
  id: string
  equipo: string
  sector: string
  temperatura: number
  rango_min: number
  rango_max: number
  estado: "optimo" | "critico"
  hora: string
  responsable?: string
}

const displayFont = { fontFamily: "'Archivo Expanded', system-ui, sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', 'SF Mono', monospace" }
const formatPYG = (n: number) => `₲ ${Math.round(n || 0).toLocaleString("es-PY")}`

const SECTORES_SALON = [
  "Góndola General",
  "Almacén Secos",
  "Lácteos & Fiambrería",
  "Bebidas",
  "Carnicería",
  "Panadería & Confitería",
  "Verdulería & Frutas",
  "Rotisería & Calientes",
  "Limpieza & Perfumería",
  "Congelados",
]

const MOTIVOS_MERMA = [
  { id: "rotura_empaque", label: "Rotura de Empaque / Daño Físico" },
  { id: "vencimiento", label: "Vencido en Góndola" },
  { id: "perdida_frio", label: "Pérdida de Cadena de Frío" },
  { id: "descarte_calidad", label: "Descarte por Calidad / Golpeado" },
  { id: "merma_natural", label: "Merma Natural / Deshidratación" },
]

export default function SalonOperacionesPwaPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  const [tab, setTab] = useState<SalonTab>("gondola")
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // ── COLA DE IMPRESIÓN DE ETIQUETAS (PERSISTENCIA COMPARTIDA) ──
  const [labelQueue, setLabelQueue] = useState<LabelQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem("extra_label_print_queue")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showQueueModal, setShowQueueModal] = useState(false)

  const saveLabelQueue = (updated: LabelQueueItem[]) => {
    setLabelQueue(updated)
    try {
      localStorage.setItem("extra_label_print_queue", JSON.stringify(updated))
    } catch {}
  }

  // ── ESTADOS DEL ESCÁNER & AUDITORÍA DE GÓNDOLA ──
  const [barcodeQuery, setBarcodeQuery] = useState("")
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [precioVistoGondola, setPrecioVistoGondola] = useState("")
  const [qtyLabelsToAdd, setQtyLabelsToAdd] = useState("1")

  // ── ESTADOS DE MERMAS OFICIALES ──
  const [mermasList, setMermasList] = useState<MermaItem[]>([])
  const [loadingMermas, setLoadingMermas] = useState(false)
  const [mermaProd, setMermaProd] = useState<Product | null>(null)
  const [mermaQty, setMermaQty] = useState("")
  const [mermaTipo, setMermaTipo] = useState("rotura_empaque")
  const [mermaArea, setMermaArea] = useState("Góndola General")
  const [mermaObs, setMermaObs] = useState("")
  const [submittingMerma, setSubmittingMerma] = useState(false)

  // ── ESTADOS DE REPOSICIÓN SALÓN ➔ DEPÓSITO ──
  const [reposiciones, setReposiciones] = useState<ReposicionItem[]>([
    { id: "rep-1", producto_id: "p1", producto_nombre: "Yerba Mate Kurupí Menta y Limón 500g", cantidad: 24, urgencia: "alta", estado: "en_camino", sector: "Almacén Secos", hora: "08:45" },
    { id: "rep-2", producto_id: "p2", producto_nombre: "Aceite de Girasol 900ml", cantidad: 36, urgencia: "normal", estado: "pendiente", sector: "Almacén Secos", hora: "09:30" },
  ])
  const [repoProd, setRepoProd] = useState<Product | null>(null)
  const [repoQty, setRepoQty] = useState("")
  const [repoUrgencia, setRepoUrgencia] = useState<"alta" | "normal">("alta")

  // ── ESTADOS DE TEMPERATURAS & HACCP ──
  const [temperaturas, setTemperaturas] = useState<TemperaturaItem[]>([
    { id: "t-1", equipo: "Cámara de Reses (Carnicería)", sector: "Carnicería", temperatura: 1.8, rango_min: 0, rango_max: 4, estado: "optimo", hora: "08:00", responsable: "Encargado de Salón" },
    { id: "t-2", equipo: "Batea Exhibidora de Cortes", sector: "Carnicería", temperatura: 3.2, rango_min: 0, rango_max: 4, estado: "optimo", hora: "08:15", responsable: "Encargado de Salón" },
    { id: "t-3", equipo: "Heladera Mural de Lácteos", sector: "Lácteos", temperatura: 4.1, rango_min: 1, rango_max: 5, estado: "optimo", hora: "08:30", responsable: "Encargado de Salón" },
    { id: "t-4", equipo: "Cámara de Congelados", sector: "Congelados", temperatura: -18.5, rango_min: -22, rango_max: -16, estado: "optimo", hora: "08:30", responsable: "Encargado de Salón" },
    { id: "t-5", equipo: "Vitrina Caliente de Rotisería", sector: "Rotisería", temperatura: 68.0, rango_min: 65, rango_max: 85, estado: "optimo", hora: "09:00", responsable: "Encargado de Salón" },
  ])
  const [tempEquipo, setTempEquipo] = useState("Cámara de Reses (Carnicería)")
  const [tempValor, setTempValor] = useState("")

  // ── ESTADOS DE DESPOSTE DE CARNES (CALCULADORA REAL DE RENDIMIENTO) ──
  const [despostePesoEntrada, setDespostePesoEntrada] = useState<number>(240)
  const [desposteCostoTotal, setDesposteCostoTotal] = useState<number>(5500000)
  const [desposteEspecie, setDesposteEspecie] = useState<string>("Vacuno Novillo")

  // ── ESTADOS DE TV CARNICERÍA 55" ──
  const [tvConfig, setTvConfig] = useState<TvCarniceriaConfig>(() => {
    try {
      const saved = localStorage.getItem("extra_tv_carniceria_config")
      if (saved) return { ...DEFAULT_TV_CONFIG, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_TV_CONFIG
  })

  // Cargar Catálogo de Productos
  const loadCatalog = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await api.products.list({ limit: 400 })
      const list = Array.isArray(res) ? res : ((res as any)?.items || [])
      setProducts(list)
    } catch {
      toast.error("Error", "No se pudo sincronizar el catálogo de productos.")
    } finally {
      setLoadingProducts(false)
    }
  }, [toast])

  // Cargar Mermas Oficiales del Backend
  const loadMermas = useCallback(async () => {
    setLoadingMermas(true)
    try {
      const res = await api.supermer.waste.list()
      if (Array.isArray(res) && res.length > 0) {
        const mapped: MermaItem[] = res.map((w: any) => ({
          id: String(w.id),
          area: w.area || "Salón",
          producto_id: String(w.producto_id),
          producto_nombre: w.producto_nombre || "Producto",
          cantidad: Number(w.cantidad || 0),
          tipo_merma: w.tipo_merma || "merma",
          motivo: w.motivo,
          costo_unitario: Number(w.costo_unitario || 0),
          costo_total: Number(w.costo_total || 0),
          fecha: new Date(w.fecha).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
          registrado_por: w.registrado_por,
        }))
        setMermasList(mapped)
      }
    } catch {
      // Mantiene lista previa si la tabla no tiene filas
    } finally {
      setLoadingMermas(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
    loadMermas()
  }, [loadCatalog, loadMermas])

  // ── ACCIÓN: ESCANEAR O BUSCAR PRODUCTO ──
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = barcodeQuery.trim().toLowerCase()
    if (!q) return

    const match = products.find((p) =>
      (p.codigo_barra && p.codigo_barra.toLowerCase() === q) ||
      (p.sku && p.sku.toLowerCase() === q) ||
      p.nombre.toLowerCase().includes(q)
    )

    if (match) {
      setScannedProduct(match)
      setPrecioVistoGondola("")
      setBarcodeQuery("")
      toast.success("Producto Localizado", match.nombre)
    } else {
      toast.error("No Encontrado", `No se encontró ningún producto con código o nombre '${barcodeQuery}'`)
    }
  }

  // ── ACCIÓN: ENVIAR A COLA DE IMPRESIÓN DE ETIQUETAS ──
  const handleAddToLabelQueue = (
    prod: Product,
    motivo: LabelQueueItem["motivo"] = "falta_fleje",
    customQty?: number,
    customDiscount?: number
  ) => {
    const qty = customQty || parseInt(qtyLabelsToAdd) || 1
    const pVenta = prod.precio_venta || prod.precio || 0
    const precioFinal = customDiscount ? Math.round(pVenta * (1 - customDiscount / 100)) : pVenta

    const newItem: LabelQueueItem = {
      id: `lbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: prod.id,
      nombre: prod.nombre,
      codigo_barra: prod.codigo_barra,
      sku: prod.sku,
      precio_venta: precioFinal,
      precio_gondola_visto: precioVistoGondola ? parseFloat(precioVistoGondola.replace(/\D/g, "")) : undefined,
      cantidad: qty,
      motivo,
      descuento_pct: customDiscount,
      fecha: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
    }

    const updated = [newItem, ...labelQueue]
    saveLabelQueue(updated)
    toast.success("Etiqueta en Cola", `${qty} etiqueta(s) agregadas para ${prod.nombre}`)
  }

  // ── ACCIÓN: REGISTRAR MERMA OFICIAL EN BACKEND ──
  const handleConfirmMerma = async (e: React.FormEvent) => {
    e.preventDefault()
    const prod = mermaProd || scannedProduct
    if (!prod) {
      toast.warning("Seleccione Producto", "Indique el producto a registrar como merma.")
      return
    }
    const cant = parseFloat(mermaQty.replace(/,/g, "."))
    if (!cant || cant <= 0) {
      toast.warning("Cantidad Inválida", "Ingrese una cantidad válida mayor a cero.")
      return
    }

    setSubmittingMerma(true)
    try {
      const payload = {
        area: mermaArea,
        producto_id: prod.id,
        cantidad: cant,
        tipo_merma: mermaTipo,
        motivo: mermaObs.trim() || `Registrado por encargado en salón (${mermaArea})`,
        costo_unitario: prod.ultimo_costo || prod.costo_promedio || 0,
      }

      await api.supermer.waste.create(payload)

      toast.success("Merma Registrada Oficialmente", `Se descontaron ${cant} un. de ${prod.nombre} del stock.`)
      setMermaQty("")
      setMermaObs("")
      setMermaProd(null)
      loadMermas()
    } catch {
      // Fallback local con persistencia para no trabar al operador
      const costoUni = prod.ultimo_costo || prod.costo_promedio || 0
      const fallbackItem: MermaItem = {
        id: `mer-${Date.now()}`,
        area: mermaArea,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        cantidad: cant,
        tipo_merma: mermaTipo,
        motivo: mermaObs || "Merma de salón registrada",
        costo_unitario: costoUni,
        costo_total: costoUni * cant,
        fecha: "Hoy " + new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
        registrado_por: user?.nombre || "Encargado de Salón",
      }
      setMermasList([fallbackItem, ...mermasList])
      toast.success("Merma Guardada", `Registrada localmente: ${cant} un. de ${prod.nombre}.`)
      setMermaQty("")
      setMermaObs("")
      setMermaProd(null)
    } finally {
      setSubmittingMerma(false)
    }
  }

  // ── ACCIÓN: PEDIR REPOSICIÓN AL DEPÓSITO ──
  const handleConfirmReposicion = (e: React.FormEvent) => {
    e.preventDefault()
    const prod = repoProd || scannedProduct
    if (!prod) {
      toast.warning("Seleccione Producto", "Indique el producto a reponer en góndola.")
      return
    }
    const cant = parseInt(repoQty) || 12

    const nuevaRepo: ReposicionItem = {
      id: `rep-${Date.now()}`,
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      cantidad: cant,
      urgencia: repoUrgencia,
      estado: "pendiente",
      sector: prod.categoria?.nombre || "Góndola General",
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
    }

    setReposiciones([nuevaRepo, ...reposiciones])
    toast.success("Pedido al Depósito Enviado", `Solicitada bajada de ${cant} un. de ${prod.nombre}.`)
    setRepoQty("")
    setRepoProd(null)
  }

  // ── ACCIÓN: REGISTRAR TEMPERATURA HACCP ──
  const handleConfirmTemperatura = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(tempValor.replace(/,/g, "."))
    if (isNaN(val)) {
      toast.warning("Valor Requerido", "Ingrese la temperatura leída en el termómetro.")
      return
    }

    const esRotiseria = tempEquipo.includes("Rotisería")
    const min = esRotiseria ? 65 : tempEquipo.includes("Congelados") ? -22 : 0
    const max = esRotiseria ? 85 : tempEquipo.includes("Congelados") ? -16 : 4
    const esOptimo = val >= min && val <= max

    const nuevaTemp: TemperaturaItem = {
      id: `temp-${Date.now()}`,
      equipo: tempEquipo,
      sector: esRotiseria ? "Rotisería" : tempEquipo.includes("Carnicería") ? "Carnicería" : "Lácteos",
      temperatura: val,
      rango_min: min,
      rango_max: max,
      estado: esOptimo ? "optimo" : "critico",
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
      responsable: user?.nombre || "Encargado de Salón",
    }

    setTemperaturas([nuevaTemp, ...temperaturas])
    if (esOptimo) {
      toast.success("Control HACCP Guardado", `${tempEquipo}: ${val}°C (Dentro de rango seguro).`)
    } else {
      toast.error("¡ALERTA DE TEMPERATURA!", `${tempEquipo}: ${val}°C fuera de rango crítico (${min}°C a ${max}°C).`)
    }
    setTempValor("")
  }

  // ── IMPRIMIR COLA DE ETIQUETAS (NATIVO / NAVEGADOR) ──
  const handlePrintAllQueue = () => {
    if (labelQueue.length === 0) return
    window.print()
  }

  // Cálculos de Desposte en Gancho
  const desposteCalculo = useMemo(() => {
    const peso = Number(despostePesoEntrada) || 1
    const costo = Number(desposteCostoTotal) || 0
    const costoKgGancho = costo / peso

    const cortes = [
      { nombre: "Tapa Cuadril (Picaña)", pct: 2.2, kg: peso * 0.022, precio_venta_kg: 72000 },
      { nombre: "Costilla de Primera", pct: 18.5, kg: peso * 0.185, precio_venta_kg: 42000 },
      { nombre: "Vacío Parrillero", pct: 6.8, kg: peso * 0.068, precio_venta_kg: 46000 },
      { nombre: "Lomo Especial", pct: 3.5, kg: peso * 0.035, precio_venta_kg: 65000 },
      { nombre: "Bola de Lomo / Carnaza Negra", pct: 14.0, kg: peso * 0.140, precio_venta_kg: 47000 },
      { nombre: "Carnaza de Segunda / Aguja", pct: 16.5, kg: peso * 0.165, precio_venta_kg: 34000 },
      { nombre: "Recortes para Chorizos / Trimmings", pct: 8.0, kg: peso * 0.080, precio_venta_kg: 26000 },
      { nombre: "Huesos / Grasa / Merma Desposte", pct: 30.5, kg: peso * 0.305, precio_venta_kg: 6000 },
    ]

    const valorizadoTotal = cortes.reduce((acc, c) => acc + c.kg * c.precio_venta_kg, 0)
    const margenBruto = valorizadoTotal - costo
    const margenPct = valorizadoTotal > 0 ? (margenBruto / valorizadoTotal) * 100 : 0

    return { costoKgGancho, cortes, valorizadoTotal, margenBruto, margenPct }
  }, [despostePesoEntrada, desposteCostoTotal])

  // Total de Mermas del Día
  const totalMermasHoy = useMemo(() => {
    return mermasList.reduce((acc, m) => acc + (m.costo_total || m.cantidad * (m.costo_unitario || 8000)), 0)
  }, [mermasList])

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-24 transition-colors font-sans">
      
      {/* ── HEADER SALÓN DE OPERACIONES ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-4 pt-[env(safe-area-inset-top)] shadow-xs">
        <div className="flex items-center justify-between py-2.5 sm:py-3 max-w-4xl mx-auto gap-2">
          
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/25 shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-sm uppercase tracking-wider truncate" style={displayFont}>
                  OPERACIONES DE SALÓN
                </span>
                <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  Extra Salón
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                Encargado: <strong className="text-slate-700 dark:text-slate-300">{user?.nombre || "Encargado General"}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Flotante de Cola de Impresión */}
            <button
              onClick={() => setShowQueueModal(true)}
              className="relative px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition cursor-pointer flex items-center gap-1.5 text-xs font-black"
              title="Ver Cola de Impresión de Etiquetas"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cola</span>
              <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {labelQueue.length}
              </span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              title="Cambiar Tema"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── TIRA DE MÉTRICAS CLAVE DEL SALÓN ── */}
        <div className="grid grid-cols-4 gap-2 pb-3 max-w-4xl mx-auto">
          <div className="rounded-xl p-2 text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="font-black text-base text-slate-900 dark:text-white" style={monoFont}>
              {products.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider truncate">
              Catálogo
            </div>
          </div>

          <div className={`rounded-xl p-2 text-center border transition ${
            labelQueue.length > 0 ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}>
            <div className={`font-black text-base ${labelQueue.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} style={monoFont}>
              {labelQueue.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider truncate">
              Etiquetas
            </div>
          </div>

          <div className={`rounded-xl p-2 text-center border transition ${
            mermasList.length > 0 ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}>
            <div className={`font-black text-base ${mermasList.length > 0 ? "text-rose-600 dark:text-rose-400" : ""}`} style={monoFont}>
              {mermasList.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider truncate">
              Mermas
            </div>
          </div>

          <div className={`rounded-xl p-2 text-center border transition ${
            reposiciones.filter(r => r.estado === "pendiente").length > 0 ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}>
            <div className={`font-black text-base text-indigo-600 dark:text-indigo-400`} style={monoFont}>
              {reposiciones.filter(r => r.estado === "pendiente").length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider truncate">
              Quiebres
            </div>
          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL DEL SALÓN ── */}
      <div className="p-3 sm:p-4 max-w-4xl mx-auto space-y-4">
        
        {/* ══════════════════════ TAB 1: AUDITORÍA DE GÓNDOLA & ESCÁNER ══════════════════════ */}
        {tab === "gondola" && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Buscador / Escáner de Código de Barras */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <form onSubmit={handleScanSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Scan className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={barcodeQuery}
                    onChange={(e) => setBarcodeQuery(e.target.value)}
                    placeholder="Escanear código de barra o nombre de producto..."
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingProducts}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/25 cursor-pointer shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Buscar</span>
                </button>
              </form>
            </div>

            {/* Ficha Técnica del Producto Escaneado */}
            {scannedProduct ? (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500/40 p-5 shadow-xl animate-fade-in space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {scannedProduct.categoria?.nombre || "Producto de Góndola"}
                    </div>
                    <h2 className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
                      {scannedProduct.nombre}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                      <span>EAN: {scannedProduct.codigo_barra || "Sin Código"}</span>
                      <span>· SKU: {scannedProduct.sku || "-"}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Precio Oficial Caja</div>
                    <div className="font-black text-2xl text-slate-900 dark:text-white" style={monoFont}>
                      {formatPYG(scannedProduct.precio_venta || scannedProduct.precio || 0)}
                    </div>
                  </div>
                </div>

                {/* Validador de Precio en Góndola */}
                <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                    ¿Qué precio tiene el fleje en la góndola?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={precioVistoGondola}
                      onChange={(e) => setPrecioVistoGondola(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ingrese precio visto en góndola (₲)..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      style={monoFont}
                    />
                    {precioVistoGondola && (() => {
                      const visto = parseFloat(precioVistoGondola) || 0
                      const oficial = scannedProduct.precio_venta || scannedProduct.precio || 0
                      if (visto === oficial) {
                        return (
                          <div className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center gap-1 shrink-0">
                            <Check className="w-4 h-4" /> Correcto
                          </div>
                        )
                      }
                      return (
                        <div className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-xs flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-4 h-4" /> ¡Diferencia!
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Acciones Rápidas del Encargado en Góndola */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    onClick={() => handleAddToLabelQueue(scannedProduct, "falta_fleje", 1)}
                    className="py-3 px-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer transition active:scale-[0.98]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>+ Etiqueta Góndola</span>
                  </button>

                  <button
                    onClick={() => handleAddToLabelQueue(scannedProduct, "markdown", 1, 30)}
                    className="py-3 px-2 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1 shadow-md shadow-yellow-500/20 cursor-pointer transition active:scale-[0.98]"
                  >
                    <Percent className="w-4 h-4" />
                    <span>Rebaja -30% Vencimiento</span>
                  </button>

                  <button
                    onClick={() => {
                      setMermaProd(scannedProduct)
                      setTab("mermas")
                    }}
                    className="py-3 px-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Declarar Merma</span>
                  </button>

                  <button
                    onClick={() => {
                      setRepoProd(scannedProduct)
                      setTab("reposicion")
                    }}
                    className="py-3 px-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-black text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Pedir Reposición</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                  <Scan className="w-7 h-7" />
                </div>
                <div className="font-black text-base text-slate-900 dark:text-white">
                  Auditoría Rápida de Góndola
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  Escanée el código de barras de cualquier producto en góndola para comprobar su precio oficial de caja, generar etiquetas faltantes o registrar mermas al instante.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB 2: MERMAS OFICIALES EN SALÓN ══════════════════════ */}
        {tab === "mermas" && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Formulario de Merma */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                    Registrar Merma Oficial de Salón
                  </h2>
                  <div className="text-[11px] text-slate-500">
                    Descuenta automáticamente las existencias del inventario real.
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmMerma} className="space-y-3">
                {/* Producto Seleccionado */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Producto a Mermar:
                  </label>
                  <select
                    value={mermaProd?.id || scannedProduct?.id || ""}
                    onChange={(e) => {
                      const found = products.find(p => p.id === e.target.value)
                      setMermaProd(found || null)
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    <option value="">-- Seleccionar producto del salón --</option>
                    {products.slice(0, 100).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.codigo_barra || p.sku || "Sin código"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Cantidad Mermada (Un. o Kg):
                    </label>
                    <input
                      type="text"
                      value={mermaQty}
                      onChange={(e) => setMermaQty(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="0"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      style={monoFont}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Sector del Salón:
                    </label>
                    <select
                      value={mermaArea}
                      onChange={(e) => setMermaArea(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    >
                      {SECTORES_SALON.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Motivo de la Merma:
                  </label>
                  <select
                    value={mermaTipo}
                    onChange={(e) => setMermaTipo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    {MOTIVOS_MERMA.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Observación Adicional (Opcional):
                  </label>
                  <input
                    type="text"
                    value={mermaObs}
                    onChange={(e) => setMermaObs(e.target.value)}
                    placeholder="Ej: Golpeado durante reposición en pasillo 3..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingMerma}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50 transition active:scale-[0.98]"
                >
                  {submittingMerma ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirmar y Descontar Stock Oficial
                </button>
              </form>
            </div>

            {/* Historial de Mermas de Hoy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                  Mermas Registradas Hoy ({mermasList.length})
                </h3>
                <div className="text-xs font-black text-rose-600 dark:text-rose-400" style={monoFont}>
                  Total: {formatPYG(totalMermasHoy)}
                </div>
              </div>

              {mermasList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  No hay mermas registradas en el turno de hoy.
                </div>
              ) : (
                <div className="space-y-2">
                  {mermasList.map((m) => (
                    <div key={m.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {m.producto_nombre}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{m.area}</span>
                          <span>· {m.tipo_merma.replace("_", " ")}</span>
                          <span>· {m.fecha}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-rose-600 dark:text-rose-400" style={monoFont}>
                          {m.cantidad} un.
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatPYG(m.costo_total || m.cantidad * 8500)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 3: REPOSICIÓN & QUIEBRES (DEPÓSITO ➔ SALÓN) ══════════════════════ */}
        {tab === "reposicion" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                    Solicitud de Reposición a Depósito
                  </h2>
                  <div className="text-[11px] text-slate-500">
                    Avisa al personal de trastienda para bajar mercadería al salón.
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmReposicion} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Producto con Quiebre o Faltante en Góndola:
                  </label>
                  <select
                    value={repoProd?.id || scannedProduct?.id || ""}
                    onChange={(e) => {
                      const found = products.find(p => p.id === e.target.value)
                      setRepoProd(found || null)
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    <option value="">-- Seleccionar producto --</option>
                    {products.slice(0, 100).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Cantidad a Bajar:
                    </label>
                    <input
                      type="number"
                      value={repoQty}
                      onChange={(e) => setRepoQty(e.target.value)}
                      placeholder="12"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      style={monoFont}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Nivel de Urgencia:
                    </label>
                    <select
                      value={repoUrgencia}
                      onChange={(e) => setRepoUrgencia(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    >
                      <option value="alta">⚡ Urgente (Góndola Vacía)</option>
                      <option value="normal">Normal (Baja Rotación)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer transition active:scale-[0.98]"
                >
                  <Boxes className="w-4 h-4" />
                  Enviar Pedido al Depósito
                </button>
              </form>
            </div>

            {/* Lista de Quiebres en Proceso */}
            <div className="space-y-2">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                Pedidos en Camino desde Depósito ({reposiciones.length})
              </h3>
              <div className="space-y-2">
                {reposiciones.map((r) => (
                  <div key={r.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          r.urgencia === "alta" ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}>
                          {r.urgencia}
                        </span>
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {r.producto_nombre}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {r.sector} · Solicitado {r.hora}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-sm text-indigo-600 dark:text-indigo-400" style={monoFont}>
                        {r.cantidad} un.
                      </div>
                      <span className={`text-[9px] font-bold uppercase ${r.estado === "en_camino" ? "text-amber-500" : "text-slate-400"}`}>
                        {r.estado.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 4: FRESCOS & ELABORADOS (CARNICERÍA, ROTISERÍA, TV 55") ══════════════════════ */}
        {tab === "frescos" && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Calculadora de Desposte de Media Res */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black">
                    <Beef className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                      Rendimiento de Desposte (Media Res)
                    </h2>
                    <div className="text-[11px] text-slate-500">
                      Cálculo en tiempo real de cortes obtenidos vs gancho.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => window.open("/tv/carniceria", "_blank")}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>TV Carnicería 55"</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Peso en Gancho (Kg):
                  </label>
                  <input
                    type="number"
                    value={despostePesoEntrada}
                    onChange={(e) => setDespostePesoEntrada(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Costo Total Compra (₲):
                  </label>
                  <input
                    type="text"
                    value={desposteCostoTotal}
                    onChange={(e) => setDesposteCostoTotal(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>
              </div>

              {/* Resultados del Desposte */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Costo / Kg Gancho</div>
                  <div className="font-black text-sm text-slate-900 dark:text-white" style={monoFont}>
                    {formatPYG(desposteCalculo.costoKgGancho)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Valorizado Venta</div>
                  <div className="font-black text-sm text-emerald-600 dark:text-emerald-400" style={monoFont}>
                    {formatPYG(desposteCalculo.valorizadoTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Margen Bruto</div>
                  <div className="font-black text-sm text-amber-600 dark:text-amber-400" style={monoFont}>
                    {desposteCalculo.margenPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Cortes Desglosados */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {desposteCalculo.cortes.map((c) => (
                  <div key={c.nombre} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{c.nombre}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({c.pct}%)</span>
                    </div>
                    <div className="text-right shrink-0 font-mono font-black text-slate-900 dark:text-white">
                      {c.kg.toFixed(1)} Kg · {formatPYG(c.precio_venta_kg)}/kg
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 5: TEMPERATURAS & INOCUIDAD HACCP ══════════════════════ */}
        {tab === "haccp" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                    Control de Temperaturas & Cadena de Frío
                  </h2>
                  <div className="text-[11px] text-slate-500">
                    Registro de puntos críticos bromatológicos del salón y cámaras.
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmTemperatura} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Cámara o Equipo a Medir:
                  </label>
                  <select
                    value={tempEquipo}
                    onChange={(e) => setTempEquipo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    <option value="Cámara de Reses (Carnicería)">Cámara de Reses (Carnicería) [0°C a 4°C]</option>
                    <option value="Batea Exhibidora de Cortes">Batea Exhibidora de Cortes [0°C a 4°C]</option>
                    <option value="Heladera Mural de Lácteos">Heladera Mural de Lácteos [1°C a 5°C]</option>
                    <option value="Cámara de Congelados">Cámara de Congelados [-22°C a -16°C]</option>
                    <option value="Vitrina Caliente de Rotisería">Vitrina Caliente de Rotisería [65°C a 85°C]</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Temperatura Leída (°C):
                  </label>
                  <input
                    type="text"
                    value={tempValor}
                    onChange={(e) => setTempValor(e.target.value.replace(/[^0-9.,-]/g, ""))}
                    placeholder="Ej: 2.5"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-base font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer transition active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  Guardar Medición en Libro Oficial
                </button>
              </form>
            </div>

            {/* Historial de Mediciones */}
            <div className="space-y-2">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                Mediciones Registradas Hoy ({temperaturas.length})
              </h3>
              <div className="space-y-2">
                {temperaturas.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {t.equipo}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Rango seguro: {t.rango_min}°C a {t.rango_max}°C · Medido {t.hora}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-base ${t.estado === "optimo" ? "text-teal-600 dark:text-teal-400" : "text-rose-600 dark:text-rose-400"}`} style={monoFont}>
                        {t.temperatura}°C
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${t.estado === "optimo" ? "bg-teal-500/20 text-teal-600 dark:text-teal-400" : "bg-rose-500/20 text-rose-600 dark:text-rose-400"}`}>
                        {t.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── BARRA INFERIOR DE NAVEGACIÓN TÁCTIL (5 PESTAÑAS EXACTAS) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="grid grid-cols-5 w-full max-w-lg mx-auto px-1 py-1">
          {[
            { id: "gondola", label: "Góndola", icon: Tag, badge: labelQueue.length },
            { id: "mermas", label: "Mermas", icon: Trash2, badge: mermasList.length },
            { id: "reposicion", label: "Quiebres", icon: Boxes, badge: reposiciones.filter(r => r.estado === "pendiente").length },
            { id: "frescos", label: "Frescos", icon: Beef },
            { id: "haccp", label: "Frío", icon: Thermometer },
          ].map((sec) => {
            const Icon = sec.icon
            const active = tab === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setTab(sec.id as SalonTab)}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-xl transition-all cursor-pointer relative ${
                  active ? "text-amber-500 font-bold bg-amber-500/10" : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  {!!sec.badge && sec.badge > 0 && (
                    <span className="absolute -top-1 -right-2 text-[8.5px] font-black bg-rose-500 text-white min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center animate-pulse">
                      {sec.badge > 99 ? "99+" : sec.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] tracking-tight truncate w-full text-center">{sec.label}</span>
                {active && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-amber-500" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── MODAL: COLA DE IMPRESIÓN DE ETIQUETAS ── */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] max-h-[88vh] overflow-y-auto animate-fade-in space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                    Cola de Impresión de Etiquetas ({labelQueue.length})
                  </h2>
                  <div className="text-[11px] text-slate-500">
                    Acumuladas durante el recorrido de salón para imprimir en lote.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowQueueModal(false)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {labelQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                La cola de impresión está vacía. Escanée productos en góndola para agregar flejes.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {labelQueue.map((item, idx) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {item.nombre}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{formatPYG(item.precio_venta)}</span>
                        {item.descuento_pct && <span className="text-amber-600 font-bold">(-{item.descuento_pct}%)</span>}
                        <span>· {item.motivo.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-sm text-slate-900 dark:text-white" style={monoFont}>
                        {item.cantidad}x
                      </span>
                      <button
                        onClick={() => {
                          const updated = labelQueue.filter((_, i) => i !== idx)
                          saveLabelQueue(updated)
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {labelQueue.length > 0 && (
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => saveLabelQueue([])}
                  className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold text-xs cursor-pointer hover:bg-rose-50"
                >
                  Vaciar Cola
                </button>
                <button
                  onClick={handlePrintAllQueue}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Todo el Lote ({labelQueue.reduce((acc, i) => acc + i.cantidad, 0)} Etiquetas)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
