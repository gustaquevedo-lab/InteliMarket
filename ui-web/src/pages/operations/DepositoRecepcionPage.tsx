import { useState, useEffect, useRef, useCallback } from "react"
import {
  Truck, Package, QrCode, Scan, CheckCircle2, AlertTriangle, AlertCircle,
  Search, X, Plus, Minus, ArrowLeft, RefreshCw, Calendar, Tag, ShieldCheck,
  Building2, User, LogIn, LogOut, Check, ChevronRight, Lock, Eye, EyeOff,
  Flame, Sparkles, Printer, Layers, Clock, ShieldAlert, Wifi, BatteryCharging,
  SlidersHorizontal, Lightbulb
} from "lucide-react"
import { api, type PurchaseOrder, type PurchaseOrderItem, type Product } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"
import { soundAlerts } from "../../utils/audioAlerts"

interface ReceptionItemDraft {
  product_id: string
  nombre: string
  codigo_barra?: string
  sku?: string
  cantidad_ordenada: number
  cantidad_recibir: number
  precio_unitario: number
  lote: string
  fecha_vencimiento: string
  cantidad_rechazada: number
  motivo_rechazo: string
  es_extraordinario?: boolean
  autorizado_por?: string
  autorizacion_motivo?: string
}

export default function DepositoRecepcionPage() {
  const { user, login, logout } = useAuth()
  const toast = useToast()

  // ── ESTADOS DE AUTENTICACIÓN LOCAL MÓVIL ───────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  // ── ESTADOS DEL FLUJO DE RECEPCIÓN ─────────────────────────────────────────
  const [viewState, setViewState] = useState<"orders" | "receiving" | "success">("orders")
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  // Borrador de ítems que se van descargando
  const [itemsDraft, setItemsDraft] = useState<ReceptionItemDraft[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [proveedorRef, setProveedorRef] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [lastReceiptCreated, setLastReceiptCreated] = useState<{ id: string; numero: string } | null>(null)

  // ── MODAL: MERCADERÍA EXTRAORDINARIA ───────────────────────────────────────
  const [showExtraordinaryModal, setShowExtraordinaryModal] = useState(false)
  const [extraSearch, setExtraSearch] = useState("")
  const [extraSearchResults, setExtraSearchResults] = useState<Product[]>([])
  const [searchingExtra, setSearchingExtra] = useState(false)
  const [selectedExtraProduct, setSelectedExtraProduct] = useState<Product | null>(null)
  const [extraCantidad, setExtraCantidad] = useState(1)
  const [extraLote, setExtraLote] = useState("")
  const [extraVencimiento, setExtraVencimiento] = useState("")
  const [extraAutorizadoPor, setExtraAutorizadoPor] = useState("")
  const [extraMotivo, setExtraMotivo] = useState("Mercadería entregada por el proveedor sin OC previa pero de alta rotación")

  // ── ESCÁNER POR CÁMARA (WEBCAM / MOBILE) ───────────────────────────────────
  const [cameraActive, setCameraActive] = useState(false)
  const [torchActive, setTorchActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)

  // ── BUFFER DEL ESCÁNER DE HARDWARE (PISTOLA LÁSER ZEBRA / HONEYWELL) ────────
  const barcodeBuffer = useRef("")
  const lastKeyTime = useRef(0)

  // ---------------------------------------------------------------------------
  // 1. CARGA DE ÓRDENES PENDIENTES
  // ---------------------------------------------------------------------------
  const fetchOrders = useCallback(async () => {
    if (!user) return
    setLoadingOrders(true)
    try {
      const res = await api.purchases.listPOs()
      const pending = (res || []).filter(
        (o) => ["confirmado", "enviada", "enviado", "parcial"].includes(o.estado || "")
      )
      setOrders(pending)
    } catch (err: any) {
      toast.error("Error de conexión", "No se pudieron obtener las órdenes pendientes.")
    } finally {
      setLoadingOrders(false)
    }
  }, [user, toast])

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [user, fetchOrders])

  // ---------------------------------------------------------------------------
  // 2. INICIAR RECEPCIÓN DE UNA ORDEN
  // ---------------------------------------------------------------------------
  const handleSelectPO = async (po: PurchaseOrder) => {
    try {
      soundAlerts.playScanSuccess()
      setSelectedPO(po)
      const fullPO = await api.purchases.getOrder(po.id!)
      const initialDraft: ReceptionItemDraft[] = (fullPO.items || []).map((it) => {
        const cantOrdenada = Number(it.cantidad || 0)
        const cantRecibidaPrevia = Number(it.recibido || (it as any).cantidad_recibida || 0)
        const pendiente = Math.max(0, cantOrdenada - cantRecibidaPrevia)
        const defaultExpiry = new Date()
        defaultExpiry.setMonth(defaultExpiry.getMonth() + 6)

        const prodId = (it as any).product_id || it.producto_id || (it as any).id || ""
        const prodNombre = (it as any).producto?.nombre || (it as any).descripcion || (it as any).nombre || "Producto"
        const prodCodigo = (it as any).producto?.codigo_barra || (it as any).codigo_barra || ""
        const prodSku = (it as any).producto?.sku || (it as any).sku || ""

        return {
          product_id: prodId,
          nombre: prodNombre,
          codigo_barra: prodCodigo,
          sku: prodSku,
          cantidad_ordenada: cantOrdenada,
          cantidad_recibir: pendiente > 0 ? pendiente : 0,
          precio_unitario: Number(it.precio_unitario || 0),
          lote: `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(prodId).slice(-3)}`,
          fecha_vencimiento: defaultExpiry.toISOString().split("T")[0],
          cantidad_rechazada: 0,
          motivo_rechazo: "Ninguno",
          es_extraordinario: false,
        }
      })

      setItemsDraft(initialDraft)
      setProveedorRef("")
      setObservaciones("")
      setViewState("receiving")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      toast.error("Error al cargar orden", err.message || "No se pudieron obtener los ítems.")
    }
  }

  // ---------------------------------------------------------------------------
  // 3. MATCHING DE CÓDIGO ESCANEADO
  // ---------------------------------------------------------------------------
  const handleBarcodeScanned = useCallback(
    async (code: string) => {
      const clean = code.trim()
      if (!clean) return

      // Si estamos en la lista de órdenes, buscar si coincide con una OC
      if (viewState === "orders") {
        const matchPO = orders.find(
          (o) => o.numero?.toLowerCase() === clean.toLowerCase() || o.id === clean
        )
        if (matchPO) {
          handleSelectPO(matchPO)
          return
        }
      }

      // Si estamos en la descarga activa de mercadería
      if (viewState === "receiving") {
        const idx = itemsDraft.findIndex(
          (it) => it.codigo_barra === clean || it.sku === clean || it.product_id === clean
        )

        if (idx !== -1) {
          // Ítem presente en la orden: Incrementar cantidad y emitir sonido positivo
          soundAlerts.playScanSuccess()
          setItemsDraft((prev) => {
            const next = [...prev]
            next[idx].cantidad_recibir += 1
            return next
          })
          setActiveItemIndex(idx)
          toast.success("Producto Escaneado", `${itemsDraft[idx].nombre} (+1)`)
        } else {
          // Ítem NO presente en la orden: Alerta de mercadería extraordinaria
          soundAlerts.playPriceMismatchAlert()
          toast.error("Mercadería Fuera de Orden", `El código ${clean} no pertenece a esta OC.`)
          // Abrir modal extraordinario precargando la búsqueda
          setExtraSearch(clean)
          setShowExtraordinaryModal(true)
        }
      }
    },
    [viewState, orders, itemsDraft]
  )

  // ---------------------------------------------------------------------------
  // 4. LISTENER DE PISTOLA DE CÓDIGOS DE BARRA (HARDWARE KEYDOWN)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = tag === "input" || tag === "textarea" || tag === "select"

      const now = Date.now()
      if (now - lastKeyTime.current > 200) {
        barcodeBuffer.current = ""
      }
      lastKeyTime.current = now

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 3) {
          handleBarcodeScanned(barcodeBuffer.current)
          barcodeBuffer.current = ""
          if (isInput) (e.target as HTMLInputElement).blur?.()
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleBarcodeScanned])

  // ---------------------------------------------------------------------------
  // 5. ESCÁNER POR CÁMARA MÓVIL (BarcodeDetector API Nativo)
  // ---------------------------------------------------------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"],
        })

        const scanFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(scanFrame)
            return
          }
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue
              handleBarcodeScanned(code)
              await new Promise((r) => setTimeout(r, 1200))
            }
          } catch {}
          scanLoopRef.current = requestAnimationFrame(scanFrame)
        }
        scanLoopRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (err: any) {
      toast.error("Error al encender cámara", err.message || "Permiso de cámara denegado.")
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setTorchActive(false)
  }

  const toggleTorch = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (track) {
      try {
        const capabilities: any = track.getCapabilities?.() || {}
        if (capabilities.torch) {
          const nextTorch = !torchActive
          await track.applyConstraints({
            advanced: [{ torch: nextTorch } as any],
          })
          setTorchActive(nextTorch)
        } else {
          toast.info("Linterna no soportada", "Este dispositivo no permite encender el flash.")
        }
      } catch {}
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 6. BÚSQUEDA DE PRODUCTO EXTRAORDINARIO
  // ---------------------------------------------------------------------------
  const handleSearchExtraProducts = async (term: string) => {
    setExtraSearch(term)
    if (!term || term.length < 2) {
      setExtraSearchResults([])
      return
    }
    setSearchingExtra(true)
    try {
      const res = await api.products.list({ search: term, limit: 8 })
      const list = Array.isArray(res) ? res : (res as any)?.items || []
      setExtraSearchResults(list)
    } catch {
      setExtraSearchResults([])
    } finally {
      setSearchingExtra(false)
    }
  }

  const handleAddExtraordinaryItem = () => {
    if (!selectedExtraProduct) {
      toast.error("Seleccione un producto", "Debe elegir el producto del maestro.")
      return
    }
    if (!extraAutorizadoPor.trim()) {
      toast.error("Autorización requerida", "Debe ingresar quién autoriza el ingreso.")
      return
    }
    if (extraCantidad <= 0) {
      toast.error("Cantidad inválida", "La cantidad debe ser mayor a 0.")
      return
    }

    const defaultExpiry = new Date()
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 6)

    const newItem: ReceptionItemDraft = {
      product_id: selectedExtraProduct.id,
      nombre: selectedExtraProduct.nombre,
      codigo_barra: selectedExtraProduct.codigo_barra,
      sku: selectedExtraProduct.sku,
      cantidad_ordenada: 0,
      cantidad_recibir: extraCantidad,
      precio_unitario: Number(selectedExtraProduct.costo_promedio || (selectedExtraProduct as any).costo || 0),
      lote: extraLote.trim() || `L-EXTRA-${Date.now().toString().slice(-4)}`,
      fecha_vencimiento: extraVencimiento || defaultExpiry.toISOString().split("T")[0],
      cantidad_rechazada: 0,
      motivo_rechazo: "Ninguno",
      es_extraordinario: true,
      autorizado_por: extraAutorizadoPor.trim(),
      autorizacion_motivo: extraMotivo.trim(),
    }

    setItemsDraft((prev) => [newItem, ...prev])
    setShowExtraordinaryModal(false)
    setSelectedExtraProduct(null)
    setExtraSearch("")
    setExtraCantidad(1)
    soundAlerts.playScanSuccess()
    toast.success("Mercadería Extraordinaria Agregada", `${newItem.nombre} (${extraCantidad} un.)`)
  }

  // ---------------------------------------------------------------------------
  // 7. CONFIRMAR RECEPCIÓN COMPLETA EN MUELLE
  // ---------------------------------------------------------------------------
  const handleConfirmReceipt = async () => {
    if (!selectedPO?.id) return

    const totalRecibir = itemsDraft.reduce((acc, it) => acc + (it.cantidad_recibir || 0), 0)
    if (totalRecibir <= 0) {
      toast.error("Sin mercadería", "Debe registrar al menos 1 unidad recibida.")
      return
    }

    setConfirmingReceipt(true)
    try {
      const payload: any = {
        purchase_order_id: selectedPO.id,
        supplier_id: selectedPO.supplier_id,
        proveedor_ref: proveedorRef.trim() || `REMITO-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`,
        observaciones: `Recepción móvil de muelle por ${user?.nombre || "Encargado de Depósito"}. ${observaciones}`,
        items: itemsDraft
          .filter((it) => it.cantidad_recibir > 0 || it.cantidad_rechazada > 0)
          .map((it) => ({
            product_id: it.product_id,
            cantidad_recibida: it.cantidad_recibir,
            precio_unitario: it.precio_unitario,
            costo_unitario: it.precio_unitario,
            total: it.cantidad_recibir * it.precio_unitario,
            lote: it.lote,
            fecha_vencimiento: it.fecha_vencimiento,
            cantidad_rechazada: it.cantidad_rechazada,
            motivo_rechazo: it.motivo_rechazo,
            es_extraordinario: it.es_extraordinario || false,
            autorizado_por: it.autorizado_por || null,
            autorizacion_motivo: it.autorizacion_motivo || null,
          })),
      }

      const receipt = await api.purchases.createReceipt(payload)
      soundAlerts.playRestockChime()
      setLastReceiptCreated({
        id: receipt.id,
        numero: receipt.numero || "REC-2026",
      })
      setViewState("success")
      toast.success("Recepción Confirmada", `Stock y lotes actualizados con éxito (${receipt.numero}).`)
    } catch (err: any) {
      soundAlerts.playPriceMismatchAlert()
      toast.error("Error al registrar recepción", err.message || "No se pudo guardar la recepción.")
    } finally {
      setConfirmingReceipt(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 8. LOGIN DEDICADO DE DEPÓSITO (Si no hay sesión)
  // ---------------------------------------------------------------------------
  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("Campos requeridos", "Ingrese su usuario y contraseña.")
      return
    }
    setLoggingIn(true)
    try {
      await login(loginEmail.trim(), loginPassword.trim())
      soundAlerts.playScanSuccess()
      toast.success("Sesión Iniciada", "Bienvenido al Muelle de Recepción.")
    } catch (err: any) {
      soundAlerts.playPriceMismatchAlert()
      toast.error("Acceso denegado", err.message || "Credenciales incorrectas.")
    } finally {
      setLoggingIn(false)
    }
  }

  // ---------------------------------------------------------------------------
  // VISTA 0: PANTALLA DE LOGIN MÓVIL DEDICADA
  // ---------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden">
        {/* Luces de fondo decorativas */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header superior de status */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Muelle Extra Online</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Wifi className="w-3.5 h-3.5 text-slate-400" />
            <span>192.168.0.10</span>
          </div>
        </div>

        {/* Tarjeta Central de Login */}
        <div className="max-w-sm w-full mx-auto my-auto py-6">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-indigo-400 p-0.5 mx-auto mb-4 shadow-2xl shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                <Truck className="w-10 h-10 text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              EXTRA MUELLE
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Recepción de Mercaderías & Control de Lotes
            </p>
          </div>

          <form onSubmit={handleLocalLogin} className="space-y-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Usuario / Correo Operativo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="deposito@superextra.com.py"
                  className="w-full bg-slate-950/80 border border-slate-700/60 rounded-2xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Contraseña / PIN
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700/60 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full mt-2 py-3.5 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {loggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loggingIn ? "Ingresando al Muelle..." : "Iniciar Turno de Descarga"}
            </button>
          </form>

          {/* Acceso Rápido Asistido */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setLoginEmail("admin@superextra.com.py")
                setLoginPassword("admin123")
              }}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
            >
              Autocompletar con Administrador de Muelle
            </button>
          </div>
        </div>

        {/* Footer Seguro Android */}
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[10px] text-slate-600 font-mono">
          InteliMarket v2.5 — Vertical Supermercado Extra
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 3: ÉXITO TRAS IMPACTAR EN STOCK
  // ---------------------------------------------------------------------------
  if (viewState === "success") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
        <div className="pt-[max(1rem,env(safe-area-inset-top))]" />

        <div className="max-w-sm w-full mx-auto my-auto text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 p-3 mx-auto flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
          </div>

          <div>
            <span className="text-[11px] font-bold font-mono tracking-widest text-emerald-400 uppercase">
              Operación Exitosa
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              Mercadería Ingresada a Stock
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              Se generó el comprobante oficial de recepción <strong className="font-mono text-white">{lastReceiptCreated?.numero}</strong>. Los lotes, vencimientos y cantidades ya están activos en el inventario.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Orden de Compra:</span>
              <span className="font-mono text-white font-bold">{selectedPO?.numero}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Proveedor:</span>
              <span className="text-white font-semibold truncate max-w-[180px]">{selectedPO?.supplier?.razon_social}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Ítems Procesados:</span>
              <span className="font-mono text-emerald-400 font-bold">{itemsDraft.length} productos</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setSelectedPO(null)
                setItemsDraft([])
                setViewState("orders")
                fetchOrders()
              }}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" /> Recibir Siguiente Camión
            </button>
          </div>
        </div>

        <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 1 & 2: APLICACIÓN PRINCIPAL DE DEPÓSITO
  // ---------------------------------------------------------------------------
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase()
    return (
      o.numero?.toLowerCase().includes(q) ||
      o.supplier?.razon_social?.toLowerCase().includes(q) ||
      o.supplier?.ruc?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      {/* ── HEADER SUPERIOR ADAPTADO A SAFE-AREA DE ANDROID ─────────────────── */}
      <header className="pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pb-3 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {viewState === "receiving" && (
              <button
                onClick={() => {
                  if (window.confirm("¿Volver a la lista de órdenes? Se perderá el avance actual.")) {
                    stopCamera()
                    setViewState("orders")
                  }
                }}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 active:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center font-black text-slate-950 text-xs">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                Extra Muelle
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  DEPÓSITO
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                Operador: <strong className="text-slate-200">{user.nombre}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cameraActive) stopCamera()
                else startCamera()
              }}
              className={`p-2 rounded-xl border transition-all ${
                cameraActive
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-400"
              }`}
              title="Alternar Cámara de Escaneo"
            >
              <Scan className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm("¿Cerrar sesión de depósito?")) {
                  logout()
                }
              }}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visor de Cámara Flotante Compacto */}
        {cameraActive && (
          <div className="mt-3 relative rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-black aspect-video max-h-48 shadow-2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {/* Mira de escaneo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-24 border-2 border-dashed border-amber-400/80 rounded-xl animate-pulse" />
            </div>
            {/* Botones de control de cámara */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md text-xs font-bold flex items-center gap-1 ${
                  torchActive ? "bg-amber-500 text-slate-950" : "bg-slate-900/80 text-white"
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                {torchActive ? "Flash ON" : "Flash"}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="p-2 rounded-xl bg-red-600/90 text-white text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── CONTENIDO PRINCIPAL SCROLLEABLE ─────────────────────────────────── */}
      <main className="flex-1 p-4 pb-36 max-w-lg w-full mx-auto space-y-4">
        {/* ===================================================================
            PANTALLA 1: LISTADO DE ÓRDENES PENDIENTES DE DESCARGA
        ==================================================================== */}
        {viewState === "orders" && (
          <>
            {/* Barra de Búsqueda y Filtro */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por N° OC o Proveedor..."
                className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Alerta de Modo Escáner */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white block">Pistola Láser Activa</span>
                <span className="text-[11px] text-slate-400">
                  Escaneá el código de barras de la orden de compra impresa para abrirla automáticamente.
                </span>
              </div>
            </div>

            {/* Listado de Órdenes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  Camiones & Órdenes Pendientes ({filteredOrders.length})
                </span>
                <button
                  onClick={fetchOrders}
                  disabled={loadingOrders}
                  className="flex items-center gap-1 text-amber-400 hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingOrders ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                  Buscando órdenes pendientes...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-3xl border border-slate-800/60 p-6">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
                  No hay órdenes de compra pendientes para descargar.
                </div>
              ) : (
                filteredOrders.map((po) => (
                  <div
                    key={po.id}
                    onClick={() => handleSelectPO(po)}
                    className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 active:scale-[0.99] rounded-3xl p-4 transition-all cursor-pointer shadow-lg space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-extrabold text-amber-400">
                          {po.numero}
                        </span>
                        <h3 className="font-bold text-sm text-white line-clamp-1">
                          {po.supplier?.razon_social || "Proveedor"}
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          RUC: {po.supplier?.ruc || "—"}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 uppercase shrink-0">
                        {po.estado}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60 font-mono text-slate-400">
                      <span>Total: <strong className="text-white">{formatPYG(po.total || 0)}</strong></span>
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        Descargar <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ===================================================================
            PANTALLA 2: DESCARGA ACTIVA EN MUELLE (LOTES & VENCIMIENTOS)
        ==================================================================== */}
        {viewState === "receiving" && selectedPO && (
          <>
            {/* Tarjeta Resumen de la Orden Activa */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-4 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-xs text-amber-400">
                  {selectedPO.numero}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatDate(selectedPO.fecha || "")}
                </span>
              </div>
              <h2 className="font-extrabold text-base text-white truncate">
                {selectedPO.supplier?.razon_social}
              </h2>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">
                    Remito / Factura Proveedor *
                  </label>
                  <input
                    type="text"
                    value={proveedorRef}
                    onChange={(e) => setProveedorRef(e.target.value)}
                    placeholder="Ej. REM-001248"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">
                    Observaciones Muelle
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Descargado en Muelle 1"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Barra de Acciones de Escaneo */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ítems de Descarga ({itemsDraft.length})
              </span>
              <button
                type="button"
                onClick={() => setShowExtraordinaryModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/50 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> + Extraordinario
              </button>
            </div>

            {/* Listado de Productos a Recibir */}
            <div className="space-y-3">
              {itemsDraft.map((it, idx) => {
                const isActive = activeItemIndex === idx
                return (
                  <div
                    key={idx}
                    className={`rounded-3xl border p-4 transition-all shadow-md space-y-3 ${
                      it.es_extraordinario
                        ? "bg-indigo-950/40 border-indigo-500/40"
                        : isActive
                        ? "bg-slate-900 border-amber-500/80 ring-1 ring-amber-500/40"
                        : "bg-slate-900/90 border-slate-800"
                    }`}
                  >
                    {/* Cabecera del Ítem */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {it.es_extraordinario && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> FUERA DE ORDEN
                          </span>
                        )}
                        <h4 className="font-extrabold text-sm text-white line-clamp-2">
                          {it.nombre}
                        </h4>
                        <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                          {it.codigo_barra ? `EAN: ${it.codigo_barra}` : it.sku ? `SKU: ${it.sku}` : "Sin código"}
                        </p>
                      </div>

                      {/* Contador Rápido Táctil */}
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-2xl p-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].cantidad_recibir = Math.max(0, next[idx].cantidad_recibir - 1)
                              return next
                            })
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 active:bg-slate-700 flex items-center justify-center font-black"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center font-mono font-black text-sm text-white">
                          {it.cantidad_recibir}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            soundAlerts.playScanSuccess()
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].cantidad_recibir += 1
                              return next
                            })
                            setActiveItemIndex(idx)
                          }}
                          className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 active:bg-amber-400 flex items-center justify-center font-black"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Campos de Control: Lote & Vencimiento */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Lote de Fábrica *
                        </label>
                        <input
                          type="text"
                          value={it.lote}
                          onChange={(e) => {
                            const val = e.target.value
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].lote = val
                              return next
                            })
                          }}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Vencimiento *
                        </label>
                        <input
                          type="date"
                          value={it.fecha_vencimiento}
                          onChange={(e) => {
                            const val = e.target.value
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].fecha_vencimiento = val
                              return next
                            })
                          }}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Sección de Rechazo en Muelle si hubiera avería */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="text-[10px]">
                        Pedido: <strong className="text-slate-200">{it.cantidad_ordenada}</strong> | Rechazados:{" "}
                        <strong className="text-red-400">{it.cantidad_rechazada}</strong>
                      </span>
                      {it.cantidad_rechazada === 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const cant = window.prompt("Cantidad averiada o rechazada:", "1")
                            if (!cant || isNaN(Number(cant))) return
                            const mot = window.prompt("Motivo del rechazo (ej. Roto, Vencido, Sin frío):", "Mercadería dañada")
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].cantidad_rechazada = Number(cant)
                              next[idx].motivo_rechazo = mot || "Mercadería dañada"
                              return next
                            })
                          }}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          + Registrar Avería
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setItemsDraft((prev) => {
                              const next = [...prev]
                              next[idx].cantidad_rechazada = 0
                              return next
                            })
                          }}
                          className="text-[10px] text-slate-500 hover:underline"
                        >
                          Limpiar Avería
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* ── BARRA FLOTANTE DE ACCIÓN INFERIOR (PROTEGIDA PARA ANDROID) ────────── */}
      {viewState === "receiving" && selectedPO && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-30 shadow-2xl">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Total a Ingresar
              </span>
              <span className="font-mono font-black text-lg text-amber-400">
                {itemsDraft.reduce((acc, it) => acc + (it.cantidad_recibir || 0), 0)} un.
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmReceipt}
              disabled={confirmingReceipt}
              className="flex-1 py-3.5 px-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {confirmingReceipt ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {confirmingReceipt ? "Guardando en Stock..." : "Confirmar Recepción"}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: INGRESO DE MERCADERÍA EXTRAORDINARIA ──────────────────────── */}
      {showExtraordinaryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Mercadería Fuera de Orden
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Excepción de muelle con auditoría obligatoria
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExtraordinaryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Buscador de Producto */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Buscar en Catálogo de Productos
              </label>
              <input
                type="text"
                value={extraSearch}
                onChange={(e) => handleSearchExtraProducts(e.target.value)}
                placeholder="Nombre, código de barras o SKU..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400"
              />
            </div>

            {/* Resultados de Búsqueda */}
            {searchingExtra ? (
              <div className="text-center py-4 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-amber-400" />
                Buscando producto...
              </div>
            ) : extraSearchResults.length > 0 && !selectedExtraProduct ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {extraSearchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedExtraProduct(p)
                      setExtraSearchResults([])
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 cursor-pointer text-xs"
                  >
                    <div className="font-bold text-white line-clamp-1">{p.nombre}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {p.codigo_barra || p.sku || "Sin código"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Producto Seleccionado */}
            {selectedExtraProduct && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-amber-400 uppercase">
                    Producto Seleccionado
                  </span>
                  <div className="font-bold text-xs text-white line-clamp-1">
                    {selectedExtraProduct.nombre}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExtraProduct(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Cantidad y Lote */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Cantidad Descargada *
                </label>
                <input
                  type="number"
                  min="1"
                  value={extraCantidad}
                  onChange={(e) => setExtraCantidad(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Lote Fabricante
                </label>
                <input
                  type="text"
                  value={extraLote}
                  onChange={(e) => setExtraLote(e.target.value)}
                  placeholder="L-EXT-001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Campos Mandatorios de Autorización */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                  Autorizado por (Nombre de Supervisor) *
                </label>
                <input
                  type="text"
                  value={extraAutorizadoPor}
                  onChange={(e) => setExtraAutorizadoPor(e.target.value)}
                  placeholder="Ej. Gerente de Compras / Jefe de Salón"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Motivo de la Excepción *
                </label>
                <input
                  type="text"
                  value={extraMotivo}
                  onChange={(e) => setExtraMotivo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowExtraordinaryModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddExtraordinaryItem}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300"
              >
                Admitir en Descarga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
