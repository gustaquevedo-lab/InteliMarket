import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Camera, CameraOff, Loader2, Package, Check, X, Plus,
  Calendar, Hash, ImagePlus, ChevronRight, ClipboardList,
  AlertTriangle, CheckCircle2, Search, Download, RefreshCcw, RefreshCw, Zap,
  LogIn, LogOut, User as UserIcon, Lock, Eye, EyeOff, ShieldCheck,
  Building2, Tag, Layers, Barcode, DollarSign, AlertCircle, Filter, ArrowLeft
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

  // ── Cámara / escáner manual ──
  const [manualCode, setManualCode] = useState("")
  const [searching, setSearching] = useState(false)

  // ── Producto identificado, a la espera de guardar el conteo ──
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [cantidadSistema, setCantidadSistema] = useState<number>(0)
  const [cantidadContada, setCantidadContada] = useState("")
  const [tieneVencimiento, setTieneVencimiento] = useState(false)
  const [lote, setLote] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        ubicacion: ubicacion.trim() || undefined,
        tipo: "salon",
      }
      if (isUuid(activeUserId)) {
        payload.contador_principal = activeUserId
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

      // Si ya fue contado en esta sesión, precargar datos previos
      const already = items.find((it) => it.producto_id === prod.id)
      if (already && already.cantidad_contada !== null && already.cantidad_contada !== undefined) {
        setCantidadContada(String(already.cantidad_contada))
        if (already.lote) {
          setLote(already.lote)
          setTieneVencimiento(true)
        }
        if (already.fecha_vencimiento) {
          setFechaVencimiento(already.fecha_vencimiento)
          setTieneVencimiento(true)
        }
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
        const found =
          (res || []).find((p) => p.codigo_barra === code || p.sku === code) ||
          (res || [])[0]
        if (!found) {
          toast.warning("Producto no encontrado", `Código '${code}' no está en el catálogo.`)
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
    onScan: lookupProduct,
    storageKey: "extra_conteo_camera_id",
    paused: !!scannedProduct || searching,
  })

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
        const res = await api.products.list({ search: q, limit: 8 })
        setQuickSearchResults(Array.isArray(res) ? res : [])
      } catch (err) {
        console.warn("Error en búsqueda rápida:", err)
      } finally {
        setSearchingQuick(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [quickSearch])

  // ── Cargar productos del alcance de la sesión (Pestaña "Lista Catálogo") ──
  useEffect(() => {
    if (!session) {
      setScopeProducts([])
      return
    }
    let cancelled = false
    setLoadingScopeProducts(true)

    const fetchScope = async () => {
      try {
        const params: any = { limit: 250, activo: true }
        if (session.area.startsWith("Proveedor:")) {
          const supName = session.area.replace("Proveedor:", "").trim().toLowerCase()
          const matchedSup = suppliers.find(
            (s) =>
              (s.razon_social && s.razon_social.toLowerCase().includes(supName)) ||
              (s.nombre && s.nombre.toLowerCase().includes(supName)) ||
              s.id === selectedSupplierId
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
  }, [session, suppliers, selectedSupplierId])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoFile(f)
    setFotoPreview(URL.createObjectURL(f))
  }

  const cancelScanned = () => {
    setScannedProduct(null)
    setCantidadContada("")
    setLote("")
    setFechaVencimiento("")
    setTieneVencimiento(false)
    setFotoFile(null)
    setFotoPreview(null)
  }

  const saveCount = async () => {
    if (!session || !scannedProduct) return
    const cantidad = parseFloat(cantidadContada.replace(",", "."))
    if (isNaN(cantidad) || cantidad < 0) {
      toast.warning("Cantidad inválida", "Ingresá la cantidad contada.")
      return
    }
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
        cantidad_contada: cantidad,
        lote: tieneVencimiento && lote.trim() ? lote.trim() : undefined,
        fecha_vencimiento: tieneVencimiento ? fechaVencimiento : undefined,
        foto_evidencia_url: fotoUrl,
      })
      toast.success("Registrado", `${scannedProduct.nombre}: ${cantidad} contadas.`)
      cancelScanned()
      refreshItems(session.id)
    } catch (e: any) {
      toast.error("No se pudo guardar", e?.message || "Reintentá en un momento.")
    } finally {
      setSaving(false)
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

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        {/* Barra superior con identidad de usuario y descarga de APK */}
        <div className="p-4 pt-5 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black truncate">Extra Conteo & Vencimientos</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
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
            <div>
              <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Sesiones abiertas — retomar</p>
              <div className="space-y-2">
                {openSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => resumeSession(s)}
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition hover:border-cyan-500/50"
                  >
                    <div>
                      <div className="font-bold text-sm text-cyan-300">{s.area}</div>
                      <div className="text-xs text-slate-400">{s.codigo} · {s.total_items_contados} contados</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Bloque Nueva Sesión con Selector de Sector o Proveedor */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">Paso 1: Alcance del Conteo</p>
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

  // 4. VISTA DE CONTEO EN VIVO (CÁMARA, BÚSQUEDA Y LISTADO)
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ── CABECERA DE SESIÓN ACTIVA ── */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-black text-sm text-cyan-300 truncate">{session.area}</div>
            <div className="text-[11px] text-slate-400 font-mono">
              {session.codigo} · <strong className="text-white">{items.length}</strong> contados
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

            {/* Estado de Stock en Sistema */}
            <div>
              {cantidadSistema <= 0 ? (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-600/50 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Sin stock registrado en sistema (0 unidades)</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-600/50 text-blue-300 text-xs font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Stock en sistema: {cantidadSistema} unidades</span>
                </div>
              )}
            </div>

            {/* Aviso si ya fue contado */}
            {items.some((it) => it.producto_id === scannedProduct.id) && (
              <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-300 text-xs font-medium">
                ℹ️ Este producto ya tenía un conteo registrado en esta sesión. Modificar la cantidad actualizará su valor.
              </div>
            )}
          </div>

          {/* Input de Cantidad Contada */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Cantidad física contada:
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
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? "Guardando..." : "Guardar Conteo"}</span>
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
    </div>
  )
}
