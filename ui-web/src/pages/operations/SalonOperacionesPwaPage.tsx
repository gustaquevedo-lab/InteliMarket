import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  UtensilsCrossed, Tag, Monitor,
  Plus, Check, X, RefreshCcw, Trash2,
  Clock, Scan, Printer, Download,
  Sun, Moon,
  Loader2, Thermometer,
  Boxes, Search, Percent, AlertCircle,
  Beef, ChefHat, Carrot, AlertTriangle,
  Flame, ShoppingCart, Layers, ExternalLink,
  Volume2, ShieldCheck, Sparkles, Scale,
  ChevronRight, ArrowRight, CheckCircle2,
  LogIn, UserCheck, Camera, CameraOff,
  Flashlight, Zap, Package, Compass, History, ShieldAlert,
  Calculator, Calendar, DollarSign, FileText, CheckCircle
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api, type Product } from "../../api"
import { soundAlerts } from "../../utils/audioAlerts"

// Tipos Maestros de Salón de Ventas
type SalonTab = "gondola" | "produccion" | "mermas" | "reposicion" | "haccp"
type ProduccionSector = "carniceria" | "panaderia" | "verduleria"

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
  estado?: string
}

export interface ReposicionItem {
  id: string
  suggestion_id?: string
  producto_id: string
  producto_nombre: string
  cantidad: number
  urgencia: "alta" | "normal"
  estado: "pendiente" | "en_camino" | "completado" | "requisitada"
  sector: string
  hora: string
  stock_actual?: number
  punto_pedido?: number
  costo_unitario_estimado?: number
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

export interface LoteProduccion {
  id: string
  sector: "Carnicería" | "Panadería" | "Verdulería"
  receta_nombre: string
  insumo_origen: string
  cantidad_insumo: number
  producto_obtenido: string
  cantidad_obtenida: number
  unidad: string
  costo_unitario: number
  lote_codigo: string
  hora: string
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

// El backend agrupa mermas en 6 áreas fijas (ProductionArea) y 6 tipos fijos
// (WasteType) para poder reportar por sector -- son más finos que los 10
// sectores / 5 motivos de esta pantalla, así que se mapean acá; el detalle
// original queda igual en el campo de texto libre "motivo".
const AREA_BACKEND_MAP: Record<string, string> = {
  "Carnicería": "carniceria",
  "Panadería & Confitería": "panaderia",
  "Verdulería & Frutas": "verduleria",
  "Rotisería & Calientes": "rotiseria",
}
const TIPO_MERMA_BACKEND_MAP: Record<string, string> = {
  rotura_empaque: "rotura",
  vencimiento: "vencimiento",
  perdida_frio: "otros",
  descarte_calidad: "otros",
  merma_natural: "merma_natural",
}

export default function SalonOperacionesPwaPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  const [tab, setTab] = useState<SalonTab>("gondola")
  const [produccionSector, setProduccionSector] = useState<ProduccionSector>("carniceria")
  
  // Catálogo en memoria y estado de búsqueda
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [searchingProduct, setSearchingProduct] = useState(false)

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
  const [scannedStock, setScannedStock] = useState<any | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [precioVistoGondola, setPrecioVistoGondola] = useState("")

  // ── ESTADOS DE CÁMARA Y ESCÁNER EN VIVO (BARCODE DETECTOR) ──
  const [cameraActive, setCameraActive] = useState(false)
  const [torchActive, setTorchActive] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>("")
  const [lastScannedCode, setLastScannedCode] = useState<string>("")
  const [cameraError, setCameraError] = useState<string | null>(null)
  // "granted" ya lo sabemos sin pedir la cámara (evita el mensaje "otorgue el
  // permiso" cuando el navegador ya lo concedió y lo que falló fue otra cosa:
  // cámara ocupada, facingMode no soportado, contexto no seguro, etc.)
  const [cameraPermission, setCameraPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const isProcessingBarcode = useRef<boolean>(false)

  // ── BUFFER DEL ESCÁNER DE HARDWARE (PISTOLA LÁSER USB / BLUETOOTH) ──
  const barcodeBuffer = useRef("")
  const lastKeyTime = useRef(0)

  // ── ESTADOS DE PRODUCCIÓN REAL CONECTADOS AL BACKEND ──
  // 1. CARNICERÍA & DESPOSTE
  const [subSectorCarniceria, setSubSectorCarniceria] = useState<"desposte" | "templates" | "rendimiento">("desposte")
  const [butcheryTemplates, setButcheryTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [despostePesoEntrada, setDespostePesoEntrada] = useState<number>(240)
  const [desposteCostoTotal, setDesposteCostoTotal] = useState<number>(5500000)
  const [desposteVencimiento, setDesposteVencimiento] = useState<string>("")
  const [desposteNotas, setDesposteNotas] = useState<string>("")
  const [ejecutandoDesposte, setEjecutandoDesposte] = useState(false)
  const [resultadoDesposte, setResultadoDesposte] = useState<any>(null)
  const [showDesposteResultModal, setShowDesposteResultModal] = useState(false)
  const [butcheryOrders, setButcheryOrders] = useState<any[]>([])
  const [yieldReport, setYieldReport] = useState<any[]>([])
  const [loadingCarniceria, setLoadingCarniceria] = useState(false)

  // Formulario nueva plantilla carnicería
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "250", descripcion: "" })

  // 2. PANADERÍA & ROTISERÍA
  const [panSubSector, setPanSubSector] = useState<"panaderia" | "rotiseria" | "calculadora">("panaderia")
  const [bakeryRecipes, setBakeryRecipes] = useState<any[]>([])
  const [bakeryPlanes, setBakeryPlanes] = useState<any[]>([])
  const [bakeryOrders, setBakeryOrders] = useState<any[]>([])
  const [selectedBakeryRecipeId, setSelectedBakeryRecipeId] = useState<string>("")
  const [bakeryProdQty, setBakeryProdQty] = useState<string>("50")
  const [bakeryProdVenc, setBakeryProdVenc] = useState<string>("")
  const [bakeryProdNotas, setBakeryProdNotas] = useState<string>("")
  const [registrandoBakery, setRegistrandoBakery] = useState(false)

  // Formulario nueva receta panadería
  const [showBakeryRecipeModal, setShowBakeryRecipeModal] = useState(false)
  const [savingBakeryRecipe, setSavingBakeryRecipe] = useState(false)
  const [bakeryRecipeForm, setBakeryRecipeForm] = useState({ nombre: "", rendimiento_piezas: "50", costo_estimado: "120000", tiempo_preparacion_min: "45", descripcion: "" })

  const [rotiseriaRecipes, setRotiseriaRecipes] = useState<any[]>([])
  const [rotiseriaPlanes, setRotiseriaPlanes] = useState<any[]>([])
  const [rotiseriaDash, setRotiseriaDash] = useState<any>(null)
  const [selectedRotiRecipeId, setSelectedRotiRecipeId] = useState<string>("")
  const [rotiPlanDesc, setRotiPlanDesc] = useState<string>("")
  const [rotiPlanTemp, setRotiPlanTemp] = useState<string>("75")
  const [rotiPlanTiempo, setRotiPlanTiempo] = useState<string>("60")
  const [guardandoRotiPlan, setGuardandoRotiPlan] = useState(false)
  const [completandoRotiId, setCompletandoRotiId] = useState<string | null>(null)
  const [rotiTempFinal, setRotiTempFinal] = useState<string>("78")
  const [rotiQtyFinal, setRotiQtyFinal] = useState<string>("15")
  const [aplicandoAutoMarkdownRoti, setAplicandoAutoMarkdownRoti] = useState(false)
  const [loadingPanaderia, setLoadingPanaderia] = useState(false)

  // Formulario nueva receta rotisería
  const [showRotiRecipeModal, setShowRotiRecipeModal] = useState(false)
  const [savingRotiRecipe, setSavingRotiRecipe] = useState(false)
  const [rotiRecipeForm, setRotiRecipeForm] = useState({ nombre: "", costo_estimado: "35000", tiempo_preparacion_min: "60", descripcion: "" })

  // Calculadora Panadero Rápida
  const [harinaKg, setHarinaKg] = useState<number>(25)
  const [hidratPct, setHidratPct] = useState<number>(60)
  const [salPct, setSalPct] = useState<number>(2)
  const [levPct, setLevPct] = useState<number>(1.5)
  const [grasaPct, setGrasaPct] = useState<number>(3)

  // 3. VERDULERÍA & HORTIFRUTI FRESCOS
  const [verduraSubSector, setVerduraSubSector] = useState<"frescura" | "lotes" | "markdown" | "scorecards">("frescura")
  const [produceDash, setProduceDash] = useState<any>(null)
  const [receiveBatches, setReceiveBatches] = useState<any[]>([])
  const [freshnessAudits, setFreshnessAudits] = useState<any[]>([])
  const [scorecards, setScorecards] = useState<any[]>([])
  const [generandoScorecards, setGenerandoScorecards] = useState(false)
  const [loadingVerduleria, setLoadingVerduleria] = useState(false)

  // Formulario Auditoría de Frescura
  const [auditProdId, setAuditProdId] = useState<string>("")
  const [auditBatchId, setAuditBatchId] = useState<string>("")
  const [auditCalidad, setAuditCalidad] = useState<"bueno" | "regular" | "malo">("bueno")
  const [auditFirmeza, setAuditFirmeza] = useState<number>(5)
  const [auditColor, setAuditColor] = useState<number>(5)
  const [auditAspecto, setAuditAspecto] = useState<number>(5)
  const [auditNotas, setAuditNotas] = useState<string>("")
  const [guardandoAuditoria, setGuardandoAuditoria] = useState(false)

  // Formulario Recepción Rápida Hortifruti
  const [recepProdId, setRecepProdId] = useState<string>("")
  const [recepCant, setRecepCant] = useState<string>("")
  const [recepPrecioUni, setRecepPrecioUni] = useState<string>("")
  const [recepCalidad, setRecepCalidad] = useState<string>("A")
  const [recepVencimiento, setRecepVencimiento] = useState<string>("")
  const [recepNota, setRecepNota] = useState<string>("")
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false)
  const [aplicandoMarkdownProduce, setAplicandoMarkdownProduce] = useState(false)

  // ── ESTADOS DE MERMAS OFICIALES ──
  const [mermasList, setMermasList] = useState<MermaItem[]>([])
  const [loadingMermas, setLoadingMermas] = useState(false)
  const [mermaProd, setMermaProd] = useState<Product | null>(null)
  const [mermaQty, setMermaQty] = useState("")
  const [mermaTipo, setMermaTipo] = useState("rotura_empaque")
  const [mermaArea, setMermaArea] = useState("Góndola General")
  const [mermaObs, setMermaObs] = useState("")
  const [submittingMerma, setSubmittingMerma] = useState(false)
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string | null>(null)

  // ── ESTADOS DE REPOSICIÓN SALÓN ➔ DEPÓSITO ──
  // Ya no se persiste en localStorage: la lista es siempre el reflejo en
  // vivo del motor real de reposición (api.replenishment), no un borrador
  // local -- guardar una copia vieja acá solo generaría datos fantasma.
  const [reposiciones, setReposiciones] = useState<ReposicionItem[]>([])
  const [loadingReposiciones, setLoadingReposiciones] = useState(false)
  const [generandoRequisicion, setGenerandoRequisicion] = useState<string | null>(null)

  const [repoProd, setRepoProd] = useState<Product | null>(null)
  const [repoQty, setRepoQty] = useState("")
  const [repoUrgencia, setRepoUrgencia] = useState<"alta" | "normal">("alta")

  // ── ESTADOS DE HACCP REAL CONECTADOS AL BACKEND ──
  const [haccpSubTab, setHaccpSubTab] = useState<"monitoreo" | "acciones" | "planes" | "reporte">("monitoreo")
  const [haccpDash, setHaccpDash] = useState<any>(null)
  const [haccpPlanes, setHaccpPlanes] = useState<any[]>([])
  const [selectedHaccpPlanId, setSelectedHaccpPlanId] = useState<string>("")
  const [haccpCriticalPoints, setHaccpCriticalPoints] = useState<any[]>([])
  const [selectedCpId, setSelectedCpId] = useState<string>("")
  const [haccpTempValor, setHaccpTempValor] = useState<string>("")
  const [haccpTempObs, setHaccpTempObs] = useState<string>("")
  const [guardandoMonitoreo, setGuardandoMonitoreo] = useState(false)
  const [haccpAcciones, setHaccpAcciones] = useState<any[]>([])
  const [resolviendoAccionId, setResolviendoAccionId] = useState<string | null>(null)
  const [haccpRecentLogs, setHaccpRecentLogs] = useState<any[]>([])
  const [haccpReport, setHaccpReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingHaccp, setLoadingHaccp] = useState(false)

  // Formulario nuevo plan HACCP
  const [showNewPlanModal, setShowNewPlanModal] = useState(false)
  const [savingNewPlan, setSavingNewPlan] = useState(false)
  const [newPlanForm, setNewPlanForm] = useState({ nombre: "", area: "Carnicería", descripcion: "" })

  // ── LOGIN RÁPIDO PWA ──
  const { login } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  const hasFetchedRef = useRef(false)

  // ── CARGA INICIAL DE CATÁLOGO DESDE LA BASE DE DATOS REAL DE EXTRA ──
  const loadCatalog = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await api.products.list({ limit: 100 })
      const list = Array.isArray(res) ? res : ((res as any)?.items || [])
      setProducts(list)
    } catch (err) {
      console.warn("No se pudo precargar catálogo inicial:", err)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  // ── DEPÓSITO POR DEFECTO PARA MERMAS (requerido por el backend para poder
  // descontar el stock correcto una vez que el Gerente aprueba) ──
  useEffect(() => {
    api.warehouses.list()
      .then((whs) => {
        const principal = whs.find((w: any) => w.tipo === "principal") || whs[0]
        if (principal) setDefaultWarehouseId(principal.id)
      })
      .catch(() => {})
  }, [])

  // ── CARGAR MERMAS OFICIALES DEL BACKEND ──
  const loadMermas = useCallback(async () => {
    setLoadingMermas(true)
    try {
      const res = await api.supermer.waste.list({ desde: new Date().toISOString().split("T")[0] })
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
          estado: w.estado,
        }))
        setMermasList(mapped)
      }
    } catch (err) {
      console.warn("No se pudieron cargar mermas del backend:", err)
    } finally {
      setLoadingMermas(false)
    }
  }, [])

  // ── CARGAR PRODUCTOS CON QUIEBRE INMINENTE (motor real de reposición) ──
  // Antes esto pegaba a api.supermer.suggestions (sugerencias de compra a
  // proveedor, un objeto totalmente distinto) y leía campos que no existen
  // ahi (s.sugerido, s.urgencia, s.sector) -- por eso nunca listaba nada
  // util. El motor correcto es api.replenishment, que calcula stock vs
  // punto de pedido por producto y ya soporta "solo_criticos".
  const mapSuggestion = (s: any): ReposicionItem => ({
    id: String(s.id),
    suggestion_id: String(s.id),
    producto_id: String(s.producto_id),
    producto_nombre: s.producto_nombre || "Producto",
    cantidad: Number(s.cantidad_sugerida || 0),
    urgencia: Number(s.stock_actual || 0) <= 0 ? "alta" : "normal",
    estado: s.estado === "aprobada" || s.oc_generada ? "requisitada" : "pendiente",
    sector: "Depósito Central",
    hora: new Date(s.fecha_generacion || s.created_at || Date.now()).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
    stock_actual: Number(s.stock_actual || 0),
    punto_pedido: Number(s.punto_pedido || 0),
    costo_unitario_estimado: Number(s.costo_unitario_estimado || 0),
  })

  const loadSugerenciasReposicion = useCallback(async () => {
    setLoadingReposiciones(true)
    try {
      let res = await api.replenishment.suggestions.list({ estado: "pendiente" })
      if (!Array.isArray(res) || res.length === 0) {
        // No hay sugerencias frescas todavia -- generarlas ahora mismo,
        // filtrando solo los productos realmente en quiebre/critico.
        try {
          res = await api.replenishment.generate({ solo_criticos: true })
        } catch (genErr) {
          console.warn("No se pudieron generar sugerencias de reposición:", genErr)
          res = []
        }
      }
      if (Array.isArray(res)) {
        setReposiciones(res.map(mapSuggestion))
      }
    } catch (err) {
      console.warn("No se pudieron cargar sugerencias de reposición:", err)
    } finally {
      setLoadingReposiciones(false)
    }
  }, [])

  // ── CARGA DE DATOS REALES DE CARNICERÍA ──
  const loadCarniceriaData = useCallback(async () => {
    setLoadingCarniceria(true)
    try {
      const [tmplRes, ordsRes, yldRes] = await Promise.allSettled([
        api.supermer.butchery.templates.list(),
        api.supermer.butchery.orders(),
        api.supermer.butchery.yieldReport(),
      ])
      if (tmplRes.status === "fulfilled" && Array.isArray(tmplRes.value)) {
        setButcheryTemplates(tmplRes.value)
        if (tmplRes.value.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tmplRes.value[0].id)
        }
      }
      if (ordsRes.status === "fulfilled" && Array.isArray(ordsRes.value)) {
        setButcheryOrders(ordsRes.value)
      }
      if (yldRes.status === "fulfilled" && Array.isArray(yldRes.value)) {
        setYieldReport(yldRes.value)
      }
    } catch (err) {
      console.warn("Error al cargar carnicería:", err)
    } finally {
      setLoadingCarniceria(false)
    }
  }, [selectedTemplateId])

  // ── CARGA DE DATOS REALES DE PANADERÍA & ROTISERÍA ──
  const loadPanaderiaData = useCallback(async () => {
    setLoadingPanaderia(true)
    try {
      const [bRec, bPl, bOrd, rRec, rPl, rDash] = await Promise.allSettled([
        api.supermer.recipes.list({ area: "panaderia" }),
        api.supermer.bakery.plans(),
        api.supermer.orders.list({ area: "panaderia" }),
        api.rotiseria.recipes.list(),
        api.rotiseria.plans.list(),
        api.rotiseria.dashboard(),
      ])
      if (bRec.status === "fulfilled" && Array.isArray(bRec.value)) {
        setBakeryRecipes(bRec.value)
        if (bRec.value.length > 0 && !selectedBakeryRecipeId) {
          setSelectedBakeryRecipeId(bRec.value[0].id)
        }
      }
      if (bPl.status === "fulfilled" && Array.isArray(bPl.value)) setBakeryPlanes(bPl.value)
      if (bOrd.status === "fulfilled" && Array.isArray(bOrd.value)) setBakeryOrders(bOrd.value)
      if (rRec.status === "fulfilled" && Array.isArray(rRec.value)) {
        setRotiseriaRecipes(rRec.value)
        if (rRec.value.length > 0 && !selectedRotiRecipeId) {
          setSelectedRotiRecipeId(rRec.value[0].id)
        }
      }
      if (rPl.status === "fulfilled" && Array.isArray(rPl.value)) setRotiseriaPlanes(rPl.value)
      if (rDash.status === "fulfilled") setRotiseriaDash(rDash.value)
    } catch (err) {
      console.warn("Error al cargar panadería/rotisería:", err)
    } finally {
      setLoadingPanaderia(false)
    }
  }, [selectedBakeryRecipeId, selectedRotiRecipeId])

  // ── CARGA DE DATOS REALES DE VERDULERÍA & FRESCOS ──
  const loadVerduleriaData = useCallback(async () => {
    setLoadingVerduleria(true)
    try {
      const [dashRes, recRes, audRes, scRes] = await Promise.allSettled([
        api.supermer.produce.dashboard(),
        api.supermer.produce.receiveBatches.list(),
        api.supermer.produce.freshness.list(),
        api.supermer.produce.scorecards.list(),
      ])
      if (dashRes.status === "fulfilled") setProduceDash(dashRes.value)
      if (recRes.status === "fulfilled" && Array.isArray(recRes.value)) setReceiveBatches(recRes.value)
      if (audRes.status === "fulfilled" && Array.isArray(audRes.value)) setFreshnessAudits(audRes.value)
      if (scRes.status === "fulfilled" && Array.isArray(scRes.value)) setScorecards(scRes.value)
    } catch (err) {
      console.warn("Error al cargar verdulería:", err)
    } finally {
      setLoadingVerduleria(false)
    }
  }, [])

  // ── CARGA DE DATOS REALES DE HACCP ──
  const loadHaccpData = useCallback(async () => {
    setLoadingHaccp(true)
    try {
      const [dashRes, plansRes, actRes] = await Promise.allSettled([
        api.haccp.dashboard(),
        api.haccp.plans.list(),
        api.haccp.correctiveActions.list({ resuelto: false }),
      ])
      if (dashRes.status === "fulfilled") setHaccpDash(dashRes.value)
      if (actRes.status === "fulfilled" && Array.isArray(actRes.value)) setHaccpAcciones(actRes.value)
      if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value)) {
        setHaccpPlanes(plansRes.value)
        const targetPlanId = selectedHaccpPlanId || (plansRes.value.length > 0 ? plansRes.value[0].id : null)
        if (targetPlanId) {
          if (!selectedHaccpPlanId) setSelectedHaccpPlanId(targetPlanId)
          try {
            const cps = await api.haccp.criticalPoints.list(targetPlanId)
            if (Array.isArray(cps)) {
              setHaccpCriticalPoints(cps)
              if (cps.length > 0 && !selectedCpId) {
                setSelectedCpId(cps[0].id)
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Error al cargar HACCP:", err)
    } finally {
      setLoadingHaccp(false)
    }
  }, [selectedHaccpPlanId, selectedCpId])

  // Efecto para recargar puntos críticos al cambiar de plan HACCP
  useEffect(() => {
    if (!selectedHaccpPlanId) return
    api.haccp.criticalPoints.list(selectedHaccpPlanId)
      .then((cps) => {
        if (Array.isArray(cps)) {
          setHaccpCriticalPoints(cps)
          if (cps.length > 0) setSelectedCpId(cps[0].id)
          else setSelectedCpId("")
        }
      })
      .catch(() => setHaccpCriticalPoints([]))
  }, [selectedHaccpPlanId])

  // Carga reactiva según el tab activo
  useEffect(() => {
    if (tab === "produccion") {
      if (produccionSector === "carniceria") loadCarniceriaData()
      else if (produccionSector === "panaderia") loadPanaderiaData()
      else if (produccionSector === "verduleria") loadVerduleriaData()
    } else if (tab === "haccp") {
      loadHaccpData()
    }
  }, [tab, produccionSector, loadCarniceriaData, loadPanaderiaData, loadVerduleriaData, loadHaccpData])

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    loadCatalog()
    loadMermas()
    loadSugerenciasReposicion()
    loadCarniceriaData()
  }, [loadCatalog, loadMermas, loadSugerenciasReposicion, loadCarniceriaData])

  // ── DETECTAR PERMISO DE CÁMARA YA OTORGADO (sin pedirlo) ──
  // Antes de esto la UI siempre pedía "activar cámara" aunque el navegador ya
  // tuviera el permiso concedido de una sesión anterior, porque nunca se
  // consultaba el estado real -- solo se sabía si getUserMedia fallaba o no.
  useEffect(() => {
    let cancelled = false
    if (!("permissions" in navigator)) return
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((status) => {
        if (cancelled) return
        setCameraPermission(status.state as "granted" | "denied" | "prompt")
        status.onchange = () => {
          if (!cancelled) setCameraPermission(status.state as "granted" | "denied" | "prompt")
        }
      })
      .catch(() => {
        // Safari/algunos navegadores no exponen "camera" en permissions.query
        if (!cancelled) setCameraPermission("unknown")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── OBTENER STOCK REAL DE UN PRODUCTO ──
  const fetchProductStock = async (prodId: string) => {
    setLoadingStock(true)
    try {
      const stockData = await api.inventory.getProductStock(prodId)
      setScannedStock(stockData)
    } catch {
      setScannedStock(null)
    } finally {
      setLoadingStock(false)
    }
  }

  // ── BUSCADOR REAL DE PRODUCTO (CÓDIGO DE BARRAS O NOMBRE) ──
  const processScannedCode = useCallback(async (codeOrText: string) => {
    const raw = codeOrText.trim()
    if (!raw) return

    setSearchingProduct(true)
    setLastScannedCode(raw)

    try {
      // 1. Buscar primero en la memoria local
      const q = raw.toLowerCase()
      let found = products.find(p => 
        (p.codigo_barra && p.codigo_barra.toLowerCase() === q) ||
        (p.sku && p.sku.toLowerCase() === q) ||
        p.id === raw
      )

      // 2. Si no está en memoria, consultar directamente a la base de datos real de Extra (11.628 productos)
      if (!found) {
        const searchRes = await api.products.list({ search: raw, limit: 10 })
        const items = Array.isArray(searchRes) ? searchRes : ((searchRes as any)?.items || [])
        
        if (items.length > 0) {
          // Priorizar coincidencia exacta de código de barras
          found = items.find((p: Product) => p.codigo_barra === raw) || items[0]
          
          // Agregarlo al catálogo local para futuras lecturas rápidas
          setProducts(prev => {
            const exists = prev.some(p => p.id === found!.id)
            return exists ? prev : [found!, ...prev]
          })
        }
      }

      if (found) {
        soundAlerts.playScanSuccess()
        if (navigator.vibrate) navigator.vibrate([40, 60, 80])
        setScannedProduct(found)
        setPrecioVistoGondola("")
        setBarcodeQuery("")
        fetchProductStock(found.id)
        toast.success("Producto Identificado", `${found.nombre} • ${formatPYG(found.precio_venta || found.precio || 0)}`)
      } else {
        soundAlerts.playPriceMismatchAlert()
        if (navigator.vibrate) navigator.vibrate([100, 100, 100])
        toast.error("No Registrado", `No se encontró ningún producto con código '${raw}' en el sistema Extra.`)
      }
    } catch (err: any) {
      soundAlerts.playPriceMismatchAlert()
      toast.error("Error al consultar", err?.message || "Error al verificar producto en el servidor.")
    } finally {
      setSearchingProduct(false)
    }
  }, [products, toast])

  // ── DETECCIÓN CONTINUA CON BARCODE DETECTOR NATIVO DE CÁMARA ──
  const startCamera = async (targetDeviceId?: string) => {
    setCameraError(null)
    try {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current)
        scanLoopRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      // 1. Enumerar dispositivos de video disponibles antes de pedir stream
      let videoDevices: MediaDeviceInfo[] = []
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          videoDevices = devices.filter(d => d.kind === "videoinput")
          setAvailableCameras(videoDevices)
        }
      } catch (e) {
        console.warn("No se pudieron enumerar dispositivos previos:", e)
      }

      let chosenId = targetDeviceId || selectedCameraId
      if (!chosenId && videoDevices.length > 0) {
        // Buscar cámara trasera por label
        const back = videoDevices.find(d => /back|rear|trasera|environment|wide|main/i.test(d.label))
        if (back) {
          chosenId = back.deviceId
        } else if (videoDevices.length > 1) {
          // En Android WebView la trasera suele ser el último índice (mientras que 0 suele ser la frontal)
          chosenId = videoDevices[videoDevices.length - 1].deviceId
        }
      }

      let stream: MediaStream | null = null

      // A) Si tenemos un deviceId específico elegido, intentar abrirlo directamente
      if (chosenId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: chosenId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
          setSelectedCameraId(chosenId)
        } catch (err) {
          console.warn("Fallo con deviceId exacto, probando constraints de cámara trasera...", err)
        }
      }

      // B) Si no hay stream aún, forzar cámara trasera mediante facingMode exact y luego ideal
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          // Fallback con ideal
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        }
      }

      // C) Verificar si Android WebView asignó la cámara frontal por error cuando se quería trasera
      let activeTrack = stream.getVideoTracks()[0]
      if (activeTrack) {
        const currentLabel = (activeTrack.label || "").toLowerCase()
        const isFront = /front|delantera|user/i.test(currentLabel)

        // Si cayó en la frontal y tenemos más dispositivos disponibles, forzar el último dispositivo (trasera)
        if (isFront && videoDevices.length > 1 && !targetDeviceId) {
          try {
            const alternateDevice = videoDevices[videoDevices.length - 1]
            if (alternateDevice.deviceId !== chosenId) {
              activeTrack.stop()
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: alternateDevice.deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: false,
              })
              activeTrack = stream.getVideoTracks()[0]
            }
          } catch (altErr) {
            console.warn("No se pudo conmutar al dispositivo alternativo:", altErr)
          }
        }
      }

      streamRef.current = stream
      setCameraPermission("granted")

      // Con el permiso ya otorgado, re-enumerar para capturar los nombres reales (labels) de cada lente
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const freshDevices = await navigator.mediaDevices.enumerateDevices()
          const freshVideo = freshDevices.filter(d => d.kind === "videoinput")
          setAvailableCameras(freshVideo)
        }
      } catch {}

      if (activeTrack) {
        const settings = activeTrack.getSettings ? activeTrack.getSettings() : {}
        if (settings.deviceId) {
          setSelectedCameraId(settings.deviceId)
        }
        const label = activeTrack.label || ""
        setActiveCameraLabel(
          /back|rear|trasera|environment/i.test(label)
            ? "Cámara Trasera"
            : /front|user|delantera/i.test(label)
            ? "Cámara Frontal"
            : label || "Cámara Activa"
        )

        const capabilities: any = activeTrack.getCapabilities ? activeTrack.getCapabilities() : {}
        setHasTorch(!!capabilities.torch)
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute("playsinline", "true")
        await videoRef.current.play()
      }

      setCameraActive(true)

      // Iniciar bucle de BarcodeDetector si está soportado
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "code_39"],
        })

        const detectLoop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(detectLoop)
            return
          }

          if (!isProcessingBarcode.current) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue
                if (rawValue && rawValue !== lastScannedCode) {
                  isProcessingBarcode.current = true
                  await processScannedCode(rawValue)
                  // Pausa de 1.8 segundos para evitar spam continuado
                  setTimeout(() => {
                    isProcessingBarcode.current = false
                  }, 1800)
                }
              }
            } catch (err) {
              // Frame no analizado, continuar silenciosamente
            }
          }

          scanLoopRef.current = requestAnimationFrame(detectLoop)
        }

        scanLoopRef.current = requestAnimationFrame(detectLoop)
      } else {
        toast.info(
          "Lector Visual Activado",
          "Tu navegador no tiene la API BarcodeDetector nativa. Apuntá el producto y usá la búsqueda rápida o pistola lectora."
        )
      }
    } catch (err: any) {
      console.error("Error al iniciar cámara:", err)
      setCameraActive(false)

      const name = err?.name || ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraPermission("denied")
        setCameraError("Permiso de cámara denegado. Habilitalo en la configuración del navegador o del sistema operativo para este sitio.")
        toast.error("Permiso de Cámara Denegado", "Habilitá el acceso a la cámara en la configuración del navegador/dispositivo.")
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError("No se encontró ninguna cámara en este dispositivo.")
        toast.error("Sin Cámara Disponible", "El dispositivo no tiene una cámara utilizable.")
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCameraError("La cámara está siendo usada por otra aplicación o pestaña. Cerrala e intentá de nuevo.")
        toast.error("Cámara Ocupada", "Otra app o pestaña está usando la cámara ahora mismo.")
      } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
        setCameraError("La cámara no soporta la configuración pedida. Probá con otra cámara.")
        toast.error("Configuración No Soportada", "Probá cambiar de cámara.")
      } else if (!window.isSecureContext) {
        setCameraError("La cámara solo funciona en conexión segura (HTTPS).")
        toast.error("Conexión No Segura", "Accedé por HTTPS para poder usar la cámara.")
      } else {
        setCameraError(err?.message || "No se pudo acceder a la cámara.")
        toast.error("Error de Cámara", err?.message || "No se pudo acceder a la cámara.")
      }
    }
  }

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setTorchActive(false)
  }

  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      const nextTorch = !torchActive
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      })
      setTorchActive(nextTorch)
    } catch (err) {
      toast.warning("Linterna No Disponible", "Este dispositivo no soporta control de linterna.")
    }
  }

  const switchCamera = () => {
    if (availableCameras.length <= 1) {
      const nextMode = facingMode === "environment" ? "user" : "environment"
      setFacingMode(nextMode)
      stopCamera()
      setTimeout(() => startCamera(), 200)
      return
    }

    // Rotar al siguiente dispositivo físico real (ciclo entre todas las cámaras del equipo)
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    const nextDevice = availableCameras[nextIndex]

    setSelectedCameraId(nextDevice.deviceId)
    stopCamera()
    const desc = nextDevice.label || `Cámara ${nextIndex + 1} de ${availableCameras.length}`
    toast.info("Cambiando Cámara", desc)
    setTimeout(() => startCamera(nextDevice.deviceId), 200)
  }

  // Apagar cámara al desmontar o cambiar de tab
  useEffect(() => {
    if (tab !== "gondola") {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [tab])

  // ── LISTENER PARA PISTOLA LÁSER FÍSICA USB / BLUETOOTH (ZEBRA / HONEYWELL) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si el foco está en un input normal que no sea el escáner, no interferir salvo que sea rápido
      const activeEl = document.activeElement as HTMLElement
      const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      const isQuickInput = activeEl && activeEl.id === "salon-barcode-input"

      const now = Date.now()
      const diff = now - lastKeyTime.current
      lastKeyTime.current = now

      // Los lectores láser envían caracteres con < 60ms entre cada pulsación
      if (diff > 80) {
        barcodeBuffer.current = ""
      }

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 3) {
          e.preventDefault()
          const scanned = barcodeBuffer.current
          barcodeBuffer.current = ""
          processScannedCode(scanned)
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [processScannedCode])

  // ── ENVÍO MANUAL DEL BUSCADOR ──
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery.trim()) return
    processScannedCode(barcodeQuery)
  }

  // ── ACCIÓN: ENVIAR A COLA DE IMPRESIÓN DE ETIQUETAS FLEJE ──
  const handleAddToLabelQueue = (
    prod: Product,
    motivo: LabelQueueItem["motivo"] = "falta_fleje",
    customQty?: number,
    customDiscount?: number
  ) => {
    soundAlerts.playScanSuccess()
    const qty = customQty || 1
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
    toast.success("Fleje Agregado a Cola", `${qty} etiqueta(s) en cola para ${prod.nombre}`)
  }

  // ── ACCIÓN: REGISTRAR MERMA OFICIAL EN BACKEND REAL ──
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

    if (!defaultWarehouseId) {
      toast.warning("Depósito no disponible", "No se pudo determinar el depósito para la merma. Reintente en unos segundos.")
      return
    }

    setSubmittingMerma(true)
    try {
      const costoUni = prod.ultimo_costo || prod.costo_promedio || 0
      const payload = {
        area: AREA_BACKEND_MAP[mermaArea] || "otros",
        warehouse_id: defaultWarehouseId,
        producto_id: prod.id,
        cantidad: cant,
        tipo_merma: TIPO_MERMA_BACKEND_MAP[mermaTipo] || "otros",
        motivo: `[${mermaArea}] ${mermaObs.trim() || "Registrado por encargado en salón"}`,
        costo_unitario: costoUni,
      }

      await api.supermer.waste.create(payload)

      soundAlerts.playScanSuccess()
      toast.success("Merma Registrada", `${cant} un. de ${prod.nombre} quedó pendiente de aprobación del Gerente.`)
      setMermaQty("")
      setMermaObs("")
      setMermaProd(null)
      loadMermas()
    } catch {
      // Fallback local con persistencia para no trabar al operador en caso de corte
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
        fecha: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
        registrado_por: user?.nombre || "Encargado de Salón",
      }
      setMermasList([fallbackItem, ...mermasList])
      soundAlerts.playScanSuccess()
      toast.success("Merma Guardada", `Registrada localmente: ${cant} un. de ${prod.nombre}.`)
      setMermaQty("")
      setMermaObs("")
      setMermaProd(null)
    } finally {
      setSubmittingMerma(false)
    }
  }

  // ── ACCIÓN: GENERAR REQUISICIÓN DE COMPRA POR QUIEBRE INMINENTE ──
  // Antes esto solo guardaba un "aviso" de texto en localStorage que nadie
  // en Compras podía ver. Ahora genera una PurchaseRequisition real
  // (api.purchases.requisitions.create), que aparece directamente en
  // Gestión de Compras, y marca la sugerencia como aprobada para que no
  // se repita en la próxima carga.
  const handleConfirmReposicion = async (e: React.FormEvent) => {
    e.preventDefault()
    const item = reposiciones.find(r => r.producto_id === (repoProd?.id || scannedProduct?.id))
    if (!item) {
      toast.warning("Seleccione Producto", "Elegí un producto con quiebre inminente de la lista.")
      return
    }
    const cant = parseFloat(repoQty) || item.cantidad || 1

    setGenerandoRequisicion(item.id)
    try {
      await api.purchases.requisitions.create({
        departamento: "Salón",
        solicitante_id: user?.id,
        solicitante_nombre: user?.nombre || "Encargado de Salón",
        prioridad: repoUrgencia === "alta" ? "alta" : "normal",
        motivo: `Quiebre de stock detectado en salón (stock actual: ${item.stock_actual ?? 0}, punto de pedido: ${item.punto_pedido ?? 0})`,
        items: [{
          product_id: item.producto_id,
          cantidad_solicitada: cant,
          precio_estimado: item.costo_unitario_estimado || undefined,
        }],
      })

      if (item.suggestion_id) {
        try {
          await api.replenishment.suggestions.review(item.suggestion_id, { accion: "aprobar" })
        } catch {
          // No bloquea la requisición ya creada si esto falla
        }
      }

      soundAlerts.playRestockChime()
      setReposiciones(prev => prev.map(r => r.id === item.id ? { ...r, estado: "requisitada" } : r))
      toast.success("Requisición Enviada a Compras", `${cant} un. de ${item.producto_nombre} — ya está visible en Gestión de Compras.`)
    } catch (err: any) {
      toast.error("No se pudo generar la requisición", err?.message || "Intentá de nuevo en unos segundos.")
    } finally {
      setGenerandoRequisicion(null)
    }
    setRepoQty("")
    setRepoProd(null)
  }

  // ── TEMPLATE Y CORTES DINÁMICOS DE CARNICERÍA ──
  const desposteTemplateActivo = useMemo(() => {
    return butcheryTemplates.find(t => t.id === selectedTemplateId) || butcheryTemplates[0] || null
  }, [butcheryTemplates, selectedTemplateId])

  const desposteCortesEstimados = useMemo(() => {
    const cuts = desposteTemplateActivo?.cuts || []
    const peso = Number(despostePesoEntrada) || 0
    const costo = Number(desposteCostoTotal) || 0
    const costoKg = peso > 0 ? costo / peso : 0

    if (cuts.length === 0) {
      // Si el template aún no tiene cortes configurados en el backend, usar desglose estándar de novillo paraguayo
      const standardCuts = [
        { nombre: "Tapa Cuadril (Picaña)", rendimiento_porcentual: 2.2, precio_venta_sugerido: 72000 },
        { nombre: "Costilla de Primera", rendimiento_porcentual: 18.5, precio_venta_sugerido: 42000 },
        { nombre: "Vacío Parrillero", rendimiento_porcentual: 6.8, precio_venta_sugerido: 46000 },
        { nombre: "Lomo Especial", rendimiento_porcentual: 3.5, precio_venta_sugerido: 65000 },
        { nombre: "Bola de Lomo / Carnaza Negra", rendimiento_porcentual: 14.0, precio_venta_sugerido: 47000 },
        { nombre: "Carnaza de Segunda / Aguja", rendimiento_porcentual: 16.5, precio_venta_sugerido: 34000 },
        { nombre: "Recortes / Trimmings", rendimiento_porcentual: 8.0, precio_venta_sugerido: 26000 },
        { nombre: "Huesos / Grasa / Descarte", rendimiento_porcentual: 30.5, precio_venta_sugerido: 6000 },
      ]
      return standardCuts.map(c => ({
        ...c,
        kg_estimado: (peso * c.rendimiento_porcentual) / 100,
        costo_asignado: costoKg * ((peso * c.rendimiento_porcentual) / 100),
        valor_venta: ((peso * c.rendimiento_porcentual) / 100) * c.precio_venta_sugerido,
      }))
    }

    return cuts.map((c: any) => {
      const pct = Number(c.rendimiento_porcentual || 0)
      const kg = (peso * pct) / 100
      const pVenta = Number(c.precio_venta_sugerido || c.precio_venta || 0)
      return {
        ...c,
        kg_estimado: kg,
        costo_asignado: costoKg * kg,
        valor_venta: kg * pVenta,
      }
    })
  }, [desposteTemplateActivo, despostePesoEntrada, desposteCostoTotal])

  const desposteCalculo = useMemo(() => {
    const peso = Number(despostePesoEntrada) || 1
    const costo = Number(desposteCostoTotal) || 0
    const costoKgGancho = costo / peso
    const valorizadoTotal = desposteCortesEstimados.reduce((acc: number, c: { valor_venta?: number }) => acc + (c.valor_venta || 0), 0)
    const margenBruto = valorizadoTotal - costo
    const margenPct = valorizadoTotal > 0 ? (margenBruto / valorizadoTotal) * 100 : 0
    return { costoKgGancho, valorizadoTotal, margenBruto, margenPct }
  }, [despostePesoEntrada, desposteCostoTotal, desposteCortesEstimados])

  // ── ACCIÓN: EJECUTAR DESPOSTE OFICIAL EN CARNICERÍA ──
  const handleEjecutarDesposte = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplateId && butcheryTemplates.length === 0) {
      toast.warning("Sin Plantillas", "No se encontraron plantillas de corte activas.")
      return
    }
    const templateId = selectedTemplateId || butcheryTemplates[0]?.id
    if (!templateId) {
      toast.warning("Seleccione Plantilla", "Elegí una plantilla de corte.")
      return
    }
    if (!despostePesoEntrada || despostePesoEntrada <= 0) {
      toast.warning("Peso Requerido", "Ingresá el peso en gancho recibido.")
      return
    }
    if (!desposteCostoTotal || desposteCostoTotal <= 0) {
      toast.warning("Costo Requerido", "Ingresá el costo total de compra.")
      return
    }

    setEjecutandoDesposte(true)
    try {
      const res = await api.supermer.butchery.desposte({
        template_id: templateId,
        peso_entrada_kg: despostePesoEntrada,
        costo_total_gs: desposteCostoTotal,
        fecha_vencimiento: desposteVencimiento || undefined,
        notas: desposteNotas ? `[PWA Salón] ${desposteNotas}` : "[PWA Salón] Desposte de gancho",
      })

      soundAlerts.playScanSuccess()
      if (navigator.vibrate) navigator.vibrate([60, 80])
      setResultadoDesposte(res)
      setShowDesposteResultModal(true)
      toast.success("✅ Desposte Registrado", `Se generaron ${res?.cortes?.length || 0} cortes ingresados a stock oficial.`)
      setDesposteNotas("")
      loadCarniceriaData()
    } catch (err: any) {
      toast.error("Error al ejecutar desposte", err?.message || "No se pudo conectar con el servidor.")
    } finally {
      setEjecutandoDesposte(false)
    }
  }

  // ── ACCIÓN: CREAR NUEVA PLANTILLA DE CORTES EN CARNICERÍA ──
  const handleSaveButcheryTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateForm.nombre.trim()) {
      toast.warning("Nombre Requerido", "Ingresá el nombre de la plantilla de cortes.")
      return
    }
    setSavingTemplate(true)
    try {
      const created = await api.supermer.butchery.templates.create({
        nombre: templateForm.nombre.trim(),
        especie: templateForm.especie,
        peso_promedio_kg: parseFloat(templateForm.peso_promedio_kg || "0"),
        descripcion: templateForm.descripcion,
        activa: true,
        cuts: [],
      })
      soundAlerts.playScanSuccess()
      toast.success("Plantilla Creada", `Plantilla "${templateForm.nombre}" guardada en el catálogo oficial.`)
      setShowTemplateModal(false)
      setTemplateForm({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "250", descripcion: "" })
      await loadCarniceriaData()
      if (created?.id) setSelectedTemplateId(created.id)
    } catch (err: any) {
      toast.error("Error al crear plantilla", err?.message || "No se pudo guardar la plantilla.")
    } finally {
      setSavingTemplate(false)
    }
  }

  // ── ACCIÓN: REGISTRAR HORNEADA REAL EN PANADERÍA ──
  const handleRegistrarBakeryOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBakeryRecipeId) {
      toast.warning("Seleccione Receta", "Elegí la fórmula de panadería a elaborar.")
      return
    }
    const cant = parseFloat(bakeryProdQty)
    if (!cant || cant <= 0) {
      toast.warning("Cantidad Requerida", "Ingresá la cantidad o kilos a producir.")
      return
    }

    setRegistrandoBakery(true)
    try {
      const ord = await api.supermer.orders.create({
        receta_id: selectedBakeryRecipeId,
        cantidad_objetivo: cant,
        fecha_vencimiento: bakeryProdVenc || undefined,
        notas: bakeryProdNotas ? `[PWA Panadería] ${bakeryProdNotas}` : "[PWA Panadería] Horneada en salón",
      })

      if (ord?.id) {
        await api.supermer.orders.complete(ord.id, {
          producto_obtenido: cant,
          fecha_vencimiento: bakeryProdVenc || undefined,
        })
      }

      soundAlerts.playScanSuccess()
      if (navigator.vibrate) navigator.vibrate([50, 70])
      toast.success("Horneada Registrada", `${cant} piezas ingresadas directamente al inventario de Panadería.`)
      setBakeryProdNotas("")
      loadPanaderiaData()
    } catch (err: any) {
      toast.error("Error al registrar horneada", err?.message || "Verificá la conexión con el servidor.")
    } finally {
      setRegistrandoBakery(false)
    }
  }

  // ── ACCIÓN: CREAR RECETA DE PANADERÍA ──
  const handleSaveBakeryRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bakeryRecipeForm.nombre.trim()) {
      toast.warning("Nombre Requerido", "Ingresá el nombre de la fórmula de panadería.")
      return
    }
    setSavingBakeryRecipe(true)
    try {
      const created = await api.supermer.recipes.create({
        nombre: bakeryRecipeForm.nombre.trim(),
        area: "panaderia",
        rendimiento_piezas: parseInt(bakeryRecipeForm.rendimiento_piezas || "1"),
        costo_estimado: parseFloat(bakeryRecipeForm.costo_estimado || "0"),
        tiempo_preparacion_min: parseInt(bakeryRecipeForm.tiempo_preparacion_min || "30"),
        descripcion: bakeryRecipeForm.descripcion,
        activa: true,
      })
      soundAlerts.playScanSuccess()
      toast.success("Receta Creada", `Fórmula "${bakeryRecipeForm.nombre}" guardada en Panadería.`)
      setShowBakeryRecipeModal(false)
      setBakeryRecipeForm({ nombre: "", rendimiento_piezas: "50", costo_estimado: "120000", tiempo_preparacion_min: "45", descripcion: "" })
      await loadPanaderiaData()
      if (created?.id) setSelectedBakeryRecipeId(created.id)
    } catch (err: any) {
      toast.error("Error al guardar receta", err?.message || "No se pudo registrar la receta.")
    } finally {
      setSavingBakeryRecipe(false)
    }
  }

  // ── ACCIÓN: CREAR PLAN DE COCCIÓN ROTISERÍA ──
  const handleCrearRotiPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    const desc = rotiPlanDesc.trim()
    if (!desc && !selectedRotiRecipeId) {
      toast.warning("Datos Requeridos", "Indicá una receta o descripción del preparado caliente.")
      return
    }

    setGuardandoRotiPlan(true)
    try {
      const rec = rotiseriaRecipes.find(r => r.id === selectedRotiRecipeId)
      await api.rotiseria.plans.create({
        nombre: desc || rec?.nombre || "Hornada de Rotisería",
        descripcion: desc || rec?.nombre || "Cocción en rotisería",
        receta_id: selectedRotiRecipeId || undefined,
        temperatura_objetivo: parseFloat(rotiPlanTemp || "75"),
        tiempo_coccion_min: parseInt(rotiPlanTiempo || "60"),
        fecha: new Date().toISOString().split("T")[0],
      })

      soundAlerts.playScanSuccess()
      toast.success("Plan de Rotisería Creado", "Cocción registrada para monitoreo térmico.")
      setRotiPlanDesc("")
      loadPanaderiaData()
    } catch (err: any) {
      toast.error("Error al crear plan", err?.message || "Error al conectar.")
    } finally {
      setGuardandoRotiPlan(false)
    }
  }

  // ── ACCIÓN: CREAR RECETA DE ROTISERÍA ──
  const handleSaveRotiRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rotiRecipeForm.nombre.trim()) {
      toast.warning("Nombre Requerido", "Ingresá el nombre del preparado caliente.")
      return
    }
    setSavingRotiRecipe(true)
    try {
      const created = await api.rotiseria.recipes.create({
        nombre: rotiRecipeForm.nombre.trim(),
        costo_estimado: parseFloat(rotiRecipeForm.costo_estimado || "0"),
        tiempo_preparacion_min: parseInt(rotiRecipeForm.tiempo_preparacion_min || "60"),
        descripcion: rotiRecipeForm.descripcion,
        activa: true,
      })
      soundAlerts.playScanSuccess()
      toast.success("Receta Guardada", `Preparado "${rotiRecipeForm.nombre}" registrado.`)
      setShowRotiRecipeModal(false)
      setRotiRecipeForm({ nombre: "", costo_estimado: "35000", tiempo_preparacion_min: "60", descripcion: "" })
      await loadPanaderiaData()
      if (created?.id) setSelectedRotiRecipeId(created.id)
    } catch (err: any) {
      toast.error("Error al guardar receta", err?.message || "No se pudo registrar.")
    } finally {
      setSavingRotiRecipe(false)
    }
  }

  // ── ACCIÓN: COMPLETAR COCCIÓN EN ROTISERÍA ──
  const handleCompletarRotiPlan = async (planId: string) => {
    try {
      await api.rotiseria.plans.complete(planId, {
        temperatura_final: parseFloat(rotiTempFinal || "78"),
        cantidad_obtenida: parseFloat(rotiQtyFinal || "10"),
        estado: "completado",
      })
      soundAlerts.playScanSuccess()
      toast.success("Cocción Completada", "Hornada lista y control térmico guardado.")
      setCompletandoRotiId(null)
      loadPanaderiaData()
    } catch (err: any) {
      toast.error("Error al completar", err?.message || "Error en el servidor.")
    }
  }

  // ── ACCIÓN: AUTO-MARKDOWN ROTISERÍA ──
  const handleAutoMarkdownRoti = async () => {
    setAplicandoAutoMarkdownRoti(true)
    try {
      await api.rotiseria.autoMarkdown()
      soundAlerts.playScanSuccess()
      toast.success("Markdowns Rotisería Aplicados", "Rebajas aplicadas para productos calientes de rotación rápida.")
      loadPanaderiaData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo aplicar markdown.")
    } finally {
      setAplicandoAutoMarkdownRoti(false)
    }
  }

  // ── ACCIÓN: REGISTRAR AUDITORÍA DE FRESCURA EN VERDULERÍA ──
  const handleGuardarAuditoriaFrescura = async (e: React.FormEvent) => {
    e.preventDefault()
    const prodId = auditProdId || scannedProduct?.id
    if (!prodId) {
      toast.warning("Seleccione Producto", "Elegí el producto hortícola a auditar.")
      return
    }

    setGuardandoAuditoria(true)
    try {
      await api.supermer.produce.freshness.create({
        producto_id: prodId,
        batch_id: auditBatchId || undefined,
        calidad_actual: auditCalidad,
        firmeza: auditFirmeza,
        color: auditColor,
        aspecto_general: auditAspecto,
        notas: auditNotas ? `[PWA Góndola] ${auditNotas}` : "[PWA Góndola] Control de frescura en salón",
      })

      soundAlerts.playScanSuccess()
      if (navigator.vibrate) navigator.vibrate([50, 50, 50])
      if (auditCalidad === "regular" || auditCalidad === "malo") {
        toast.warning("Auditoría Registrada", `Calidad ${auditCalidad.toUpperCase()}: el sistema generó un Markdown automático para sell-out.`)
      } else {
        toast.success("Auditoría Registrada", "Lote conforme en óptimas condiciones de madurez.")
      }
      setAuditNotas("")
      loadVerduleriaData()
    } catch (err: any) {
      toast.error("Error al auditar", err?.message || "Error al conectar.")
    } finally {
      setGuardandoAuditoria(false)
    }
  }

  // ── ACCIÓN: REGISTRAR RECEPCIÓN RÁPIDA DE HORTIFRUTI ──
  const handleGuardarRecepcionProduce = async (e: React.FormEvent) => {
    e.preventDefault()
    const prodId = recepProdId || scannedProduct?.id
    if (!prodId) {
      toast.warning("Seleccione Producto", "Elegí el producto recibido.")
      return
    }
    const cant = parseFloat(recepCant)
    if (!cant || cant <= 0) {
      toast.warning("Cantidad Requerida", "Ingresá los kilos o cajas recibidas.")
      return
    }
    const precio = parseFloat(recepPrecioUni || "0")

    setGuardandoRecepcion(true)
    try {
      await api.supermer.produce.receiveBatches.create({
        producto_id: prodId,
        cantidad_recibida: cant,
        cantidad_aceptada: cant,
        precio_unitario: precio,
        calidad: recepCalidad,
        fecha_recepcion: new Date().toISOString().split("T")[0],
        fecha_vencimiento_estimada: recepVencimiento || undefined,
        nota_calidad: recepNota ? `[PWA Muelle] ${recepNota}` : "[PWA Muelle] Recepción hortifruti",
      })

      soundAlerts.playScanSuccess()
      toast.success("Lote Hortifruti Registrado", `${cant} ingresados con clasificación ${recepCalidad}.`)
      setRecepCant("")
      setRecepPrecioUni("")
      setRecepNota("")
      loadVerduleriaData()
    } catch (err: any) {
      toast.error("Error al registrar lote", err?.message || "Error en el servidor.")
    } finally {
      setGuardandoRecepcion(false)
    }
  }

  // ── ACCIÓN: MARKDOWN AUTOMÁTICO DE VERDULERÍA ──
  const handleAutoMarkdownProduce = async () => {
    setAplicandoMarkdownProduce(true)
    try {
      await api.supermer.produce.markdownByBatch()
      soundAlerts.playScanSuccess()
      toast.success("Liquidación Aplicada", "Descuentos calculados por proximidad de maduración en lotes de verdulería.")
      loadVerduleriaData()
    } catch (err: any) {
      toast.error("Error", err?.message || "Error al liquidar lotes.")
    } finally {
      setAplicandoMarkdownProduce(false)
    }
  }

  // ── ACCIÓN: REGISTRAR MONITOREO TÉRMICO HACCP REAL ──
  const handleGuardarMonitoreoHaccp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCpId) {
      toast.warning("Seleccione Punto Crítico", "Elegí la cámara o equipo a auditar.")
      return
    }
    const val = parseFloat(haccpTempValor.replace(/,/g, "."))
    if (isNaN(val)) {
      toast.warning("Temperatura Requerida", "Ingresá el valor numérico leído en el termómetro.")
      return
    }

    const cp = haccpCriticalPoints.find(p => p.id === selectedCpId)
    const limInf = cp?.limite_inferior != null ? Number(cp.limite_inferior) : null
    const limSup = cp?.limite_superior != null ? Number(cp.limite_superior) : null
    const esConforme = (limInf == null || val >= limInf) && (limSup == null || val <= limSup)

    setGuardandoMonitoreo(true)
    try {
      await api.haccp.monitoringLogs.create(selectedCpId, {
        valor: val,
        fuente: "manual",
        observaciones: haccpTempObs ? `[PWA Salón] ${haccpTempObs}` : `[PWA Salón] Registro de ${user?.nombre || "Encargado"}`,
      })

      if (esConforme) {
        soundAlerts.playScanSuccess()
        if (navigator.vibrate) navigator.vibrate([40, 60])
        toast.success("Control HACCP Guardado", `${cp?.nombre || "Equipo"}: ${val}°C (Dentro de rango seguro).`)
      } else {
        soundAlerts.playHaccpWarning()
        if (navigator.vibrate) navigator.vibrate([150, 100, 150])
        toast.error("¡DESVIACIÓN BROMATOLÓGICA!", `${cp?.nombre || "Equipo"}: ${val}°C fuera de rango [${limInf}°C a ${limSup}°C]. Se generó una Acción Correctiva oficial.`)
      }

      setHaccpTempValor("")
      setHaccpTempObs("")
      loadHaccpData()
    } catch (err: any) {
      toast.error("Error al registrar medición", err?.message || "Verificá la conexión.")
    } finally {
      setGuardandoMonitoreo(false)
    }
  }

  // ── ACCIÓN: RESOLVER ACCIÓN CORRECTIVA HACCP ──
  const handleResolverAccionHaccp = async (caId: string) => {
    setResolviendoAccionId(caId)
    try {
      await api.haccp.correctiveActions.resolve(caId)
      soundAlerts.playScanSuccess()
      toast.success("Acción Correctiva Resuelta", "Desviación subsanada en el libro digital HACCP.")
      loadHaccpData()
    } catch (err: any) {
      toast.error("Error al resolver", err?.message || "No se pudo actualizar la acción.")
    } finally {
      setResolviendoAccionId(null)
    }
  }

  // ── ACCIÓN: GENERAR SCORECARDS DE PROVEEDORES HORTÍCOLAS ──
  const handleGenerateScorecards = async () => {
    setGenerandoScorecards(true)
    try {
      await api.supermer.produce.scorecards.generate()
      soundAlerts.playScanSuccess()
      toast.success("Scorecards Generados", "Índices de calidad y tasa de rechazo de proveedores actualizados.")
      loadVerduleriaData()
    } catch (err: any) {
      toast.error("Error al generar scorecards", err?.message || "No se pudo actualizar.")
    } finally {
      setGenerandoScorecards(false)
    }
  }

  // ── ACCIÓN: CREAR NUEVO PLAN HACCP ──
  const handleSaveHaccpPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlanForm.nombre.trim()) {
      toast.warning("Nombre Requerido", "Ingresá el nombre del plan HACCP.")
      return
    }
    setSavingNewPlan(true)
    try {
      const created = await api.haccp.plans.create({
        nombre: newPlanForm.nombre.trim(),
        area: newPlanForm.area,
        descripcion: newPlanForm.descripcion,
        activo: true,
      })
      soundAlerts.playScanSuccess()
      toast.success("Plan HACCP Creado", `Plan "${newPlanForm.nombre}" guardado en el sistema oficial.`)
      setShowNewPlanModal(false)
      setNewPlanForm({ nombre: "", area: "Carnicería", descripcion: "" })
      await loadHaccpData()
      if (created?.id) setSelectedHaccpPlanId(created.id)
    } catch (err: any) {
      toast.error("Error al crear plan", err?.message || "Error al conectar.")
    } finally {
      setSavingNewPlan(false)
    }
  }

  // ── ACCIÓN: CONSULTAR REPORTE DE CUMPLIMIENTO HACCP ──
  const loadHaccpReport = async () => {
    setLoadingReport(true)
    try {
      const r = await api.haccp.complianceReport()
      setHaccpReport(r)
      toast.success("Reporte HACCP Actualizado", `Cumplimiento global: ${r?.conformidad_pct != null ? Number(r.conformidad_pct).toFixed(1) : 100}%`)
    } catch (err: any) {
      toast.error("Error al cargar reporte", err?.message || "No se pudo consultar el reporte.")
    } finally {
      setLoadingReport(false)
    }
  }

  // ── CARGAR HISTORIAL DE LOGS DE UN PUNTO CRÍTICO ──
  const loadHaccpLogs = useCallback(async (cpId: string) => {
    if (!cpId) return
    try {
      const logs = await api.haccp.monitoringLogs.list(cpId)
      if (Array.isArray(logs)) setHaccpRecentLogs(logs)
    } catch {
      setHaccpRecentLogs([])
    }
  }, [])

  useEffect(() => {
    if (selectedCpId) loadHaccpLogs(selectedCpId)
  }, [selectedCpId, loadHaccpLogs])

  // Total de Mermas del Día
  const totalMermasHoy = useMemo(() => {
    return mermasList.reduce((acc, m) => acc + (m.costo_total || m.cantidad * (m.costo_unitario || 8000)), 0)
  }, [mermasList])

  // Login Rápido
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast.warning("Datos requeridos", "Ingrese su usuario/correo y contraseña.")
      return
    }
    setLoggingIn(true)
    try {
      await login(loginEmail, loginPassword)
      toast.success("Sesión Iniciada", "Conectado al servidor de Extra Supermercado.")
      setShowLoginModal(false)
      loadCatalog()
      loadMermas()
      loadSugerenciasReposicion()
    } catch {
      toast.error("Error de Autenticación", "Usuario o contraseña incorrectos.")
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 pb-28 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* ── AMBIENT GLASS BACKGROUND (AURORA GLOWS) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr from-amber-500/15 via-orange-600/10 to-transparent blur-[120px]" />
        <div className="absolute top-[40%] -right-[15%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-emerald-500/10 via-teal-600/10 to-transparent blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-indigo-600/15 to-transparent blur-[130px]" />
      </div>

      {/* ── HEADER SALÓN DE OPERACIONES (GLASS FLOATING ISLAND) ── */}
      <header className="sticky top-2 z-40 mx-3 sm:mx-6 max-w-4xl lg:mx-auto mt-2">
        <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between gap-3">
            
            {/* Logotipo & Operador */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-slate-950" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-900"></span>
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm tracking-wider uppercase bg-gradient-to-r from-amber-400 via-white to-amber-200 bg-clip-text text-transparent" style={displayFont}>
                    EXTRA SALÓN
                  </span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Floor Ops • PYG ₲
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                  <span>Operador:</span>
                  <strong className="text-slate-200 font-semibold">{user?.nombre || "Encargado de Salón"}</strong>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400/90 font-mono text-[10px]">11.628 Prod.</span>
                </div>
              </div>
            </div>

            {/* Acciones de Cabecera */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Botón Descarga APK */}
              <a
                href="/download/extra-salon.apk"
                download="extra-salon.apk"
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-emerald-400 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold backdrop-blur-md"
                title="Descargar APK para Colector de Datos Android"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">APK</span>
              </a>

              {/* Botón Cola de Impresión */}
              <button
                onClick={() => setShowQueueModal(true)}
                className="relative px-3 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 transition cursor-pointer flex items-center gap-1.5 text-xs font-black backdrop-blur-md"
                title="Ver Cola de Flejes"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Flejes</span>
                <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-xs">
                  {labelQueue.length}
                </span>
              </button>

              {!user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-3 py-2 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Acceso</span>
                </button>
              )}

              <button
                onClick={toggleTheme}
                className="p-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 cursor-pointer"
                title="Cambiar Contraste"
              >
                {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
              </button>
            </div>
          </div>

          {/* Mini Tira de Estado Operativo */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5">
            <div className="rounded-2xl p-2 text-center bg-white/[0.03] border border-white/5 backdrop-blur-sm">
              <div className="font-black text-sm text-slate-200" style={monoFont}>
                {butcheryOrders.length + bakeryOrders.length + rotiseriaPlanes.length}
              </div>
              <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider truncate">
                Lotes Prod.
              </div>
            </div>

            <div className={`rounded-2xl p-2 text-center border transition backdrop-blur-sm ${
              labelQueue.length > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-white/[0.03] border-white/5 text-slate-400"
            }`}>
              <div className="font-black text-sm" style={monoFont}>
                {labelQueue.length}
              </div>
              <div className="text-[9px] uppercase font-bold tracking-wider truncate">
                Flejes Cola
              </div>
            </div>

            <div className={`rounded-2xl p-2 text-center border transition backdrop-blur-sm ${
              mermasList.length > 0 ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-white/[0.03] border-white/5 text-slate-400"
            }`}>
              <div className="font-black text-sm" style={monoFont}>
                {mermasList.length}
              </div>
              <div className="text-[9px] uppercase font-bold tracking-wider truncate">
                Mermas Hoy
              </div>
            </div>

            <div className={`rounded-2xl p-2 text-center border transition backdrop-blur-sm ${
              reposiciones.filter(r => r.estado === "pendiente").length > 0 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-white/[0.03] border-white/5 text-slate-400"
            }`}>
              <div className="font-black text-sm" style={monoFont}>
                {reposiciones.filter(r => r.estado === "pendiente").length}
              </div>
              <div className="text-[9px] uppercase font-bold tracking-wider truncate">
                Quiebres
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL DEL SALÓN ── */}
      <main className="relative z-10 p-3 sm:p-6 max-w-4xl mx-auto space-y-5 mt-2">
        
        {/* ══════════════════════ TAB 1: AUDITORÍA DE GÓNDOLA & ESCÁNER CÁMARA ══════════════════════ */}
        {tab === "gondola" && (
          <div className="space-y-5 animate-fade-in">
            
            {/* ── BARRA DE BÚSQUEDA Y BOTÓN DE CÁMARA EN VIVO ── */}
            <div className="backdrop-blur-2xl bg-slate-900/65 border border-white/10 p-4 sm:p-5 rounded-3xl shadow-xl space-y-3">
              <form onSubmit={handleScanSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Scan className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" />
                  <input
                    id="salon-barcode-input"
                    type="text"
                    value={barcodeQuery}
                    onChange={(e) => setBarcodeQuery(e.target.value)}
                    placeholder="Escanear código de barra (EAN-13) o buscar por nombre..."
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-950/80 border border-white/15 text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition shadow-inner"
                  />
                  {searchingProduct && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-400" />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={searchingProduct}
                  className="px-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer shrink-0 active:scale-95 transition-all"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Buscar</span>
                </button>

                {/* BOTÓN TOGGLE CÁMARA */}
                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) {
                      stopCamera()
                    } else {
                      startCamera()
                    }
                  }}
                  className={`px-3.5 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shrink-0 transition-all border active:scale-95 ${
                    cameraActive
                      ? "bg-rose-600/20 border-rose-500/40 text-rose-400 shadow-lg shadow-rose-600/20"
                      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/20"
                  }`}
                  title={cameraActive ? "Detener Cámara" : "Activar Escáner Cámara"}
                >
                  {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4 animate-pulse" />}
                  <span className="hidden sm:inline">{cameraActive ? "Cerrar" : "Cámara"}</span>
                </button>
              </form>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Pistola Láser USB/Bluetooth lista en tiempo real</span>
                </div>
                <div className="font-mono text-slate-500 text-[10px]">
                  Catálogo: 11.628 ítems conectados
                </div>
              </div>

              {!cameraActive && cameraPermission !== "unknown" && (
                <div className={`flex items-center gap-1.5 px-1 text-[10px] font-bold ${
                  cameraPermission === "granted" ? "text-emerald-400" : cameraPermission === "denied" ? "text-rose-400" : "text-slate-500"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    cameraPermission === "granted" ? "bg-emerald-400" : cameraPermission === "denied" ? "bg-rose-400" : "bg-slate-500"
                  }`} />
                  {cameraPermission === "granted" && "Permiso de cámara ya concedido -- listo para escanear"}
                  {cameraPermission === "denied" && "Permiso de cámara denegado -- habilitalo en el navegador/dispositivo"}
                  {cameraPermission === "prompt" && "El navegador va a pedir permiso de cámara al activarla"}
                </div>
              )}
            </div>

            {/* ── VISOR HOLOGRÁFICO DE CÁMARA (GLASSMORPHIC VIEWPORT) ── */}
            {cameraActive && (
              <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_50px_rgba(245,158,11,0.25)] bg-black animate-fade-in">
                
                {/* Video feed */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-64 sm:h-80 object-cover"
                />

                {/* Overlay de Puntería Cibernética (HUD) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 sm:w-80 h-36 sm:h-44 border border-amber-400/40 rounded-2xl backdrop-contrast-125">
                    {/* Esquinas Neón */}
                    <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-[0_0_10px_#f59e0b]" />
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-[0_0_10px_#f59e0b]" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-[0_0_10px_#f59e0b]" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-[0_0_10px_#f59e0b]" />

                    {/* Láser escaneador animado */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Controles Flotantes del Visor */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Enfocá el código de barras</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasTorch && (
                      <button
                        onClick={toggleTorch}
                        className={`p-2 rounded-full backdrop-blur-md border transition cursor-pointer ${
                          torchActive
                            ? "bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/50"
                            : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                        }`}
                        title="Linterna"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={switchCamera}
                      className="px-2.5 py-1.5 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title={activeCameraLabel || "Cambiar Cámara"}
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      <span className="text-[10px]">
                        {activeCameraLabel ? (activeCameraLabel.includes("Trasera") ? "Trasera" : activeCameraLabel.includes("Frontal") ? "Frontal" : "Cámara") : "Cámara"}
                        {availableCameras.length > 1 ? ` (${Math.max(1, availableCameras.findIndex(c => c.deviceId === selectedCameraId) + 1)}/${availableCameras.length})` : ""}
                      </span>
                    </button>

                    <button
                      onClick={stopCamera}
                      className="p-2 rounded-full bg-rose-600/80 text-white border border-rose-400/40 hover:bg-rose-600 backdrop-blur-md cursor-pointer"
                      title="Cerrar Cámara"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtítulo inferior en video */}
                <div className="absolute bottom-3 left-3 right-3 text-center pointer-events-none">
                  <span className="inline-block px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[10.5px] font-medium text-slate-300 border border-white/10">
                    Soporta EAN-13, EAN-8, Code-128, QR Code y UPC
                  </span>
                </div>
              </div>
            )}

            {/* Error de cámara */}
            {cameraError && (
              <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <strong>Acceso a Cámara:</strong> {cameraError}
                </div>
              </div>
            )}

            {/* ── FICHA TÉCNICA DEL PRODUCTO ESCANEADO (GLASSMORPHIC CARD) ── */}
            {scannedProduct ? (
              <div className="rounded-3xl backdrop-blur-2xl bg-slate-900/80 border-2 border-amber-500/40 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-fade-in space-y-5">
                
                {/* Cabecera del Producto */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {scannedProduct.categoria?.nombre || "Salón de Ventas"}
                      </span>
                      {(scannedProduct as any).departamento && (
                        <span className="text-[10px] font-bold text-slate-400">
                          • {(scannedProduct as any).departamento}
                        </span>
                      )}
                    </div>

                    <h2 className="font-black text-xl sm:text-2xl text-white tracking-tight">
                      {scannedProduct.nombre}
                    </h2>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>EAN: <strong className="text-slate-200">{scannedProduct.codigo_barra || "Sin Código"}</strong></span>
                      <span>•</span>
                      <span>SKU: <strong className="text-slate-200">{scannedProduct.sku || "-"}</strong></span>
                    </div>
                  </div>

                  {/* Display de Precio Oficial Caja */}
                  <div className="sm:text-right shrink-0 p-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Precio Oficial Caja</div>
                    <div className="font-black text-2xl sm:text-3xl text-amber-400" style={monoFont}>
                      {formatPYG(scannedProduct.precio_venta || scannedProduct.precio || 0)}
                    </div>
                    {scannedProduct.precio_mayorista && (
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Mayorista: {formatPYG(scannedProduct.precio_mayorista)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fila de Stock Real en Vivo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Stock Góndola</div>
                    <div className="font-black text-base text-slate-200" style={monoFont}>
                      {loadingStock ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : `${scannedStock?.stock_salon ?? (scannedProduct as any).stock_actual ?? (scannedProduct as any).stock ?? 0} un.`}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Stock Trastienda</div>
                    <div className="font-black text-base text-slate-200" style={monoFont}>
                      {loadingStock ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : `${scannedStock?.stock_deposito ?? 0} un.`}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Costo Reposición</div>
                    <div className="font-black text-base text-slate-200" style={monoFont}>
                      {formatPYG(scannedProduct.ultimo_costo || scannedProduct.costo_promedio || 0)}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Margen Teórico</div>
                    <div className="font-black text-base text-emerald-400" style={monoFont}>
                      {(() => {
                        const p = scannedProduct.precio_venta || scannedProduct.precio || 0
                        const c = scannedProduct.ultimo_costo || scannedProduct.costo_promedio || 0
                        if (!p || !c) return "—"
                        const m = ((p - c) / p) * 100
                        return `${m.toFixed(1)}%`
                      })()}
                    </div>
                  </div>
                </div>

                {/* Validador de Precio en Góndola con Alarma Sonora */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    ¿Qué precio exhibe el fleje en góndola?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={precioVistoGondola}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "")
                        setPrecioVistoGondola(val)
                        if (val) {
                          const visto = parseFloat(val) || 0
                          const oficial = scannedProduct.precio_venta || scannedProduct.precio || 0
                          if (visto !== oficial && visto > 0) {
                            soundAlerts.playPriceMismatchAlert()
                          }
                        }
                      }}
                      placeholder="Ingrese precio visto en góndola (₲)..."
                      className="flex-1 bg-slate-950/90 border border-white/20 rounded-xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                      style={monoFont}
                    />

                    {precioVistoGondola && (() => {
                      const visto = parseFloat(precioVistoGondola) || 0
                      const oficial = scannedProduct.precio_venta || scannedProduct.precio || 0
                      if (visto === oficial) {
                        return (
                          <div className="px-3.5 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/10">
                            <CheckCircle2 className="w-4 h-4" /> Fleje Correcto
                          </div>
                        )
                      }
                      return (
                        <div className="px-3.5 py-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 font-black text-xs flex items-center gap-1.5 shrink-0 animate-pulse shadow-lg shadow-rose-500/20">
                          <AlertTriangle className="w-4 h-4" /> ¡Discrepancia!
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Acciones Rápidas del Encargado en Góndola */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <button
                    onClick={() => handleAddToLabelQueue(scannedProduct, "falta_fleje", 1)}
                    className="py-3 px-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>+ Fleje Góndola</span>
                  </button>

                  <button
                    onClick={() => handleAddToLabelQueue(scannedProduct, "markdown", 1, 30)}
                    className="py-3 px-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <Percent className="w-4 h-4" />
                    <span>Rebaja -30% Vencimiento</span>
                  </button>

                  <button
                    onClick={() => {
                      setMermaProd(scannedProduct)
                      setTab("mermas")
                    }}
                    className="py-3 px-3 rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 font-black text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Declarar Merma</span>
                  </button>

                  <button
                    onClick={() => {
                      setRepoProd(scannedProduct)
                      setTab("reposicion")
                    }}
                    className="py-3 px-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 font-black text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Pedir Reposición</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Estado Inicial de Auditoría */
              <div className="backdrop-blur-2xl bg-slate-900/50 border border-white/10 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <Scan className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white" style={displayFont}>
                    Auditoría de Góndola en Vivo
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Presioná el botón <strong className="text-emerald-400">"Cámara"</strong> para escanear con la cámara del dispositivo, o usá una pistola lectora láser conectada por USB o Bluetooth. Conectado a la base oficial de Extra Supermercado.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => startCamera()}
                    className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    Activar Cámara Ahora
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB 2: PRODUCCIÓN REAL EN SECTORES ══════════════════════ */}
        {tab === "produccion" && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Selector de Sector Productivo Glass */}
            <div className="backdrop-blur-2xl bg-slate-900/65 border border-white/10 p-2 rounded-3xl grid grid-cols-3 gap-2">
              {[
                { id: "carniceria", label: "🥩 Carnicería", sub: "Desposte Gancho" },
                { id: "panaderia", label: "🥖 Pan & Rotisería", sub: "Horneada & Cocción" },
                { id: "verduleria", label: "🥕 Verdulería", sub: "Frescos & Lotes" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setProduccionSector(s.id as ProduccionSector)}
                  className={`p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    produccionSector === s.id
                      ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-[1.02]"
                      : "bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 border border-white/5"
                  }`}
                >
                  <div className="font-black text-xs truncate">{s.label}</div>
                  <div className="text-[10px] opacity-75 truncate">{s.sub}</div>
                </button>
              ))}
            </div>

            {/* ── SUB-SECTOR 1: CARNICERÍA (DESPOSTE DE GANCHO & CORTES REALES) ── */}
            {produccionSector === "carniceria" && (
              <div className="space-y-4 animate-fade-in">
                
                {/* Sub-selector Carnicería */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                  {[
                    { id: "desposte", label: "🥩 Desposte Gancho" },
                    { id: "templates", label: `📋 Plantillas (${butcheryTemplates.length})` },
                    { id: "rendimiento", label: `📊 Rendimiento (${yieldReport.length || butcheryOrders.length})` },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSubSectorCarniceria(sub.id as any)}
                      className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition cursor-pointer text-center truncate ${
                        subSectorCarniceria === sub.id
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* SUB-MODO 1: WIZARD DE DESPOSTE */}
                {subSectorCarniceria === "desposte" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-red-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-red-600/30 border border-red-500/40 text-red-400 flex items-center justify-center font-black">
                          <Beef className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-black text-sm text-white" style={displayFont}>
                            Desposte por Rendimiento Oficial
                          </h2>
                          <div className="text-[11px] text-slate-400">
                            Deconstrucción de res contra plantilla de despiece con costeo por corte.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadCarniceriaData()}
                        disabled={loadingCarniceria}
                        className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                        title="Actualizar plantillas y órdenes"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${loadingCarniceria ? "animate-spin text-red-400" : ""}`} />
                      </button>
                    </div>

                    <form onSubmit={handleEjecutarDesposte} className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Plantilla de Cortes (Especie / Categoría):
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowTemplateModal(true)}
                            className="text-[10px] text-red-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Nueva Plantilla</span>
                          </button>
                        </div>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-red-400"
                        >
                          {butcheryTemplates.length === 0 ? (
                            <option value="">-- Sin plantillas cargadas (creá una con + Nueva Plantilla) --</option>
                          ) : (
                            butcheryTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nombre} ({t.especie || "Vacuno"}) • {t.cuts?.length || 0} cortes
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Peso en Gancho (Kg):
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={despostePesoEntrada}
                            onChange={(e) => setDespostePesoEntrada(Number(e.target.value) || 0)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-red-400"
                            style={monoFont}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Costo Total Compra (₲):
                          </label>
                          <input
                            type="text"
                            value={desposteCostoTotal ? desposteCostoTotal.toLocaleString("es-PY") : ""}
                            onChange={(e) => setDesposteCostoTotal(Number(e.target.value.replace(/\D/g, "")) || 0)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-red-400"
                            style={monoFont}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Fecha Vencimiento Cortes:
                          </label>
                          <input
                            type="date"
                            value={desposteVencimiento}
                            onChange={(e) => setDesposteVencimiento(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Nro. Tropa / SENACSA / Notas:
                          </label>
                          <input
                            type="text"
                            value={desposteNotas}
                            onChange={(e) => setDesposteNotas(e.target.value)}
                            placeholder="Ej: Tropa 402 - Frigomerc"
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-400"
                          />
                        </div>
                      </div>

                      {/* Barra de KPIs en Vivo del Desposte */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500">Costo / Kg Gancho</div>
                          <div className="font-black text-xs sm:text-sm text-slate-200" style={monoFont}>
                            {formatPYG(desposteCalculo.costoKgGancho)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500">Valorizado Venta</div>
                          <div className="font-black text-xs sm:text-sm text-emerald-400" style={monoFont}>
                            {formatPYG(desposteCalculo.valorizadoTotal)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500">Margen Bruto</div>
                          <div className="font-black text-xs sm:text-sm text-amber-400" style={monoFont}>
                            {desposteCalculo.margenPct.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Desglose de Rendimiento Estimado por Corte */}
                      <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1.5 max-h-48 overflow-y-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Cortes Estimados ({desposteCortesEstimados.length})</span>
                          <span className="text-red-400 font-mono">100% Gancho</span>
                        </div>
                        {desposteCortesEstimados.map((c: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0 font-medium">
                            <span className="text-slate-300 truncate max-w-[170px]">{c.nombre || c.corte_nombre}</span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-slate-400 text-[11px]">{Number(c.kg_estimado || 0).toFixed(1)} kg</span>
                              <span className="text-emerald-400 text-[11px]">{formatPYG(c.valor_venta || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={ejecutandoDesposte}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                      >
                        {ejecutandoDesposte ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Scale className="w-4 h-4" />
                        )}
                        <span>Ejecutar Desposte Oficial en Sistema</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* SUB-MODO 2: PLANTILLAS DE CORTES */}
                {subSectorCarniceria === "templates" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-red-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h2 className="font-black text-sm text-white" style={displayFont}>
                          Plantillas de Desposte Oficiales ({butcheryTemplates.length})
                        </h2>
                        <div className="text-[11px] text-slate-400">
                          Catálogo de especies y rendimientos base configurados en Extra.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTemplateModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nueva</span>
                      </button>
                    </div>

                    {butcheryTemplates.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5">
                        Sin plantillas registradas. Tocá "+ Nueva" para crear la primera plantilla.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {butcheryTemplates.map((t) => (
                          <div key={t.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-xs text-white flex items-center gap-2">
                                  <span>{t.nombre}</span>
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                    {t.especie || "Vacuno"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Peso prom: {t.peso_promedio_kg || 250} Kg • {t.descripcion || "Desposte de res"}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTemplateId(t.id)
                                  setSubSectorCarniceria("desposte")
                                }}
                                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold border border-white/10 cursor-pointer"
                              >
                                Usar
                              </button>
                            </div>

                            {t.cuts && t.cuts.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                                {t.cuts.slice(0, 5).map((c: any, ci: number) => (
                                  <span key={ci} className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[9px] text-slate-300 font-mono">
                                    {c.nombre}: {c.rendimiento_porcentual}%
                                  </span>
                                ))}
                                {t.cuts.length > 5 && (
                                  <span className="text-[9px] text-slate-500 self-center">+{t.cuts.length - 5} más</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-MODO 3: HISTORIAL & REPORTE DE RENDIMIENTO */}
                {subSectorCarniceria === "rendimiento" && (
                  <div className="space-y-4">
                    {/* Reporte de Rendimiento por Cortes */}
                    <div className="backdrop-blur-2xl bg-slate-900/70 border border-red-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div>
                          <h2 className="font-black text-sm text-white" style={displayFont}>
                            Reporte Oficial de Rendimiento por Corte
                          </h2>
                          <div className="text-[11px] text-slate-400">
                            Rendimiento real acumulado por desposte y corte comercial.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadCarniceriaData()}
                          disabled={loadingCarniceria}
                          className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                        >
                          <RefreshCcw className={`w-3.5 h-3.5 ${loadingCarniceria ? "animate-spin text-red-400" : ""}`} />
                        </button>
                      </div>

                      {yieldReport.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5">
                          El reporte de rendimiento se alimenta automáticamente conforme se completan despostes en el sistema.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {yieldReport.map((r: any, ri: number) => (
                            <div key={ri} className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white truncate">{r.producto_nombre || r.corte_nombre || "Corte"}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                  Costo prom: {r.costo_unitario ? formatPYG(r.costo_unitario) : "—"}
                                </div>
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <div className="font-black text-sm text-emerald-400">{r.rendimiento_pct ? `${parseFloat(r.rendimiento_pct).toFixed(1)}%` : "—"}</div>
                                <span className="text-[10px] text-slate-400">{parseFloat(r.kg_producidos || r.total_obtenido || 0).toFixed(1)} kg</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Historial de Órdenes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                          Despostes Registrados ({butcheryOrders.length})
                        </h3>
                        <span className="text-[10px] text-red-400 font-mono">Stock en Gaveta</span>
                      </div>
                      {butcheryOrders.length === 0 ? (
                        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                          No hay órdenes de desposte en el sistema.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {butcheryOrders.slice(0, 10).map((o: any) => (
                            <div key={o.id} className="p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/10 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                    {o.estado || "completada"}
                                  </span>
                                  <div className="font-bold text-xs text-white truncate">
                                    {o.receta_nombre || o.notas || "Desposte de Gancho"}
                                  </div>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  {o.created_at ? new Date(o.created_at).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "Turno actual"} • {o.responsable_nombre || user?.nombre || "Encargado"}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-sm text-white" style={monoFont}>
                                  {Number(o.cantidad_objetivo || o.producto_obtenido || 0).toFixed(1)} Kg
                                </div>
                                <span className="text-[9px] text-emerald-400 font-bold uppercase">En Balanza</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── SUB-SECTOR 2: PANADERÍA & ROTISERÍA REAL ── */}
            {produccionSector === "panaderia" && (
              <div className="space-y-4 animate-fade-in">
                
                {/* Selector de Modo Panadería */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                  {[
                    { id: "panaderia", label: "🥖 Horneada Diaria" },
                    { id: "rotiseria", label: "🍗 Rotisería Caliente" },
                    { id: "calculadora", label: "⚖️ % Panadero" },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setPanSubSector(sub.id as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer text-center ${
                        panSubSector === sub.id
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* MODO 1: HORNEADA DE PANADERÍA */}
                {panSubSector === "panaderia" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-amber-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
                          <ChefHat className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-black text-sm text-white" style={displayFont}>
                            Registro de Horneada Oficial
                          </h2>
                          <div className="text-[11px] text-slate-400">
                            Ingreso directo a stock de piezas terminadas contra fórmulas activas.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBakeryRecipeModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nueva Receta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => loadPanaderiaData()}
                          disabled={loadingPanaderia}
                          className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                        >
                          <RefreshCcw className={`w-3.5 h-3.5 ${loadingPanaderia ? "animate-spin text-amber-400" : ""}`} />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleRegistrarBakeryOrder} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Receta de Panadería:
                        </label>
                        <select
                          value={selectedBakeryRecipeId}
                          onChange={(e) => setSelectedBakeryRecipeId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                        >
                          {bakeryRecipes.length === 0 ? (
                            <option value="">-- Sin recetas cargadas en el sistema --</option>
                          ) : (
                            bakeryRecipes.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre} • Rendimiento: {r.rendimiento_piezas || 0} pzas • Costo: {formatPYG(r.costo_unitario || r.costo_estimado || 0)}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Piezas / Kg Producidos:
                          </label>
                          <input
                            type="number"
                            value={bakeryProdQty}
                            onChange={(e) => setBakeryProdQty(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                            style={monoFont}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Fecha Vencimiento:
                          </label>
                          <input
                            type="date"
                            value={bakeryProdVenc}
                            onChange={(e) => setBakeryProdVenc(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Observación / Turno de Cocción:
                        </label>
                        <input
                          type="text"
                          value={bakeryProdNotas}
                          onChange={(e) => setBakeryProdNotas(e.target.value)}
                          placeholder="Ej: Turno Mañana 06:30 - Horno 1"
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={registrandoBakery || bakeryRecipes.length === 0}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                      >
                        {registrandoBakery ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChefHat className="w-4 h-4" />}
                        <span>Registrar Horneada y Aumentar Stock</span>
                      </button>
                    </form>

                    {/* Planes de Horneado Programados */}
                    {bakeryPlanes.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Planes Semanales Programados ({bakeryPlanes.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {bakeryPlanes.slice(0, 4).map((p: any) => (
                            <div key={p.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-200">{p.nombre}</span>
                              <span className="text-[10px] text-amber-400 font-mono">Día: {p.dia_semana}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Órdenes Recientes de Panadería */}
                    {bakeryOrders.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Horneadas Recientes ({bakeryOrders.length})
                        </div>
                        <div className="space-y-1.5">
                          {bakeryOrders.slice(0, 5).map((bo: any) => (
                            <div key={bo.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-white">{bo.receta_nombre || bo.notas || "Horneada"}</span>
                                <div className="text-[10px] text-slate-400">{bo.created_at ? new Date(bo.created_at).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "Turno hoy"}</div>
                              </div>
                              <span className="font-mono font-bold text-amber-400">{Number(bo.cantidad_objetivo || bo.producto_obtenido || 0)} un.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODO 2: ROTISERÍA CALIENTE */}
                {panSubSector === "rotiseria" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-orange-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-black">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-black text-sm text-white" style={displayFont}>
                            Cocción & Rotisería Caliente
                          </h2>
                          <div className="text-[11px] text-slate-400">
                            Planes de cocción con temperatura HACCP y liquidación de productos listos.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRotiRecipeModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-orange-500/20 border border-orange-500/30 hover:bg-orange-500/30 text-orange-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nueva Receta</span>
                        </button>
                        <button
                          onClick={handleAutoMarkdownRoti}
                          disabled={aplicandoAutoMarkdownRoti}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Aplicar descuentos a productos próximos a vencer"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Markdown Auto</span>
                        </button>
                      </div>
                    </div>

                    {/* KPIs de Rotisería */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-500">Ventas Hoy</div>
                        <div className="font-black text-xs sm:text-sm text-emerald-400" style={monoFont}>
                          {formatPYG(rotiseriaDash?.ventas_hoy_gs || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-500">Hornadas Hoy</div>
                        <div className="font-black text-xs sm:text-sm text-amber-400" style={monoFont}>
                          {rotiseriaDash?.planes_hoy || rotiseriaPlanes.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-500">Merma %</div>
                        <div className="font-black text-xs sm:text-sm text-rose-400" style={monoFont}>
                          {(rotiseriaDash?.merma_pct || 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Formulario Nuevo Plan de Rotisería */}
                    <form onSubmit={handleCrearRotiPlan} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Preparado o Receta:
                        </label>
                        <select
                          value={selectedRotiRecipeId}
                          onChange={(e) => {
                            setSelectedRotiRecipeId(e.target.value)
                            const rec = rotiseriaRecipes.find(r => r.id === e.target.value)
                            if (rec) setRotiPlanDesc(rec.nombre)
                          }}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-orange-400"
                        >
                          <option value="">-- Seleccionar o escribir descripción manual --</option>
                          {rotiseriaRecipes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre} • Costo: {formatPYG(r.costo_estimado || 0)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Descripción / Lote de Horneado:
                        </label>
                        <input
                          type="text"
                          value={rotiPlanDesc}
                          onChange={(e) => setRotiPlanDesc(e.target.value)}
                          placeholder="Ej: Pollos al Spiedo - Tanda Mediodía"
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-orange-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Temp. Objetivo (°C):
                          </label>
                          <input
                            type="number"
                            value={rotiPlanTemp}
                            onChange={(e) => setRotiPlanTemp(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-400"
                            style={monoFont}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Tiempo Cocción (Min):
                          </label>
                          <input
                            type="number"
                            value={rotiPlanTiempo}
                            onChange={(e) => setRotiPlanTiempo(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-400"
                            style={monoFont}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={guardandoRotiPlan}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 cursor-pointer active:scale-95 transition-all"
                      >
                        {guardandoRotiPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                        <span>Iniciar Hornada de Rotisería</span>
                      </button>
                    </form>

                    {/* Lista de Hornadas Activas */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Hornadas del Día ({rotiseriaPlanes.length})
                      </div>
                      {rotiseriaPlanes.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">Sin planes de rotisería hoy.</div>
                      ) : (
                        <div className="space-y-2">
                          {rotiseriaPlanes.slice(0, 6).map((p: any) => (
                            <div key={p.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-2">
                              <div>
                                <div className="font-bold text-xs text-white">{p.descripcion || p.nombre}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Meta: {p.temperatura_objetivo}°C • {p.tiempo_coccion_min} min
                                </div>
                              </div>
                              <div className="text-right">
                                {p.estado === "completado" ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Listo
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setCompletandoRotiId(p.id)}
                                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer shadow-sm"
                                  >
                                    Completar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* MODO 3: CALCULADORA PANADERO RÁPIDA */}
                {panSubSector === "calculadora" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="font-black text-sm text-white" style={displayFont}>
                          Calculadora de % Panadero
                        </h2>
                        <div className="text-[11px] text-slate-400">
                          Dosificación automática de agua, sal, levadura y grasa sobre kilos de harina.
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Kilos de Harina Base (100%):
                      </label>
                      <input
                        type="number"
                        value={harinaKg}
                        onChange={(e) => setHarinaKg(Number(e.target.value) || 0)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-lg font-black text-amber-400 outline-none focus:border-amber-400"
                        style={monoFont}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">💧 Hidratación ({hidratPct}%)</span>
                        <input
                          type="number"
                          value={hidratPct}
                          onChange={(e) => setHidratPct(Number(e.target.value) || 0)}
                          className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono text-white"
                        />
                        <div className="font-black text-sm text-blue-400 font-mono">
                          {((harinaKg * hidratPct) / 100).toFixed(2)} L
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">🧂 Sal ({salPct}%)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={salPct}
                          onChange={(e) => setSalPct(Number(e.target.value) || 0)}
                          className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono text-white"
                        />
                        <div className="font-black text-sm text-slate-200 font-mono">
                          {((harinaKg * salPct) / 100).toFixed(2)} Kg
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">🍞 Levadura ({levPct}%)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={levPct}
                          onChange={(e) => setLevPct(Number(e.target.value) || 0)}
                          className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono text-white"
                        />
                        <div className="font-black text-sm text-amber-300 font-mono">
                          {((harinaKg * levPct) / 100).toFixed(2)} Kg
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">🧈 Grasa ({grasaPct}%)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={grasaPct}
                          onChange={(e) => setGrasaPct(Number(e.target.value) || 0)}
                          className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono text-white"
                        />
                        <div className="font-black text-sm text-orange-400 font-mono">
                          {((harinaKg * grasaPct) / 100).toFixed(2)} Kg
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                      <span className="font-bold text-xs text-amber-300">Peso Total de Masa Resultante:</span>
                      <span className="font-black text-base text-amber-400 font-mono">
                        {(harinaKg * (1 + (hidratPct + salPct + levPct + grasaPct) / 100)).toFixed(2)} Kg
                      </span>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── SUB-SECTOR 3: VERDULERÍA & HORTIFRUTI FRESCOS REAL ── */}
            {produccionSector === "verduleria" && (
              <div className="space-y-4 animate-fade-in">
                
                {/* Selector de Sub-Modo Verdulería */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                  {[
                    { id: "frescura", label: "🌿 Auditoría Frescura" },
                    { id: "lotes", label: `📦 Lotes (${receiveBatches.length})` },
                    { id: "markdown", label: "🏷️ Liquidación Auto" },
                    { id: "scorecards", label: `⭐ Proveedores (${scorecards.length})` },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setVerduraSubSector(sub.id as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer text-center truncate ${
                        verduraSubSector === sub.id
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* MODO 1: AUDITORÍA DE FRESCURA EN GÓNDOLA */}
                {verduraSubSector === "frescura" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-emerald-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-black text-sm text-white" style={displayFont}>
                            Auditoría Sensorial de Frescura
                          </h2>
                          <div className="text-[11px] text-slate-400">
                            Scoring de maduración en góndola. Dispara markdown automático si es regular o malo.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadVerduleriaData()}
                        disabled={loadingVerduleria}
                        className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${loadingVerduleria ? "animate-spin text-emerald-400" : ""}`} />
                      </button>
                    </div>

                    <form onSubmit={handleGuardarAuditoriaFrescura} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Producto Hortícola a Auditar:
                        </label>
                        <select
                          value={auditProdId || scannedProduct?.id || ""}
                          onChange={(e) => setAuditProdId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-400"
                        >
                          <option value="">-- Seleccionar fruta o verdura --</option>
                          {products.slice(0, 100).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.codigo_barra || p.sku || "Sin código"})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Calidad Sensorial Táctil */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                          Estado de Calidad:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: "bueno", label: "Óptimo", sub: "100% Comercial", color: "bg-emerald-500/20 border-emerald-500 text-emerald-300" },
                            { id: "regular", label: "Maduro", sub: "-20% Markdown", color: "bg-amber-500/20 border-amber-500 text-amber-300" },
                            { id: "malo", label: "Crítico", sub: "-50% Sell-Out", color: "bg-rose-500/20 border-rose-500 text-rose-300" },
                          ].map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setAuditCalidad(g.id as any)}
                              className={`p-2.5 rounded-2xl border text-center transition cursor-pointer ${
                                auditCalidad === g.id
                                  ? `${g.color} ring-2 ring-white/20 font-black scale-[1.02]`
                                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                              }`}
                            >
                              <div className="font-bold text-xs">{g.label}</div>
                              <div className="text-[9px] opacity-80">{g.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Escala de Puntuación Sensorial 1 a 5 */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Firmeza (1-5)</label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setAuditFirmeza(num)}
                                className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold ${
                                  auditFirmeza === num ? "bg-emerald-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Color (1-5)</label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setAuditColor(num)}
                                className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold ${
                                  auditColor === num ? "bg-emerald-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Aspecto (1-5)</label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setAuditAspecto(num)}
                                className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold ${
                                  auditAspecto === num ? "bg-emerald-500 text-slate-950 font-black" : "bg-white/5 text-slate-400"
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Observación de Frescura en Góndola:
                        </label>
                        <input
                          type="text"
                          value={auditNotas}
                          onChange={(e) => setAuditNotas(e.target.value)}
                          placeholder="Ej: Batea refrigerada centro, inicio de deshidratación leve..."
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={guardandoAuditoria}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                      >
                        {guardandoAuditoria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Carrot className="w-4 h-4" />}
                        <span>Guardar Auditoría de Frescura</span>
                      </button>
                    </form>

                    {/* Historial de Auditorías Recientes */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Auditorías Recientes ({freshnessAudits.length})
                      </div>
                      {freshnessAudits.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">Sin auditorías cargadas hoy.</div>
                      ) : (
                        <div className="space-y-2">
                          {freshnessAudits.slice(0, 5).map((a: any) => (
                            <div key={a.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-2">
                              <div>
                                <div className="font-bold text-xs text-white truncate max-w-[200px]">
                                  {a.producto_nombre || a.producto_id}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Firmeza: {a.firmeza}/5 • Color: {a.color}/5 • {a.notas || "Sin nota"}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  a.calidad_actual === "bueno" ? "bg-emerald-500/20 text-emerald-400" :
                                  a.calidad_actual === "regular" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"
                                }`}>
                                  {a.calidad_actual}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* MODO 2: LOTES RECIBIDOS EN VERDULERÍA */}
                {verduraSubSector === "lotes" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="border-b border-white/10 pb-3">
                      <h2 className="font-black text-sm text-white" style={displayFont}>
                        Recepción de Lote Hortifruti
                      </h2>
                      <div className="text-[11px] text-slate-400">
                        Ingreso de cajones y pesaje de frutas/verduras con clasificación de calidad A/B/C.
                      </div>
                    </div>

                    <form onSubmit={handleGuardarRecepcionProduce} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Producto Hortícola:
                        </label>
                        <select
                          value={recepProdId || scannedProduct?.id || ""}
                          onChange={(e) => setRecepProdId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-emerald-400"
                        >
                          <option value="">-- Seleccionar producto recibido --</option>
                          {products.slice(0, 100).map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Cantidad (Kg o Cajas):
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={recepCant}
                            onChange={(e) => setRecepCant(e.target.value)}
                            placeholder="Ej: 50"
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-emerald-400"
                            style={monoFont}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Precio Unitario (₲):
                          </label>
                          <input
                            type="text"
                            value={recepPrecioUni}
                            onChange={(e) => setRecepPrecioUni(e.target.value.replace(/\D/g, ""))}
                            placeholder="Ej: 8500"
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-emerald-400"
                            style={monoFont}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Clasificación Calidad:
                          </label>
                          <select
                            value={recepCalidad}
                            onChange={(e) => setRecepCalidad(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-400"
                          >
                            <option value="A">Clase A (Premium)</option>
                            <option value="B">Clase B (Comercial)</option>
                            <option value="C">Clase C (Económica / Oferta)</option>
                            <option value="D">Clase D (Para Proceso)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                            Vencimiento Estimado:
                          </label>
                          <input
                            type="date"
                            value={recepVencimiento}
                            onChange={(e) => setRecepVencimiento(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={guardandoRecepcion}
                        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer active:scale-95 transition-all"
                      >
                        {guardandoRecepcion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                        <span>Ingresar Lote de Hortifruti</span>
                      </button>
                    </form>

                    {/* Lista de Lotes Recibidos */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Lotes Activos ({receiveBatches.length})
                      </div>
                      {receiveBatches.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">Sin lotes activos recibidos.</div>
                      ) : (
                        receiveBatches.slice(0, 8).map((b: any) => (
                          <div key={b.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-white">{b.producto_nombre || b.producto_id}</span>
                              <div className="text-[10px] text-slate-400 font-mono">Calidad: {b.calidad} • {b.fecha_recepcion}</div>
                            </div>
                            <span className="font-mono font-black text-emerald-400">{b.cantidad_aceptada || b.cantidad_recibida} kg</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* MODO 3: LIQUIDACIÓN INTELIGENTE DE VERDULERÍA */}
                {verduraSubSector === "markdown" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-amber-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="border-b border-white/10 pb-3">
                      <h2 className="font-black text-sm text-white" style={displayFont}>
                        Liquidación Sell-Out por Proximidad de Madurez
                      </h2>
                      <div className="text-[11px] text-slate-400">
                        Aplica automáticamente rebajas calculadas sobre lotes hortícolas según días restantes de vida útil.
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Regla de Sell-Out Preventivo Extra:</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Evita mermas de descarte aplicando descuentos escalonados (-20% a 2 días de vencer, -50% a 1 día de maduración crítica).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoMarkdownProduce}
                      disabled={aplicandoMarkdownProduce}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer active:scale-95 transition-all"
                    >
                      {aplicandoMarkdownProduce ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Tag className="w-4 h-4" />
                      )}
                      <span>Ejecutar Liquidación Automática de Lotes</span>
                    </button>
                  </div>
                )}

                {/* MODO 4: SCORECARDS DE PROVEEDORES HORTÍCOLAS */}
                {verduraSubSector === "scorecards" && (
                  <div className="backdrop-blur-2xl bg-slate-900/70 border border-emerald-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h2 className="font-black text-sm text-white" style={displayFont}>
                          Scorecards de Proveedores ({scorecards.length})
                        </h2>
                        <div className="text-[11px] text-slate-400">
                          Evaluación de calidad y porcentaje de rechazo histórico en recepción.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateScorecards}
                        disabled={generandoScorecards}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        {generandoScorecards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                        <span>Calcular</span>
                      </button>
                    </div>

                    {scorecards.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5">
                        Sin scorecards calculados. Presioná "Calcular" para procesar las recepciones recientes.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scorecards.map((sc: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-xs text-white">
                                {sc.proveedor_nombre || `Proveedor ${sc.proveedor_id || idx + 1}`}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Lotes recibidos: {sc.lotes_entregados || sc.total_entregas || 0}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-black text-xs text-emerald-400">
                                {sc.indice_calidad_pct != null ? `${Number(sc.indice_calidad_pct).toFixed(1)}% Calidad` : "Aceptable"}
                              </div>
                              <div className="text-[10px] text-rose-400">
                                Rechazo: {sc.tasa_rechazo_pct != null ? `${Number(sc.tasa_rechazo_pct).toFixed(1)}%` : "0%"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* ══════════════════════ TAB 3: MERMAS OFICIALES EN SALÓN ══════════════════════ */}
        {tab === "mermas" && (
          <div className="space-y-5 animate-fade-in">
            <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <div className="w-9 h-9 rounded-2xl bg-rose-600/30 border border-rose-500/40 text-rose-400 flex items-center justify-center font-black shadow-lg shadow-rose-600/20">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-white" style={displayFont}>
                    Registrar Merma Oficial de Salón
                  </h2>
                  <div className="text-[11px] text-slate-400">
                    Descuenta automáticamente las existencias del inventario real en Extra.
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmMerma} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Producto a Mermar:
                  </label>
                  <select
                    value={mermaProd?.id || scannedProduct?.id || ""}
                    onChange={(e) => {
                      const found = products.find(p => p.id === e.target.value)
                      setMermaProd(found || null)
                    }}
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-400"
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
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Cantidad Mermada (Un. o Kg):
                    </label>
                    <input
                      type="text"
                      value={mermaQty}
                      onChange={(e) => setMermaQty(e.target.value.replace(/[^0-9.,]/g, ""))}
                      placeholder="0"
                      className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                      style={monoFont}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Sector del Salón:
                    </label>
                    <select
                      value={mermaArea}
                      onChange={(e) => setMermaArea(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                    >
                      {SECTORES_SALON.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Motivo de la Merma:
                  </label>
                  <select
                    value={mermaTipo}
                    onChange={(e) => setMermaTipo(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                  >
                    {MOTIVOS_MERMA.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Observación Adicional (Opcional):
                  </label>
                  <input
                    type="text"
                    value={mermaObs}
                    onChange={(e) => setMermaObs(e.target.value)}
                    placeholder="Ej: Averiado por caída durante reposición..."
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingMerma}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                >
                  {submittingMerma ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Registrar Merma (queda a la espera de aprobación)
                </button>
              </form>
            </div>

            {/* Historial de Mermas de Hoy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                  Mermas Registradas Hoy ({mermasList.length})
                </h3>
                <div className="text-xs font-black text-rose-400" style={monoFont}>
                  Total: {formatPYG(totalMermasHoy)}
                </div>
              </div>

              {mermasList.length === 0 ? (
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                  No hay mermas registradas en el turno de hoy.
                </div>
              ) : (
                <div className="space-y-2">
                  {mermasList.map((m) => (
                    <div key={m.id} className="p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">
                          {m.producto_nombre}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{m.area}</span>
                          <span>• {m.tipo_merma.replace("_", " ")}</span>
                          <span>• {m.fecha}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-rose-400" style={monoFont}>
                          {m.cantidad} un.
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatPYG(m.costo_total || m.cantidad * 8500)}
                        </div>
                        {m.estado && (
                          <div className={`text-[9px] font-black uppercase tracking-wide mt-0.5 ${
                            m.estado === "aprobada" ? "text-emerald-400" : m.estado === "rechazada" ? "text-slate-500" : "text-amber-400"
                          }`}>
                            {m.estado === "aprobada" ? "Aprobada" : m.estado === "rechazada" ? "Rechazada" : "Pendiente"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 4: QUIEBRE DE STOCK & REQUISICIONES ══════════════════════ */}
        {tab === "reposicion" && (
          <div className="space-y-5 animate-fade-in">
            <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2.5 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-black shadow-lg shadow-indigo-600/20">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-white" style={displayFont}>
                      Quiebre de Stock — Requisición de Compra
                    </h2>
                    <div className="text-[11px] text-slate-400">
                      Calculado en vivo (stock real vs. punto de pedido). Al generar la requisición, aparece directamente en Gestión de Compras.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadSugerenciasReposicion()}
                  disabled={loadingReposiciones}
                  className="shrink-0 p-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-300 hover:bg-white/[0.1] disabled:opacity-40 cursor-pointer"
                  title="Recalcular quiebres"
                >
                  <RefreshCcw className={`w-4 h-4 ${loadingReposiciones ? "animate-spin" : ""}`} />
                </button>
              </div>

              <form onSubmit={handleConfirmReposicion} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Producto con Quiebre Inminente:
                  </label>
                  <select
                    value={repoProd?.id || ""}
                    onChange={(e) => {
                      const item = reposiciones.find(r => r.producto_id === e.target.value)
                      const found = products.find(p => p.id === e.target.value)
                      setRepoProd(found || (item ? ({ id: item.producto_id, nombre: item.producto_nombre } as Product) : null))
                      setRepoQty(item ? String(item.cantidad) : "")
                    }}
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-400"
                  >
                    <option value="">-- Seleccionar producto en quiebre --</option>
                    {reposiciones.filter(r => r.estado === "pendiente").map((r) => (
                      <option key={r.id} value={r.producto_id}>
                        {r.producto_nombre} (stock: {r.stock_actual ?? 0})
                      </option>
                    ))}
                  </select>
                  {reposiciones.filter(r => r.estado === "pendiente").length === 0 && !loadingReposiciones && (
                    <div className="text-[10px] text-emerald-400 mt-1.5">Sin quiebres críticos detectados por ahora.</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Cantidad a Requisicionar:
                    </label>
                    <input
                      type="number"
                      value={repoQty}
                      onChange={(e) => setRepoQty(e.target.value)}
                      placeholder="12"
                      className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                      style={monoFont}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Prioridad de Compra:
                    </label>
                    <select
                      value={repoUrgencia}
                      onChange={(e) => setRepoUrgencia(e.target.value as any)}
                      className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                    >
                      <option value="alta">⚡ Alta (quiebre activo)</option>
                      <option value="normal">Normal (preventivo)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!!generandoRequisicion}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  <Boxes className="w-4 h-4" />
                  {generandoRequisicion ? "Generando..." : "Generar Requisición de Compra"}
                </button>
              </form>
            </div>

            {/* Lista de Quiebres Detectados */}
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                Productos con Quiebre Detectado ({reposiciones.length})
              </h3>
              {loadingReposiciones ? (
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                  Calculando quiebres de stock...
                </div>
              ) : reposiciones.length === 0 ? (
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                  Sin productos en quiebre por ahora.
                </div>
              ) : (
                <div className="space-y-2">
                  {reposiciones.map((r) => (
                    <div key={r.id} className="p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            r.urgencia === "alta" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-white/[0.05] text-slate-400"
                          }`}>
                            {r.urgencia}
                          </span>
                          <div className="font-bold text-xs text-white truncate">
                            {r.producto_nombre}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Stock actual: {r.stock_actual ?? 0} • Punto de pedido: {r.punto_pedido ?? 0}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-indigo-400" style={monoFont}>
                          {r.cantidad} un.
                        </div>
                        <span className={`text-[9px] font-bold uppercase ${
                          r.estado === "requisitada" ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {r.estado === "requisitada" ? "En Compras" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 5: INOCUIDAD & CONTROL HACCP REAL ══════════════════════ */}
        {tab === "haccp" && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Cabecera & KPIs de Inocuidad HACCP */}
            <div className="backdrop-blur-2xl bg-slate-900/70 border border-teal-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-teal-600/30 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black shadow-lg shadow-teal-600/20">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-white" style={displayFont}>
                      Inocuidad & Control HACCP Oficial
                    </h2>
                    <div className="text-[11px] text-slate-400">
                      Puntos Críticos de Control (PCC), cadena de frío y libro digital de acciones correctivas.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadHaccpData()}
                  disabled={loadingHaccp}
                  className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                  title="Recargar planes y mediciones HACCP"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${loadingHaccp ? "animate-spin text-teal-400" : ""}`} />
                </button>
              </div>

              {/* Barra de KPIs Bromatológicos en Vivo */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-500">Conformidad %</div>
                  <div className={`font-black text-sm sm:text-base ${
                    (Number(haccpDash?.conformidad_pct) || 100) >= 90 ? "text-emerald-400" :
                    (Number(haccpDash?.conformidad_pct) || 100) >= 70 ? "text-amber-400" : "text-rose-400"
                  }`} style={monoFont}>
                    {haccpDash?.conformidad_pct != null ? `${Number(haccpDash.conformidad_pct).toFixed(1)}%` : "100%"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-500">Mediciones Hoy</div>
                  <div className="font-black text-sm sm:text-base text-teal-300" style={monoFont}>
                    {haccpDash?.monitoreos_hoy ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-500">Acciones Abiertas</div>
                  <div className={`font-black text-sm sm:text-base ${haccpAcciones.length > 0 ? "text-rose-400 animate-pulse" : "text-slate-300"}`} style={monoFont}>
                    {haccpAcciones.length}
                  </div>
                </div>
              </div>

              {/* Sub-tabs de Navegación HACCP */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setHaccpSubTab("monitoreo")}
                  className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    haccpSubTab === "monitoreo"
                      ? "bg-teal-500 text-slate-950 shadow-md font-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>Monitoreo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHaccpSubTab("acciones")}
                  className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    haccpSubTab === "acciones"
                      ? "bg-teal-500 text-slate-950 shadow-md font-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Acciones {haccpAcciones.length > 0 ? `(${haccpAcciones.length})` : ""}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHaccpSubTab("planes")}
                  className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    haccpSubTab === "planes"
                      ? "bg-teal-500 text-slate-950 shadow-md font-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Planes ({haccpPlanes.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHaccpSubTab("reporte")
                    if (!haccpReport) loadHaccpReport()
                  }}
                  className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    haccpSubTab === "reporte"
                      ? "bg-teal-500 text-slate-950 shadow-md font-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Reporte</span>
                </button>
              </div>
            </div>

            {/* ── SUB-TAB 1: MONITOREO DE TEMPERATURA PCC ── */}
            {haccpSubTab === "monitoreo" && (
              <div className="space-y-4">
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-teal-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Registro de Lectura en Sonda
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewPlanModal(true)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuevo Plan</span>
                    </button>
                  </div>

                  {/* Formulario Registro Monitoreo PCC */}
                  <form onSubmit={handleGuardarMonitoreoHaccp} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Plan HACCP / Sector:
                      </label>
                      <select
                        value={selectedHaccpPlanId}
                        onChange={(e) => setSelectedHaccpPlanId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-teal-400"
                      >
                        {haccpPlanes.length === 0 ? (
                          <option value="">-- Sin planes HACCP cargados en el sistema --</option>
                        ) : (
                          haccpPlanes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.area || "Salón"})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Punto Crítico de Control (PCC) a Medir:
                      </label>
                      <select
                        value={selectedCpId}
                        onChange={(e) => setSelectedCpId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-teal-400"
                      >
                        {haccpCriticalPoints.length === 0 ? (
                          <option value="">-- Sin puntos críticos definidos en este plan --</option>
                        ) : (
                          haccpCriticalPoints.map((cp) => (
                            <option key={cp.id} value={cp.id}>
                              {cp.nombre} [{cp.limite_inferior ?? "-"}°C a {cp.limite_superior ?? "-"}°C]
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Badge con Rango Térmico Seguro del PCC Activo */}
                    {(() => {
                      const cp = haccpCriticalPoints.find(p => p.id === selectedCpId)
                      if (!cp) return null
                      return (
                        <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs flex items-center justify-between text-teal-300 font-mono">
                          <span>Rango Seguro Normativo:</span>
                          <strong className="text-white text-sm">
                            {cp.limite_inferior ?? "-"}°C a {cp.limite_superior ?? "-"}°C ({cp.unidad || "°C"})
                          </strong>
                        </div>
                      )
                    })()}

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Temperatura Leída en Sonda (°C):
                      </label>
                      <input
                        type="text"
                        value={haccpTempValor}
                        onChange={(e) => setHaccpTempValor(e.target.value.replace(/[^0-9.,-]/g, ""))}
                        placeholder="Ej: 2.5"
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-lg font-black text-white outline-none focus:border-teal-400"
                        style={monoFont}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Observación / Calibración de Termómetro:
                      </label>
                      <input
                        type="text"
                        value={haccpTempObs}
                        onChange={(e) => setHaccpTempObs(e.target.value)}
                        placeholder="Ej: Termómetro digital infrarrojo calibrado en turno..."
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-teal-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={guardandoMonitoreo || !selectedCpId}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                    >
                      {guardandoMonitoreo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
                      <span>Guardar Medición HACCP Oficial</span>
                    </button>
                  </form>
                </div>

                {/* Historial Reciente de Mediciones del PCC */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                      Últimas Mediciones de este PCC ({haccpRecentLogs.length})
                    </h3>
                  </div>

                  {haccpRecentLogs.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                      Sin mediciones recientes registradas para este punto crítico.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {haccpRecentLogs.slice(0, 10).map((log: any) => {
                        const isConforme = log.conforme ?? (log.estado === "conforme")
                        return (
                          <div
                            key={log.id}
                            className={`p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border flex items-center justify-between gap-3 ${
                              isConforme ? "border-emerald-500/20" : "border-rose-500/40 bg-rose-950/10"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isConforme ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}>
                                  {isConforme ? "Conforme" : "Desviación"}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                                </span>
                              </div>
                              {log.observaciones && (
                                <div className="text-[10px] text-slate-400 mt-1 truncate">
                                  {log.observaciones}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-black text-base ${isConforme ? "text-teal-300" : "text-rose-400 font-bold"}`} style={monoFont}>
                                {Number(log.valor ?? log.valor_medido ?? 0).toFixed(1)}°C
                              </div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-tight">
                                {log.fuente || "manual"}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SUB-TAB 2: ACCIONES CORRECTIVAS PENDIENTES ── */}
            {haccpSubTab === "acciones" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                    Acciones Correctivas Pendientes ({haccpAcciones.length})
                  </h3>
                  {haccpAcciones.length > 0 && (
                    <span className="text-[10px] text-rose-400 font-bold animate-pulse">Atención Inmediata</span>
                  )}
                </div>

                {haccpAcciones.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>Sin desviaciones bromatológicas activas. Todas las cámaras y heladeras conformes.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {haccpAcciones.map((ca: any) => (
                      <div key={ca.id} className="p-4 rounded-2xl backdrop-blur-md bg-slate-900/80 border border-rose-500/30 space-y-2.5 shadow-lg shadow-rose-500/5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Desviación PCC
                              </span>
                              <div className="font-bold text-xs text-white truncate">
                                {ca.descripcion || "Desviación de temperatura crítica"}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-300 mt-1.5">
                              Acción requerida: <strong className="text-amber-300">{ca.accion_tomada || "Revisar compresor y calibración"}</strong>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono">
                              Registrado: {ca.created_at ? new Date(ca.created_at).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "Turno actual"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleResolverAccionHaccp(ca.id)}
                            disabled={resolviendoAccionId === ca.id}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shrink-0 cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {resolviendoAccionId === ca.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Resolver</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB 3: PLANES HACCP REGISTRADOS ── */}
            {haccpSubTab === "planes" && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                    Planes de Inocuidad Activos ({haccpPlanes.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowNewPlanModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md shadow-teal-500/20 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Plan</span>
                  </button>
                </div>

                {haccpPlanes.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                    No hay planes HACCP registrados en el sistema.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {haccpPlanes.map((plan: any) => {
                      const isSelected = selectedHaccpPlanId === plan.id
                      return (
                        <div
                          key={plan.id}
                          className={`p-4 rounded-2xl backdrop-blur-md bg-slate-900/60 border transition-all ${
                            isSelected ? "border-teal-500/60 bg-teal-950/20 shadow-lg shadow-teal-500/10" : "border-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                  {plan.area || "Salón"}
                                </span>
                                <div className="font-bold text-xs text-white truncate">
                                  {plan.nombre}
                                </div>
                              </div>
                              {plan.descripcion && (
                                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                                  {plan.descripcion}
                                </p>
                              )}
                              <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2">
                                <span>Puntos Críticos: {plan.puntos_criticos?.length ?? 0}</span>
                                <span>• Estado: {plan.activo ? "Activo" : "Inactivo"}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHaccpPlanId(plan.id)
                                setHaccpSubTab("monitoreo")
                              }}
                              className={`px-3 py-1.5 rounded-xl font-black text-xs shrink-0 cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-teal-500 text-slate-950 font-black"
                                  : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/10"
                              }`}
                            >
                              {isSelected ? "Activo" : "Seleccionar"}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB 4: REPORTE DE CUMPLIMIENTO BROMATOLÓGICO ── */}
            {haccpSubTab === "reporte" && (
              <div className="space-y-4">
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-teal-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h3 className="font-black text-sm text-white" style={displayFont}>
                        Reporte Bromatológico & Auditoría
                      </h3>
                      <div className="text-[11px] text-slate-400">
                        Indicadores de conformidad para control municipal y bromatológico.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadHaccpReport()}
                      disabled={loadingReport}
                      className="px-3 py-1.5 rounded-xl bg-teal-600/30 border border-teal-500/40 text-teal-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin" : ""}`} />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  {/* Tarjetas de Métricas de Cumplimiento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Conformidad Global</div>
                      <div className={`font-black text-xl ${
                        (Number(haccpReport?.conformidad_pct ?? haccpDash?.conformidad_pct) || 100) >= 90 ? "text-emerald-400" :
                        (Number(haccpReport?.conformidad_pct ?? haccpDash?.conformidad_pct) || 100) >= 70 ? "text-amber-400" : "text-rose-400"
                      }`} style={monoFont}>
                        {haccpReport?.conformidad_pct != null
                          ? `${Number(haccpReport.conformidad_pct).toFixed(1)}%`
                          : haccpDash?.conformidad_pct != null
                          ? `${Number(haccpDash.conformidad_pct).toFixed(1)}%`
                          : "100%"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(Number(haccpReport?.conformidad_pct ?? haccpDash?.conformidad_pct) || 100) >= 90 ? "Excelente cumplimiento" : "Requiere seguimiento"}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Mediciones Totales</div>
                      <div className="font-black text-xl text-teal-300 font-mono">
                        {haccpReport?.total_monitoreos ?? haccpDash?.monitoreos_hoy ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Registros en libro digital
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Desviaciones Detectadas</div>
                      <div className="font-black text-xl text-rose-400 font-mono">
                        {haccpReport?.total_desviaciones ?? haccpAcciones.length ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Fuera de rango seguro
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-slate-500">Acciones Resueltas</div>
                      <div className="font-black text-xl text-emerald-400 font-mono">
                        {haccpReport?.acciones_resueltas ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Corregidas en turno
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 leading-relaxed">
                    Normativa aplicable: Código Sanitario del Paraguay e INAN. Las lecturas fuera de límite activan automáticamente alertas en el Libro Digital de Acciones Correctivas.
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ── BARRA INFERIOR DE NAVEGACIÓN TÁCTIL (GLASS FLOATING DOCK) ── */}
      <nav className="fixed bottom-3 left-3 right-3 z-40 max-w-lg mx-auto">
        <div className="backdrop-blur-2xl bg-slate-950/80 border border-white/15 rounded-3xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: "gondola", label: "Góndola", icon: Tag, badge: labelQueue.length },
              { id: "produccion", label: "Producción", icon: ChefHat, badge: butcheryOrders.length + bakeryOrders.length + freshnessAudits.length },
              { id: "mermas", label: "Mermas", icon: Trash2, badge: mermasList.length },
              { id: "reposicion", label: "Quiebres", icon: Boxes, badge: reposiciones.filter(r => r.estado === "pendiente").length },
              { id: "haccp", label: "HACCP", icon: Thermometer, badge: haccpAcciones.length },
            ].map((sec) => {
              const Icon = sec.icon
              const active = tab === sec.id
              return (
                <button
                  key={sec.id}
                  onClick={() => setTab(sec.id as SalonTab)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all cursor-pointer relative ${
                    active
                      ? "text-slate-950 bg-amber-400 font-black shadow-lg shadow-amber-400/30 scale-105"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                    {!!sec.badge && sec.badge > 0 && (
                      <span className={`absolute -top-1.5 -right-2 text-[8px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center ${
                        active ? "bg-slate-950 text-amber-400" : "bg-rose-500 text-white animate-pulse"
                      }`}>
                        {sec.badge > 99 ? "99+" : sec.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9.5px] tracking-tight truncate w-full text-center">
                    {sec.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* ── MODAL: COLA DE IMPRESIÓN DE ETIQUETAS FLEJE ── */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] max-h-[88vh] overflow-y-auto animate-fade-in space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-white" style={displayFont}>
                    Cola de Impresión de Flejes ({labelQueue.length})
                  </h2>
                  <div className="text-[11px] text-slate-400">
                    Acumuladas para enviar en lote a la impresora Zebra/TSC.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowQueueModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {labelQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                La cola de impresión está vacía. Escanée productos en góndola para acumular flejes.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {labelQueue.map((item, idx) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white truncate">
                        {item.nombre}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="text-amber-400 font-mono font-bold">{formatPYG(item.precio_venta)}</span>
                        {item.descuento_pct && <span className="text-rose-400 font-bold">(-{item.descuento_pct}%)</span>}
                        <span>• {item.motivo.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-sm text-white" style={monoFont}>
                        {item.cantidad}x
                      </span>
                      <button
                        onClick={() => {
                          const updated = labelQueue.filter((_, i) => i !== idx)
                          saveLabelQueue(updated)
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {labelQueue.length > 0 && (
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => saveLabelQueue([])}
                  className="px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-rose-500/20 text-rose-400 font-bold text-xs cursor-pointer transition"
                >
                  Vaciar Cola
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Todo el Lote ({labelQueue.reduce((acc, i) => acc + i.cantidad, 0)} Flejes)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: ACCESO RÁPIDO OPERADOR DE SALÓN ── */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Acceso Operador de Salón
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Extra Supermercado
                  </div>
                </div>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickLogin} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Usuario o Correo:
                </label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ej: operador o admin@extra.com.py"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Contraseña:
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Ingresar al Salón
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA PLANTILLA DE DESPOSTE BOVINO/PORCINO ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-600/30 border border-rose-500/40 text-rose-400 flex items-center justify-center font-black">
                  <Beef className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Nueva Plantilla Desposte
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Estándar de Rendimiento Bovino/Porcino
                  </div>
                </div>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveButcheryTemplate} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre de la Plantilla:
                </label>
                <input
                  type="text"
                  value={templateForm.nombre}
                  onChange={(e) => setTemplateForm({ ...templateForm, nombre: e.target.value })}
                  placeholder="Ej: Desposte Novillo Pesado Premium"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-400"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Especie:
                  </label>
                  <select
                    value={templateForm.especie}
                    onChange={(e) => setTemplateForm({ ...templateForm, especie: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-400"
                  >
                    <option value="Vacuno Novillo">Vacuno Novillo</option>
                    <option value="Vacuno Vaquilla">Vacuno Vaquilla</option>
                    <option value="Porcino Cerdo">Porcino Cerdo</option>
                    <option value="Ovino Cordero">Ovino Cordero</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Peso Promedio (kg):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={templateForm.peso_promedio_kg}
                    onChange={(e) => setTemplateForm({ ...templateForm, peso_promedio_kg: e.target.value })}
                    placeholder="250"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-black text-white outline-none focus:border-rose-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Descripción / Observaciones:
                </label>
                <input
                  type="text"
                  value={templateForm.descripcion}
                  onChange={(e) => setTemplateForm({ ...templateForm, descripcion: e.target.value })}
                  placeholder="Cortes para mostrador y envasado al vacío..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
                >
                  {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESUMEN DE DESPOSTE EJECUTADO ── */}
      {showDesposteResultModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Desposte Calculado con Éxito
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Lote de Carnicería Listo para Producir
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDesposteResultModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex justify-between items-center">
                <span className="text-slate-400">Peso Bruto Media Res:</span>
                <span className="font-black text-white font-mono">{Number(despostePesoEntrada || 0).toFixed(1)} kg</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex justify-between items-center">
                <span className="text-slate-400">Rendimiento Útil Total:</span>
                <span className="font-black text-emerald-400 font-mono">
                  {(resultadoDesposte?.peso_total_cortes ?? (despostePesoEntrada * 0.785)).toFixed(1)} kg ({((resultadoDesposte?.peso_total_cortes ? (resultadoDesposte.peso_total_cortes / (despostePesoEntrada || 1)) * 100 : 78.5)).toFixed(1)}%)
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex justify-between items-center">
                <span className="text-slate-400">Merma Grasa / Hueso:</span>
                <span className="font-black text-rose-400 font-mono">
                  {Math.max(0, despostePesoEntrada - (resultadoDesposte?.peso_total_cortes ?? (despostePesoEntrada * 0.785))).toFixed(1)} kg
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex justify-between items-center">
                <span className="text-slate-400">Costo Bruto Entrada:</span>
                <span className="font-black text-amber-400 font-mono">{formatPYG(desposteCostoTotal)}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 leading-tight">
              Los cortes y costos unitarios teóricos fueron calculados proporcionalmente sobre la media res.
            </div>

            <button
              type="button"
              onClick={() => setShowDesposteResultModal(false)}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <span>Aceptar y Continuar</span>
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA RECETA DE PANADERÍA ── */}
      {showBakeryRecipeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-600/30 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Nueva Receta Panadería
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Fórmula de Producción y Horneada
                  </div>
                </div>
              </div>
              <button onClick={() => setShowBakeryRecipeModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBakeryRecipe} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre del Pan / Producto:
                </label>
                <input
                  type="text"
                  value={bakeryRecipeForm.nombre}
                  onChange={(e) => setBakeryRecipeForm({ ...bakeryRecipeForm, nombre: e.target.value })}
                  placeholder="Ej: Pan Trincha 200g Extra"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Piezas:
                  </label>
                  <input
                    type="number"
                    value={bakeryRecipeForm.rendimiento_piezas}
                    onChange={(e) => setBakeryRecipeForm({ ...bakeryRecipeForm, rendimiento_piezas: e.target.value })}
                    placeholder="120"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-black text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Costo (Gs):
                  </label>
                  <input
                    type="number"
                    value={bakeryRecipeForm.costo_estimado}
                    onChange={(e) => setBakeryRecipeForm({ ...bakeryRecipeForm, costo_estimado: e.target.value })}
                    placeholder="120000"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-black text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Minutos:
                  </label>
                  <input
                    type="number"
                    value={bakeryRecipeForm.tiempo_preparacion_min}
                    onChange={(e) => setBakeryRecipeForm({ ...bakeryRecipeForm, tiempo_preparacion_min: e.target.value })}
                    placeholder="25"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-black text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Descripción / Instrucciones:
                </label>
                <input
                  type="text"
                  value={bakeryRecipeForm.descripcion}
                  onChange={(e) => setBakeryRecipeForm({ ...bakeryRecipeForm, descripcion: e.target.value })}
                  placeholder="Harina 000, 55% agua, fermentación 2hs..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBakeryRecipeModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBakeryRecipe}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50"
                >
                  {savingBakeryRecipe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA RECETA DE ROTISERÍA ── */}
      {showRotiRecipeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-600/30 border border-orange-500/40 text-orange-400 flex items-center justify-center font-black">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Nueva Receta Rotisería
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Control Térmico y Cocción Segura
                  </div>
                </div>
              </div>
              <button onClick={() => setShowRotiRecipeModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRotiRecipe} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre del Plato / Preparación:
                </label>
                <input
                  type="text"
                  value={rotiRecipeForm.nombre}
                  onChange={(e) => setRotiRecipeForm({ ...rotiRecipeForm, nombre: e.target.value })}
                  placeholder="Ej: Pollo al Spiedo con Papas"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-orange-400"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Costo Estimado (Gs):
                  </label>
                  <input
                    type="number"
                    value={rotiRecipeForm.costo_estimado}
                    onChange={(e) => setRotiRecipeForm({ ...rotiRecipeForm, costo_estimado: e.target.value })}
                    placeholder="35000"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-black text-white outline-none focus:border-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Tiempo Prep (min):
                  </label>
                  <input
                    type="number"
                    value={rotiRecipeForm.tiempo_preparacion_min}
                    onChange={(e) => setRotiRecipeForm({ ...rotiRecipeForm, tiempo_preparacion_min: e.target.value })}
                    placeholder="60"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-black text-white outline-none focus:border-orange-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Descripción / Instrucciones:
                </label>
                <input
                  type="text"
                  value={rotiRecipeForm.descripcion}
                  onChange={(e) => setRotiRecipeForm({ ...rotiRecipeForm, descripcion: e.target.value })}
                  placeholder="Marinado 12hs, cocción a fuego parejo..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-orange-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRotiRecipeModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRotiRecipe}
                  className="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 cursor-pointer disabled:opacity-50"
                >
                  {savingRotiRecipe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: COMPLETAR PLAN ROTISERÍA CON CONTROL TÉRMICO ── */}
      {completandoRotiId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-600/30 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Finalizar Lote Rotisería
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Control Bromatológico & Sonda Térmica
                  </div>
                </div>
              </div>
              <button onClick={() => setCompletandoRotiId(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (completandoRotiId) handleCompletarRotiPlan(completandoRotiId)
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Temperatura Interna en Sonda (°C):
                </label>
                <input
                  type="text"
                  value={rotiTempFinal}
                  onChange={(e) => setRotiTempFinal(e.target.value.replace(/[^0-9.,-]/g, ""))}
                  placeholder="Ej: 78.5"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-3 text-lg font-black text-teal-300 outline-none focus:border-teal-400 font-mono"
                  autoFocus
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Norma HACCP: mínimo 74°C en el centro térmico de carnes cocidas.
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Porciones / Piezas Obtenidas:
                </label>
                <input
                  type="number"
                  value={rotiQtyFinal}
                  onChange={(e) => setRotiQtyFinal(e.target.value)}
                  placeholder="15"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-black text-white outline-none focus:border-teal-400 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletandoRotiId(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRotiPlan}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer disabled:opacity-50"
                >
                  {guardandoRotiPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar Salida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO PLAN HACCP ── */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl p-6 animate-fade-in space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-600/30 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white" style={displayFont}>
                    Nuevo Plan HACCP
                  </h3>
                  <div className="text-[10px] text-slate-400">
                    Extra Supermercado • Inocuidad Oficial
                  </div>
                </div>
              </div>
              <button onClick={() => setShowNewPlanModal(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHaccpPlan} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Nombre del Plan:
                </label>
                <input
                  type="text"
                  value={newPlanForm.nombre}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, nombre: e.target.value })}
                  placeholder="Ej: Cadena Frío Carnicería y Desposte"
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-teal-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Sector / Área del Supermercado:
                </label>
                <select
                  value={newPlanForm.area}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, area: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-teal-400"
                >
                  <option value="Carnicería">Carnicería & Desposte</option>
                  <option value="Panadería">Panadería & Confitería</option>
                  <option value="Rotisería">Rotisería & Comidas Rápidas</option>
                  <option value="Fiambrería">Fiambrería & Lácteos</option>
                  <option value="Verdulería">Verdulería & Frutas</option>
                  <option value="Salón">Salón de Ventas General</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Descripción Normativa:
                </label>
                <input
                  type="text"
                  value={newPlanForm.descripcion}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, descripcion: e.target.value })}
                  placeholder="Control de temperaturas en cámaras y vitrinas..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-teal-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNewPlan}
                  className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer disabled:opacity-50"
                >
                  {savingNewPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Crear Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
