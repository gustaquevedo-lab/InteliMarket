import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
  Beef, UtensilsCrossed, Carrot, ChefHat, Tag, Monitor, ShieldCheck,
  Plus, Check, X, AlertTriangle, RefreshCcw, Camera, Upload, Trash2,
  TrendingDown, ArrowRight, Sparkles, Flame, Clock, Award, Scan, Printer,
  Layers, Package, CheckCircle2, ChevronRight, Sun, Moon, LogOut, ArrowUpRight,
  DollarSign, FileText, ShoppingBag, Eye, EyeOff, Loader2, Scale, Thermometer,
  Boxes, Send, CheckSquare, Search, Percent, AlertCircle, BarChart3, Radio
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api, type Product } from "../../api"
import { DEFAULT_TV_CONFIG, DEFAULT_CORTES, type TvCarniceriaConfig, type MeatProduct } from "../kiosk/CarniceriaTvDigitalPage"

// Tipos del Hub de Operaciones
type SectorTab = "carniceria" | "panaderia" | "verduleria" | "auditoria_precios" | "mermas" | "reposicion" | "haccp" | "marketing_tv"

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

interface MermaRegistro {
  id: string
  producto_nombre: string
  cantidad: number
  unidad: string
  motivo: "vencimiento" | "rotura_empaque" | "perdida_frio" | "merma_natural" | "descarte_calidad"
  sector: string
  costo_estimado: number
  fecha: string
  responsable: string
}

interface SolicitudReposicion {
  id: string
  producto_nombre: string
  sector: string
  urgencia: "alta" | "media" | "baja"
  cantidad_solicitada: number
  unidad: string
  estado: "pendiente" | "en_camino" | "completado"
  hora: string
}

interface RegistroTemperatura {
  id: string
  equipo: string
  sector: string
  temperatura: number
  rango_min: number
  rango_max: number
  estado: "optimo" | "alerta" | "critico"
  hora: string
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
  const [carniceriaSubTab, setCarniceriaSubTab] = useState<"elaborados" | "desposte" | "balanza">("elaborados")
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

  // ── ESTADOS DE DESPOSTE DE MEDIA RES ──
  const [despostePesoEntrada, setDespostePesoEntrada] = useState<number>(240)
  const [desposteCostoTotal, setDesposteCostoTotal] = useState<number>(5500000)
  const [desposteEspecie, setDesposteEspecie] = useState<string>("Vacuno Novillo")

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

    const valorizadoTotal = cortes.reduce((acc, c) => acc + (c.kg * c.precio_venta_kg), 0)
    const margenBruto = valorizadoTotal - costo
    const margenPct = valorizadoTotal > 0 ? (margenBruto / valorizadoTotal) * 100 : 0

    return { costoKgGancho, cortes, valorizadoTotal, margenBruto, margenPct }
  }, [despostePesoEntrada, desposteCostoTotal])

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
  const [printingTag, setPrintingTag] = useState(false)

  // ── ESTADOS DE MERMAS DIRECTAS EN SALÓN ──
  const [mermas, setMermas] = useState<MermaRegistro[]>([
    { id: "mer-1", producto_nombre: "Leche Entera UHT 1L", cantidad: 3, unidad: "UN", motivo: "rotura_empaque", sector: "Lácteos", costo_estimado: 18000, fecha: "Hoy 08:45", responsable: user?.nombre || "Operador" },
    { id: "mer-2", producto_nombre: "Yogur Frutilla 500g", cantidad: 4, unidad: "UN", motivo: "vencimiento", sector: "Fiambrería", costo_estimado: 24000, fecha: "Hoy 09:10", responsable: user?.nombre || "Operador" },
    { id: "mer-3", producto_nombre: "Lechuga Hidropónica", cantidad: 2.5, unidad: "KG", motivo: "merma_natural", sector: "Verdulería", costo_estimado: 15000, fecha: "Hoy 10:00", responsable: user?.nombre || "Operador" },
  ])
  const [mermaProdNombre, setMermaProdNombre] = useState("")
  const [mermaCantidad, setMermaCantidad] = useState("")
  const [mermaMotivo, setMermaMotivo] = useState<"vencimiento" | "rotura_empaque" | "perdida_frio" | "merma_natural" | "descarte_calidad">("rotura_empaque")
  const [mermaSector, setMermaSector] = useState("Salón / Góndola")

  // ── ESTADOS DE REPOSICIÓN DE SALÓN (QUIEBRES DE GÓNDOLA) ──
  const [reposiciones, setReposiciones] = useState<SolicitudReposicion[]>([
    { id: "rep-1", producto_nombre: "Aceite de Girasol 900ml", sector: "Almacén", urgencia: "alta", cantidad_solicitada: 24, unidad: "UN", estado: "en_camino", hora: "09:30" },
    { id: "rep-2", producto_nombre: "Arroz Tipo 1 1Kg", sector: "Granos", urgencia: "media", cantidad_solicitada: 50, unidad: "UN", estado: "pendiente", hora: "10:15" },
    { id: "rep-3", producto_nombre: "Queso Muzzarella Barra", sector: "Fiambrería", urgencia: "alta", cantidad_solicitada: 4, unidad: "Piezas", estado: "completado", hora: "08:15" },
  ])
  const [repoProd, setRepoProd] = useState("")
  const [repoCant, setRepoCant] = useState("")
  const [repoSector, setRepoSector] = useState("Góndola General")
  const [repoUrgencia, setRepoUrgencia] = useState<"alta" | "media" | "baja">("alta")

  // ── ESTADOS DE INOCUIDAD & TEMPERATURAS HACCP ──
  const [temperaturas, setTemperaturas] = useState<RegistroTemperatura[]>([
    { id: "temp-1", equipo: "Cámara de Reses 01", sector: "Carnicería", temperatura: 1.8, rango_min: 0, rango_max: 4, estado: "optimo", hora: "09:00" },
    { id: "temp-2", equipo: "Batea Exhibidora Cortes", sector: "Carnicería", temperatura: 3.2, rango_min: 0, rango_max: 4, estado: "optimo", hora: "09:00" },
    { id: "temp-3", equipo: "Heladera Mural Lácteos", sector: "Lácteos", temperatura: 4.1, rango_min: 1, rango_max: 5, estado: "optimo", hora: "09:15" },
    { id: "temp-4", equipo: "Vitrina Caliente Rotisería", sector: "Rotisería", temperatura: 68.5, rango_min: 65, rango_max: 85, estado: "optimo", hora: "09:30" },
    { id: "temp-5", equipo: "Cámara Congelados 02", sector: "Congelados", temperatura: -18.2, rango_min: -22, rango_max: -16, estado: "optimo", hora: "08:45" },
  ])
  const [tempEquipo, setTempEquipo] = useState("Cámara de Reses 01")
  const [tempValor, setTempValor] = useState("")

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

  // Cargar productos
  useEffect(() => {
    setLoading(true)
    api.products.list({ limit: 300 })
      .then((res) => setProducts(Array.isArray(res) ? res : ((res as any)?.items || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Guardar Lote de Elaborados
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
    }, 400)
  }

  // Guardar Transformación Panadería
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
    }, 400)
  }

  // Registrar Auditoría de Frescura
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

  // Registrar Merma Directa
  const handleCreateMerma = (e: React.FormEvent) => {
    e.preventDefault()
    const cant = parseFloat(mermaCantidad.replace(/,/g, ".")) || 0
    if (!mermaProdNombre.trim() || cant <= 0) {
      toast.warning("Datos incompletos", "Ingrese el producto y la cantidad a mermar.")
      return
    }

    const nuevo: MermaRegistro = {
      id: `mer-${Date.now().toString().slice(-4)}`,
      producto_nombre: mermaProdNombre.trim(),
      cantidad: cant,
      unidad: "UN",
      motivo: mermaMotivo,
      sector: mermaSector,
      costo_estimado: cant * 8500,
      fecha: "Hoy " + new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
      responsable: user?.nombre || "Operador de Salón"
    }

    setMermas([nuevo, ...mermas])
    toast.success("Merma Registrada", `Se descontaron ${cant} un. de ${nuevo.producto_nombre} por ${nuevo.motivo.replace("_", " ")}.`)
    setMermaProdNombre("")
    setMermaCantidad("")
  }

  // Registrar Solicitud de Reposición
  const handleCreateReposicion = (e: React.FormEvent) => {
    e.preventDefault()
    const cant = parseFloat(repoCant.replace(/,/g, ".")) || 0
    if (!repoProd.trim() || cant <= 0) {
      toast.warning("Datos incompletos", "Ingrese el producto y la cantidad requerida.")
      return
    }

    const nueva: SolicitudReposicion = {
      id: `rep-${Date.now().toString().slice(-4)}`,
      producto_nombre: repoProd.trim(),
      sector: repoSector,
      urgencia: repoUrgencia,
      cantidad_solicitada: cant,
      unidad: "UN",
      estado: "pendiente",
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }

    setReposiciones([nueva, ...reposiciones])
    toast.success("Reposición Solicitada", `Aviso enviado al depósito para reponer ${cant} un. de ${nueva.producto_nombre}.`)
    setRepoProd("")
    setRepoCant("")
  }

  // Registrar Temperatura
  const handleCreateTemperatura = (e: React.FormEvent) => {
    e.preventDefault()
    const temp = parseFloat(tempValor.replace(/,/g, "."))
    if (isNaN(temp)) {
      toast.warning("Valor requerido", "Ingrese la temperatura leída en el termómetro.")
      return
    }

    const nuevo: RegistroTemperatura = {
      id: `temp-${Date.now().toString().slice(-4)}`,
      equipo: tempEquipo,
      sector: tempEquipo.includes("Reses") || tempEquipo.includes("Cortes") ? "Carnicería" : tempEquipo.includes("Rotisería") ? "Rotisería" : "Lácteos",
      temperatura: temp,
      rango_min: tempEquipo.includes("Rotisería") ? 65 : 0,
      rango_max: tempEquipo.includes("Rotisería") ? 85 : 4,
      estado: temp >= 0 && temp <= 4 ? "optimo" : "alerta",
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }

    setTemperaturas([nuevo, ...temperaturas])
    toast.success("Temperatura Registrada", `${tempEquipo}: ${temp}°C guardado en el libro HACCP.`)
    setTempValor("")
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setFormFrescuraFoto(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleScanLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scannerCode.trim()
    if (!code) return
    const match = products.find((p) => (p.codigo_barra && p.codigo_barra.includes(code)) || p.nombre.toLowerCase().includes(code.toLowerCase()))
    if (match) {
      const pUnit = match.precio_venta || match.precio || 0
      setScannedItem({ product: match, precio_gondola: pUnit })
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
        <div className="flex items-center justify-between max-w-7xl mx-auto">
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
                Extra Supermercado · Estación Móvil de Trabajo para Operadores de Salón
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

        {/* ── BARRA DE SECTORES / TABS TÁCTILES RÁPIDAS (8 MÓDULOS) ── */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 max-w-7xl mx-auto scrollbar-none">
          {[
            { id: "carniceria", label: "Carnicería & Desposte", icon: Beef, color: "text-red-500" },
            { id: "panaderia", label: "Panadería & Rotisería", icon: ChefHat, color: "text-amber-500" },
            { id: "verduleria", label: "Verdulería & Calidad", icon: Carrot, color: "text-emerald-500" },
            { id: "auditoria_precios", label: "Auditoría Góndola", icon: Tag, color: "text-blue-500" },
            { id: "mermas", label: "Mermas en Salón", icon: Trash2, color: "text-rose-500" },
            { id: "reposicion", label: "Reposición Depósito", icon: Boxes, color: "text-indigo-500" },
            { id: "haccp", label: "Temperaturas & HACCP", icon: Thermometer, color: "text-teal-500" },
            { id: "marketing_tv", label: "Marketing & TV 55\"", icon: Monitor, color: "text-purple-500" },
          ].map((sec) => {
            const Icon = sec.icon
            const active = tab === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setTab(sec.id as SectorTab)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
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
      <div className="p-4 max-w-7xl mx-auto space-y-6">
        
        {/* ══════════════════════ SECTOR 1: CARNICERÍA, DESPOSTE & BALANZAS ══════════════════════ */}
        {tab === "carniceria" && (
          <div className="space-y-6 animate-fade-in">
            {/* Subtabs de Carnicería */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setCarniceriaSubTab("elaborados")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                  carniceriaSubTab === "elaborados"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                1. Elaboración & Embutidos
              </button>
              <button
                onClick={() => setCarniceriaSubTab("desposte")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                  carniceriaSubTab === "desposte"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                2. Desposte & Rinde de Media Res
              </button>
              <button
                onClick={() => setCarniceriaSubTab("balanza")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                  carniceriaSubTab === "balanza"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                3. Balanza & Pesaje Mostrador
              </button>
            </div>

            {/* Subtab Elaborados */}
            {carniceriaSubTab === "elaborados" && (
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

                {/* Historial de Lotes */}
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
            )}

            {/* Subtab Desposte & Rendimiento de Media Res */}
            {carniceriaSubTab === "desposte" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Peso en Gancho (Kg):</label>
                    <input
                      type="number"
                      value={despostePesoEntrada}
                      onChange={(e) => setDespostePesoEntrada(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono font-black text-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Costo Total Compra (Gs.):</label>
                    <input
                      type="number"
                      value={desposteCostoTotal}
                      onChange={(e) => setDesposteCostoTotal(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono font-black text-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="p-5 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-600/20 flex flex-col justify-between">
                    <div className="text-[10px] font-black uppercase text-emerald-100">Margen Estimado de Despiece:</div>
                    <div className="font-black text-3xl" style={monoFont}>{desposteCalculo.margenPct.toFixed(1)}%</div>
                    <div className="text-xs text-emerald-100 font-mono">Margen Bruto: {formatPYG(desposteCalculo.margenBruto)}</div>
                  </div>
                </div>

                {/* Tabla de Rendimiento por Cortes */}
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs overflow-x-auto">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white mb-3" style={displayFont}>
                    Desglose de Cortes y Rinde Proyectado ({desposteEspecie})
                  </h3>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] font-black text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Corte / Derivado</th>
                        <th className="p-3 text-center">% Rinde</th>
                        <th className="p-3 text-center">Kg Obtenidos</th>
                        <th className="p-3 text-right">Precio Venta / Kg</th>
                        <th className="p-3 text-right">Valor Total Proyectado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {desposteCalculo.cortes.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{c.nombre}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">{c.pct}%</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.kg.toFixed(2)} Kg</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{formatPYG(c.precio_venta_kg)}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(c.kg * c.precio_venta_kg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Subtab Balanza Mostrador */}
            {carniceriaSubTab === "balanza" && (
              <div className="max-w-xl mx-auto p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 text-center">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 mx-auto w-fit">
                  <Scale className="w-8 h-8" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase" style={displayFont}>
                  Balanza de Mostrador Carnicería (RS-232 / USB)
                </h3>
                <div className="p-6 rounded-2xl bg-slate-950 text-white font-mono text-5xl font-black tracking-tight border-2 border-amber-500/50">
                  1.485 <span className="text-xl text-slate-400">KG</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success("Balanza Conectada", "Lectura continua activa en puerto COM3.")}
                    className="flex-1 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-xs uppercase"
                  >
                    Tara Cero
                  </button>
                  <button
                    onClick={() => toast.success("Etiqueta Térmica Impresa", "Código de barras EAN-13 emitido.")}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Etiqueta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ SECTOR 2: PANADERÍA & SOBRANTES ══════════════════════ */}
        {tab === "panaderia" && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-5 rounded-3xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 shadow-xl shadow-amber-500/20 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Economía Circular Zero Waste
                </div>
                <h2 className="font-black text-2xl mt-1 text-slate-950" style={displayFont}>
                  Transformación de Sobrantes
                </h2>
                <p className="text-xs text-amber-950 font-medium max-w-lg mt-0.5">
                  Convertí el pan del día anterior y facturas no vendidas en pan rallado, tostadas saborizadas y budines artesanales.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-amber-950">Aprovechamiento</div>
                <div className="font-black text-3xl" style={monoFont}>96.4%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulario */}
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
                      Tipo de Transformación:
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

              {/* Registro */}
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
              {/* Formulario con Cámara */}
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

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Evidencia Fotográfica:
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

              {/* Registro */}
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

        {/* ══════════════════════ SECTOR 4: AUDITORÍA DE PRECIOS EN GÓNDOLA ══════════════════════ */}
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
                  placeholder="Escanear o tipear código de barras..."
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

                  <button
                    onClick={handlePrintPriceTag}
                    disabled={printingTag}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/25 disabled:opacity-50"
                  >
                    {printingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    Mandar a Imprimir Etiqueta Góndola
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 5: REGISTRO DE MERMAS EN SALÓN ══════════════════════ */}
        {tab === "mermas" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulario de Merma */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Registrar Merma / Baja de Producto
                    </h3>
                    <p className="text-xs text-slate-500">Descarte por rotura, vencimiento o pérdida de frío</p>
                  </div>
                </div>

                <form onSubmit={handleCreateMerma} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Producto:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Leche 1L / Yogur 500g..."
                      value={mermaProdNombre}
                      onChange={(e) => setMermaProdNombre(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Cantidad / Kilos:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 3"
                        value={mermaCantidad}
                        onChange={(e) => setMermaCantidad(e.target.value.replace(/[^0-9.,]/g, ""))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                        style={monoFont}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Motivo:
                      </label>
                      <select
                        value={mermaMotivo}
                        onChange={(e) => setMermaMotivo(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                      >
                        <option value="rotura_empaque">Rotura de Empaque / Caída</option>
                        <option value="vencimiento">Fecha Vencida</option>
                        <option value="perdida_frio">Pérdida de Frío</option>
                        <option value="descarte_calidad">Descarte de Calidad</option>
                        <option value="merma_natural">Merma Natural / Deshidratación</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Sector del Salón:
                    </label>
                    <select
                      value={mermaSector}
                      onChange={(e) => setMermaSector(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    >
                      <option value="Lácteos & Fiambrería">Lácteos & Fiambrería</option>
                      <option value="Carnicería & Aves">Carnicería & Aves</option>
                      <option value="Panadería & Rotisería">Panadería & Rotisería</option>
                      <option value="Verdulería & Frutas">Verdulería & Frutas</option>
                      <option value="Góndola General">Góndola General / Almacén</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Registrar Merma & Descontar Stock
                  </button>
                </form>
              </div>

              {/* Historial de Mermas */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Mermas Registradas Hoy ({mermas.length})
                </h3>

                <div className="space-y-2.5">
                  {mermas.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {m.producto_nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.fecha} · Sector: {m.sector} · Motivo: <span className="font-bold text-rose-500">{m.motivo.replace("_", " ")}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-rose-600 dark:text-rose-400 font-mono">
                          -{m.cantidad} {m.unidad}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Pérdida: {formatPYG(m.costo_estimado)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 6: REPOSICIÓN DE SALÓN (DEPÓSITO) ══════════════════════ */}
        {tab === "reposicion" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulario */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Solicitar Reposición a Depósito
                    </h3>
                    <p className="text-xs text-slate-500">Avisar quiebre de batea o góndola vacía</p>
                  </div>
                </div>

                <form onSubmit={handleCreateReposicion} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Producto a Reponer:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Aceite Girasol 900ml / Harina 000..."
                      value={repoProd}
                      onChange={(e) => setRepoProd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Cantidad Requerida:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 24"
                        value={repoCant}
                        onChange={(e) => setRepoCant(e.target.value.replace(/[^0-9.,]/g, ""))}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        style={monoFont}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                        Urgencia:
                      </label>
                      <select
                        value={repoUrgencia}
                        onChange={(e) => setRepoUrgencia(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value="alta">🔴 Urgente (Batea Vacía)</option>
                        <option value="media">🟡 Media (Pocas unidades)</option>
                        <option value="baja">🟢 Preventiva (Para el turno)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Enviar Pedido a Depósito
                  </button>
                </form>
              </div>

              {/* Registro */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Pedidos de Reposición Activos ({reposiciones.length})
                </h3>

                <div className="space-y-2.5">
                  {reposiciones.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{r.producto_nombre}</span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            r.urgencia === "alta" ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-amber-500/20 text-amber-600"
                          }`}>
                            {r.urgencia}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Hora: {r.hora} · Cantidad: {r.cantidad_solicitada} {r.unidad}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                          r.estado === "completado" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                          r.estado === "en_camino" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse" :
                          "bg-amber-500/20 text-amber-600"
                        }`}>
                          {r.estado.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 7: INOCUIDAD & HACCP ══════════════════════ */}
        {tab === "haccp" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Formulario Temperaturas */}
              <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                    <Thermometer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider" style={displayFont}>
                      Registro de Temperaturas HACCP
                    </h3>
                    <p className="text-xs text-slate-500">Monitoreo obligatorio de cadena de frío y calor</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTemperatura} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Equipo / Batea:
                    </label>
                    <select
                      value={tempEquipo}
                      onChange={(e) => setTempEquipo(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
                    >
                      <option value="Cámara de Reses 01">Cámara de Reses 01 (Carnicería)</option>
                      <option value="Batea Exhibidora Cortes">Batea Exhibidora Cortes (Carnicería)</option>
                      <option value="Heladera Mural Lácteos">Heladera Mural Lácteos</option>
                      <option value="Vitrina Caliente Rotisería">Vitrina Caliente Rotisería</option>
                      <option value="Cámara Congelados 02">Cámara Congelados 02</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                      Temperatura Leída (°C):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 2.5"
                      value={tempValor}
                      onChange={(e) => setTempValor(e.target.value.replace(/[^0-9.,-]/g, ""))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Guardar en Libro HACCP
                  </button>
                </form>
              </div>

              {/* Registro */}
              <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3" style={displayFont}>
                  Lecturas de Temperatura Recientes ({temperaturas.length})
                </h3>

                <div className="space-y-2.5">
                  {temperaturas.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {t.equipo}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Sector: {t.sector} · Hora: {t.hora} · Rango seguro: {t.rango_min}°C a {t.rango_max}°C
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-xl text-emerald-600 dark:text-emerald-400 font-mono">
                          {t.temperatura} °C
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          ✓ En Rango
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ SECTOR 8: MARKETING & TV 55" ══════════════════════ */}
        {tab === "marketing_tv" && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-black text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" /> Google TV 55" Carnicería · Panel de Control
                </div>
                <h2 className="font-black text-xl text-white mt-1" style={displayFont}>
                  Configuración de Pantalla en Vivo
                </h2>
                <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                  Controlá qué cortes, fotos, precios oficiales y promociones se proyectan en el salón.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.open("/tv/carniceria", "_blank")}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> Abrir Pantalla 55"
                </button>
              </div>
            </div>

            {/* Selector de Productos Habilitados para la TV */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-500" style={displayFont}>
                  Cortes y Productos en TV ({[...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].filter((c) => tvConfig.productos_visibles_ids.includes(c.id)).length} activos)
                </h3>
                <button
                  onClick={() => saveTvConfig({ ...tvConfig, productos_visibles_ids: [...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].map((c) => c.id) })}
                  className="text-[11px] font-bold text-red-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Activar Todos
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...DEFAULT_CORTES, ...(tvConfig.custom_products || [])].map((c) => {
                  const isVisible = tvConfig.productos_visibles_ids.includes(c.id)
                  const dbMatch = products.find((p: Product) => p.id === c.id || p.nombre.toLowerCase() === c.nombre.toLowerCase())
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
                          <div className="text-[10px] text-slate-500 capitalize font-mono">
                            {formatPYG(realPrice)}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isVisible ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}>
                        {isVisible ? "En TV" : "Pausado"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
