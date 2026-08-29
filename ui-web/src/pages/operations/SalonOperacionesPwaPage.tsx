import { useState, useEffect, useCallback, useRef } from "react"
import {
  Beef, UtensilsCrossed, Carrot, ChefHat, Tag, Monitor, ShieldCheck,
  Plus, Check, X, AlertTriangle, RefreshCcw, Camera, Upload, Trash2,
  TrendingDown, ArrowRight, Sparkles, Flame, Clock, Award, Scan, Printer,
  Layers, Package, CheckCircle2, ChevronRight, Sun, Moon, LogOut, ArrowUpRight,
  DollarSign, FileText, ShoppingBag, Eye, EyeOff, Loader2
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api, type Product, type KioskBanner } from "../../api"
import { DEFAULT_TV_CONFIG, DEFAULT_CORTES, type TvCarniceriaConfig, type MeatProduct } from "../kiosk/CarniceriaTvDigitalPage"

// Tipos del Hub de Operaciones
type SectorTab = "carniceria" | "panaderia" | "verduleria" | "auditoria_precios" | "marketing_tv" | "haccp"

interface ElaboracionReceta {
  id: string
  nombre: string
  categoria: string
  rendimiento_pct: number
  ingredientes_base: string
  precio_sugerido_kg: number
}

interface LoteElaborado {
  id: string
  receta_nombre: string
  kg_carne_trimmings: number
  kg_tocino_grasa: number
  kg_producidos: number
  costo_kg: number
  fecha: string
  responsable: string
}

interface TransformacionPanaderia {
  id: string
  origen_nombre: string
  destino_nombre: string
  kg_sobrante: number
  kg_obtenidos: number
  fecha: string
  responsable: string
  estado: "completado" | "pendiente"
}

interface AuditoriaFrescura {
  id: string
  sector: string
  producto: string
  calidad: "excelente" | "bueno" | "maduro_oferta" | "descarte"
  dias_exhibicion: number
  foto_url?: string
  observacion: string
  fecha: string
}

const RECETAS_CARNICERIA: ElaboracionReceta[] = [
  { id: "rec-1", nombre: "Chorizo Casero Parrillero Extra", categoria: "Chorizo", rendimiento_pct: 98, ingredientes_base: "70% Recortes Novillo, 30% Tocino de Cerdo, Ajo, Pimentón, Sal", precio_sugerido_kg: 29000 },
  { id: "rec-2", nombre: "Chorizo Toscano Puro Cerdo", categoria: "Chorizo", rendimiento_pct: 97, ingredientes_base: "80% Paleta Cerdo, 20% Grasa Cerdo, Vino Blanco, Finas Hierbas", precio_sugerido_kg: 36000 },
  { id: "rec-3", nombre: "Morcilla Tradicional con Verdeo", categoria: "Embutido", rendimiento_pct: 95, ingredientes_base: "Sangre vacuna, cebollita de hoja, nuez moscada, orégano", precio_sugerido_kg: 25000 },
  { id: "rec-4", nombre: "Hamburguesas Artesanales 100% Picaña", categoria: "Hamburguesa", rendimiento_pct: 99, ingredientes_base: "Tapa cuadril molida con 15% grasa natural, sal marina", precio_sugerido_kg: 38000 },
  { id: "rec-5", nombre: "Milanesas de Bola de Lomo Empanadas", categoria: "Rebozados", rendimiento_pct: 125, ingredientes_base: "Carne vacuna de primera, huevo pasteurizado, pan rallado propio, perejil", precio_sugerido_kg: 37000 },
]

const SUGERENCIAS_TRANSFORMACION_PAN = [
  { origen: "Pan Francés / Baguette (Día anterior)", destino: "Pan Rallado Fino Extra (Bolsa 1Kg)", ratio: 0.95, precio_sugerido: 12000 },
  { origen: "Pan Francés / Baguette (Día anterior)", destino: "Tostadas Horneadas con Orégano y Ajo", ratio: 0.90, precio_sugerido: 15000 },
  { origen: "Facturas / Medialunas (Sobrante de turno)", destino: "Budín de Pan Artesanal con Caramelo", ratio: 1.20, precio_sugerido: 18000 },
  { origen: "Bizcochuelo / Recortes de Torta", destino: "Postres en Vaso / Cake Pops Decorados", ratio: 1.10, precio_sugerido: 14000 },
]

const displayFont = { fontFamily: "'Archivo Expanded', system-ui, sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', 'SF Mono', monospace" }
const formatPYG = (n: number) => `₲ ${Math.round(n || 0).toLocaleString("es-PY")}`

export default function SalonOperacionesPwaPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  const [tab, setTab] = useState<SectorTab>("carniceria")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // ── ESTADOS DE CARNICERÍA & ELABORADOS ──
  const [lotesCarne, setLotesCarne] = useState<LoteElaborado[]>([
    { id: "lot-101", receta_nombre: "Chorizo Casero Parrillero Extra", kg_carne_trimmings: 25, kg_tocino_grasa: 10, kg_producidos: 34.5, costo_kg: 18500, fecha: "Hoy 08:30", responsable: "Marcos Centurión" },
    { id: "lot-102", receta_nombre: "Hamburguesas Artesanales 100% Picaña", kg_carne_trimmings: 15, kg_tocino_grasa: 0, kg_producidos: 14.8, costo_kg: 28000, fecha: "Hoy 10:15", responsable: "Marcos Centurión" },
  ])
  const [selectedReceta, setSelectedReceta] = useState<ElaboracionReceta>(RECETAS_CARNICERIA[0])
  const [formKgCarne, setFormKgCarne] = useState("")
  const [formKgGrasa, setFormKgGrasa] = useState("")
  const [submittingLote, setSubmittingLote] = useState(false)

  // ── ESTADOS DE PANADERÍA & TRANSFORMACIONES ──
  const [transformaciones, setTransformaciones] = useState<TransformacionPanaderia[]>([
    { id: "tr-201", origen_nombre: "Pan Francés (Día anterior)", destino_nombre: "Pan Rallado Fino Extra", kg_sobrante: 18, kg_obtenidos: 17.1, fecha: "Hoy 07:00", responsable: "Rosa Benítez", estado: "completado" },
    { id: "tr-202", origen_nombre: "Medialunas (Sobrante ayer)", destino_nombre: "Budín de Pan Artesanal", kg_sobrante: 6, kg_obtenidos: 7.2, fecha: "Hoy 07:30", responsable: "Rosa Benítez", estado: "completado" },
  ])
  const [selectedSugTransform, setSelectedSugTransform] = useState(SUGERENCIAS_TRANSFORMACION_PAN[0])
  const [formKgSobrantePan, setFormKgSobrantePan] = useState("")
  const [submittingTransform, setSubmittingTransform] = useState(false)

  // ── ESTADOS DE VERDULERÍA & AUDITORÍA DE FRESCURA ──
  const [auditoriasFrescura, setAuditoriasFrescura] = useState<AuditoriaFrescura[]>([
    { id: "aud-1", sector: "Frutas", producto: "Tomate Santa Cruz", calidad: "bueno", dias_exhibicion: 2, observacion: "Bateas con buena firmeza y rotación normal.", fecha: "Hoy 09:00" },
    { id: "aud-2", sector: "Verduras", producto: "Banana Nanica", calidad: "maduro_oferta", dias_exhibicion: 4, observacion: "Punto óptimo de maduración. Se aplicó -30% para liquidación rápida.", fecha: "Hoy 09:15" },
  ])
  const [formFrescuraProd, setFormFrescuraProd] = useState("")
  const [formFrescuraCalidad, setFormFrescuraCalidad] = useState<"excelente" | "bueno" | "maduro_oferta" | "descarte">("bueno")
  const [formFrescuraObs, setFormFrescuraObs] = useState("")
  const [formFrescuraFoto, setFormFrescuraFoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── ESTADOS DE AUDITORÍA DE PRECIOS EN GÓNDOLA (ESCANER) ──
  const [scannerCode, setScannerCode] = useState("")
  const [scannedItem, setScannedItem] = useState<{ product: Product; precio_gondola?: number } | null>(null)
  const [priceGondolaInput, setPriceGondolaInput] = useState("")
  const [printingTag, setPrintingTag] = useState(false)

  // ── ESTADOS DE CONFIGURADOR DE TV 55" ──
  const [tvConfig, setTvConfig] = useState<TvCarniceriaConfig>(() => {
    try {
      const saved = localStorage.getItem("extra_tv_carniceria_config")
      if (saved) return { ...DEFAULT_TV_CONFIG, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_TV_CONFIG
  })

  const saveTvConfig = (updated: TvCarniceriaConfig) => {
    setTvConfig(updated)
    localStorage.setItem("extra_tv_carniceria_config", JSON.stringify(updated))
    toast.success("Configuración de TV Guardada", "Los cambios se aplicaron en vivo a las pantallas.")
  }

  const toggleProductoTvVisible = (prodId: string) => {
    const current = tvConfig.productos_visibles_ids || []
    const updatedIds = current.includes(prodId)
      ? current.filter((id) => id !== prodId)
      : [...current, prodId]
    saveTvConfig({ ...tvConfig, productos_visibles_ids: updatedIds })
  }

  const [tvSearchQuery, setTvSearchQuery] = useState("")

  const filteredCatalogProducts = useMemo(() => {
    if (!tvSearchQuery.trim()) return []
    const q = tvSearchQuery.toLowerCase()
    return products.filter((p) =>
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo_barra && p.codigo_barra.includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [products, tvSearchQuery])

  const handleAddCatalogProductToTv = (p: Product) => {
    const newMeat: MeatProduct = {
      id: p.id,
      nombre: p.nombre,
      categoria: "otros",
      precio: p.precio_venta || p.precio || 0,
      stock_kg: p.stock || 10,
      foto_url: p.imagen_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
      etiqueta: "OFERTA",
      origen: "Extra Supermercado",
      destacado: false,
      sku: p.sku
    }

    const currentCustom = tvConfig.custom_products || []
    const updatedCustom = currentCustom.some((c) => c.id === p.id)
      ? currentCustom
      : [...currentCustom, newMeat]

    const currentIds = tvConfig.productos_visibles_ids || []
    const updatedIds = currentIds.includes(p.id) ? currentIds : [...currentIds, p.id]

    saveTvConfig({
      ...tvConfig,
      custom_products: updatedCustom,
      productos_visibles_ids: updatedIds
    })
    toast.success("Producto Añadido a la TV", `${p.nombre} con precio del sistema ${formatPYG(p.precio_venta || p.precio || 0)}`)
    setTvSearchQuery("")
  }

  // Cargar productos para auditorías y carnicería
  useEffect(() => {
    setLoading(true)
    api.products.list({ limit: 300 })
      .then((res) => setProducts(Array.isArray(res) ? res : ((res as any)?.items || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Guardar Lote de Elaborados en Carnicería
  const handleCreateLoteCarne = (e: React.FormEvent) => {
    e.preventDefault()
    const carne = parseFloat(formKgCarne.replace(/,/g, ".")) || 0
    const grasa = parseFloat(formKgGrasa.replace(/,/g, ".")) || 0
    if (carne <= 0) {
      toast.warning("Datos requeridos", "Ingrese los Kilos de carne / recortes usados.")
      return
    }

    setSubmittingLote(true)
    setTimeout(() => {
      const kgTotal = (carne + grasa) * (selectedReceta.rendimiento_pct / 100)
      const nuevoLote: LoteElaborado = {
        id: `lot-${Date.now().toString().slice(-4)}`,
        receta_nombre: selectedReceta.nombre,
        kg_carne_trimmings: carne,
        kg_tocino_grasa: grasa,
        kg_producidos: Math.round(kgTotal * 10) / 10,
        costo_kg: Math.round((carne * 22000 + grasa * 12000) / (kgTotal || 1)),
        fecha: "Hoy " + new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
        responsable: user?.nombre || "Encargado de Carnicería"
      }
      setLotesCarne([nuevoLote, ...lotesCarne])
      toast.success("Producción Registrada", `Se ingresaron ${nuevoLote.kg_producidos} Kg de ${selectedReceta.nombre} al stock de mostrador.`)
      setFormKgCarne("")
      setFormKgGrasa("")
      setSubmittingLote(false)
    }, 600)
  }

  // Guardar Transformación Circular en Panadería
  const handleCreateTransformacion = (e: React.FormEvent) => {
    e.preventDefault()
    const sobrante = parseFloat(formKgSobrantePan.replace(/,/g, ".")) || 0
    if (sobrante <= 0) {
      toast.warning("Datos requeridos", "Ingrese los Kilos de producto sobrante.")
      return
    }

    setSubmittingTransform(true)
    setTimeout(() => {
      const obtenidos = Math.round(sobrante * selectedSugTransform.ratio * 10) / 10
      const nuevaTr: TransformacionPanaderia = {
        id: `tr-${Date.now().toString().slice(-4)}`,
        origen_nombre: selectedSugTransform.origen,
        destino_nombre: selectedSugTransform.destino,
        kg_sobrante: sobrante,
        kg_obtenidos: obtenidos,
        fecha: "Hoy " + new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
        responsable: user?.nombre || "Maestro Panadero",
        estado: "completado"
      }
      setTransformaciones([nuevaTr, ...transformaciones])
      toast.success("Transformación Exitosa", `Se convirtieron ${sobrante} Kg de sobrante en ${obtenidos} Kg de ${selectedSugTransform.destino}.`)
      setFormKgSobrantePan("")
      setSubmittingTransform(false)
    }, 600)
  }

  // Registrar Auditoría de Frescura con Foto
  const handleCreateAuditoriaFrescura = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formFrescuraProd.trim()) {
      toast.warning("Producto requerido", "Ingrese o seleccione el producto auditado.")
      return
    }

    const nuevaAud: AuditoriaFrescura = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      sector: "Verdulería & Hortifruti",
      producto: formFrescuraProd.trim(),
      calidad: formFrescuraCalidad,
      dias_exhibicion: 2,
      foto_url: formFrescuraFoto || undefined,
      observacion: formFrescuraObs.trim() || "Auditoría de calidad rutinaria en salón.",
      fecha: "Hoy " + new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }
    setAuditoriasFrescura([nuevaAud, ...auditoriasFrescura])
    toast.success("Auditoría Registrada", `Control de frescura guardado para ${nuevaAud.producto}.`)
    setFormFrescuraProd("")
    setFormFrescuraObs("")
    setFormFrescuraFoto(null)
  }

  // Simular captura de foto
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setFormFrescuraFoto(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  // Buscar Producto para Auditoría de Góndola
  const handleScanLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scannerCode.trim()
    if (!code) return
    const match = products.find((p) => (p.codigo_barra && p.codigo_barra.includes(code)) || p.nombre.toLowerCase().includes(code.toLowerCase()))
    if (match) {
      const pUnit = match.precio_venta || match.precio || 0
      setScannedItem({ product: match, precio_gondola: pUnit })
      setPriceGondolaInput(String(pUnit))
      toast.success("Producto Encontrado", match.nombre)
    } else {
      toast.error("No encontrado", `No se halló ningún producto con código ${code}`)
    }
  }

  const handlePrintPriceTag = () => {
    if (!scannedItem) return
    setPrintingTag(true)
    setTimeout(() => {
      toast.success("Etiqueta Enviada", `Se mandó a imprimir la etiqueta de góndola para ${scannedItem.product.nombre}`)
      setPrintingTag(false)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-24 transition-colors font-sans select-none">
      
      {/* ── HEADER SALÓN DE VENTAS (OPTIMIZADO TABLET & MÓVIL) ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/25 shrink-0">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                  OPERACIONES DE SALÓN
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                  PWA Activa
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Extra Supermercado · Control de Perecederos, Producción & Góndola
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open("/tv/carniceria", "_blank")}
              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer transition"
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">Ver TV Carnicería 55"</span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── BARRA DE SECTORES / TABS TÁCTILES RÁPIDAS ── */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 max-w-6xl mx-auto scrollbar-none">
          {[
            { id: "carniceria", label: "Carnicería & Elaborados", icon: Beef, color: "text-red-500" },
            { id: "panaderia", label: "Panadería & Sobrantes", icon: ChefHat, color: "text-amber-500" },
            { id: "verduleria", label: "Verdulería & Calidad", icon: Carrot, color: "text-emerald-500" },
            { id: "auditoria_precios", label: "Auditoría Góndola", icon: Tag, color: "text-blue-500" },
            { id: "marketing_tv", label: "Marketing & TV 55\"", icon: Monitor, color: "text-purple-500" },
            { id: "haccp", label: "Inocuidad & HACCP", icon: ShieldCheck, color: "text-teal-500" },
          ].map((sec) => {
            const Icon = sec.icon
            const active = tab === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setTab(sec.id as SectorTab)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md scale-[1.02]"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-amber-500"
                }`}
              >
                <Icon className={`w-4 h-4 ${sec.color}`} />
                <span>{sec.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL POR SECTOR ── */}
      <div className="p-4 max-w-6xl mx-auto space-y-6">
        
        {/* ══════════════════════ SECTOR 1: CARNICERÍA & ELABORADOS ══════════════════════ */}
        {tab === "carniceria" && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner Informativo y Accesos Rápidos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-gradient-to-tr from-red-600 to-amber-600 text-white shadow-xl shadow-red-600/20">
                <div className="text-[10px] font-black uppercase tracking-widest text-red-100 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" /> Producción de Elaborados Hoy
                </div>
                <div className="font-black text-3xl mt-1 mb-2" style={monoFont}>
                  {lotesCarne.reduce((acc, l) => acc + l.kg_producidos, 0).toFixed(1)} Kg
                </div>
                <div className="text-xs text-red-100">
                  {lotesCarne.length} lotes elaborados listos para mostrador
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cámara Frigorífica 01
                </div>
                <div className="font-black text-2xl mt-1 text-emerald-600 dark:text-emerald-400 flex items-center gap-2" style={monoFont}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> 1.8 °C
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Rango óptimo (0°C a 4°C) · Sensor OK
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cartelería TV 55"
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                    2 Pantallas en Vivo
                  </div>
                </div>
                <button
                  onClick={() => setTab("marketing_tv")}
                  className="mt-2 text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  Gestionar Cortes en TV ➔
                </button>
              </div>
            </div>

            {/* Módulo de Elaboración de Chorizos & Derivados */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario de Elaboración */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
                    <Beef className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Nueva Tanda de Elaborados
                    </h2>
                    <p className="text-xs text-slate-500">Chorizos, hamburguesas y milanesas caseras</p>
                  </div>
                </div>

                <form onSubmit={handleCreateLoteCarne} className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Receta de Elaboración:
                    </label>
                    <select
                      value={selectedReceta.id}
                      onChange={(e) => setSelectedReceta(RECETAS_CARNICERIA.find((r) => r.id === e.target.value) || RECETAS_CARNICERIA[0])}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-red-500"
                    >
                      {RECETAS_CARNICERIA.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre} (Rend. {r.rendimiento_pct}%)</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">Base: </span>{selectedReceta.ingredientes_base}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Kg Carne / Trimmings:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 20"
                        value={formKgCarne}
                        onChange={(e) => setFormKgCarne(e.target.value.replace(/[^0-9.,]/g, ""))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-red-500"
                        style={monoFont}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Kg Tocino / Grasa:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 5"
                        value={formKgGrasa}
                        onChange={(e) => setFormKgGrasa(e.target.value.replace(/[^0-9.,]/g, ""))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-red-500"
                        style={monoFont}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLote}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer disabled:opacity-50 transition"
                  >
                    {submittingLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Registrar Lote & Sumar a Stock
                  </button>
                </form>
              </div>

              {/* Historial de Lotes Producidos */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Lotes Elaborados del Día ({lotesCarne.length})
                </h2>

                <div className="space-y-2.5">
                  {lotesCarne.map((l) => (
                    <div
                      key={l.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {l.receta_nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {l.fecha} · {l.responsable} · {l.kg_carne_trimmings}Kg carne + {l.kg_tocino_grasa}Kg grasa
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-base text-emerald-600 dark:text-emerald-400" style={monoFont}>
                          +{l.kg_producidos} Kg
                        </div>
                        <div className="text-[10px] text-slate-400" style={monoFont}>
                          Costo: {formatPYG(l.costo_kg)}/Kg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 2: PANADERÍA & SOBRANTES (ZERO WASTE) ══════════════════════ */}
        {tab === "panaderia" && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner de Economía Circular */}
            <div className="p-5 rounded-3xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 shadow-xl shadow-amber-500/20 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Economía Circular Zero Waste
                </div>
                <h2 className="font-black text-2xl mt-1 text-slate-950" style={displayFont}>
                  Transformación de Sobrantes
                </h2>
                <p className="text-xs text-amber-950 font-medium max-w-lg mt-0.5">
                  Convertí el pan del día anterior y facturas no vendidas en pan rallado, tostadas saborizadas y budines artesanales para evitar mermas y generar margen neto.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-amber-950">Aprovechamiento</div>
                <div className="font-black text-3xl" style={monoFont}>96.4%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulario de Transformación */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Registrar Transformación
                    </h3>
                    <p className="text-xs text-slate-500">Baja del sobrante y alta del nuevo producto</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTransformacion} className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Tipo de Transformación Sugerida:
                    </label>
                    <select
                      value={selectedSugTransform.destino}
                      onChange={(e) => setSelectedSugTransform(SUGERENCIAS_TRANSFORMACION_PAN.find((s) => s.destino === e.target.value) || SUGERENCIAS_TRANSFORMACION_PAN[0])}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    >
                      {SUGERENCIAS_TRANSFORMACION_PAN.map((s) => (
                        <option key={s.destino} value={s.destino}>{s.origen} ➔ {s.destino}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Kilos de Sobrante Ingresados:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 15"
                      value={formKgSobrantePan}
                      onChange={(e) => setFormKgSobrantePan(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      style={monoFont}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTransform}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50 transition"
                  >
                    {submittingTransform ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Confirmar Transformación & Alta
                  </button>
                </form>
              </div>

              {/* Registro de Transformaciones Realizadas */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Transformaciones Realizadas ({transformaciones.length})
                </h3>

                <div className="space-y-2.5">
                  {transformaciones.map((tr) => (
                    <div
                      key={tr.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {tr.destino_nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Desde: {tr.origen_nombre} · {tr.fecha} · {tr.responsable}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-amber-600 dark:text-amber-400" style={monoFont}>
                          {tr.kg_obtenidos} Kg
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          ✓ Envasado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 3: VERDULERÍA & CALIDAD FRESCOS ══════════════════════ */}
        {tab === "verduleria" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario de Auditoría de Frescura con Cámara */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Carrot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Auditoría Visual de Frescura
                    </h3>
                    <p className="text-xs text-slate-500">Control de calidad y estado de bateas</p>
                  </div>
                </div>

                <form onSubmit={handleCreateAuditoriaFrescura} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Producto / Batea:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Tomate Santa Cruz / Manzana Gala"
                      value={formFrescuraProd}
                      onChange={(e) => setFormFrescuraProd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Calificación de Estado:
                    </label>
                    <select
                      value={formFrescuraCalidad}
                      onChange={(e) => setFormFrescuraCalidad(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    >
                      <option value="excelente">🟢 Excelente / Recién llegado</option>
                      <option value="bueno">🟡 Bueno / Rotación normal</option>
                      <option value="maduro_oferta">🟠 Maduro / Aplicar -30% Liquidación</option>
                      <option value="descarte">🔴 Descarte / Merma</option>
                    </select>
                  </div>

                  {/* Captura de Foto con Cámara */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Evidencia Fotográfica (Opcional):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-2 hover:border-emerald-500 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-500" />
                      {formFrescuraFoto ? "✓ Foto Capturada (Cambiar)" : "Tomar Foto con la Cámara"}
                    </button>
                    {formFrescuraFoto && (
                      <div className="mt-2 w-full h-32 rounded-xl overflow-hidden border border-slate-300">
                        <img src={formFrescuraFoto} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Observaciones de Salón:
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Bateas rotadas, se retiraron 2 Kg con magulladuras..."
                      value={formFrescuraObs}
                      onChange={(e) => setFormFrescuraObs(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar Auditoría
                  </button>
                </form>
              </div>

              {/* Registro de Auditorías */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Controles de Frescura Recientes ({auditoriasFrescura.length})
                </h3>

                <div className="space-y-3">
                  {auditoriasFrescura.map((aud) => (
                    <div
                      key={aud.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {aud.producto}
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          aud.calidad === "excelente" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                          aud.calidad === "bueno" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                          aud.calidad === "maduro_oferta" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                          "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                        }`}>
                          {aud.calidad.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                        {aud.observacion}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        <span>{aud.fecha}</span>
                        <span>Días en exhibición: {aud.dias_exhibicion} días</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 4: AUDITORÍA DE PRECIOS EN GÓNDOLA (ESCANER) ══════════════════════ */}
        {tab === "auditoria_precios" && (
          <div className="space-y-6 animate-fade-in">
            <div className="max-w-2xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                    Verificador de Precios en Góndola
                  </h3>
                  <p className="text-xs text-slate-500">Escaneá el código de barras y compará con la etiqueta física</p>
                </div>
              </div>

              <form onSubmit={handleScanLookup} className="flex gap-2 mb-6">
                <input
                  type="text"
                  autoFocus
                  placeholder="Escanear o tipear código de barras / nombre..."
                  value={scannerCode}
                  onChange={(e) => setScannerCode(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  style={monoFont}
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/25"
                >
                  <Scan className="w-4 h-4" /> Buscar
                </button>
              </form>

              {scannedItem && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-blue-500/30 space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                      Producto Identificado
                    </div>
                    <div className="font-black text-lg text-slate-900 dark:text-white mt-0.5">
                      {scannedItem.product.nombre}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Cód: {scannedItem.product.codigo_barra || scannedItem.product.id}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400">Precio Activo Sistema:</div>
                      <div className="font-black text-2xl text-emerald-600 dark:text-emerald-400" style={monoFont}>
                        {formatPYG(scannedItem.product.precio_venta || scannedItem.product.precio || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400">Stock Actual:</div>
                      <div className="font-black text-2xl text-slate-900 dark:text-white" style={monoFont}>
                        {scannedItem.product.stock || 0} un.
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintPriceTag}
                      disabled={printingTag}
                      className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/25 disabled:opacity-50"
                    >
                      {printingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                      Mandar a Imprimir Etiqueta Góndola
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 5: MARKETING & TV 55" ══════════════════════ */}
        {tab === "marketing_tv" && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner y Acceso Rápido a la TV */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-black text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" /> Google TV 55" Carnicería · Panel de Control
                </div>
                <h2 className="font-black text-xl text-white mt-1" style={displayFont}>
                  Configurador de Cartelería en Salón
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mt-0.5">
                  Controlá qué se exhibe en las 2 pantallas de carnicería: seleccioná los cortes activos, cambiá el tema de color y configurá promociones con un solo toque.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => window.open("/tv/carniceria", "_blank")}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> Ver Pantalla en Vivo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Opciones y Toggles de la TV */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                  Ajustes de Exhibición en Pantalla
                </h3>

                {/* Toggle Modo Claro / Oscuro de la TV */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      {tvConfig.theme === "light" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Modo de Color de la TV</div>
                      <div className="text-[11px] text-slate-500">
                        {tvConfig.theme === "light" ? "☀️ Modo Claro (Gourmet White)" : "🌙 Modo Oscuro (Boutique Black)"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => saveTvConfig({ ...tvConfig, theme: tvConfig.theme === "light" ? "dark" : "light" })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer transition ${
                      tvConfig.theme === "light"
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tvConfig.theme === "light" ? "Claro" : "Oscuro"}
                  </button>
                </div>

                {/* Intervalo de Rotación */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" /> Tiempo por Sector:
                    </div>
                    <span className="font-mono text-xs font-black text-red-600 dark:text-amber-400">
                      {tvConfig.intervalo_segundos} segundos
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[6, 8, 10, 15].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => saveTvConfig({ ...tvConfig, intervalo_segundos: sec })}
                        className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          tvConfig.intervalo_segundos === sec
                            ? "bg-red-600 text-white font-black"
                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-red-400"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle Club Extra */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Precios Club Extra</div>
                    <div className="text-[11px] text-slate-500">Mostrar columna de precio socio</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tvConfig.mostrar_club_extra}
                    onChange={(e) => saveTvConfig({ ...tvConfig, mostrar_club_extra: e.target.checked })}
                    className="w-5 h-5 rounded text-red-600 cursor-pointer"
                  />
                </div>

                {/* Toggle Turnero Digital */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Turnero Digital (Encausador)</div>
                    <div className="text-[11px] text-slate-500">Módulo de número de turno en pantalla</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tvConfig.mostrar_turnero}
                    onChange={(e) => saveTvConfig({ ...tvConfig, mostrar_turnero: e.target.checked })}
                    className="w-5 h-5 rounded text-red-600 cursor-pointer"
                  />
                </div>

                {/* Toggle Banner Combo */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Banner Combo Parrillero</div>
                    <div className="text-[11px] text-slate-500">Franja inferior con promo especial</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tvConfig.mostrar_combo_banner}
                    onChange={(e) => saveTvConfig({ ...tvConfig, mostrar_combo_banner: e.target.checked })}
                    className="w-5 h-5 rounded text-red-600 cursor-pointer"
                  />
                </div>

                {/* Edición de Textos del Combo */}
                {tvConfig.mostrar_combo_banner && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-400">Texto del Combo en TV:</div>
                    <input
                      type="text"
                      value={tvConfig.combo_titulo}
                      onChange={(e) => setTvConfig({ ...tvConfig, combo_titulo: e.target.value })}
                      onBlur={() => saveTvConfig(tvConfig)}
                      placeholder="Título del combo"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={tvConfig.combo_descripcion}
                      onChange={(e) => setTvConfig({ ...tvConfig, combo_descripcion: e.target.value })}
                      onBlur={() => saveTvConfig(tvConfig)}
                      placeholder="Descripción de cortes incluidos"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={tvConfig.combo_precio}
                      onChange={(e) => setTvConfig({ ...tvConfig, combo_precio: e.target.value })}
                      onBlur={() => saveTvConfig(tvConfig)}
                      placeholder="Precio combo (ej: ₲ 195.000)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 dark:text-amber-400 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Selector de Productos Habilitados para la TV */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                        Productos & Cortes en TV ({[...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].filter((c) => tvConfig.productos_visibles_ids.includes(c.id)).length} activos)
                      </h3>
                      <p className="text-[11px] text-slate-400">Precios sincronizados directamente con la base de datos de Intelimarket</p>
                    </div>
                    <button
                      onClick={() => saveTvConfig({ ...tvConfig, productos_visibles_ids: [...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].map((c) => c.id) })}
                      className="text-[11px] font-bold text-red-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Activar Todos
                    </button>
                  </div>

                  {/* Buscador de Cualquier Producto del Supermercado */}
                  <div className="mb-4 relative">
                    <input
                      type="text"
                      placeholder="🔍 Buscar cualquier producto del supermercado para agregar a la TV..."
                      value={tvSearchQuery}
                      onChange={(e) => setTvSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-red-500"
                    />

                    {filteredCatalogProducts.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-2 space-y-1">
                        <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                          Resultados del Catálogo ({filteredCatalogProducts.length}):
                        </div>
                        {filteredCatalogProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleAddCatalogProductToTv(p)}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer transition"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {p.nombre}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                SKU: {p.sku || p.id.slice(0, 8)} · {p.unidad_medida || "UN"}
                              </div>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                                {formatPYG(p.precio_venta || p.precio || 0)}
                              </span>
                              <span className="px-2 py-1 rounded-lg bg-red-600 text-white font-black text-[10px] uppercase">
                                + Agregar
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de Cortes y Productos Activos */}
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {[...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].map((c) => {
                      const isVisible = tvConfig.productos_visibles_ids.includes(c.id)
                      const dbMatch = products.find((p) => p.id === c.id || p.nombre.toLowerCase() === c.nombre.toLowerCase())
                      const realPrice = dbMatch?.precio_venta || dbMatch?.precio || c.precio

                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleProductoTvVisible(c.id)}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                            isVisible
                              ? "bg-slate-50 dark:bg-slate-950/60 border-slate-300 dark:border-slate-700"
                              : "bg-slate-100/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-900 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                              <img src={c.foto_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80"} alt={c.nombre} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {c.nombre}
                              </div>
                              <div className="text-[10px] text-slate-500 capitalize flex items-center gap-1.5">
                                <span>Sector: {c.categoria}</span>
                                <span>·</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                  {formatPYG(realPrice)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isVisible
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                            }`}>
                              {isVisible ? "En Pantalla" : "Pausado"}
                            </span>
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-red-600 pointer-events-none"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 6: INOCUIDAD & HACCP ══════════════════════ */}
        {tab === "haccp" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-3" style={displayFont}>
                Checklist Diario de Sanitización de Salón
              </h3>
              <div className="space-y-2.5">
                {[
                  "Desinfección de sierras de corte y picadoras de carne con amonio cuaternario.",
                  "Limpieza y sanitización de tablas de polietileno y cuchillos de carnicería.",
                  "Control y registro de temperatura de vitrinas exhibidoras (0°C a 4°C).",
                  "Rotación y retiro de bandejas de verdulería con magulladuras.",
                  "Limpieza de bandejas y horno rotativo de panadería."
                ].map((item, idx) => (
                  <label key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-emerald-500">
                    <input type="checkbox" defaultChecked={idx < 3} className="w-4 h-4 rounded text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
