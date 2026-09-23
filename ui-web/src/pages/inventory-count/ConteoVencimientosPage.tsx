import { useState, useEffect, useRef, useCallback } from "react"
import {
  Camera, CameraOff, Loader2, Package, Check, X, Plus,
  Calendar, Hash, ImagePlus, ChevronRight, ClipboardList,
  AlertTriangle, CheckCircle2, Search, Download, RefreshCcw, RefreshCw, Zap,
  LogIn, LogOut, User as UserIcon, Lock, Eye, EyeOff, ShieldCheck,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { api, type Product } from "../../api"
import { formatPYG } from "../../utils/format"

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
  const [selectedArea, setSelectedArea] = useState(AREAS[0].key)
  const [ubicacion, setUbicacion] = useState("")
  const [startingSession, setStartingSession] = useState(false)

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

  // ── Camara / escaneo ──
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const isProcessing = useRef(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>("Cámara Trasera")
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

      const areaObj = AREAS.find((a) => a.key === selectedArea)
      const areaLabel = areaObj?.label || selectedArea

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
  const lookupProduct = useCallback(async (raw: string) => {
    const code = raw.trim()
    if (!code) return
    setSearching(true)
    try {
      const res = await api.products.list({ search: code, limit: 5 })
      const found = (res || []).find((p) => p.codigo_barra === code || p.sku === code) || (res || [])[0]
      if (!found) {
        toast.warning("Producto no encontrado", `Código '${code}' no está en el catálogo.`)
        return
      }
      setScannedProduct(found)
      setCantidadContada("")
      setLote("")
      setFechaVencimiento("")
      setTieneVencimiento(false)
      setFotoFile(null)
      setFotoPreview(null)
      try {
        const stock = await api.inventory.getProductStock(found.id)
        setCantidadSistema(Number((stock as any)?.cantidad_disponible ?? 0))
      } catch {
        setCantidadSistema(0)
      }
      if (navigator.vibrate) navigator.vibrate(50)
    } catch (e: any) {
      toast.error("Error al buscar", e?.message || "No se pudo consultar el producto.")
    } finally {
      setSearching(false)
    }
  }, [toast])

  // ── Camara con BarcodeDetector nativo (mismo patron que el Hub de Salon) ──
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    scanLoopRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async (targetDeviceId?: string) => {
    setCameraError(null)
    try {
      let stream: MediaStream | null = null

      // 1. Si el usuario seleccionó un dispositivo específico (rotación manual de cámara), usar su deviceId
      if (targetDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
          setSelectedCameraId(targetDeviceId)
        } catch (err) {
          console.warn("Fallo con deviceId exacto, probando fallback a cámara trasera:", err)
        }
      }

      // 2. Si no hay stream aún, solicitar cámara trasera sin pasar deviceId ciego
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch (exactErr) {
          console.warn("facingMode exact environment no soportado, probando ideal...", exactErr)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            })
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          }
        }
      }

      // 3. Con el stream activo (permisos ya concedidos por el usuario), enumerar dispositivos
      let freshVideo: MediaDeviceInfo[] = []
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const freshDevices = await navigator.mediaDevices.enumerateDevices()
          freshVideo = freshDevices.filter((d) => d.kind === "videoinput")
          setAvailableCameras(freshVideo)
        }
      } catch {}

      // 4. Verificar el sensor activo
      let activeTrack = stream.getVideoTracks()[0]
      if (activeTrack) {
        const currentLabel = (activeTrack.label || "").toLowerCase()
        const isFront = /front|delantera|user|selfie/i.test(currentLabel)

        // Si Android abrió la frontal involuntariamente y tenemos más de 1 cámara, buscar la trasera y conmutar
        if (isFront && freshVideo.length > 1 && !targetDeviceId) {
          const currentDevId = activeTrack.getSettings ? activeTrack.getSettings().deviceId : undefined
          const isFrontText = (l: string) => /front|delantera|user|selfie/i.test(l)
          const isBackText = (l: string) => /back|rear|trasera|environment|extern/i.test(l)

          const realBackDevice =
            freshVideo.find((d) => isBackText(d.label)) ||
            freshVideo.find((d) => !isFrontText(d.label) && d.deviceId !== currentDevId) ||
            freshVideo.find((d) => d.deviceId !== currentDevId)

          if (realBackDevice && realBackDevice.deviceId !== currentDevId) {
            try {
              activeTrack.stop()
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: realBackDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
              })
              activeTrack = stream.getVideoTracks()[0]
            } catch (err) {
              console.warn("Fallo al conmutar a cámara trasera confirmada:", err)
            }
          }
        }
      }

      streamRef.current = stream

      if (activeTrack) {
        const settings = activeTrack.getSettings ? activeTrack.getSettings() : {}
        if (settings.deviceId) {
          setSelectedCameraId(settings.deviceId)
        }
        const label = activeTrack.label || ""
        const isBack = /back|rear|trasera|environment|extern/i.test(label) || (!/front|delantera|user|selfie/i.test(label) && freshVideo.length > 1)
        setActiveCameraLabel(
          isBack
            ? "Cámara Trasera"
            : /front|user|delantera|selfie/i.test(label)
            ? "Cámara Frontal"
            : label || "Cámara Activa"
        )
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute("playsinline", "true")
        await videoRef.current.play()
      }
      setCameraActive(true)

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "upc_a", "code_39"],
        })
        let lastCode = ""
        const loop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(loop)
            return
          }
          if (!isProcessing.current) {
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0 && codes[0].rawValue && codes[0].rawValue !== lastCode) {
                lastCode = codes[0].rawValue
                isProcessing.current = true
                await lookupProduct(codes[0].rawValue)
                setTimeout(() => { isProcessing.current = false }, 1800)
              }
            } catch {}
          }
          scanLoopRef.current = requestAnimationFrame(loop)
        }
        scanLoopRef.current = requestAnimationFrame(loop)
      } else {
        toast.info("Escaneo visual no disponible", "Este navegador no tiene lector de código nativo. Usá la búsqueda manual.")
      }
    } catch (err: any) {
      setCameraActive(false)
      const name = err?.name || ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Permiso de cámara denegado. Habilitalo en los ajustes de la app.")
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        setCameraError("La cámara requiere una conexión segura (HTTPS). Contactá a soporte.")
      } else {
        setCameraError(err?.message || "No se pudo iniciar la cámara. Probá con búsqueda manual.")
      }
    }
  }, [lookupProduct, toast])

  const switchCamera = () => {
    if (availableCameras.length <= 1) {
      stopCamera()
      setTimeout(() => startCamera(), 200)
      return
    }
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId)
    const nextIndex = (currentIndex + 1) % availableCameras.length
    const nextDevice = availableCameras[nextIndex]
    setSelectedCameraId(nextDevice.deviceId)
    stopCamera()
    const desc = nextDevice.label || `Cámara ${nextIndex + 1} de ${availableCameras.length}`
    toast.info("Cambiando Cámara", desc)
    setTimeout(() => startCamera(nextDevice.deviceId), 200)
  }

  useEffect(() => () => stopCamera(), [stopCamera])

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

          {/* Bloque Nueva Sesión con Selector de Sector */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">Paso 1: Seleccioná el Sector</p>
              <span className="text-[11px] font-bold text-slate-400">
                Seleccionado: <span className="text-white">{selectedAreaLabel}</span>
              </span>
            </div>

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

  // 4. VISTA DE CONTEO EN VIVO CON CÁMARA
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div>
          <div className="font-bold text-sm text-cyan-300">{session.area}</div>
          <div className="text-[11px] text-slate-400">{session.codigo} · {items.length} contados</div>
        </div>
        <button
          onClick={finishSession}
          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 rounded-xl px-3 py-2 flex items-center gap-1 cursor-pointer transition shadow-sm active:scale-95"
        >
          <CheckCircle2 className="w-4 h-4" /> Finalizar
        </button>
      </div>

      {!scannedProduct ? (
        <div className="flex-1 flex flex-col">
          <div className="relative bg-black aspect-square max-h-[50vh]">
            {cameraActive ? (
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                <Camera className="w-10 h-10 text-slate-600" />
                <button
                  onClick={() => startCamera()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-sm font-black px-4 py-2.5 rounded-xl cursor-pointer active:scale-95 transition shadow-md shadow-cyan-500/20"
                >
                  Activar cámara
                </button>
                {cameraError && <p className="text-xs text-amber-400 max-w-[80%] text-center">{cameraError}</p>}
              </div>
            )}
            {cameraActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
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
                  className="bg-black/60 rounded-full p-2 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md cursor-pointer"
                  title="Apagar Cámara"
                >
                  <CameraOff className="w-4 h-4" />
                </button>
              </div>
            )}
            {searching && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            )}
          </div>

          <div className="p-4 space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); lookupProduct(manualCode); setManualCode("") }} className="relative">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Código de barra o SKU manual"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-blue-500"
              />
              <button type="submit" className="absolute right-2 top-2 bottom-2 px-2 text-slate-400">
                <Search className="w-5 h-5" />
              </button>
            </form>

            {items.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Contados en esta sesión</p>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {items.slice().reverse().map((it) => (
                    <div key={it.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{it.producto_nombre}</div>
                        <div className="text-slate-500">
                          Sistema {it.cantidad_sistema} · Contado {it.cantidad_contada}
                          {it.fecha_vencimiento ? ` · Vence ${it.fecha_vencimiento}` : ""}
                        </div>
                      </div>
                      {!!it.diferencia && Math.abs(it.diferencia) > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {scannedProduct.imagen_url ? (
                <img src={scannedProduct.imagen_url} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-7 h-7 text-slate-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{scannedProduct.nombre}</div>
              <div className="text-xs text-slate-400">{scannedProduct.sku} · {formatPYG(scannedProduct.precio_venta || 0)}</div>
              <div className="text-xs text-blue-400 mt-1">Sistema: {cantidadSistema} unidades</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">Cantidad contada</label>
            <input
              type="number"
              inputMode="decimal"
              value={cantidadContada}
              onChange={(e) => setCantidadContada(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setTieneVencimiento((v) => !v)}
            className={`w-full flex items-center gap-2 rounded-xl px-4 py-3 border text-sm font-bold transition ${
              tieneVencimiento ? "bg-amber-600/20 border-amber-600 text-amber-300" : "bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            {tieneVencimiento ? "Lleva vencimiento — registrando lote y fecha" : "¿Tiene fecha de vencimiento?"}
          </button>

          {tieneVencimiento && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block flex items-center gap-1"><Hash className="w-3 h-3" /> Lote</label>
                <input
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">Vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="w-full flex items-center gap-2 bg-slate-900 border border-slate-800 border-dashed rounded-xl px-4 py-3 text-sm text-slate-300 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              {fotoPreview ? "Foto lista — tocá para cambiarla" : "Sacar foto de respaldo (opcional)"}
              <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
            </label>
            {fotoPreview && (
              <img src={fotoPreview} className="mt-2 w-full max-h-40 object-contain rounded-xl border border-slate-800" />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={cancelScanned}
              className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={saveCount}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
