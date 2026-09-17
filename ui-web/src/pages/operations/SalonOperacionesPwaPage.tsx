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
  Flashlight, Zap, Package, Compass, History, ShieldAlert
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

  // ── ESTADOS DE PRODUCCIÓN & TRANSFORMACIÓN REAL ──
  const [lotesProduccion, setLotesProduccion] = useState<LoteProduccion[]>(() => {
    try {
      const saved = localStorage.getItem("extra_salon_lotes_prod")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const saveLotesProduccion = (newList: LoteProduccion[]) => {
    setLotesProduccion(newList)
    try {
      localStorage.setItem("extra_salon_lotes_prod", JSON.stringify(newList))
    } catch {}
  }

  // Formulario de Carnicería
  const [carneReceta, setCarneReceta] = useState("Chorizo Parrillero Casero Extra")
  const [carneKgTrimmings, setCarneKgTrimmings] = useState("30")
  const [carneKgTocino, setCarneKgTocino] = useState("10")

  // Formulario de Panadería
  const [panModo, setPanModo] = useState<"amasado" | "sobrante">("sobrante")
  const [panKgHarina, setPanKgHarina] = useState("50")
  const [panTipoAmasado, setPanTipoAmasado] = useState("Pan Francés Tradicional")
  const [panKgSobrante, setPanKgSobrante] = useState("25")
  const [panDestinoSobrante, setPanDestinoSobrante] = useState("Pan Rallado Artesanal Extra")

  // Formulario de Verdulería
  const [verduraInsumo, setVerduraInsumo] = useState("Zapallo Kabutiá")
  const [verduraKgBrutos, setVerduraKgBrutos] = useState("40")
  const [verduraBandejasDestino, setVerduraBandejasDestino] = useState("Bandejas Zapallo en Cubos 500g")

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

  // ── ESTADOS DE TEMPERATURAS & HACCP ──
  const [temperaturas, setTemperaturas] = useState<TemperaturaItem[]>(() => {
    try {
      const saved = localStorage.getItem("extra_salon_temperaturas")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const saveTemperaturas = (newList: TemperaturaItem[]) => {
    setTemperaturas(newList)
    try {
      localStorage.setItem("extra_salon_temperaturas", JSON.stringify(newList))
    } catch {}
  }

  const [tempEquipo, setTempEquipo] = useState("Cámara de Reses (Carnicería)")
  const [tempValor, setTempValor] = useState("")

  // ── DESPOSTE DE CARNES ──
  const [despostePesoEntrada, setDespostePesoEntrada] = useState<number>(240)
  const [desposteCostoTotal, setDesposteCostoTotal] = useState<number>(5500000)

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

  // ── CARGAR LOTES DE PRODUCCIÓN REALES ──
  const loadLotesProduccion = useCallback(async () => {
    try {
      const res = await api.supermer.batches.list()
      if (Array.isArray(res) && res.length > 0) {
        const mapped: LoteProduccion[] = res.slice(0, 20).map((b: any) => ({
          id: String(b.id),
          sector: (b.sector || (b.producto_nombre?.toLowerCase().includes("chorizo") ? "Carnicería" : "Panadería")) as any,
          receta_nombre: b.receta_nombre || b.producto_nombre || "Elaboración de Salón",
          insumo_origen: b.insumo_origen || "Materia Prima Fraccionada",
          cantidad_insumo: Number(b.cantidad_insumo || b.cantidad || 0),
          producto_obtenido: b.producto_nombre || "Elaborado Extra",
          cantidad_obtenida: Number(b.cantidad || 0),
          unidad: b.unidad || "Kg",
          costo_unitario: Number(b.costo_unitario || 0),
          lote_codigo: b.lote_codigo || b.codigo || `LOT-${b.id}`,
          hora: new Date(b.created_at || Date.now()).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
        }))
        setLotesProduccion(prev => {
          const ids = new Set(prev.map(p => p.id))
          const fresh = mapped.filter(m => !ids.has(m.id))
          return [...fresh, ...prev]
        })
      }
    } catch (err) {
      console.warn("No se pudieron cargar lotes de producción:", err)
    }
  }, [])

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    loadCatalog()
    loadMermas()
    loadSugerenciasReposicion()
    loadLotesProduccion()
  }, [loadCatalog, loadMermas, loadSugerenciasReposicion, loadLotesProduccion])

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
  const startCamera = async (mode: "environment" | "user" = facingMode) => {
    setCameraError(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setCameraPermission("granted")

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraActive(true)

      // Verificar si tiene soporte de linterna (Torch)
      const track = stream.getVideoTracks()[0]
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {}
        setHasTorch(!!capabilities.torch)
      }

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

      // getUserMedia lanza distintos err.name segun la causa real -- antes
      // se le mostraba al usuario "otorgue permisos" para CUALQUIER falla
      // (camara ocupada, facingMode no soportado, hardware ausente,
      // contexto no seguro), aunque el permiso ya estuviera concedido.
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
        setCameraError("La cámara no soporta la configuración pedida (cámara trasera). Probá con la cámara frontal.")
        toast.error("Configuración No Soportada", "Probá cambiar a la cámara frontal.")
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
    const nextMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)
    stopCamera()
    setTimeout(() => startCamera(nextMode), 200)
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

    const updated = [nuevaTemp, ...temperaturas]
    saveTemperaturas(updated)

    if (esOptimo) {
      soundAlerts.playScanSuccess()
      toast.success("Control HACCP Guardado", `${tempEquipo}: ${val}°C (Dentro de rango seguro).`)
    } else {
      soundAlerts.playHaccpWarning()
      toast.error("¡ALERTA DE TEMPERATURA!", `${tempEquipo}: ${val}°C fuera de rango crítico (${min}°C a ${max}°C).`)
    }
    setTempValor("")
  }

  // ── ACCIÓN: REGISTRAR PRODUCCIÓN DE CARNICERÍA ──
  const handleConfirmProduccionCarne = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmings = parseFloat(carneKgTrimmings) || 0
    const tocino = parseFloat(carneKgTocino) || 0
    if (trimmings <= 0) {
      toast.warning("Faltan insumos", "Ingrese los Kilos de recortes/trimmings.")
      return
    }

    const kgObtenidos = (trimmings + tocino) * 0.97
    const loteCod = `EMB-${Date.now().toString().slice(-4)}`
    const nuevoLote: LoteProduccion = {
      id: `lp-${Date.now()}`,
      sector: "Carnicería",
      receta_nombre: carneReceta,
      insumo_origen: `${trimmings}kg Trimmings + ${tocino}kg Tocino`,
      cantidad_insumo: trimmings + tocino,
      producto_obtenido: carneReceta,
      cantidad_obtenida: Math.round(kgObtenidos * 10) / 10,
      unidad: "Kg",
      costo_unitario: 23500,
      lote_codigo: loteCod,
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }

    soundAlerts.playScanSuccess()
    const updated = [nuevoLote, ...lotesProduccion]
    saveLotesProduccion(updated)
    toast.success("Producción Registrada", `${kgObtenidos.toFixed(1)} Kg de ${carneReceta} con lote ${loteCod}.`)
  }

  // ── ACCIÓN: REGISTRAR PRODUCCIÓN DE PANADERÍA ──
  const handleConfirmProduccionPan = (e: React.FormEvent) => {
    e.preventDefault()
    if (panModo === "sobrante") {
      const sobrante = parseFloat(panKgSobrante) || 0
      if (sobrante <= 0) {
        toast.warning("Faltan datos", "Ingrese los Kilos de pan sobrante a moler.")
        return
      }
      const obtenido = sobrante * 0.96
      const loteCod = `RES-${Date.now().toString().slice(-4)}`
      const nuevoLote: LoteProduccion = {
        id: `lp-${Date.now()}`,
        sector: "Panadería",
        receta_nombre: "Transformación Residuo Cero (Pan Seco ➔ Pan Rallado)",
        insumo_origen: `${sobrante}kg Pan Francés de Ayer`,
        cantidad_insumo: sobrante,
        producto_obtenido: panDestinoSobrante,
        cantidad_obtenida: Math.round(obtenido * 10) / 10,
        unidad: "Kg",
        costo_unitario: 5800,
        lote_codigo: loteCod,
        hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
      }
      soundAlerts.playScanSuccess()
      const updated = [nuevoLote, ...lotesProduccion]
      saveLotesProduccion(updated)
      toast.success("Residuo Cero Registrado", `Convertidos ${sobrante}kg de pan en ${obtenido.toFixed(1)}kg de Pan Rallado.`)
    } else {
      const harina = parseFloat(panKgHarina) || 0
      const obtenido = harina * 1.35
      const loteCod = `PAN-${Date.now().toString().slice(-4)}`
      const nuevoLote: LoteProduccion = {
        id: `lp-${Date.now()}`,
        sector: "Panadería",
        receta_nombre: `Amasado Diario: ${panTipoAmasado}`,
        insumo_origen: `${harina}kg Harina 000 + Insumos`,
        cantidad_insumo: harina,
        producto_obtenido: panTipoAmasado,
        cantidad_obtenida: Math.round(obtenido * 10) / 10,
        unidad: "Kg",
        costo_unitario: 8200,
        lote_codigo: loteCod,
        hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
      }
      soundAlerts.playScanSuccess()
      const updated = [nuevoLote, ...lotesProduccion]
      saveLotesProduccion(updated)
      toast.success("Horneada Registrada", `Producidos ${obtenido.toFixed(1)}kg de ${panTipoAmasado}.`)
    }
  }

  // ── ACCIÓN: REGISTRAR PRODUCCIÓN DE VERDULERÍA ──
  const handleConfirmProduccionVerdura = (e: React.FormEvent) => {
    e.preventDefault()
    const brutos = parseFloat(verduraKgBrutos) || 0
    if (brutos <= 0) {
      toast.warning("Faltan datos", "Ingrese los Kilos brutos fraccionados.")
      return
    }
    const bandejas = Math.floor((brutos * 0.85) / 0.5)
    const loteCod = `FC-${Date.now().toString().slice(-4)}`
    const nuevoLote: LoteProduccion = {
      id: `lp-${Date.now()}`,
      sector: "Verdulería",
      receta_nombre: `Fresh Cut: ${verduraBandejasDestino}`,
      insumo_origen: `${brutos}kg ${verduraInsumo} a granel`,
      cantidad_insumo: brutos,
      producto_obtenido: verduraBandejasDestino,
      cantidad_obtenida: bandejas,
      unidad: "Bandejas",
      costo_unitario: 4300,
      lote_codigo: loteCod,
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }
    soundAlerts.playScanSuccess()
    const updated = [nuevoLote, ...lotesProduccion]
    saveLotesProduccion(updated)
    toast.success("Fraccionamiento Terminado", `Empacadas ${bandejas} bandejas listas para venta refrigerada.`)
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
                {lotesProduccion.length}
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
                      className="p-2 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md cursor-pointer"
                      title="Cambiar Cámara Delantera/Trasera"
                    >
                      <RefreshCcw className="w-4 h-4" />
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

        {/* ══════════════════════ TAB 2: PRODUCCIÓN & TRANSFORMACIÓN REAL EN SECTORES ══════════════════════ */}
        {tab === "produccion" && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Selector de Sector Productivo Glass */}
            <div className="backdrop-blur-2xl bg-slate-900/65 border border-white/10 p-2 rounded-3xl grid grid-cols-3 gap-2">
              {[
                { id: "carniceria", label: "🥩 Carnicería", sub: "Desposte & Embutidos" },
                { id: "panaderia", label: "🥖 Panadería", sub: "Amasado & Residuo Cero" },
                { id: "verduleria", label: "🥕 Verdulería", sub: "Fresh Cut & Conveniencia" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setProduccionSector(s.id as ProduccionSector)}
                  className={`p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    produccionSector === s.id
                      ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
                      : "bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 border border-white/5"
                  }`}
                >
                  <div className="font-black text-xs truncate">{s.label}</div>
                  <div className="text-[10px] opacity-75 truncate">{s.sub}</div>
                </button>
              ))}
            </div>

            {/* ── SUB-SECTOR 1: CARNICERÍA (DESPOSTE & EMBUTIDOS) ── */}
            {produccionSector === "carniceria" && (
              <div className="space-y-4 animate-fade-in">
                
                {/* Desposte de Res */}
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h2 className="font-black text-sm text-white" style={displayFont}>
                        Desposte de Media Res (Cuarteo Gancho)
                      </h2>
                      <div className="text-[11px] text-slate-400">
                        Deconstrucción de media res a cortes nobles, recortes y hueso.
                      </div>
                    </div>
                    <button
                      onClick={() => window.open("/tv/carniceria", "_blank")}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black flex items-center gap-1 shadow-lg shadow-red-600/20 cursor-pointer"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>TV 55"</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Peso en Gancho (Kg):
                      </label>
                      <input
                        type="number"
                        value={despostePesoEntrada}
                        onChange={(e) => setDespostePesoEntrada(Number(e.target.value) || 0)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                        style={monoFont}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Costo Total Compra (₲):
                      </label>
                      <input
                        type="text"
                        value={desposteCostoTotal}
                        onChange={(e) => setDesposteCostoTotal(Number(e.target.value.replace(/\D/g, "")) || 0)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                        style={monoFont}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Costo / Kg Gancho</div>
                      <div className="font-black text-sm text-slate-200" style={monoFont}>
                        {formatPYG(desposteCalculo.costoKgGancho)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Valorizado Venta</div>
                      <div className="font-black text-sm text-emerald-400" style={monoFont}>
                        {formatPYG(desposteCalculo.valorizadoTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Margen Bruto</div>
                      <div className="font-black text-sm text-amber-400" style={monoFont}>
                        {desposteCalculo.margenPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Elaboración de Embutidos */}
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <h2 className="font-black text-sm text-white" style={displayFont}>
                    Elaboración de Embutidos & Chacinados
                  </h2>
                  <form onSubmit={handleConfirmProduccionCarne} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Receta a Elaborar:
                      </label>
                      <select
                        value={carneReceta}
                        onChange={(e) => setCarneReceta(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                      >
                        <option value="Chorizo Parrillero Casero Extra">Chorizo Parrillero Casero Extra (BOM: Trimmings + Tocino)</option>
                        <option value="Chorizo Toscano con Hierbas">Chorizo Toscano con Hierbas</option>
                        <option value="Morcilla Criolla Tradicional">Morcilla Criolla Tradicional</option>
                        <option value="Milanesas de Bola de Lomo Rebozadas">Milanesas Rebozadas (con Pan Rallado Panadería)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Kg Recortes / Trimmings:
                        </label>
                        <input
                          type="number"
                          value={carneKgTrimmings}
                          onChange={(e) => setCarneKgTrimmings(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-400"
                          style={monoFont}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Kg Tocino / Grasa:
                        </label>
                        <input
                          type="number"
                          value={carneKgTocino}
                          onChange={(e) => setCarneKgTocino(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-400"
                          style={monoFont}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 cursor-pointer active:scale-95 transition-all"
                    >
                      <Beef className="w-4 h-4" />
                      Registrar Lote de Elaborados en Carnicería
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── SUB-SECTOR 2: PANADERÍA ── */}
            {produccionSector === "panaderia" && (
              <div className="space-y-4 animate-fade-in">
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <button
                      onClick={() => setPanModo("sobrante")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        panModo === "sobrante" ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      ♻️ Residuo Cero (Pan Rallado)
                    </button>
                    <button
                      onClick={() => setPanModo("amasado")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        panModo === "amasado" ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      🥖 Horneada Diaria (Amasado)
                    </button>
                  </div>

                  <form onSubmit={handleConfirmProduccionPan} className="space-y-3">
                    {panModo === "sobrante" ? (
                      <>
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                          <strong>Upcycling / Residuo Cero:</strong> Convierte el pan no vendido en Pan Rallado embolsado para evitar merma y ganar margen.
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              Kg Pan Francés Seco:
                            </label>
                            <input
                              type="number"
                              value={panKgSobrante}
                              onChange={(e) => setPanKgSobrante(e.target.value)}
                              className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-400"
                              style={monoFont}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              Destino de Transformación:
                            </label>
                            <select
                              value={panDestinoSobrante}
                              onChange={(e) => setPanDestinoSobrante(e.target.value)}
                              className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                            >
                              <option value="Pan Rallado Artesanal Extra">Pan Rallado Artesanal Extra (Bolsas 1Kg)</option>
                              <option value="Tostadas Saborizadas con Orégano">Tostadas Saborizadas con Orégano</option>
                              <option value="Budín de Pan Artesanal Rotisería">Budín de Pan Artesanal (Rotisería)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
                        >
                          <ChefHat className="w-4 h-4" />
                          Transformar en Pan Rallado (Residuo Cero)
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              Kg Harina Amasada:
                            </label>
                            <input
                              type="number"
                              value={panKgHarina}
                              onChange={(e) => setPanKgHarina(e.target.value)}
                              className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-400"
                              style={monoFont}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                              Variedad Horneada:
                            </label>
                            <select
                              value={panTipoAmasado}
                              onChange={(e) => setPanTipoAmasado(e.target.value)}
                              className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                            >
                              <option value="Pan Francés Tradicional">Pan Francés Tradicional</option>
                              <option value="Pan Felipe">Pan Felipe</option>
                              <option value="Galletas Cuarteleras">Galletas Cuarteleras</option>
                              <option value="Chipa Almidón">Chipa Almidón</option>
                              <option value="Facturas / Medialunas">Facturas / Medialunas</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
                        >
                          <ChefHat className="w-4 h-4" />
                          Registrar Horneada y Descontar Harina
                        </button>
                      </>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* ── SUB-SECTOR 3: VERDULERÍA ── */}
            {produccionSector === "verduleria" && (
              <div className="space-y-4 animate-fade-in">
                <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <h2 className="font-black text-sm text-white" style={displayFont}>
                      Fraccionamiento Fresh Cut (Valor Agregado)
                    </h2>
                    <div className="text-[11px] text-slate-400">
                      Convierte verduras a granel en bandejas peladas de conveniencia (margen 50%+).
                    </div>
                  </div>

                  <form onSubmit={handleConfirmProduccionVerdura} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Verdura Insumo (Granel):
                        </label>
                        <select
                          value={verduraInsumo}
                          onChange={(e) => setVerduraInsumo(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                        >
                          <option value="Zapallo Kabutiá">Zapallo Kabutiá</option>
                          <option value="Mandioca Seleccionada">Mandioca Seleccionada</option>
                          <option value="Repollo / Zanahoria / Choclo">Mix Sopa de Verduras</option>
                          <option value="Frutas de Estación">Ensalada de Frutas</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          Kg Brutos Insumidos:
                        </label>
                        <input
                          type="number"
                          value={verduraKgBrutos}
                          onChange={(e) => setVerduraKgBrutos(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-400"
                          style={monoFont}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Producto Final Empacado:
                      </label>
                      <select
                        value={verduraBandejasDestino}
                        onChange={(e) => setVerduraBandejasDestino(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-3 py-3 text-xs font-bold text-white outline-none focus:border-amber-400"
                      >
                        <option value="Bandejas Zapallo en Cubos 500g">Bandejas Zapallo en Cubos 500g</option>
                        <option value="Bolsas Mandioca Pelada Envasada 1Kg">Bolsas Mandioca Pelada Envasada 1Kg</option>
                        <option value="Bandejas Sopa de Verduras Picadas">Bandejas Sopa de Verduras Picadas</option>
                        <option value="Potes Ensalada de Frutas 350g">Potes Ensalada de Frutas 350g</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all"
                    >
                      <Carrot className="w-4 h-4" />
                      Registrar Bandejeado en Batea Refrigerada
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Historial de Lotes Producidos */}
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                Lotes Producidos Hoy ({lotesProduccion.length})
              </h3>
              {lotesProduccion.length === 0 ? (
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                  Aún no se registraron lotes de producción en el turno.
                </div>
              ) : (
                <div className="space-y-2">
                  {lotesProduccion.map((lp) => (
                    <div key={lp.id} className="p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            lp.sector === "Carnicería" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                            lp.sector === "Panadería" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {lp.sector}
                          </span>
                          <div className="font-bold text-xs text-white truncate">
                            {lp.producto_obtenido}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Insumo: {lp.insumo_origen} • Lote: <strong className="text-slate-200 font-mono">{lp.lote_codigo}</strong> • {lp.hora}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-white" style={monoFont}>
                          {lp.cantidad_obtenida} {lp.unidad}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatPYG(lp.costo_unitario)}/{lp.unidad === "Bandejas" ? "un" : "kg"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

        {/* ══════════════════════ TAB 5: TEMPERATURAS & INOCUIDAD HACCP ══════════════════════ */}
        {tab === "haccp" && (
          <div className="space-y-5 animate-fade-in">
            <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <div className="w-9 h-9 rounded-2xl bg-teal-600/30 border border-teal-500/40 text-teal-400 flex items-center justify-center font-black shadow-lg shadow-teal-600/20">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-white" style={displayFont}>
                    Control de Temperaturas & Cadena de Frío
                  </h2>
                  <div className="text-[11px] text-slate-400">
                    Registro de puntos críticos bromatológicos del salón y cámaras.
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmTemperatura} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Cámara o Equipo a Medir:
                  </label>
                  <select
                    value={tempEquipo}
                    onChange={(e) => setTempEquipo(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-400"
                  >
                    <option value="Cámara de Reses (Carnicería)">Cámara de Reses (Carnicería) [0°C a 4°C]</option>
                    <option value="Batea Exhibidora de Cortes">Batea Exhibidora de Cortes [0°C a 4°C]</option>
                    <option value="Heladera Mural de Lácteos">Heladera Mural de Lácteos [1°C a 5°C]</option>
                    <option value="Cámara de Congelados">Cámara de Congelados [-22°C a -16°C]</option>
                    <option value="Vitrina Caliente de Rotisería">Vitrina Caliente de Rotisería [65°C a 85°C]</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Temperatura Leída (°C):
                  </label>
                  <input
                    type="text"
                    value={tempValor}
                    onChange={(e) => setTempValor(e.target.value.replace(/[^0-9.,-]/g, ""))}
                    placeholder="Ej: 2.5"
                    className="w-full bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 text-base font-black text-white outline-none focus:border-amber-400"
                    style={monoFont}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 cursor-pointer active:scale-95 transition-all"
                >
                  <Thermometer className="w-4 h-4" />
                  Guardar Medición HACCP Oficial
                </button>
              </form>
            </div>

            {/* Historial de Temperaturas */}
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400" style={displayFont}>
                Mediciones Registradas Hoy ({temperaturas.length})
              </h3>
              {temperaturas.length === 0 ? (
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 text-center text-xs text-slate-500">
                  No hay mediciones registradas en el turno de hoy.
                </div>
              ) : (
                <div className="space-y-2">
                  {temperaturas.map((t) => (
                    <div key={t.id} className="p-3.5 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            t.estado === "optimo" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                          }`}>
                            {t.estado === "optimo" ? "Óptimo" : "Crítico"}
                          </span>
                          <div className="font-bold text-xs text-white truncate">
                            {t.equipo}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Rango seguro: {t.rango_min}°C a {t.rango_max}°C • {t.hora}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-black text-lg ${t.estado === "optimo" ? "text-emerald-400" : "text-rose-400"}`} style={monoFont}>
                          {t.temperatura > 0 ? `+${t.temperatura}` : t.temperatura}°C
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ── BARRA INFERIOR DE NAVEGACIÓN TÁCTIL (GLASS FLOATING DOCK) ── */}
      <nav className="fixed bottom-3 left-3 right-3 z-40 max-w-lg mx-auto">
        <div className="backdrop-blur-2xl bg-slate-950/80 border border-white/15 rounded-3xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: "gondola", label: "Góndola", icon: Tag, badge: labelQueue.length },
              { id: "produccion", label: "Producción", icon: ChefHat, badge: lotesProduccion.length },
              { id: "mermas", label: "Mermas", icon: Trash2, badge: mermasList.length },
              { id: "reposicion", label: "Quiebres", icon: Boxes, badge: reposiciones.filter(r => r.estado === "pendiente").length },
              { id: "haccp", label: "HACCP", icon: Thermometer },
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

    </div>
  )
}
