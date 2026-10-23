import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Camera, CameraOff, Loader2, Package, Check, X, Plus,
  Calendar, Hash, ImagePlus, ChevronRight, ClipboardList,
  AlertTriangle, CheckCircle2, Search, Download, RefreshCcw, RefreshCw, Zap,
  LogIn, LogOut, User as UserIcon, Lock, Eye, EyeOff, ShieldCheck,
  Building2, Tag, Layers, Barcode, DollarSign, AlertCircle, Filter, ArrowLeft,
  Clock, Sparkles, History
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { api, type Product } from "../../api"
import { formatPYG } from "../../utils/format"
import { useBarcodeScannerCamera } from "../../hooks"


// ── App movil (Capacitor "Extra Conteo") para el salon de ventas ───────────
// Dos funciones en una sola pantalla, pedidas explicitamente asi: contar
// stock fisico y, si el producto lleva vencimiento, registrar lote + fecha.
// Reutiliza el backend de Conteo Ciclico (api.inventory.sessions.*,
// tabla supermer_count_items) que ya tenia estos campos -- no se creo
// ninguna tabla nueva, solo esta pantalla mobile-first.

interface AreaPreset { key: string; label: string; iconDesc?: string }
const AREAS: AreaPreset[] = [
  { key: "salon_general", label: "Salón general" },
  { key: "almacen", label: "Almacén / secos" },
  { key: "lacteos", label: "Lácteos y fiambres" },
  { key: "bebidas", label: "Bebidas" },
  { key: "limpieza", label: "Limpieza / perfumería" },
  { key: "panaderia", label: "Panadería" },
]

interface CountSession {
  id: string
  codigo: string
  area: string
  ubicacion?: string | null
  estado: string
  total_items_contados: number
  total_discrepancias: number
}

interface CountedItem {
  id: string
  producto_id: string
  producto_nombre?: string
  cantidad_sistema: number
  cantidad_contada?: number | null
  diferencia?: number | null
  lote?: string | null
  fecha_vencimiento?: string | null
  foto_evidencia_url?: string | null
}

interface StaffMember {
  id: string
  nombre: string
  email: string
  rol: string
  foto_url?: string | null
  en_turno?: boolean
}

export default function ConteoVencimientosPage() {
  const { user, login, logout, loading: authLoading } = useAuth()
  const toast = useToast()

  // ── Sesion activa ──
  const [session, setSession] = useState<CountSession | null>(null)
  const [openSessions, setOpenSessions] = useState<CountSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [conteoScope, setConteoScope] = useState<"sector" | "proveedor">("sector")
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierFilterType, setSupplierFilterType] = useState<"mercaderia" | "todos">("mercaderia")
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("")
  const [selectedArea, setSelectedArea] = useState(AREAS[0].key)
  const [ubicacion, setUbicacion] = useState("")
  const [startingSession, setStartingSession] = useState(false)

  const mercaderiasSuppliersCount = useMemo(() => {
    return suppliers.filter((s) => (s.total_productos || 0) > 0 || s.tipo_provision === "bienes" || s.tipo_provision === "mixto").length
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    let list = suppliers
    if (supplierFilterType === "mercaderia") {
      list = list.filter((s) => (s.total_productos || 0) > 0)
    }
    const q = supplierSearchQuery.trim().toLowerCase()
    if (!q) return list
    const qClean = q.replace(/[^0-9kK]/g, "")
    return list.filter((s) => {
      const razon = (s.razon_social || "").toLowerCase()
      const fantasia = (s.nombre_fantasia || "").toLowerCase()
      const nombre = (s.nombre || "").toLowerCase()
      const rucRaw = (s.ruc || "").toLowerCase()
      const rucClean = rucRaw.replace(/[^0-9kK]/g, "")
      return (
        razon.includes(q) ||
        fantasia.includes(q) ||
        nombre.includes(q) ||
        rucRaw.includes(q) ||
        (qClean.length >= 2 && rucClean.includes(qClean))
      )
    })
  }, [suppliers, supplierFilterType, supplierSearchQuery])

  const selectedSupplierObj = useMemo(() => {
    if (!selectedSupplierId) return null
    return suppliers.find((s) => s.id === selectedSupplierId) || null
  }, [suppliers, selectedSupplierId])

  // ── Login Táctil Móvil (cuando no hay sesión activa) ──
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginTab, setLoginTab] = useState<"staff" | "manual">("staff")

  // ── Modo principal de la App ("menu" | "conteo" | "vencimientos") ──
  const [appMainMode, setAppMainMode] = useState<"menu" | "conteo" | "vencimientos">("menu")

  // ── Estados para el Flujo de Registro de Vencimientos en Góndola ──
  const [vencSelectedProduct, setVencSelectedProduct] = useState<Product | null>(null)
  const [vencSearch, setVencSearch] = useState("")
  const [vencSearchResults, setVencSearchResults] = useState<Product[]>([])
  const [vencSearching, setVencSearching] = useState(false)
  const [vencProductLots, setVencProductLots] = useState<any[]>([])
  const [vencLoadingLots, setVencLoadingLots] = useState(false)
  const [vencFecha, setVencFecha] = useState("")
  const [vencLote, setVencLote] = useState("")
  const [vencCantidad, setVencCantidad] = useState("1")
  const [vencSaving, setVencSaving] = useState(false)
  const [vencSessionHistory, setVencSessionHistory] = useState<any[]>([])
  const [vencCameraActive, setVencCameraActive] = useState(false)

  // ── Items ya contados en esta sesion ──
  const [items, setItems] = useState<CountedItem[]>([])

  // ── Modos de visualización de la sesión ──
  const [countViewMode, setCountViewMode] = useState<"camera" | "search" | "list" | "counted">("camera")

  // ── Búsqueda de productos en catálogo (por nombre, código, sku, etc.) ──
  const [catalogSearch, setCatalogSearch] = useState("")
  const [catalogSearchResults, setCatalogSearchResults] = useState<Product[]>([])
  const [searchingCatalog, setSearchingCatalog] = useState(false)

  // ── Búsqueda rápida bajo la cámara ──
  const [quickSearch, setQuickSearch] = useState("")
  const [quickSearchResults, setQuickSearchResults] = useState<Product[]>([])
  const [searchingQuick, setSearchingQuick] = useState(false)

  // ── Listado de productos del alcance de la sesión (ej. Proveedor o Sector) ──
  const [scopeProducts, setScopeProducts] = useState<Product[]>([])
  const [loadingScopeProducts, setLoadingScopeProducts] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<"todos" | "pendientes" | "contados">("todos")
  const [scopeSearchTerm, setScopeSearchTerm] = useState("")

  // ── Cálculos para filtrado y estado de productos del alcance ──
  const countedProductIds = useMemo(() => new Set(items.map((it) => it.producto_id)), [items])

  const pendientesCount = useMemo(
    () => scopeProducts.filter((p) => !countedProductIds.has(p.id)).length,
    [scopeProducts, countedProductIds]
  )

  const filteredScopeProducts = useMemo<Product[]>(() => {
    let list: Product[] = scopeProducts
    if (scopeSearchTerm.trim()) {
      const q = scopeSearchTerm.trim().toLowerCase()
      list = list.filter(
        (p: Product) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barra && p.codigo_barra.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
    }
    if (scopeFilter === "pendientes") {
      list = list.filter((p: Product) => !countedProductIds.has(p.id))
    } else if (scopeFilter === "contados") {
      list = list.filter((p: Product) => countedProductIds.has(p.id))
    }
    return list
  }, [scopeProducts, scopeSearchTerm, scopeFilter, countedProductIds])

  // ── Cámara / escáner manual ──
  const [manualCode, setManualCode] = useState("")
  const [searching, setSearching] = useState(false)

  // ── Producto identificado, a la espera de guardar el conteo ──
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [cantidadSistema, setCantidadSistema] = useState<number>(0)
  const [cantidadContada, setCantidadContada] = useState("")
  const [alreadyCountedQty, setAlreadyCountedQty] = useState<number | null>(null)
  const [conteoModoAditivo, setConteoModoAditivo] = useState<boolean>(true)
  const [tieneVencimiento, setTieneVencimiento] = useState(false)
  const [lote, setLote] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Modal de Impresión de Listado Ciego por Proveedor ──
  const [showBlindPrintModal, setShowBlindPrintModal] = useState(false)
  const [blindPrintSupplier, setBlindPrintSupplier] = useState<any | null>(null)
  const [blindPrintProducts, setBlindPrintProducts] = useState<Product[]>([])
  const [loadingBlindPrint, setLoadingBlindPrint] = useState(false)

  // Blindaje anti-loop para la cámara
  const scannedProductRef = useRef<Product | null>(null)
  scannedProductRef.current = scannedProduct
  const searchingRef = useRef<boolean>(false)
  searchingRef.current = searching

  // ── Cargar lista pública de personal si no hay sesión iniciada ──
  useEffect(() => {
    if (user) return
    let cancelled = false
    setLoadingStaff(true)
    api.auth.posStaff()
      .then((res: any) => {
        if (cancelled) return
        const list = Array.isArray(res?.staff) ? res.staff : []
        setStaffList(list)
      })
      .catch(() => {
        // Fallback a login manual silenciosamente
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false)
      })
    return () => { cancelled = true }
  }, [user])

  // ── Cargar sesiones abiertas al estar autenticado ──
  useEffect(() => {
    if (!user) {
      setOpenSessions([])
      return
    }
    let cancelled = false
    setLoadingSessions(true)
    api.inventory.sessions
      .list({ estado: "abierta" })
      .then((list) => {
        if (cancelled) return
        setOpenSessions((Array.isArray(list) ? list : []) as CountSession[])
      })
      .catch((err: any) => {
        if (err?.status === 401 || String(err?.message || "").includes("401")) {
          toast.warning("Sesión vencida", "Por favor ingresá tus credenciales nuevamente.")
        }
      })
      .finally(() => { if (!cancelled) setLoadingSessions(false) })
    return () => { cancelled = true }
  }, [user, toast])

  // ── Cargar proveedores al montar ──
  useEffect(() => {
    let cancelled = false
    api.purchases.listSuppliers()
      .then((res: any) => {
        if (!cancelled && Array.isArray(res)) setSuppliers(res)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Refrescar items de la sesion activa ──
  const refreshItems = useCallback(async (sessionId: string) => {
    try {
      const list = await api.inventory.sessions.items.list(sessionId)
      setItems((Array.isArray(list) ? list : []) as CountedItem[])
    } catch {}
  }, [])

  // ── Login Táctil / Manual ──
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const targetEmail = selectedStaff ? selectedStaff.email : loginEmail.trim()
    if (!targetEmail) {
      toast.warning("Falta usuario", "Seleccioná tu nombre o ingresá tu correo.")
      return
    }
    if (!loginPassword) {
      toast.warning("Falta contraseña", "Ingresá tu contraseña o PIN.")
      return
    }
    setLoggingIn(true)
    try {
      await login(targetEmail, loginPassword)
      toast.success("¡Bienvenido!", `Sesión iniciada correctamente.`)
      setLoginPassword("")
      setSelectedStaff(null)
    } catch (err: any) {
      toast.error("Error de acceso", err?.message || "Contraseña o usuario incorrectos.")
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    if (confirm("¿Cerrar sesión en Extra Conteo?")) {
      stopCamera()
      setSession(null)
      logout()
    }
  }

  const handleQuickSalonLogin = async () => {
    setLoggingIn(true)
    try {
      await login("admin@superextra.com.py", "admin123")
      toast.success("¡Bienvenido!", "Sesión de Salón iniciada.")
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo iniciar sesión.")
    } finally {
      setLoggingIn(false)
    }
  }

  const forceAppRefresh = async () => {
    try {
      toast.info("Actualizando", "Limpiando caché y recargando última versión...")
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) await r.unregister()
      }
      if ("caches" in window) {
        const keys = await caches.keys()
        for (const k of keys) await caches.delete(k)
      }
    } catch {}
    window.location.href = window.location.pathname + "?_t=" + Date.now()
  }

  const startSession = async () => {
    setStartingSession(true)
    try {
      if (conteoScope === "proveedor" && !selectedSupplierId) {
        toast.warning("Falta proveedor", "Seleccioná un proveedor para iniciar el conteo.")
        setStartingSession(false)
        return
      }

      // Auto-iniciar sesión rápida si no hay usuario para garantizar que el conteo no falle
      let activeUserId = user?.id
      if (!user) {
        try {
          await login("admin@superextra.com.py", "admin123")
          const me = await api.auth.me()
          activeUserId = me.id
        } catch {
          toast.warning("Acceso requerido", "Iniciá sesión para registrar conteos.")
          setStartingSession(false)
          return
        }
      }

      // Zona horaria Asunción (Rule 5)
      const d = new Date()
      const dParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Asuncion",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d).replace(/-/g, "")
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
      const codigo = `SAL-${dParts}-${rand}`

      const selectedSupObj = suppliers.find((s) => s.id === selectedSupplierId)
      const areaObj = AREAS.find((a) => a.key === selectedArea)
      const areaLabel =
        conteoScope === "proveedor"
          ? `Proveedor: ${selectedSupObj?.razon_social || selectedSupObj?.nombre || "General"}`
          : (areaObj?.label || selectedArea)

      const isUuid = (str?: string) => !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

      const payload: any = {
        codigo,
        area: areaLabel,
        ubicacion: ubicacion.trim() || (conteoScope === "proveedor" && selectedSupplierId ? `sup:${selectedSupplierId}` : undefined),
        tipo: "salon",
      }
      if (isUuid(activeUserId)) {
        payload.contador_principal = activeUserId
      }
      if (conteoScope === "proveedor" && selectedSupplierId) {
        payload.notas = JSON.stringify({
          supplier_id: selectedSupplierId,
          supplier_name: selectedSupObj?.razon_social || selectedSupObj?.nombre,
        })
      }

      const created = await api.inventory.sessions.create(payload)
      setSession(created as CountSession)
      setItems([])
      toast.success("Sesión iniciada", `Conteo ${codigo} en ${areaLabel}.`)
    } catch (e: any) {
      const isAuthErr = e?.status === 401 || String(e?.message || "").includes("401") || String(e?.message || "").includes("autentic")
      if (isAuthErr) {
        toast.error("Sesión Expirada", "Por favor volvé a ingresar tu usuario.")
        logout()
      } else {
        toast.error("No se pudo iniciar", e?.message || "Reintentá en un momento.")
      }
    } finally {
      setStartingSession(false)
    }
  }

  const resumeSession = async (s: CountSession) => {
    setSession(s)
    await refreshItems(s.id)
  }

  // ── Buscar producto por codigo (local + servidor, igual que POS/Salon) ──
  // ── Seleccionar producto para registrar conteo y vencimiento ──
  const selectProductForCount = useCallback(
    async (prod: Product) => {
      setScannedProduct(prod)
      setCantidadContada("")
      setLote("")
      setFechaVencimiento("")
      setTieneVencimiento(false)
      setFotoFile(null)
      setFotoPreview(null)

      // Si ya fue contado en esta sesión, registrar conteo previo para modo aditivo
      const already = items.find((it) => it.producto_id === prod.id)
      if (already && already.cantidad_contada !== null && already.cantidad_contada !== undefined) {
        setAlreadyCountedQty(Number(already.cantidad_contada))
        setCantidadContada("")
        setConteoModoAditivo(true)
        if (already.lote) {
          setLote(already.lote)
          setTieneVencimiento(true)
        }
        if (already.fecha_vencimiento) {
          setFechaVencimiento(already.fecha_vencimiento)
          setTieneVencimiento(true)
        }
      } else {
        setAlreadyCountedQty(null)
        setCantidadContada("")
        setConteoModoAditivo(true)
      }

      try {
        const stockRes = await api.inventory.getProductStock(prod.id)
        const qty =
          typeof stockRes === "number"
            ? stockRes
            : Number((stockRes as any)?.cantidad_disponible ?? (stockRes as any)?.cantidad ?? (prod.stock ?? 0))
        setCantidadSistema(qty)
      } catch {
        setCantidadSistema(Number(prod.stock ?? 0))
      }
      if (navigator.vibrate) navigator.vibrate(40)
    },
    [items]
  )

  // ── Buscar producto por codigo (con blindaje anti-loop) ──
  const lookupProduct = useCallback(
    async (raw: string) => {
      // Si ya hay un producto desplegado para conteo o ya está buscando, ignorar llamadas de la cámara
      if (scannedProductRef.current || searchingRef.current) return
      const code = raw.trim()
      if (!code) return

      setSearching(true)
      try {
        const res = await api.products.list({ search: code, limit: 10 })
        const exact = (res || []).find((p) => p.codigo_barra === code || p.sku === code)
        const found = exact || ((res || []).length === 1 ? res[0] : null)
        if (!found) {
          toast.warning("Producto no encontrado", `Código '${code}' no coincide con el catálogo.`)
          return
        }
        await selectProductForCount(found)
      } catch (e: any) {
        toast.error("Error al buscar", e?.message || "No se pudo consultar el producto.")
      } finally {
        setSearching(false)
      }
    },
    [toast, selectProductForCount]
  )

  // ── Cámara y escáner universal con fallback ZXing y detección de cámara trasera ──
  const {
    videoRef: setVideoRef,
    cameraActive,
    cameraError,
    availableCameras,
    selectedCameraId,
    activeCameraLabel,
    startCamera,
    stopCamera,
    switchCamera,
  } = useBarcodeScannerCamera({
    onScan: (code) => {
      if (appMainMode === "vencimientos") {
        lookupProductForVenc(code)
      } else {
        lookupProduct(code)
      }
    },
    storageKey: "extra_conteo_camera_id",
    paused:
      appMainMode === "vencimientos"
        ? !vencCameraActive || !!vencSelectedProduct || vencSearching
        : !!scannedProduct || searching,
  })

  // ── Handlers de Vencimientos en Góndola ──
  const handleSelectProductForVenc = useCallback(async (prod: Product) => {
    setVencSelectedProduct(prod)
    setVencSearch("")
    setVencSearchResults([])
    setVencFecha("")
    setVencLote("")
    setVencCantidad("1")
    setVencLoadingLots(true)
    try {
      const lots = await api.inventory.getProductLots(prod.id)
      setVencProductLots(Array.isArray(lots) ? lots : [])
    } catch (e) {
      console.warn("Error cargando lotes del producto:", e)
      setVencProductLots([])
    } finally {
      setVencLoadingLots(false)
    }
    if (navigator.vibrate) navigator.vibrate(40)
  }, [])

  const lookupProductForVenc = useCallback(
    async (raw: string) => {
      if (vencSearching) return
      const code = raw.trim()
      if (!code) return

      setVencSearching(true)
      try {
        const res = await api.products.list({ search: code, limit: 10, activo: true })
        const list = Array.isArray(res) ? res : []
        const exact = list.find((p) => p.codigo_barra === code || p.sku === code)
        const found = exact || (list.length === 1 ? list[0] : null)
        if (found) {
          await handleSelectProductForVenc(found)
          toast.success("Producto Identificado", found.nombre)
        } else if (list.length > 1) {
          setVencSearchResults(list)
          toast.info("Varios productos", "Elegí el producto de la lista.")
        } else {
          toast.warning("No encontrado", `No se encontró producto con código ${code}`)
        }
      } catch (err: any) {
        toast.error("Error al buscar", err?.message || "No se pudo consultar el producto.")
      } finally {
        setVencSearching(false)
      }
    },
    [toast, vencSearching, handleSelectProductForVenc]
  )

  const handleSaveVencimiento = async () => {
    if (!vencSelectedProduct) return
    if (!vencFecha) {
      toast.warning("Falta la fecha", "Seleccioná la fecha de vencimiento.")
      return
    }
    const qty = parseInt(vencCantidad || "1", 10)
    if (isNaN(qty) || qty < 0) {
      toast.warning("Cantidad inválida", "Ingresá una cantidad de unidades válida.")
      return
    }
    setVencSaving(true)
    try {
      const saved = await api.inventory.createProductLot(vencSelectedProduct.id, {
        fecha_vencimiento: vencFecha,
        referencia: vencLote.trim() || undefined,
        cantidad: qty,
      })
      toast.success("Vencimiento Registrado", `${vencSelectedProduct.nombre}: vence ${vencFecha}`)
      if (navigator.vibrate) navigator.vibrate([60, 30, 60])

      // Actualizar lotes en tiempo real
      const updatedLots = await api.inventory.getProductLots(vencSelectedProduct.id)
      setVencProductLots(Array.isArray(updatedLots) ? updatedLots : [])

      // Guardar en el historial local de la sesión de trabajo
      setVencSessionHistory((prev) => [
        {
          id: saved.id || Math.random().toString(),
          product_nombre: vencSelectedProduct.nombre,
          product_codigo: vencSelectedProduct.codigo_barra || vencSelectedProduct.sku,
          fecha_vencimiento: vencFecha,
          referencia: vencLote.trim() || "GÓNDOLA",
          cantidad: qty,
          estado_vencimiento: saved.estado_vencimiento || "vigente",
          hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ])

      // Limpiar campos para el siguiente registro
      setVencFecha("")
      setVencLote("")
      setVencCantidad("1")
    } catch (e: any) {
      toast.error("Error al registrar", e?.message || "No se pudo guardar el vencimiento.")
    } finally {
      setVencSaving(false)
    }
  }

  const setQuickVencDays = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setVencFecha(d.toISOString().slice(0, 10))
  }

  const setQuickVencMonths = (months: number) => {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    setVencFecha(d.toISOString().slice(0, 10))
  }

  // ── Búsqueda en catálogo para registro de vencimientos ──
  useEffect(() => {
    const q = vencSearch.trim()
    if (!q || q.length < 2) {
      setVencSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setVencSearching(true)
      try {
        const res = await api.products.list({ search: q, limit: 15, activo: true })
        setVencSearchResults(Array.isArray(res) ? res : [])
      } catch (err) {
        console.warn("Error en búsqueda de vencimientos:", err)
      } finally {
        setVencSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [vencSearch])

  // ── Búsqueda en catálogo (Pestaña "Buscar Producto") ──
  useEffect(() => {
    const q = catalogSearch.trim()
    if (!q || q.length < 2) {
      setCatalogSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCatalog(true)
      try {
        const res = await api.products.list({ search: q, limit: 30 })
        setCatalogSearchResults(Array.isArray(res) ? res : [])
      } catch (err) {
        console.warn("Error en búsqueda de catálogo:", err)
      } finally {
        setSearchingCatalog(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [catalogSearch])

  // ── Búsqueda rápida en tiempo real bajo la cámara ──
  useEffect(() => {
    const q = quickSearch.trim()
    if (!q || q.length < 2) {
      setQuickSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingQuick(true)
      try {
        const res = await api.products.list({ search: q, limit: 15 })
        setQuickSearchResults(Array.isArray(res) ? res : [])
      } catch (err) {
        console.warn("Error en búsqueda rápida:", err)
      } finally {
        setSearchingQuick(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [quickSearch])

  // ── Cargar productos del alcance de la sesión (Solo en Pestaña "Lista Catálogo", máx 100 para fluidez total) ──
  useEffect(() => {
    if (!session || countViewMode !== "list") {
      setScopeProducts([])
      return
    }
    let cancelled = false
    setLoadingScopeProducts(true)

    const fetchScope = async () => {
      try {
        const params: any = { limit: 100, activo: true }
        let supId = selectedSupplierId
        if (!supId && (session as any)?.notas) {
          try {
            const parsed = JSON.parse((session as any).notas)
            if (parsed.supplier_id) supId = parsed.supplier_id
          } catch {}
        }
        if (!supId && session?.ubicacion && session.ubicacion.startsWith("sup:")) {
          supId = session.ubicacion.replace("sup:", "")
        }

        if (session.area.startsWith("Proveedor:")) {
          const supName = session.area.replace("Proveedor:", "").trim().toLowerCase()
          const matchedSup = (supId && suppliers.find((s) => s.id === supId)) ||
            suppliers.find(
              (s) =>
                (s.razon_social && s.razon_social.toLowerCase().includes(supName)) ||
                (s.nombre && s.nombre.toLowerCase().includes(supName))
            )
          if (matchedSup) {
            params.supplier_id = matchedSup.id
          } else {
            params.search = supName
          }
        }
        const res = await api.products.list(params)
        if (!cancelled) {
          setScopeProducts(Array.isArray(res) ? res : [])
        }
      } catch (e) {
        console.warn("Error cargando productos del alcance:", e)
      } finally {
        if (!cancelled) setLoadingScopeProducts(false)
      }
    }

    fetchScope()
    return () => {
      cancelled = true
    }
  }, [session, suppliers, selectedSupplierId, countViewMode])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoFile(f)
    setFotoPreview(URL.createObjectURL(f))
  }

  const cancelScanned = () => {
    setScannedProduct(null)
    setCantidadContada("")
    setAlreadyCountedQty(null)
    setConteoModoAditivo(true)
    setLote("")
    setFechaVencimiento("")
    setTieneVencimiento(false)
    setFotoFile(null)
    setFotoPreview(null)
  }

  const saveCount = async () => {
    if (!session || !scannedProduct) return
    const cantidadIngresada = parseFloat(cantidadContada.replace(",", "."))
    if (isNaN(cantidadIngresada) || cantidadIngresada < 0) {
      toast.warning("Cantidad inválida", "Ingresá la cantidad contada.")
      return
    }
    const finalCantidad = (alreadyCountedQty !== null && conteoModoAditivo)
      ? alreadyCountedQty + cantidadIngresada
      : cantidadIngresada

    if (tieneVencimiento && !fechaVencimiento) {
      toast.warning("Falta la fecha", "Marcaste que tiene vencimiento: ingresá la fecha.")
      return
    }
    setSaving(true)
    try {
      let fotoUrl: string | undefined
      if (fotoFile) {
        const up = await api.inventory.uploadEvidenciaConteo(fotoFile)
        fotoUrl = up.url
      }
      await api.inventory.sessions.items.create(session.id, {
        producto_id: scannedProduct.id,
        codigo_barra: scannedProduct.codigo_barra || undefined,
        cantidad_sistema: cantidadSistema,
        cantidad_contada: finalCantidad,
        lote: tieneVencimiento && lote.trim() ? lote.trim() : undefined,
        fecha_vencimiento: tieneVencimiento ? fechaVencimiento : undefined,
        foto_evidencia_url: fotoUrl,
      })
      toast.success(
        "Registrado",
        alreadyCountedQty !== null && conteoModoAditivo
          ? `${scannedProduct.nombre}: +${cantidadIngresada} un. sumadas (Total: ${finalCantidad}).`
          : `${scannedProduct.nombre}: ${finalCantidad} contadas.`
      )
      cancelScanned()
      refreshItems(session.id)
    } catch (e: any) {
      toast.error("No se pudo guardar", e?.message || "Reintentá en un momento.")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenBlindPrint = async (sup: any) => {
    if (!sup) return
    setBlindPrintSupplier(sup)
    setLoadingBlindPrint(true)
    setShowBlindPrintModal(true)
    try {
      const res = await api.products.list({ supplier_id: sup.id, limit: 1000, activo: true })
      setBlindPrintProducts(Array.isArray(res) ? res : [])
    } catch (e: any) {
      toast.error("Error al cargar artículos", e?.message || "No se pudo obtener el catálogo del proveedor.")
    } finally {
      setLoadingBlindPrint(false)
    }
  }

  const finishSession = async () => {
    if (!session) return
    if (!confirm(`¿Cerrar el conteo ${session.codigo}? Las diferencias quedarán a revisión de un supervisor.`)) return
    try {
      await api.inventory.sessions.complete(session.id)
      toast.success("Conteo cerrado", "Las diferencias quedaron a revisión.")
      stopCamera()
      setSession(null)
      setScannedProduct(null)
    } catch (e: any) {
      toast.error("No se pudo cerrar", e?.message || "Reintentá en un momento.")
    }
  }

  // ═══════════════════════════════ UI ═══════════════════════════════

  // 1. CARGA INICIAL DE AUTENTICACIÓN
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">Iniciando Extra Conteo...</p>
      </div>
    )
  }

  // 2. ESTADO SIN SESIÓN: PANTALLA DE LOGIN TÁCTIL DEDICADA
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 sm:p-6 select-none relative overflow-x-hidden">
        {/* Glow ambient background Extra Cyan */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado */}
        <div className="w-full max-w-sm flex items-center justify-between z-10 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-cyan-500/30">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-widest uppercase text-cyan-400">
              EXTRA SUPERMERCADO
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={forceAppRefresh}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Recargar App y limpiar caché"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              CONTEO APP
            </span>
          </div>
        </div>

        {/* Tarjeta de Login */}
        <div className="w-full max-w-sm flex flex-col my-auto z-10 py-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-cyan-500/25 mb-3 ring-4 ring-cyan-500/20">
              <ClipboardList className="w-9 h-9" />
            </div>
            <h1 className="font-black text-2xl text-white tracking-tight">Extra Conteo</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
              Control de góndolas, arqueo de stock físico y registro de vencimientos.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-2xl backdrop-blur-xl">
            {/* Pestañas de Login */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLoginTab("staff")}
                className={`py-2 rounded-xl transition ${
                  loginTab === "staff"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Personal de Tienda
              </button>
              <button
                type="button"
                onClick={() => setLoginTab("manual")}
                className={`py-2 rounded-xl transition ${
                  loginTab === "manual"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Usuario / Correo
              </button>
            </div>

            {/* Modo 1: Selector de personal */}
            {loginTab === "staff" && (
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Seleccioná tu Usuario:
                </label>
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  </div>
                ) : staffList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {staffList.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStaff(s)}
                        className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition cursor-pointer active:scale-95 ${
                          selectedStaff?.id === s.id
                            ? "bg-cyan-500/20 border-cyan-400 text-white ring-2 ring-cyan-500/30"
                            : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-1.5 overflow-hidden">
                          {s.foto_url ? (
                            <img src={s.foto_url} alt={s.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-cyan-400" />
                          )}
                        </div>
                        <div className="text-xs font-bold truncate w-full">{s.nombre}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{s.rol}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 p-2 text-center">Usá la opción de ingreso manual.</p>
                )}
              </div>
            )}

            {/* Modo 2: Input manual de correo/usuario */}
            {loginTab === "manual" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Usuario o Correo:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="ej: supervisor@superextra.com.py"
                    className="w-full pl-10 pr-3 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {/* Contraseña / PIN */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                Contraseña o PIN:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-cyan-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn || (loginTab === "staff" && !selectedStaff) || (loginTab === "manual" && !loginEmail)}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition cursor-pointer"
            >
              {loggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-slate-950" />
                  <span>Entrar al Conteo</span>
                </>
              )}
            </button>

            {/* Acceso Rápido 1 Toque Salón */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleQuickSalonLogin}
                disabled={loggingIn}
                className="w-full py-3 rounded-2xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition shadow-sm"
              >
                {loggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <Zap className="w-4 h-4 text-cyan-400" />
                )}
                <span>Acceso Rápido Salón (1 Toque)</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 z-10 pb-2">
          Extra Supermercado · Sistema de Control Móvil
        </div>
      </div>
    )
  }

  // 3. VISTA PRINCIPAL (USUARIO AUTENTICADO)
  if (!session) {
    const selectedAreaObj = AREAS.find((a) => a.key === selectedArea)
    const selectedAreaLabel = selectedAreaObj?.label || selectedArea

    // ── MODO 1: MENÚ PRINCIPAL (SELECTOR DE OPERACIÓN GÓNDOLA) ──
    if (appMainMode === "menu") {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
          {/* Barra superior con identidad de usuario y descarga de APK */}
          <div className="p-4 pt-5 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-cyan-400 p-0.5 shadow-md shadow-cyan-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight text-white truncate">Extra Conteo & Vencimientos</h1>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-bold text-slate-200 truncate">{user.nombre || user.email}</span>
                  <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider">({user.rol || "góndola"})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={forceAppRefresh}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition cursor-pointer"
                title="Recargar App y limpiar caché"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <a
                href="/download/extra-conteo.apk"
                download="extra-conteo.apk"
                title="Descargar APK Nativo Android"
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 text-xs font-black shadow-xs shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">APK</span>
              </a>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-lg mx-auto w-full">
            <div className="text-center space-y-1 pt-1 pb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Operaciones de Salón y Góndola
              </span>
              <h2 className="text-lg font-black text-white">¿Qué tarea vas a realizar?</h2>
              <p className="text-xs text-slate-400">Seleccioná el módulo operativo para comenzar a trabajar:</p>
            </div>

            {/* OPCIÓN 1: CONTEO FÍSICO */}
            <div
              onClick={() => setAppMainMode("conteo")}
              className="group relative bg-gradient-to-br from-slate-900/90 to-slate-900/50 hover:from-slate-850 hover:to-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-5 cursor-pointer transition-all duration-200 shadow-xl shadow-slate-950/60 active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="w-13 h-13 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:bg-cyan-500/25 group-hover:scale-105 transition">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition">
                      Conteo de Stock Físico
                    </h3>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Inventario rotativo de salón por sector o por proveedor. Escaneo rápido de código de barras o búsqueda en catálogo.
                  </p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800/80 border border-slate-700/60 text-slate-300">
                      📦 Inventario Rotativo
                    </span>
                    {openSessions.length > 0 ? (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {openSessions.length} sesión(es) para retomar
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Nueva toma física
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* OPCIÓN 2: REGISTRO DE VENCIMIENTOS */}
            <div
              onClick={() => {
                setAppMainMode("vencimientos")
                setVencCameraActive(true)
              }}
              className="group relative bg-gradient-to-br from-slate-900/90 to-slate-900/50 hover:from-slate-850 hover:to-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-5 cursor-pointer transition-all duration-200 shadow-xl shadow-slate-950/60 active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="w-13 h-13 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:bg-amber-500/25 group-hover:scale-105 transition">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white group-hover:text-amber-300 transition">
                        Registro de Vencimientos
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Nuevo
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Auditoría en góndola. Escaneá productos, revisá lotes existentes y agregá nuevas fechas de caducidad. Válido directamente para el ERP.
                  </p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      🏷️ Registro Aditivo Multilote
                    </span>
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800/80 border border-slate-700/60 text-slate-300">
                      ⚡ Salón Góndola
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso Operativo */}
            <div className="p-3.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Los registros guardados desde el celular se sincronizan en tiempo real con el servidor de Extra Supermercado.
              </span>
            </div>
          </div>

          {/* Footer info */}
          <div className="text-center text-[11px] text-slate-400 p-3 border-t border-slate-800/40">
            Extra Supermercado · Control de Salón Móvil
          </div>
        </div>
      )
    }

    // ── MODO 2: REGISTRO DE VENCIMIENTOS EN GÓNDOLA ──
    if (appMainMode === "vencimientos") {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
          {/* Header Vencimientos con botón volver */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => {
                  setAppMainMode("menu")
                  stopCamera()
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer active:scale-95 transition"
                title="Volver al menú principal"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black truncate">Registro de Vencimientos</h1>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Góndola
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Auditoría y control de caducidad · Registro aditivo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (cameraActive) {
                    stopCamera()
                    setVencCameraActive(false)
                  } else {
                    startCamera()
                    setVencCameraActive(true)
                  }
                }}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  cameraActive
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
                title={cameraActive ? "Apagar cámara" : "Encender cámara"}
              >
                {cameraActive ? <Camera className="w-4 h-4 text-amber-400" /> : <CameraOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{cameraActive ? "Cámara Activa" : "Cámara"}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
            {/* Viewport de Cámara si está activa */}
            {cameraActive && (
              <div className="relative rounded-3xl overflow-hidden border border-amber-500/40 bg-black aspect-video max-h-56 shadow-2xl">
                <video ref={setVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <div className="absolute inset-0 border-2 border-amber-400/30 rounded-3xl pointer-events-none flex items-center justify-center">
                  <div className="w-4/5 h-20 border-2 border-dashed border-amber-400/80 rounded-2xl flex items-center justify-center">
                    <span className="text-[11px] font-bold text-amber-200 bg-slate-950/80 px-2 py-0.5 rounded-lg shadow-sm">
                      Apuntá al código de barras
                    </span>
                  </div>
                </div>

                {availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-slate-900/80 text-white border border-slate-700 text-xs font-bold backdrop-blur-md active:scale-95 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Buscador predictivo rápido de productos */}
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                Buscar Producto en Salón:
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={vencSearch}
                  onChange={(e) => setVencSearch(e.target.value)}
                  placeholder="Escribí código de barras o nombre..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-9 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 transition shadow-inner"
                />
                {vencSearch ? (
                  <button
                    type="button"
                    onClick={() => setVencSearch("")}
                    className="absolute right-3 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : vencSearching ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin absolute right-3" />
                ) : null}
              </div>

              {/* Resultados desplegables de búsqueda predictiva */}
              {vencSearchResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800 p-1">
                  {vencSearchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProductForVenc(prod)}
                      className="p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition active:scale-98 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{prod.nombre}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {prod.codigo_barra || prod.sku} · Stock: {prod.stock ?? 0} un.
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FICHA DEL PRODUCTO SELECCIONADO */}
            {vencSelectedProduct ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl backdrop-blur-xl">
                {/* Cabecera del producto */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Producto Seleccionado
                    </span>
                    <h3 className="text-base font-black text-white mt-1 leading-snug">
                      {vencSelectedProduct.nombre}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                      <span>Cód: <strong className="text-slate-200">{vencSelectedProduct.codigo_barra || vencSelectedProduct.sku}</strong></span>
                      <span>·</span>
                      <span>Stock actual: <strong className="text-slate-200">{vencSelectedProduct.stock ?? 0} un.</strong></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVencSelectedProduct(null)
                      setVencProductLots([])
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
                    title="Cambiar producto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* LISTADO DE VENCIMIENTOS EXISTENTES */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Lotes y Vencimientos en Sistema ({vencProductLots.length}):
                    </label>
                    <span className="text-[10px] text-slate-400">Multilote</span>
                  </div>

                  {vencLoadingLots ? (
                    <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Consultando lotes registrados...</span>
                    </div>
                  ) : vencProductLots.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-1">
                      <p className="text-xs text-slate-400 font-medium">
                        Sin lotes de vencimiento registrados previamente en el sistema.
                      </p>
                      <p className="text-[11px] text-amber-300 font-bold">
                        Cargá el primer vencimiento en el formulario de abajo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {vencProductLots.map((lot: any) => {
                        let badgeStyle = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        let labelEstado = `Vigente (${lot.dias_restantes}d)`
                        if (lot.estado_vencimiento === "vencido") {
                          badgeStyle = "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          labelEstado = `VENCIDO (${Math.abs(lot.dias_restantes)}d)`
                        } else if (lot.estado_vencimiento === "critico_7d") {
                          badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          labelEstado = `Crítico (≤ ${lot.dias_restantes}d)`
                        } else if (lot.estado_vencimiento === "alerta_30d") {
                          badgeStyle = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                          labelEstado = `Alerta (${lot.dias_restantes}d)`
                        }

                        const dateStr = lot.fecha_vencimiento
                          ? new Date(lot.fecha_vencimiento).toLocaleDateString("es-PY", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "Sin fecha"

                        return (
                          <div
                            key={lot.id}
                            className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">{lot.referencia}</span>
                                <span className="text-[10px] text-slate-400">· {lot.warehouse_nombre}</span>
                              </div>
                              <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                                Vence: <strong className="text-white">{dateStr}</strong>
                                {lot.cantidad_disponible > 0 && (
                                  <span className="text-slate-400"> · Cant: {lot.cantidad_disponible} un.</span>
                                )}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${badgeStyle} shrink-0`}>
                              {labelEstado}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* FORMULARIO ADITIVO DE NUEVO VENCIMIENTO */}
                <div className="pt-3 border-t border-slate-800/80 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Registrar Nuevo Vencimiento (Aditivo):</span>
                    </p>
                  </div>

                  {/* Campo Fecha de Vencimiento */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 px-1">
                      Fecha de Caducidad / Vencimiento: *
                    </label>
                    <input
                      type="date"
                      value={vencFecha}
                      onChange={(e) => setVencFecha(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-amber-400 transition"
                    />

                    {/* Atajos rápidos de fecha */}
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto pb-1 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setQuickVencDays(30)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0 active:scale-95"
                      >
                        +30 días
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickVencDays(60)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0 active:scale-95"
                      >
                        +60 días
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickVencDays(90)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0 active:scale-95"
                      >
                        +90 días
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickVencMonths(6)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0 active:scale-95"
                      >
                        +6 meses
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickVencMonths(12)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0 active:scale-95"
                      >
                        +1 año
                      </button>
                    </div>
                  </div>

                  {/* Campo Lote / Referencia */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 px-1">
                      Código de Lote impreso (Opcional):
                    </label>
                    <input
                      type="text"
                      value={vencLote}
                      onChange={(e) => setVencLote(e.target.value)}
                      placeholder="ej: LOTE-2405 o dejar en blanco"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400 transition"
                    />
                  </div>

                  {/* Campo Cantidad en Góndola */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300 px-1">
                      Cantidad con este vencimiento en salón:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVencCantidad((prev) => String(Math.max(1, (parseInt(prev || "1", 10) || 1) - 1)))}
                        className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95 transition"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={vencCantidad}
                        onChange={(e) => setVencCantidad(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl py-2.5 text-center text-base font-black text-white outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setVencCantidad((prev) => String((parseInt(prev || "1", 10) || 0) + 1))}
                        className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95 transition"
                      >
                        +
                      </button>
                    </div>

                    {/* Presets de cantidad */}
                    <div className="flex items-center gap-1.5 pt-1 text-[10px] font-bold">
                      {["1", "6", "12", "24", "48"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setVencCantidad(preset)}
                          className={`flex-1 py-1 rounded-lg border transition ${
                            vencCantidad === preset
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          {preset} un.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Botón Guardar Vencimiento */}
                  <button
                    type="button"
                    onClick={handleSaveVencimiento}
                    disabled={vencSaving || !vencFecha}
                    className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-40 cursor-pointer"
                  >
                    {vencSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                        <span>Guardando en el sistema...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 text-slate-950" />
                        <span>Guardar Vencimiento en Góndola</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-3">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Barcode className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Ningún producto seleccionado</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Escaneá el código de barras con la cámara o buscá el producto por nombre en el buscador superior para registrar sus vencimientos.
                  </p>
                </div>
              </div>
            )}

            {/* HISTORIAL DE LA SESIÓN DE TRABAJO */}
            {vencSessionHistory.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-400 px-1">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Registrados en tu turno ({vencSessionHistory.length}):</span>
                  </span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {vencSessionHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{item.product_nombre}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Lote: {item.referencia} · Vence: <strong className="text-cyan-300">{item.fecha_vencimiento}</strong> · {item.cantidad} un.
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{item.hora}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // ── MODO 3: VISTA DE CONFIGURACIÓN DE CONTEO FÍSICO ──
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        {/* Barra superior con botón volver al menú */}
        <div className="p-4 pt-5 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setAppMainMode("menu")}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer active:scale-95 transition"
              title="Volver al menú principal"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-black truncate">Conteo Físico de Stock</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="font-bold text-slate-300 truncate">{user.nombre || user.email}</span>
                <span className="text-slate-400">({user.rol || "operador"})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={forceAppRefresh}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition cursor-pointer"
              title="Recargar App y limpiar caché"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition cursor-pointer"
              title="Cerrar sesión de conteo"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <a
              href="/download/extra-conteo.apk"
              download="extra-conteo.apk"
              title="Descargar APK Nativo Android Extra Conteo"
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 text-xs font-black shadow-xs shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">APK</span>
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loadingSessions ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
          ) : openSessions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Sesiones en curso</p>
                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/30">
                  {openSessions.length} activa(s)
                </span>
              </div>
              <div className="space-y-2">
                {openSessions.map((s: any) => {
                  const isMySession = s.contador_principal === user?.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => resumeSession(s)}
                      className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition border ${
                        isMySession
                          ? "bg-slate-900 border-cyan-500/60 shadow-md shadow-cyan-950/30 hover:border-cyan-400"
                          : "bg-slate-950/80 border-slate-800/80 hover:border-slate-700 opacity-80"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isMySession ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
                          <div className={`font-bold text-sm truncate ${isMySession ? "text-cyan-300" : "text-slate-300"}`}>
                            {s.area}
                          </div>
                          {isMySession && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              Tu Sesión
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {s.codigo} · <strong className="text-white">{s.total_items_contados}</strong> contados
                          {s.contador_nombre && !isMySession && ` · Contador: ${s.contador_nombre}`}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Bloque Nueva Sesión con Selector de Sector o Proveedor */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                ✨ Iniciar Mi Sesión de Conteo Independiente
              </p>
              <span className="text-[11px] font-bold text-slate-400 truncate max-w-[200px]">
                Seleccionado: <span className="text-white">{selectedAreaLabel}</span>
              </span>
            </div>

            {/* Selector de Modalidad: Sector vs Proveedor */}
            <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setConteoScope("sector")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  conteoScope === "sector"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Por Sector de Salón</span>
              </button>
              <button
                type="button"
                onClick={() => setConteoScope("proveedor")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  conteoScope === "proveedor"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Por Proveedor</span>
              </button>
            </div>

            {conteoScope === "sector" ? (
              <div className="grid grid-cols-2 gap-2.5">
                {AREAS.map((a) => {
                  const isSelected = selectedArea === a.key
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setSelectedArea(a.key)}
                      className={`px-3.5 py-3 rounded-2xl text-sm font-bold border transition text-left flex items-center justify-between cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500/20"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span>{a.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Proveedor a contar en el salón:</span>
                  </label>
                  {selectedSupplierObj && (
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierId("")}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      Cambiar
                    </button>
                  )}
                </div>

                {selectedSupplierObj ? (
                  /* Tarjeta del Proveedor Seleccionado */
                  <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-white truncate">
                          {selectedSupplierObj.razon_social || selectedSupplierObj.nombre}
                        </h4>
                        {selectedSupplierObj.nombre_fantasia && selectedSupplierObj.nombre_fantasia !== selectedSupplierObj.razon_social && (
                          <p className="text-[11px] text-cyan-300 truncate">
                            Fantasía: {selectedSupplierObj.nombre_fantasia}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {selectedSupplierObj.ruc && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 font-bold">
                              RUC: {selectedSupplierObj.ruc}
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            (selectedSupplierObj.total_productos || 0) > 0
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {selectedSupplierObj.total_productos || 0} artículos en catálogo
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSupplierId("")}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white rounded-lg transition shrink-0"
                        title="Deseleccionar proveedor"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {(selectedSupplierObj.total_productos || 0) === 0 && (
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-[11px] text-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Este proveedor no posee artículos activos asignados en catálogo. La lista precargada iniciará vacía.</span>
                      </div>
                    )}

                    {/* Botón de Impresión de Planilla Ciega Manual */}
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleOpenBlindPrint(selectedSupplierObj)}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer shadow-xs"
                        title="Imprimir planilla en blanco con casillas para conteo ciego manual"
                      >
                        <Printer className="w-4 h-4 text-cyan-400" />
                        <span>📄 Imprimir Listado Ciego para Conteo Manual (PDF / Papel)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Selector Interactivo y Buscador de Proveedores */
                  <div className="space-y-2">
                    {/* Filtro: Mercadería de Venta vs Todos */}
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSupplierFilterType("mercaderia")}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                          supplierFilterType === "mercaderia"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>📦 Mercaderías ({mercaderiasSuppliersCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupplierFilterType("todos")}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                          supplierFilterType === "todos"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>📋 Todos ({suppliers.length})</span>
                      </button>
                    </div>

                    {/* Buscador táctil */}
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={supplierSearchQuery}
                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, fantasía o RUC..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
                      />
                      {supplierSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSupplierSearchQuery("")}
                          className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Lista Scrolleable Táctil */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                          <p>No se encontraron proveedores coincidentes.</p>
                          {supplierFilterType === "mercaderia" && (
                            <button
                              type="button"
                              onClick={() => setSupplierFilterType("todos")}
                              className="text-xs font-bold text-cyan-400 hover:underline"
                            >
                              Ver en todos los proveedores ({suppliers.length})
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredSuppliers.slice(0, 40).map((s) => {
                          const isSelected = selectedSupplierId === s.id
                          const prods = s.total_productos || 0
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSupplierId(s.id)
                                setSupplierSearchQuery("")
                              }}
                              className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2 active:scale-[0.98] ${
                                isSelected
                                  ? "bg-cyan-500/20 border border-cyan-500/40 text-white"
                                  : "hover:bg-slate-900 text-slate-200"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-xs truncate">
                                  {s.razon_social || s.nombre}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {s.ruc && (
                                    <span className="font-mono text-[10px] text-slate-400">
                                      RUC: {s.ruc}
                                    </span>
                                  )}
                                  {s.nombre_fantasia && s.nombre_fantasia !== s.razon_social && (
                                    <span className="text-[10px] text-slate-500 truncate">
                                      • {s.nombre_fantasia}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  prods > 0
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                    : "bg-slate-800 text-slate-500"
                                }`}>
                                  {prods} {prods === 1 ? "artículo" : "artículos"}
                                </span>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                Paso 2: Ubicación Puntual (Opcional):
              </label>
              <input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="ej: Pasillo 3, Góndola Central, Heladera 2"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-500 text-white placeholder-slate-600 transition"
              />
            </div>

            <button
              onClick={startSession}
              disabled={startingSession}
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-black text-sm rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              {startingSession ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>Iniciando conteo...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-slate-950" />
                  <span>Iniciar Conteo en: {selectedAreaLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }


  // 4. VISTA DE CONTEO EN VIVO (CÁMARA, BÚSQUEDA Y LISTADO)
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ── CABECERA DE SESIÓN ACTIVA ── */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                stopCamera()
                setSession(null)
                setAppMainMode("menu")
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Pausar conteo y volver al menú principal"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="font-black text-sm text-cyan-300 truncate">{session.area}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                {session.codigo} · <strong className="text-white">{items.length}</strong> contados
              </div>
            </div>
          </div>
          <button
            onClick={finishSession}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 rounded-xl px-3 py-2 flex items-center gap-1.5 cursor-pointer transition shadow-sm active:scale-95 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" /> Finalizar
          </button>
        </div>

        {/* ── SELECTOR DE MODALIDAD / PESTAÑAS ── */}
        {!scannedProduct && (
          <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => setCountViewMode("camera")}
              className={`py-1.5 px-1 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                countViewMode === "camera"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cámara</span>
            </button>

            <button
              onClick={() => setCountViewMode("search")}
              className={`py-1.5 px-1 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                countViewMode === "search"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
            </button>

            <button
              onClick={() => setCountViewMode("list")}
              className={`py-1.5 px-1 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                countViewMode === "list"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Artículos</span>
            </button>

            <button
              onClick={() => setCountViewMode("counted")}
              className={`py-1.5 px-1 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                countViewMode === "counted"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Contados ({items.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* ── CUERPO PRINCIPAL: FORMULARIO DE CONTEO O VISTA ACTIVA ── */}
      {scannedProduct ? (
        /* ══════════════════════════════════════════════════════════════════════
           PANTALLA DE INGRESO DE CONTEO & VENCIMIENTO DE PRODUCTO
           ══════════════════════════════════════════════════════════════════════ */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={cancelScanned}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              SKU: {scannedProduct.sku}
            </span>
          </div>

          {/* Tarjeta de información completa del producto */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-700/60">
                {scannedProduct.imagen_url ? (
                  <img src={scannedProduct.imagen_url} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-sm text-white leading-tight">
                  {scannedProduct.nombre}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300">
                    {scannedProduct.codigo_barra || "Sin código de barras"}
                  </span>
                </div>
              </div>
            </div>

            {/* Precios e Información Fiscal/Comercial */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Precio Minorista
                </span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {formatPYG(scannedProduct.precio_venta || 0)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Precio Mayorista
                </span>
                <span className="text-sm font-black font-mono text-amber-400">
                  {scannedProduct.precio_mayorista
                    ? formatPYG(scannedProduct.precio_mayorista)
                    : "No configurado"}
                </span>
              </div>
            </div>

            {/* Modo Conteo Ciego Oficial */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-base">👁️</span>
                <span>Conteo Ciego Oficial</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-black">
                Sin sesgo de stock
              </span>
            </div>

            {/* Manejo Aditivo si ya fue contado en esta sesión */}
            {alreadyCountedQty !== null && (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-cyan-500/40 text-cyan-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Conteo previo registrado:</span>
                  </span>
                  <span className="text-sm font-black text-cyan-400 font-mono bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                    {alreadyCountedQty} un.
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  ¿Encontraste más unidades en otro lugar o góndola? Ingresá las nuevas unidades abajo para sumarlas automáticamente.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConteoModoAditivo(true)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border transition flex items-center justify-center gap-1 ${
                      conteoModoAditivo
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-xs"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    <span>➕ Sumar</span>
                    <span className="font-mono text-[10px]">
                      ({alreadyCountedQty} + {parseFloat(cantidadContada) || 0} = {alreadyCountedQty + (parseFloat(cantidadContada) || 0)})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConteoModoAditivo(false)}
                    className={`py-1.5 px-3 rounded-xl text-[11px] font-bold border transition ${
                      !conteoModoAditivo
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    <span>✏️ Reemplazar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Input de Cantidad Contada */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              {alreadyCountedQty !== null && conteoModoAditivo
                ? `Nuevas unidades encontradas aquí (se sumarán a las ${alreadyCountedQty} previas):`
                : "Cantidad física contada:"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={cantidadContada}
              onChange={(e) => setCantidadContada(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-2xl font-black text-center text-cyan-400 outline-none focus:border-cyan-400 shadow-inner"
            />

            {/* Atajos numéricos rápidos para agilizar conteo táctil */}
            <div className="flex gap-1.5 justify-center pt-1">
              {[1, 5, 10, 24, 50].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => {
                    const curr = parseFloat(cantidadContada) || 0
                    setCantidadContada(String(curr + inc))
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCantidadContada("")}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-rose-400 hover:bg-slate-800 active:scale-95 transition cursor-pointer"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Interruptor de Vencimiento y Lote */}
          <button
            onClick={() => setTieneVencimiento((v) => !v)}
            className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 border text-xs font-bold transition cursor-pointer ${
              tieneVencimiento
                ? "bg-amber-600/20 border-amber-500 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{tieneVencimiento ? "Registrando Lote y Fecha de Vencimiento" : "¿Lleva fecha de vencimiento o lote?"}</span>
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-slate-800">
              {tieneVencimiento ? "Activo" : "Opcional"}
            </span>
          </button>

          {tieneVencimiento && (
            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 animate-in fade-in duration-150">
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Lote
                </label>
                <input
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Ej. L-4091"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-400 text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">
                  Fecha Vencimiento
                </label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-400 text-white"
                />
              </div>
            </div>
          )}

          {/* Foto de Evidencia Opcional */}
          <div>
            <label className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 border-dashed rounded-2xl px-4 py-3 text-xs font-bold text-slate-300 cursor-pointer hover:border-slate-700 transition">
              <ImagePlus className="w-4 h-4 text-cyan-400" />
              {fotoPreview ? "Foto adjuntada — tocá para cambiar" : "Sacar foto de evidencia (opcional)"}
              <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
            </label>
            {fotoPreview && (
              <img src={fotoPreview} className="mt-2 w-full max-h-36 object-contain rounded-xl border border-slate-800" />
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-2 pt-2 pb-4">
            <button
              onClick={cancelScanned}
              className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-2xl py-3.5 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={saveCount}
              disabled={saving}
              className="flex-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 disabled:opacity-50 rounded-2xl py-3.5 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition shadow-lg shadow-cyan-500/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Guardando...</span>
                </>
              ) : alreadyCountedQty !== null && conteoModoAditivo ? (
                <>
                  <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>Sumar ({alreadyCountedQty + (parseFloat(cantidadContada) || 0)} un.)</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>Guardar Conteo</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : countViewMode === "camera" ? (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 1: CÁMARA & ESCÁNER (CON ANTI-LOOP Y BÚSQUEDA RÁPIDA)
           ══════════════════════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Contenedor del Video */}
          <div className="relative bg-black aspect-video max-h-[40vh] overflow-hidden shrink-0">
            <video
              ref={setVideoRef}
              className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
              muted
              playsInline
              autoPlay
            />
            {!cameraActive && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 p-4">
                <Camera className="w-8 h-8 text-slate-600" />
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-black px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition shadow-md shadow-cyan-500/20"
                >
                  Activar cámara de escaneo
                </button>
                {cameraError && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs max-w-[90%] text-center">
                    {cameraError}
                  </div>
                )}
              </div>
            )}
            {cameraActive && (
              <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                <button
                  onClick={switchCamera}
                  className="px-2.5 py-1 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  title={activeCameraLabel || "Cambiar Cámara"}
                >
                  <RefreshCcw className="w-3 h-3" />
                  <span>{activeCameraLabel?.includes("Frontal") ? "Frontal" : "Trasera"}</span>
                </button>
                <button
                  onClick={stopCamera}
                  className="bg-black/60 rounded-full p-1.5 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md cursor-pointer"
                  title="Apagar Cámara"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {searching && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-cyan-300 font-bold text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span>Identificando producto...</span>
              </div>
            )}
          </div>

          {/* Búsqueda rápida y lista inmediata */}
          <div className="p-3 space-y-3 flex-1">
            {/* Buscador Rápido en Vivo */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Buscar por nombre, código de barra o SKU..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Resultados de búsqueda rápida */}
            {searchingQuick && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Buscando en catálogo...</span>
              </div>
            )}

            {quickSearchResults.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Resultados encontrados ({quickSearchResults.length})
                </p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {quickSearchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => selectProductForCount(prod)}
                      className="w-full text-left bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 transition cursor-pointer active:scale-98"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">{prod.nombre}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{prod.codigo_barra || prod.sku}</span>
                          <span className="text-emerald-400 font-bold">{formatPYG(prod.precio_venta || 0)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {(prod.stock ?? 0) <= 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Sin stock
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {prod.stock} un.
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Historial de contados en esta sesión */}
            {items.length > 0 && quickSearchResults.length === 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Contados recientemente en esta sesión
                </p>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {items.slice().reverse().map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold truncate text-slate-200">{it.producto_nombre}</div>
                        <div className="text-[11px] text-slate-400">
                          Sist: <strong className="text-slate-300">{it.cantidad_sistema}</strong> · Contado:{" "}
                          <strong className="text-cyan-300">{it.cantidad_contada}</strong>
                          {it.fecha_vencimiento ? ` · Vto: ${it.fecha_vencimiento}` : ""}
                        </div>
                      </div>
                      {!!it.diferencia && Math.abs(it.diferencia) > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          Dif: {it.diferencia > 0 ? `+${it.diferencia}` : it.diferencia}
                        </span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : countViewMode === "search" ? (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 2: BÚSQUEDA EXHAUSTIVA EN CATÁLOGO CON PRECIOS Y STOCK
           ══════════════════════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3">
          {/* Campo de búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              autoFocus
              placeholder="Escribí nombre del producto, código de barra o SKU..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-9 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 shadow-sm"
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchingCatalog && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Buscando productos en el catálogo...</span>
            </div>
          )}

          {!searchingCatalog && catalogSearch.trim().length >= 2 && catalogSearchResults.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-xs">
              No se encontraron productos coincidentes con '{catalogSearch}'.
            </div>
          )}

          {/* Listado de Tarjetas de Productos Encontrados */}
          <div className="space-y-2">
            {catalogSearchResults.map((prod) => {
              const already = items.find((it) => it.producto_id === prod.id)
              const hasNoStock = (prod.stock ?? 0) <= 0

              return (
                <div
                  key={prod.id}
                  onClick={() => selectProductForCount(prod)}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 rounded-2xl p-3 flex gap-3 items-center justify-between cursor-pointer transition active:scale-98 shadow-xs"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-700/60">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="font-bold text-xs text-white truncate">{prod.nombre}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">{prod.codigo_barra || prod.sku}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatPYG(prod.precio_venta || 0)}
                      </span>
                      {prod.precio_mayorista ? (
                        <span className="font-mono text-amber-400 text-[10px]">
                          May: {formatPYG(prod.precio_mayorista)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      {hasNoStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          ⚠️ Sin stock (0)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Stock: {prod.stock} un.
                        </span>
                      )}

                      {already && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          ✓ Contado: {already.cantidad_contada} un.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-cyan-400 pl-1">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : countViewMode === "list" ? (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 3: LISTADO DE PRODUCTOS DEL ALCANCE (PROVEEDOR O SECTOR)
           ══════════════════════════════════════════════════════════════════════ */
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-3">
          {/* Filtros de la lista */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scopeSearchTerm}
                onChange={(e) => setScopeSearchTerm(e.target.value)}
                placeholder="Filtrar productos de este alcance..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
              {scopeSearchTerm && (
                <button
                  type="button"
                  onClick={() => setScopeSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setScopeFilter("todos")}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition ${
                  scopeFilter === "todos"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos ({scopeProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("pendientes")}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition ${
                  scopeFilter === "pendientes"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Pendientes ({pendientesCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("contados")}
                className={`flex-1 py-1 px-2 rounded-lg font-bold transition ${
                  scopeFilter === "contados"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Contados ({items.length})
              </button>
            </div>
          </div>

          {loadingScopeProducts && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Cargando planilla de productos del alcance...</span>
            </div>
          )}

          {/* Listado Clickeable */}
          <div className="space-y-1.5">
            {filteredScopeProducts.map((prod: Product) => {
              const already = items.find((it) => it.producto_id === prod.id)
              const hasNoStock = (prod.stock ?? 0) <= 0

              return (
                <div
                  key={prod.id}
                  onClick={() => selectProductForCount(prod)}
                  className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 cursor-pointer transition active:scale-98"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white truncate">{prod.nombre}</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono">{prod.codigo_barra || prod.sku}</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {formatPYG(prod.precio_venta || 0)}
                      </span>
                      {hasNoStock ? (
                        <span className="text-rose-400 font-bold text-[10px]">
                          Sin stock
                        </span>
                      ) : (
                        <span className="text-blue-400 text-[10px]">
                          Stock: {prod.stock}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {already ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {already.cantidad_contada} un.
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                        Contar
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 4: LISTA COMPLETA DE ARTÍCULOS YA CONTADOS EN ESTA SESIÓN
           ══════════════════════════════════════════════════════════════════════ */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Artículos contados en esta sesión ({items.length})</span>
            <span className="text-cyan-300 font-mono">Tocá cualquiera para editar</span>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Aún no se ha contado ningún producto en esta sesión.
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.slice().reverse().map((it) => (
                <div
                  key={it.id}
                  onClick={async () => {
                    try {
                      const prod = await api.products.get(it.producto_id)
                      if (prod) selectProductForCount(prod)
                    } catch {}
                  }}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition active:scale-98"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white truncate">{it.producto_nombre}</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Sistema: <strong className="text-slate-300">{it.cantidad_sistema}</strong></span>
                      <span>Contado: <strong className="text-cyan-300">{it.cantidad_contada}</strong></span>
                      {it.fecha_vencimiento && (
                        <span className="text-amber-400">Vto: {it.fecha_vencimiento}</span>
                      )}
                      {it.lote && <span className="text-slate-400">Lote: {it.lote}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {!!it.diferencia && Math.abs(it.diferencia) > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {it.diferencia > 0 ? `+${it.diferencia}` : it.diferencia}
                      </span>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL CANÓNICO / PLANILLA DE CONTEO FÍSICO CIEGO POR PROVEEDOR (PRINTABLE A4)
      ────────────────────────────────────────────────────────────────────────── */}
      {showBlindPrintModal && blindPrintSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header no imprimible */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 print:hidden shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Planilla de Conteo Físico Ciego
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                      100% Ciego
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proveedor: <strong>{blindPrintSupplier.razon_social || blindPrintSupplier.nombre}</strong> ({blindPrintProducts.length} artículos)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-black uppercase rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-md shadow-cyan-600/20 active:scale-95 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBlindPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hoja Imprimible */}
            <div className="p-6 overflow-y-auto space-y-4 print:p-0 print:overflow-visible text-slate-900 dark:text-slate-100 bg-white">
              {/* Membrete Oficial Extra Supermercado */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start text-slate-900">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-slate-950">
                    EXTRA SUPERMERCADO MAYORISTA
                  </h2>
                  <p className="text-xs font-semibold text-slate-700">
                    GRUPO SANTA TERESA E.A.S. · RUC: 80150377-9
                  </p>
                  <p className="text-xs font-black text-cyan-800 mt-1 uppercase tracking-wide">
                    Planilla de Conteo Ciego · Auditoría Cíclica de Inventario
                  </p>
                </div>
                <div className="text-right text-xs text-slate-700 space-y-0.5">
                  <p className="font-mono font-bold text-sm text-slate-900">
                    FECHA: {new Date().toLocaleDateString("es-PY", { timeZone: "America/Asuncion" })}
                  </p>
                  <p>HORA: {new Date().toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-[10px] text-slate-500 italic">Procedimiento: Conteo Ciego Sin Sesgo Teórico</p>
                </div>
              </div>

              {/* Ficha Proveedor y Responsables */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-300 text-slate-800">
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 uppercase font-black block">Proveedor:</span>
                  <strong className="text-sm text-slate-900">{blindPrintSupplier.razon_social || blindPrintSupplier.nombre}</strong>
                  {blindPrintSupplier.ruc && <span className="text-slate-600 font-mono ml-2">({blindPrintSupplier.ruc})</span>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-black block">Contador 1 (Firma):</span>
                  <span className="text-slate-400 font-mono text-[11px]">_____________________</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-black block">Contador 2 (Firma):</span>
                  <span className="text-slate-400 font-mono text-[11px]">_____________________</span>
                </div>
              </div>

              {loadingBlindPrint ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                  <span className="text-xs">Cargando catálogo de artículos del proveedor...</span>
                </div>
              ) : blindPrintProducts.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl">
                  No se encontraron productos activos asociados directamente a este proveedor en el catálogo.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse border border-slate-300 text-slate-900">
                  <thead className="bg-slate-100 text-slate-900 font-black uppercase text-[10px] tracking-wider border-b-2 border-slate-400">
                    <tr>
                      <th className="p-2 border border-slate-300 w-8 text-center">#</th>
                      <th className="p-2 border border-slate-300 w-32 font-mono">Cód. Barras</th>
                      <th className="p-2 border border-slate-300">Descripción del Artículo</th>
                      <th className="p-2 border border-slate-300 w-16 text-center">U.M.</th>
                      <th className="p-2 border-2 border-slate-900 w-24 text-center bg-cyan-50/50">
                        Conteo 1
                      </th>
                      <th className="p-2 border-2 border-slate-900 w-24 text-center bg-cyan-50/50">
                        Conteo 2
                      </th>
                      <th className="p-2 border border-slate-300 w-36 text-center">
                        Lote / Vto. / Obs.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {blindPrintProducts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50 text-[11px]">
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">
                          {p.codigo_barra || p.sku || "-"}
                        </td>
                        <td className="p-2 border border-slate-300 font-medium text-slate-950">
                          {p.nombre}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">
                          {p.unidad_medida || "UN"}
                        </td>
                        <td className="p-2 border-2 border-slate-900 text-center font-mono h-9 bg-white"></td>
                        <td className="p-2 border-2 border-slate-900 text-center font-mono h-9 bg-white"></td>
                        <td className="p-2 border border-slate-300 text-slate-400"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-600">
                <span>Total artículos en listado: <strong>{blindPrintProducts.length}</strong></span>
                <span>Nota: El contador no debe consultar ni acceder al stock teórico del sistema antes de contar.</span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
