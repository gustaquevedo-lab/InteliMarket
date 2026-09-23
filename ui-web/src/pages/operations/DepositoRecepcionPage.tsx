import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Truck, Package, QrCode, Scan, CheckCircle2, AlertTriangle, AlertCircle,
  Search, X, Plus, Minus, ArrowLeft, RefreshCw, Calendar, Tag, ShieldCheck,
  Building2, User, LogIn, LogOut, Check, ChevronRight, Lock, Eye, EyeOff,
  Flame, Sparkles, Printer, Layers, Clock, ShieldAlert, Wifi,
  Lightbulb, Sun, Moon, CheckCheck, FileText, Download,
  Hash, RotateCcw, Barcode, FlipHorizontal, ArrowDownCircle, ExternalLink
} from "lucide-react"
import { useBarcodeScannerCamera } from "../../hooks"
import { api, type PurchaseOrder, type Product } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"

import { useTheme } from "../../context/ThemeContext"
import { formatPYG, formatDate } from "../../utils/format"
import { soundAlerts } from "../../utils/audioAlerts"

interface ReceptionItemDraft {
  draft_id: string
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

const PRESET_AVERIAS = [
  "Rotura / Empaque Dañado",
  "Vencido o Próximo a Vencer",
  "Cadena de Frío Rota / Descongelado",
  "Faltante en Bulto / Incompleto",
  "Mercadería No Solicitada",
  "Calidad Deficiente / Manchas"
]

const STORAGE_PREFIX = "deposito_receipt_draft_"
const STORAGE_ACTIVE_PO_KEY = "deposito_active_po_id"

const saveDraftToStorage = (po: PurchaseOrder, items: ReceptionItemDraft[], ref: string, obs: string) => {
  if (!po?.id) return
  try {
    const data = {
      po,
      itemsDraft: items,
      proveedorRef: ref,
      observaciones: obs,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_PREFIX + po.id, JSON.stringify(data))
    localStorage.setItem(STORAGE_ACTIVE_PO_KEY, po.id)
  } catch (err) {
    console.warn("[Deposito] No se pudo guardar borrador en localStorage", err)
  }
}

const loadDraftFromStorage = (poId: string) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + poId)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const clearDraftFromStorage = (poId: string) => {
  try {
    localStorage.removeItem(STORAGE_PREFIX + poId)
    if (localStorage.getItem(STORAGE_ACTIVE_PO_KEY) === poId) {
      localStorage.removeItem(STORAGE_ACTIVE_PO_KEY)
    }
  } catch {}
}

export default function DepositoRecepcionPage() {
  const { user, login, logout } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

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
  const [orderFilterTab, setOrderFilterTab] = useState<"todas" | "pendientes" | "parciales">("todas")
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  // Borrador de ítems que se van descargando
  const [itemsDraft, setItemsDraft] = useState<ReceptionItemDraft[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null)
  const [proveedorRef, setProveedorRef] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [lastReceiptCreated, setLastReceiptCreated] = useState<{ id: string; numero: string } | null>(null)
  const [restoredFromDraft, setRestoredFromDraft] = useState(false)
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null)

  // Filtro y buscador dentro de la orden activa
  const [itemSearchQuery, setItemSearchQuery] = useState("")
  const [itemStatusFilter, setItemStatusFilter] = useState<"todos" | "pendientes" | "sin_lote" | "completos" | "averias">("todos")
  const [lastScannedBarcode, setLastScannedBarcode] = useState("")

  // ── HERRAMIENTAS MASIVAS PARA LISTAS LARGAS ────────────────────────────────
  const [showBatchLoteModal, setShowBatchLoteModal] = useState(false)
  const [batchLoteInput, setBatchLoteInput] = useState("")
  const [batchLoteScope, setBatchLoteScope] = useState<"todos" | "sin_lote" | "visibles">("sin_lote")

  const [showBatchExpiryModal, setShowBatchExpiryModal] = useState(false)
  const [batchExpiryInput, setBatchExpiryInput] = useState("")
  const [batchExpiryScope, setBatchExpiryScope] = useState<"todos" | "visibles">("todos")

  // ── MODAL: REGISTRO DE AVERÍA / RECHAZO TÉCNICO ────────────────────────────
  const [averiaModalDraftId, setAveriaModalDraftId] = useState<string | null>(null)
  const [averiaCantInput, setAveriaCantInput] = useState("1")
  const [averiaMotivoInput, setAveriaMotivoInput] = useState(PRESET_AVERIAS[0])

  // ── MODAL: MERCADERÍA EXTRAORDINARIA (FUERA DE OC) ─────────────────────────
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


  // Acordeón y caché de ítems de órdenes en lista principal
  const [expandedPOId, setExpandedPOId] = useState<string | null>(null)
  const [poDetailsLoading, setPoDetailsLoading] = useState<Record<string, boolean>>({})
  const [poDetailsCache, setPoDetailsCache] = useState<Record<string, any[]>>({})

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
      // Ordenar por última actualización/creación de modo que órdenes modificadas o creadas recientemente aparezcan primero
      pending.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.fecha || a.created_at || 0).getTime()
        const timeB = new Date(b.updated_at || b.fecha || b.created_at || 0).getTime()
        return timeB - timeA
      })
      setOrders(pending)
    } catch (err: any) {
      const isAuthError =
        err?.status === 401 ||
        err?.response?.status === 401 ||
        err?.message?.includes("401") ||
        err?.message?.toLowerCase().includes("unauthorized") ||
        err?.message?.toLowerCase().includes("token")
      if (isAuthError) {
        toast.warning("Sesión Expirada", "Su sesión ha vencido. Por favor, vuelva a ingresar.")
        logout()
      } else {
        toast.error("Error de conexión", "No se pudieron obtener las órdenes pendientes.")
      }
    } finally {
      setLoadingOrders(false)
    }
  }, [user, toast, logout])

  // Auto-restaurar borrador al abrir o recargar la página
  useEffect(() => {
    if (!user) return
    const activePoId = localStorage.getItem(STORAGE_ACTIVE_PO_KEY)
    if (activePoId && viewState === "orders" && !selectedPO) {
      const draft = loadDraftFromStorage(activePoId)
      if (draft && draft.po && Array.isArray(draft.itemsDraft) && draft.itemsDraft.length > 0) {
        const validatedItems = draft.itemsDraft.map((it: any, idx: number) => ({
          ...it,
          draft_id: it.draft_id || `${it.product_id || "prod"}-${idx}-${Date.now()}`,
        }))
        setSelectedPO(draft.po)
        setItemsDraft(validatedItems)
        setProveedorRef(draft.proveedorRef || "")
        setObservaciones(draft.observaciones || "")
        setRestoredFromDraft(true)
        setDraftLastSaved(draft.savedAt || new Date().toISOString())
        setViewState("receiving")
        toast.info(
          "Recepción Restaurada",
          `Continuando orden ${draft.po.numero || "activa"}. Lotes y fechas protegidos contra recargas.`
        )
      }
    }
  }, [user, viewState, selectedPO, toast])

  // Auto-guardado en localStorage cada vez que cambian los datos de recepción
  useEffect(() => {
    if (viewState === "receiving" && selectedPO?.id && itemsDraft.length > 0) {
      saveDraftToStorage(selectedPO, itemsDraft, proveedorRef, observaciones)
      setDraftLastSaved(new Date().toISOString())
    }
  }, [viewState, selectedPO, itemsDraft, proveedorRef, observaciones])

  // Advertencia antes de cerrar o recargar la pestaña si hay una descarga en curso
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (viewState === "receiving" && itemsDraft.length > 0) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [viewState, itemsDraft.length])

  // Actualización inmutable y segura por draft_id
  const updateDraftItem = useCallback((draftId: string, patch: Partial<ReceptionItemDraft>) => {
    setItemsDraft((prev) =>
      prev.map((it) => (it.draft_id === draftId ? { ...it, ...patch } : it))
    )
  }, [])

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [user, fetchOrders])

  const toggleExpandPO = async (poId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (expandedPOId === poId) {
      setExpandedPOId(null)
      return
    }
    setExpandedPOId(poId)
    if (!poDetailsCache[poId]) {
      setPoDetailsLoading((prev) => ({ ...prev, [poId]: true }))
      try {
        const items = await api.purchases.getOrderItems(poId)
        setPoDetailsCache((prev) => ({ ...prev, [poId]: items || [] }))
      } catch {
        setPoDetailsCache((prev) => ({ ...prev, [poId]: [] }))
      } finally {
        setPoDetailsLoading((prev) => ({ ...prev, [poId]: false }))
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. INICIAR RECEPCIÓN DE UNA ORDEN CON CÓDIGOS DE BARRA COMPLETOS
  // ---------------------------------------------------------------------------
  const handleSelectPO = async (po: PurchaseOrder, forceFresh = false) => {
    try {
      soundAlerts.playScanSuccess()
      setSelectedPO(po)

      // 1. Si existe un borrador guardado en localStorage y no se forzó inicio limpio, restaurarlo
      if (!forceFresh && po.id) {
        const savedDraft = loadDraftFromStorage(po.id)
        if (savedDraft && Array.isArray(savedDraft.itemsDraft) && savedDraft.itemsDraft.length > 0) {
          const poUpdatedTime = po.updated_at ? new Date(po.updated_at).getTime() : 0
          const draftSavedTime = savedDraft.savedAt ? new Date(savedDraft.savedAt).getTime() : 0

          // Si la orden fue modificada en compras después de guardar el borrador en depósito:
          if (poUpdatedTime > 0 && draftSavedTime > 0 && poUpdatedTime > draftSavedTime + 3000) {
            toast.info(
              "Orden Modificada en Compras",
              "La orden fue modificada recientemente en el sistema. Se cargará la lista actualizada de productos desde el servidor."
            )
            // No restaurar el borrador viejo desactualizado; dejar que cargue del servidor
          } else {
            const validatedItems = savedDraft.itemsDraft.map((it: any, idx: number) => ({
              ...it,
              draft_id: it.draft_id || `${it.product_id || "prod"}-${idx}-${Date.now()}`,
            }))
            setSelectedPO(savedDraft.po || po)
            setItemsDraft(validatedItems)
            setProveedorRef(savedDraft.proveedorRef || "")
            setObservaciones(savedDraft.observaciones || "")
            setRestoredFromDraft(true)
            setDraftLastSaved(savedDraft.savedAt || new Date().toISOString())
            setItemSearchQuery("")
            setItemStatusFilter("todos")
            setViewState("receiving")
            toast.info("Borrador Recuperado", "Se restauraron todos los lotes y cantidades cargadas previamente.")
            window.scrollTo({ top: 0, behavior: "smooth" })
            return
          }
        }
      }

      // 2. Cargar la cabecera completa y la lista de ítems detallada con códigos de barra
      const [fullPO, detailedItems] = await Promise.all([
        api.purchases.getOrder(po.id!),
        api.purchases.getOrderItems(po.id!).catch(() => []),
      ])
      const activePO = fullPO || po
      setSelectedPO(activePO)

      const detailedMap = new Map<string, any>()
      ;(detailedItems || []).forEach((d: any) => {
        if (d.id) detailedMap.set(String(d.id), d)
        if (d.product_id) detailedMap.set(String(d.product_id), d)
      })

      const initialDraft: ReceptionItemDraft[] = (activePO.items || []).map((it: any, idx: number) => {
        const cantOrdenada = Number(it.cantidad || 0)
        const cantRecibidaPrevia = Number(it.recibido || it.cantidad_recibida || 0)
        const pendiente = Math.max(0, cantOrdenada - cantRecibidaPrevia)
        const defaultExpiry = new Date()
        defaultExpiry.setMonth(defaultExpiry.getMonth() + 6)

        const prodId = String(it.product_id || it.producto_id || it.id || "")
        const detail = detailedMap.get(String(it.id)) || detailedMap.get(prodId) || {}

        const rawCode = detail.codigo_barra || it.codigo_barra || it.producto?.codigo_barra || ""
        const cleanCode = rawCode === "—" ? "" : String(rawCode).trim()

        const rawSku = detail.sku || it.sku || it.producto?.sku || ""
        const cleanSku = rawSku === "—" ? "" : String(rawSku).trim()

        const prodNombre =
          detail.descripcion ||
          it.descripcion ||
          it.producto?.nombre ||
          it.nombre ||
          "Producto"

        const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${prodId}-${idx}-${Date.now()}`

        return {
          draft_id: uniqueId,
          product_id: prodId,
          nombre: prodNombre,
          codigo_barra: cleanCode,
          sku: cleanSku,
          cantidad_ordenada: cantOrdenada,
          cantidad_recibir: pendiente > 0 ? pendiente : 0,
          precio_unitario: Number(it.precio_unitario || 0),
          lote: `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(prodId).slice(-4)}`,
          fecha_vencimiento: defaultExpiry.toISOString().split("T")[0],
          cantidad_rechazada: 0,
          motivo_rechazo: "Ninguno",
          es_extraordinario: false,
        }
      })

      setItemsDraft(initialDraft)
      setProveedorRef("")
      setObservaciones("")
      setRestoredFromDraft(false)
      setItemSearchQuery("")
      setItemStatusFilter("todos")
      setViewState("receiving")
      saveDraftToStorage(activePO, initialDraft, "", "")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      toast.error("Error al cargar orden", err.message || "No se pudieron obtener los ítems de la orden.")
    }
  }

  const handleDiscardDraft = () => {
    if (!selectedPO?.id) return
    if (window.confirm("¿Seguro que deseas descartar el borrador guardado y volver a cargar los datos originales de la orden?")) {
      clearDraftFromStorage(selectedPO.id)
      setRestoredFromDraft(false)
      handleSelectPO(selectedPO, true)
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PROCESAMIENTO INTELIGENTE DE CÓDIGO DE BARRAS ESCANEADO
  // ---------------------------------------------------------------------------
  const processScannedCode = useCallback(
    (code: string) => {
      const cleanCode = code.trim()
      if (!cleanCode) return
      setLastScannedBarcode(cleanCode)

      // Vista 1: Si estamos en la lista de órdenes y se escanea el código de una OC
      if (viewState === "orders") {
        const foundPO = orders.find(
          (o) =>
            o.numero?.toLowerCase() === cleanCode.toLowerCase() ||
            (o as any).codigo_barra === cleanCode
        )
        if (foundPO) {
          handleSelectPO(foundPO)
          return
        }
      }

      // Vista 2: Si estamos en recepción activa y se escanea un producto
      if (viewState === "receiving") {
        const cleanNoLeading = cleanCode.replace(/^0+/, "")
        const matchIdx = itemsDraft.findIndex((it) => {
          const itCode = (it.codigo_barra || "").trim()
          const itCodeNoLeading = itCode.replace(/^0+/, "")
          return (
            (itCode && (itCode === cleanCode || (itCodeNoLeading && itCodeNoLeading === cleanNoLeading))) ||
            (it.sku && it.sku.toLowerCase() === cleanCode.toLowerCase()) ||
            it.product_id === cleanCode
          )
        })

        if (matchIdx !== -1) {
          soundAlerts.playScanSuccess()
          setItemsDraft((prev) => {
            const next = [...prev]
            next[matchIdx].cantidad_recibir += 1
            return next
          })
          setActiveItemIndex(matchIdx)
          toast.success("Producto Verificado", `+1 un. de ${itemsDraft[matchIdx].nombre}`)

          // Auto-scroll al ítem
          const element = document.getElementById(`item-card-${matchIdx}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        } else {
          soundAlerts.playPriceMismatchAlert()
          toast.warning(
            "Producto No Incluido en esta OC",
            `El código ${cleanCode} no figura en la orden. Podés cargarlo como Extraordinario.`
          )
        }
      }
    },
    [viewState, orders, itemsDraft, toast]
  )

  // Listener para pistola láser USB/Bluetooth (Hardware Scan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if ((e.target as HTMLElement).id !== "quick-scan-input") {
          return
        }
      }

      const now = Date.now()
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = ""
      }
      lastKeyTime.current = now

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 3) {
          e.preventDefault()
          processScannedCode(barcodeBuffer.current)
          barcodeBuffer.current = ""
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [processScannedCode])

  // ── ESCÁNER POR CÁMARA Y MOTOR UNIVERSAL (ZXing + BarcodeDetector + Detección Trasera) ──
  const {
    videoRef,
    cameraActive,
    cameraLoading,
    cameraError,
    availableCameras,
    selectedCameraId,
    activeCameraLabel,
    hasTorch,
    torchActive,
    startCamera,
    stopCamera,
    switchCamera,
    toggleTorch,
  } = useBarcodeScannerCamera({
    onScan: (code) => {
      try {
        soundAlerts.playScanSuccess()
      } catch {}
      processScannedCode(code)
    },
    storageKey: "extra_deposito_camera_id",
  })

  // ---------------------------------------------------------------------------
  // 5. ACCIONES MASIVAS: RECEPCIÓN, LOTES Y VENCIMIENTOS
  // ---------------------------------------------------------------------------
  const handleReceiveAllPending = () => {
    if (window.confirm("¿Confirmar recepción completa de todos los productos según la Orden de Compra?")) {
      soundAlerts.playScanSuccess()
      setItemsDraft((prev) =>
        prev.map((it) => ({
          ...it,
          cantidad_recibir: it.cantidad_ordenada > 0 ? it.cantidad_ordenada : it.cantidad_recibir,
        }))
      )
      toast.success("Cantidades Actualizadas", "Todos los ítems han sido marcados con su cantidad ordenada.")
    }
  }

  const handleAutoFillMissingLotes = () => {
    let count = 0
    setItemsDraft((prev) =>
      prev.map((it) => {
        if (!it.lote || it.lote.trim() === "") {
          count++
          return {
            ...it,
            lote: `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(it.product_id).slice(-4)}`,
          }
        }
        return it
      })
    )
    soundAlerts.playScanSuccess()
    toast.success("Lotes Autogenerados", `${count > 0 ? `${count} productos actualizados` : "Todos los productos ya contaban con lote"}.`)
  }

  const handleApplyBatchLote = () => {
    const val = batchLoteInput.trim()
    if (!val) {
      toast.error("Lote requerido", "Ingrese el número de lote a aplicar.")
      return
    }
    setItemsDraft((prev) =>
      prev.map((it) => {
        if (batchLoteScope === "sin_lote" && it.lote && it.lote.trim() !== "") return it
        if (batchLoteScope === "visibles") {
          const isVisible = visibleItemsDraft.some((v) => v.draft_id === it.draft_id)
          if (!isVisible) return it
        }
        return { ...it, lote: val }
      })
    )
    setShowBatchLoteModal(false)
    setBatchLoteInput("")
    soundAlerts.playScanSuccess()
    toast.success("Lote Masivo Aplicado", `Se asignó el lote "${val}" exitosamente.`)
  }

  const handleApplyBatchExpiry = () => {
    const val = batchExpiryInput.trim()
    if (!val) {
      toast.error("Fecha requerida", "Seleccione la fecha de vencimiento a aplicar.")
      return
    }
    setItemsDraft((prev) =>
      prev.map((it) => {
        if (batchExpiryScope === "visibles") {
          const isVisible = visibleItemsDraft.some((v) => v.draft_id === it.draft_id)
          if (!isVisible) return it
        }
        return { ...it, fecha_vencimiento: val }
      })
    )
    setShowBatchExpiryModal(false)
    setBatchExpiryInput("")
    soundAlerts.playScanSuccess()
    toast.success("Vencimiento Masivo Aplicado", `Se asignó la fecha ${val} exitosamente.`)
  }

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

    const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `extra-${selectedExtraProduct.id}-${Date.now()}`

    const newItem: ReceptionItemDraft = {
      draft_id: uniqueId,
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
      const todayISO = new Date().toISOString().slice(2, 10).replace(/-/g, "")
      const defaultExpiry = new Date()
      defaultExpiry.setMonth(defaultExpiry.getMonth() + 6)
      const defaultExpiryStr = defaultExpiry.toISOString().split("T")[0]

      const firstItemWh = selectedPO.items && selectedPO.items.length > 0 ? (selectedPO.items[0] as any)?.warehouse_id : undefined
      const targetWarehouseId = (selectedPO as any)?.warehouse_id || firstItemWh || undefined

      const payload: any = {
        purchase_order_id: selectedPO.id,
        supplier_id: selectedPO.supplier_id,
        warehouse_id: targetWarehouseId,
        proveedor_ref: proveedorRef.trim() || `REMITO-${todayISO}`,
        observaciones: `Recepción móvil de muelle por ${user?.nombre || "Encargado de Depósito"}. ${observaciones}`.trim(),
        items: itemsDraft
          .filter((it) => (it.cantidad_recibir || 0) > 0 || (it.cantidad_rechazada || 0) > 0)
          .map((it) => {
            const safeLote = it.lote && it.lote.trim()
              ? it.lote.trim()
              : `L-${todayISO}-${String(it.product_id).slice(-4)}`
            const safeExpiry = it.fecha_vencimiento && it.fecha_vencimiento.trim()
              ? it.fecha_vencimiento.trim()
              : defaultExpiryStr

            return {
              product_id: it.product_id,
              cantidad_recibida: Number(it.cantidad_recibir || 0),
              precio_unitario: Number(it.precio_unitario || 0),
              costo_unitario: Number(it.precio_unitario || 0),
              total: Number(it.cantidad_recibir || 0) * Number(it.precio_unitario || 0),
              lote: safeLote,
              fecha_vencimiento: safeExpiry.includes("T") ? safeExpiry : `${safeExpiry}T00:00:00Z`,
              cantidad_rechazada: Number(it.cantidad_rechazada || 0),
              motivo_rechazo: it.motivo_rechazo && it.motivo_rechazo !== "Ninguno" ? it.motivo_rechazo.trim() : undefined,
              es_extraordinario: Boolean(it.es_extraordinario),
              autorizado_por: undefined, // no enviar string en campo UUID
              autorizacion_motivo: it.autorizacion_motivo ? it.autorizacion_motivo.trim() : undefined,
            }
          }),
      }

      const receipt = await api.purchases.createReceipt(payload)
      soundAlerts.playRestockChime()
      clearDraftFromStorage(selectedPO.id)
      setRestoredFromDraft(false)
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans transition-colors duration-200">
        {/* Header superior con status y toggle de tema */}
        <div className="pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Muelle Extra Online
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
              title="Cambiar Modo Claro / Oscuro"
            >
              {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              <Wifi className="w-4 h-4" />
              <span>192.168.0.10</span>
            </div>
          </div>
        </div>

        {/* Tarjeta Central de Login */}
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-600 to-indigo-600 p-1 mx-auto mb-4 shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[22px] flex items-center justify-center">
                <Truck className="w-10 h-10 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              EXTRA MUELLE
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Recepción de Mercaderías & Control de Lotes
            </p>
          </div>

          <form onSubmit={handleLocalLogin} className="space-y-5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Usuario / Correo Operativo
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="deposito@superextra.com.py"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-2xl pl-11 pr-3 py-3.5 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Contraseña / PIN
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-2xl pl-11 pr-11 py-3.5 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full mt-2 py-4 rounded-2xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loggingIn ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loggingIn ? "Ingresando al Muelle..." : "Iniciar Turno de Descarga"}
            </button>
          </form>

          {/* Acceso Rápido Asistido */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setLoginEmail("admin@superextra.com.py")
                setLoginPassword("admin123")
              }}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Autocompletar con Administrador de Muelle
            </button>
          </div>
        </div>

        {/* Footer Seguro Android */}
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-400 dark:text-slate-600 font-mono">
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans transition-colors duration-200">
        <div className="pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between">
          <span className="font-mono text-xs text-slate-400 font-bold">Muelle de Recepción Extra</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 p-3 mx-auto flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <span className="text-xs font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
              Operación Exitosa
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              Mercadería Ingresada a Stock
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">
              Se generó el comprobante oficial de recepción{" "}
              <strong className="font-mono text-slate-900 dark:text-white text-base">
                {lastReceiptCreated?.numero}
              </strong>
              . Los lotes, vencimientos y cantidades ya están activos en el inventario.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left space-y-3 shadow-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Orden de Compra:</span>
              <span className="font-mono text-slate-900 dark:text-white font-black text-base">{selectedPO?.numero}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Proveedor:</span>
              <span className="text-slate-900 dark:text-white font-bold truncate max-w-[200px] text-right">{selectedPO?.supplier?.razon_social}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Ítems Procesados:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black text-base">{itemsDraft.length} productos</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Unidades:</span>
              <span className="font-mono text-slate-900 dark:text-white font-black text-base">
                {itemsDraft.reduce((acc, it) => acc + (it.cantidad_recibir || 0), 0)} un.
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full py-3.5 rounded-2xl font-bold text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" /> Imprimir Comprobante de Recepción
            </button>

            <button
              onClick={() => {
                setSelectedPO(null)
                setItemsDraft([])
                setViewState("orders")
                fetchOrders()
              }}
              className="w-full py-4 rounded-2xl font-black text-base text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Truck className="w-5 h-5" /> Recibir Siguiente Camión
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
    const matchesQuery =
      o.numero?.toLowerCase().includes(q) ||
      o.supplier?.razon_social?.toLowerCase().includes(q) ||
      o.supplier?.ruc?.toLowerCase().includes(q)

    if (!matchesQuery) return false
    if (orderFilterTab === "pendientes") return ["confirmado", "enviada", "enviado"].includes(o.estado || "")
    if (orderFilterTab === "parciales") return o.estado === "parcial"
    return true
  })

  // Métricas del borrador de recepción
  const totalOrdenado = itemsDraft.reduce((acc, it) => acc + (it.cantidad_ordenada || 0), 0)
  const totalRecibiendo = itemsDraft.reduce((acc, it) => acc + (it.cantidad_recibir || 0), 0)
  const totalAverias = itemsDraft.reduce((acc, it) => acc + (it.cantidad_rechazada || 0), 0)
  const itemsCompletados = itemsDraft.filter((it) => it.cantidad_recibir >= it.cantidad_ordenada && it.cantidad_recibir > 0).length
  const pctProgreso = itemsDraft.length > 0 ? Math.round((itemsCompletados / itemsDraft.length) * 100) : 0

  const hasLocalDraft = (poId?: string) => {
    if (!poId) return false
    return !!localStorage.getItem(STORAGE_PREFIX + poId)
  }

  // Filtrado de ítems en pantalla de recepción activa
  const visibleItemsDraft = itemsDraft.filter((it) => {
    const q = itemSearchQuery.toLowerCase()
    const matchesSearch =
      it.nombre.toLowerCase().includes(q) ||
      (it.codigo_barra && it.codigo_barra.includes(q)) ||
      (it.sku && it.sku.toLowerCase().includes(q)) ||
      (it.lote && it.lote.toLowerCase().includes(q))

    if (!matchesSearch) return false

    if (itemStatusFilter === "pendientes") {
      return it.cantidad_recibir < it.cantidad_ordenada
    }
    if (itemStatusFilter === "sin_lote") {
      return !it.lote || it.lote.trim() === ""
    }
    if (itemStatusFilter === "completos") {
      return it.cantidad_recibir >= it.cantidad_ordenada && it.cantidad_recibir > 0
    }
    if (itemStatusFilter === "averias") {
      return it.cantidad_rechazada > 0
    }
    return true
  })

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* ── HEADER SUPERIOR ADAPTADO A SAFE-AREA DE ANDROID ─────────────────── */}
      <header className="pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {viewState === "receiving" && (
              <button
                onClick={() => {
                  if (window.confirm("¿Volver a la lista de órdenes? Se perderá el avance actual.")) {
                    stopCamera()
                    setViewState("orders")
                  }
                }}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
                title="Volver a Órdenes"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 shadow-md">
              <Truck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Extra Muelle
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  DEPÓSITO
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                Operador: <strong className="text-slate-800 dark:text-slate-200">{user.nombre}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Descargar APK Nativo Android Extra Depósito */}
            <a
              href="/download/extra-deposito.apk"
              download="extra-deposito.apk"
              title="Descargar APK Nativo Android Extra Depósito"
              className="px-2.5 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 text-xs font-black shadow-sm shrink-0"
            >
              <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">DESCARGAR</span>
              <span className="text-[10px] uppercase font-black tracking-wider bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-md">
                APK
              </span>
            </a>

            {/* Toggle Modo Claro / Oscuro */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-500 active:scale-95 transition-all"
              title="Cambiar Modo Claro / Oscuro"
            >
              {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Alternar Cámara */}
            <button
              onClick={() => {
                if (cameraActive) stopCamera()
                else startCamera()
              }}
              className={`p-2.5 rounded-2xl border transition-all ${
                cameraActive
                  ? "bg-red-500/20 border-red-500 text-red-600 dark:text-red-400 shadow-md shadow-red-500/20"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-500"
              }`}
              title="Alternar Cámara de Escaneo"
            >
              <Scan className="w-4 h-4" />
            </button>

            {/* Cerrar Sesión */}
            <button
              onClick={() => {
                if (window.confirm("¿Cerrar sesión de depósito?")) {
                  logout()
                  window.location.reload()
                }
              }}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 active:scale-95 transition-all"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {cameraError && (

          <div className="mt-2 max-w-2xl mx-auto p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Visor de Cámara Flotante con ZXing & Selector de Cámara */}
        {cameraActive && (

          <div className="mt-3 max-w-2xl mx-auto relative rounded-3xl overflow-hidden border-2 border-amber-500 bg-black aspect-video max-h-60 shadow-2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            
            {/* Guía de enfoque con rayo de escaneo animado */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-32 border-2 border-dashed border-amber-400/90 rounded-2xl relative overflow-hidden flex flex-col justify-between p-2">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-center text-amber-300/80 bg-black/40 px-2 py-0.5 rounded-full mx-auto">
                  Enfocá el código de barras (EAN-13, EAN-8, UPC, Code 128)
                </span>
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
              </div>
            </div>

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
              {availableCameras.length > 1 ? (
                <button
                  type="button"
                  onClick={switchCamera}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 active:scale-95 transition"
                  title={activeCameraLabel || "Cambiar Cámara"}
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>{activeCameraLabel ? (activeCameraLabel.includes("Trasera") ? "Trasera" : activeCameraLabel.includes("Frontal") ? "Frontal" : "Girar") : "Girar"}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({Math.max(1, availableCameras.findIndex(c => c.deviceId === selectedCameraId) + 1)}/{availableCameras.length})</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`px-3 py-1.5 rounded-xl backdrop-blur-md text-xs font-bold flex items-center gap-1.5 transition ${
                    torchActive ? "bg-amber-500 text-slate-950 font-black shadow-md" : "bg-slate-900/85 text-white border border-white/20"
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {torchActive ? "Flash ON" : "Flash"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-black shadow-md transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── CONTENIDO PRINCIPAL SCROLLEABLE ─────────────────────────────────── */}
      <main className="flex-1 p-4 pb-40 max-w-2xl w-full mx-auto space-y-4">
        {/* ===================================================================
            PANTALLA 1: LISTADO DE ÓRDENES PENDIENTES DE DESCARGA
        ==================================================================== */}
        {viewState === "orders" && (
          <>
            {/* Barra de Búsqueda y Filtro */}
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por N° OC, Proveedor o RUC..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl pl-12 pr-10 py-3.5 text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Pestañas de Filtro de Órdenes */}
            <div className="flex gap-2 bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOrderFilterTab("todas")}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  orderFilterTab === "todas"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Todas ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilterTab("pendientes")}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  orderFilterTab === "pendientes"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Completas ({orders.filter((o) => ["confirmado", "enviada", "enviado"].includes(o.estado || "")).length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilterTab("parciales")}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                  orderFilterTab === "parciales"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Parciales ({orders.filter((o) => o.estado === "parcial").length})
              </button>
            </div>

            {/* Banner de Ayuda con Escáner Láser & Descarga APK */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                  <Barcode className="w-6 h-6" />
                </div>
                <div className="text-xs sm:text-sm">
                  <span className="font-extrabold text-slate-900 dark:text-white block text-sm sm:text-base">
                    Pistola Láser & Cámara Activas
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Escaneá el código de la orden o abrí la cámara para verificar códigos de barra automáticamente.
                  </span>
                </div>
              </div>
              <a
                href="/download/extra-deposito.apk"
                download="extra-deposito.apk"
                title="Bajar APK Nativo Android"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition shrink-0 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Instalar APK</span>
              </a>
            </div>

            {/* Listado de Órdenes */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-1">
                <span className="font-extrabold uppercase tracking-wider text-xs text-slate-700 dark:text-slate-300">
                  Camiones & Órdenes Pendientes ({filteredOrders.length})
                </span>
                <button
                  onClick={fetchOrders}
                  disabled={loadingOrders}
                  className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
              </div>

              {loadingOrders ? (
                <div className="py-14 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
                  Buscando órdenes pendientes de descarga...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-14 text-center text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
                  No hay órdenes de compra pendientes para descargar.
                </div>
              ) : (
                filteredOrders.map((po) => {
                  const isExpanded = expandedPOId === po.id
                  const cachedItems = po.id ? poDetailsCache[po.id] : undefined
                  const isLoadingItems = po.id ? poDetailsLoading[po.id] : false

                  return (
                    <div
                      key={po.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/80 rounded-3xl p-5 transition-all shadow-sm hover:shadow-md space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                              {po.numero}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {formatDate(po.fecha || "")}
                            </span>
                            {po.updated_at && po.created_at && new Date(po.updated_at).getTime() - new Date(po.created_at).getTime() > 60000 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                🔄 Actualizada
                              </span>
                            )}
                          </div>
                          <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white mt-1 break-words">
                            {po.supplier?.razon_social || "Proveedor"}
                          </h3>
                          <p className="text-xs sm:text-sm font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            RUC: <strong className="text-slate-700 dark:text-slate-300">{po.supplier?.ruc || "—"}</strong>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {hasLocalDraft(po.id) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                              ⚡ Borrador Guardado
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-black uppercase shrink-0 ${
                            po.estado === "parcial"
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                          }`}>
                            {po.estado}
                          </span>
                        </div>
                      </div>

                      {/* Botón para previsualizar ítems y códigos de barra antes de descargar */}
                      {po.id && (
                        <div>
                          <button
                            type="button"
                            onClick={(e) => toggleExpandPO(po.id!, e)}
                            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 flex items-center gap-1.5 py-1 transition cursor-pointer"
                          >
                            <Package className="w-3.5 h-3.5 text-amber-500" />
                            <span>{isExpanded ? "Ocultar Productos & Códigos" : "Ver Productos & Códigos de Barra"}</span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                              {isLoadingItems ? (
                                <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                  Cargando detalle de productos y códigos...
                                </div>
                              ) : cachedItems && cachedItems.length > 0 ? (
                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                  {cachedItems.map((ci: any, cidx: number) => (
                                    <div
                                      key={`${ci.id || cidx}`}
                                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-xs flex items-center justify-between gap-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-extrabold text-slate-900 dark:text-slate-100 break-words">
                                          {ci.descripcion || ci.nombre || "Producto"}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          <span className="font-mono font-bold text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                            <Barcode className="w-3 h-3" />
                                            {ci.codigo_barra && ci.codigo_barra !== "—" ? ci.codigo_barra : "Sin EAN"}
                                          </span>
                                          {ci.sku && ci.sku !== "—" && (
                                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                              SKU: {ci.sku}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 font-mono font-black text-slate-900 dark:text-white">
                                        {ci.cantidad} {ci.unidad_medida || "UN"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic py-1">Sin ítems disponibles para previsualizar.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-100 dark:border-slate-800/80 font-mono text-slate-600 dark:text-slate-400">
                        <span>Total: <strong className="text-slate-900 dark:text-white font-black">{formatPYG(po.total || 0)}</strong></span>
                        <button
                          type="button"
                          onClick={() => handleSelectPO(po)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                          <span>{hasLocalDraft(po.id) ? "Continuar Descarga" : "Iniciar Descarga"}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* ===================================================================
            PANTALLA 2: DESCARGA ACTIVA EN MUELLE (LOTES & VENCIMIENTOS)
        ==================================================================== */}
        {viewState === "receiving" && selectedPO && (
          <>
            {/* Banner de Borrador Protegido contra Recargas */}
            {restoredFromDraft && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                      Borrador Protegido Localmente
                    </h4>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                      Los lotes y cantidades cargadas están a salvo de recargas accidentales {draftLastSaved ? `(${new Date(draftLastSaved).toLocaleTimeString()})` : ""}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shrink-0 cursor-pointer shadow-sm transition"
                >
                  Descartar borrador y reiniciar
                </button>
              </div>
            )}

            {/* Tarjeta Resumen de la Orden Activa */}
            <div className="bg-white dark:bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                  {selectedPO.numero}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                  {formatDate(selectedPO.fecha || "")}
                </span>
              </div>
              <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white truncate">
                {selectedPO.supplier?.razon_social}
              </h2>

              {/* Barra de Progreso de Recepción */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-400">Progreso de Descarga:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{itemsCompletados} de {itemsDraft.length} ítems ({pctProgreso}%)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${pctProgreso}%` }}
                  />
                </div>
              </div>

              {/* Campos Remito & Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block uppercase mb-1">
                    Remito / Factura Proveedor *
                  </label>
                  <input
                    type="text"
                    value={proveedorRef}
                    onChange={(e) => setProveedorRef(e.target.value)}
                    placeholder="Ej. REM-001248"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block uppercase mb-1">
                    Observaciones Muelle
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej. Descargado en Muelle 1"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Input de Escaneo Rápido de Pistola Láser en Recepción */}
            <div className="relative">
              <Scan className="w-5 h-5 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="quick-scan-input"
                type="text"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && itemSearchQuery.trim()) {
                    processScannedCode(itemSearchQuery.trim())
                    setItemSearchQuery("")
                  }
                }}
                placeholder="Escanear código de barras o filtrar producto..."
                className="w-full bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl pl-11 pr-10 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-all font-mono font-medium shadow-sm"
              />
              {itemSearchQuery && (
                <button
                  type="button"
                  onClick={() => setItemSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Barra de Herramientas Masivas para Listas Largas de Supermercado */}
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Herramientas Rápidas de Carga
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {itemsDraft.length} ítems en orden
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFillMissingLotes}
                  className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Auto-generar lote trazable para todos los productos que no tengan lote"
                >
                  <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Auto-Lotes Faltantes</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBatchLoteInput(proveedorRef ? proveedorRef.trim() : `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}`)
                    setShowBatchLoteModal(true)
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 text-xs font-black flex items-center gap-1.5 border border-slate-300/80 dark:border-slate-700 transition cursor-pointer"
                  title="Asignar el mismo lote a múltiples productos de una vez"
                >
                  <Barcode className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lote Masivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setMonth(d.getMonth() + 6)
                    setBatchExpiryInput(d.toISOString().split("T")[0])
                    setShowBatchExpiryModal(true)
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 text-xs font-black flex items-center gap-1.5 border border-slate-300/80 dark:border-slate-700 transition cursor-pointer"
                  title="Asignar la misma fecha de vencimiento a múltiples productos"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Vencimiento Masivo</span>
                </button>

                <button
                  type="button"
                  onClick={handleReceiveAllPending}
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                  title="Marcar todo como recibido 100%"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Recibir Todo (100%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExtraordinaryModal(true)}
                  className="px-3 py-2 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/25 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Fuera de Orden</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros de Ítems */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-xl border border-slate-300/80 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setItemStatusFilter("todos")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    itemStatusFilter === "todos"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Todos ({itemsDraft.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemStatusFilter("pendientes")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    itemStatusFilter === "pendientes"
                      ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Faltantes ({itemsDraft.filter((it) => (it.cantidad_recibir || 0) < it.cantidad_ordenada).length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemStatusFilter("sin_lote")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    itemStatusFilter === "sin_lote"
                      ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Sin Lote ({itemsDraft.filter((it) => !it.lote || it.lote.trim() === "").length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemStatusFilter("averias")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    itemStatusFilter === "averias"
                      ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Averías ({itemsDraft.filter((it) => (it.cantidad_rechazada || 0) > 0).length})
                </button>
              </div>
            </div>

            {/* Listado de Productos a Recibir */}
            <div className="space-y-3.5">
              {visibleItemsDraft.map((it) => {
                const isComplete = (it.cantidad_recibir || 0) >= it.cantidad_ordenada && it.cantidad_ordenada > 0
                const isExceeded = (it.cantidad_recibir || 0) > it.cantidad_ordenada
                const hasAveria = (it.cantidad_rechazada || 0) > 0
                const isPending = (it.cantidad_recibir || 0) < it.cantidad_ordenada
                const missingLote = !it.lote || it.lote.trim() === ""

                return (
                  <div
                    key={it.draft_id}
                    id={`item-card-${it.draft_id}`}
                    className={`rounded-3xl border p-5 transition-all shadow-sm space-y-4 ${
                      it.es_extraordinario
                        ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/40"
                        : hasAveria
                        ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/40"
                        : isComplete && !isExceeded
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Cabecera del Ítem con Nombre Completo y Etiquetas */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3.5">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {it.es_extraordinario && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                              <ShieldAlert className="w-3.5 h-3.5" /> FUERA DE ORDEN
                            </span>
                          )}
                          {isComplete && !isExceeded && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              <Check className="w-3.5 h-3.5" /> COMPLETO
                            </span>
                          )}
                          {isExceeded && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                              EXCEDENTE (+{(it.cantidad_recibir || 0) - it.cantidad_ordenada})
                            </span>
                          )}
                          {isPending && (it.cantidad_recibir || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              EN PROCESO ({it.cantidad_recibir}/{it.cantidad_ordenada})
                            </span>
                          )}
                          {missingLote && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              SIN LOTE
                            </span>
                          )}
                          {hasAveria && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                              <AlertTriangle className="w-3.5 h-3.5" /> AVERÍA: {it.cantidad_rechazada} UN.
                            </span>
                          )}
                        </div>

                        {/* Nombre del Producto 100% Completo sin truncamiento */}
                        <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-snug break-words">
                          {it.nombre}
                        </h4>

                        {/* Insignia Canónica de Código de Barras y SKU */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-mono font-black border shadow-sm ${
                              it.codigo_barra && it.codigo_barra !== "—"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500"
                            }`}
                          >
                            <Barcode className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{it.codigo_barra && it.codigo_barra !== "—" ? it.codigo_barra : "SIN CÓDIGO EAN"}</span>
                          </div>

                          {it.sku && it.sku !== "—" && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                              <Tag className="w-3.5 h-3.5 text-slate-400" />
                              <span>SKU: {it.sku}</span>
                            </div>
                          )}

                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Unitario: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatPYG(it.precio_unitario || 0)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Contador Táctil Ergonómico de 48px */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-1.5 shrink-0 shadow-inner self-start">
                        <button
                          type="button"
                          onClick={() => {
                            updateDraftItem(it.draft_id, {
                              cantidad_recibir: Math.max(0, (it.cantidad_recibir || 0) - 1),
                            })
                          }}
                          className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 active:scale-95 flex items-center justify-center font-black cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750"
                          title="Restar 1 unidad"
                        >
                          <Minus className="w-5 h-5" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={it.cantidad_recibir}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            updateDraftItem(it.draft_id, { cantidad_recibir: val })
                          }}
                          className="w-16 text-center font-mono font-black text-xl text-slate-900 dark:text-white bg-transparent outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            soundAlerts.playScanSuccess()
                            updateDraftItem(it.draft_id, {
                              cantidad_recibir: (it.cantidad_recibir || 0) + 1,
                            })
                          }}
                          className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 flex items-center justify-center font-black cursor-pointer shadow-md"
                          title="Sumar 1 unidad"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Botón de llenado rápido de cantidad ordenada */}
                    {it.cantidad_ordenada > 0 && it.cantidad_recibir !== it.cantidad_ordenada && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            soundAlerts.playScanSuccess()
                            updateDraftItem(it.draft_id, { cantidad_recibir: it.cantidad_ordenada })
                            toast.success("Cantidad asignada", `${it.cantidad_ordenada} un. marcadas como recibidas`)
                          }}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Recibir cantidad completa ({it.cantidad_ordenada} un.)</span>
                        </button>
                      </div>
                    )}

                    {/* Campos de Control: Lote & Vencimiento con Atajos Rápidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Lote de Fábrica *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const autoLote = `L-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(it.product_id).slice(-4)}`
                              updateDraftItem(it.draft_id, { lote: autoLote })
                              toast.success("Lote asignado", autoLote)
                            }}
                            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            Auto Lote
                          </button>
                        </div>
                        <input
                          type="text"
                          value={it.lote}
                          onChange={(e) => {
                            updateDraftItem(it.draft_id, { lote: e.target.value })
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono font-bold focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Fecha Vencimiento *
                          </label>
                          <div className="flex items-center gap-1">
                            {[
                              { label: "+6m", months: 6 },
                              { label: "+1a", months: 12 },
                              { label: "+2a", months: 24 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  const d = new Date()
                                  d.setMonth(d.getMonth() + preset.months)
                                  const iso = d.toISOString().split("T")[0]
                                  updateDraftItem(it.draft_id, { fecha_vencimiento: iso })
                                }}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer"
                                title={`Sumar ${preset.months} meses`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="date"
                          value={it.fecha_vencimiento}
                          onChange={(e) => {
                            updateDraftItem(it.draft_id, { fecha_vencimiento: e.target.value })
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono font-bold focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Barra de Estado de Cantidades y Registro de Averías */}
                    <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        Pedido en OC: <strong className="text-slate-900 dark:text-slate-200 font-mono font-bold">{it.cantidad_ordenada} un.</strong>
                        {hasAveria && (
                          <span className="ml-2 text-rose-600 dark:text-rose-400 font-semibold">
                            (Avería: {it.cantidad_rechazada} un. · {it.motivo_rechazo})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAveriaModalDraftId(it.draft_id)
                          setAveriaCantInput(String(it.cantidad_rechazada || 1))
                          setAveriaMotivoInput(it.motivo_rechazo && it.motivo_rechazo !== "Ninguno" ? it.motivo_rechazo : PRESET_AVERIAS[0])
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          hasAveria
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {hasAveria ? "Editar Avería" : "+ Registrar Avería"}
                      </button>
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
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-30 shadow-2xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block uppercase">
                Total a Ingresar
              </span>
              <span className="font-mono font-black text-xl sm:text-2xl text-amber-600 dark:text-amber-400">
                {totalRecibiendo} un.
              </span>
              {totalAverias > 0 && (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                  ({totalAverias} un. en avería)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirmReceipt}
              disabled={confirmingReceipt || totalRecibiendo <= 0}
              className="flex-1 py-4 px-5 rounded-2xl font-black text-base text-slate-950 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {confirmingReceipt ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {confirmingReceipt ? "Guardando en Stock..." : "Confirmar Recepción"}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR AVERÍA / RECHAZO TÉCNICO ────────────────────────── */}
      {averiaModalDraftId !== null && (() => {
        const activeItem = itemsDraft.find((it) => it.draft_id === averiaModalDraftId)
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                      Registrar Avería / Rechazo
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 break-words mt-0.5">
                      {activeItem?.nombre}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAveriaModalDraftId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Cantidad Averiada o Rechazada (Unidades)
                </label>
                <input
                  type="number"
                  min="1"
                  value={averiaCantInput}
                  onChange={(e) => setAveriaCantInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                  Motivo del Rechazo
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_AVERIAS.map((mot) => (
                    <button
                      key={mot}
                      type="button"
                      onClick={() => setAveriaMotivoInput(mot)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        averiaMotivoInput === mot
                          ? "bg-rose-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {mot}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={averiaMotivoInput}
                  onChange={(e) => setAveriaMotivoInput(e.target.value)}
                  placeholder="Otro motivo específico..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                {activeItem && (activeItem.cantidad_rechazada || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      updateDraftItem(averiaModalDraftId, {
                        cantidad_rechazada: 0,
                        motivo_rechazo: "Ninguno",
                      })
                      setAveriaModalDraftId(null)
                      toast.success("Avería eliminada", "El ítem no tiene averías registradas.")
                    }}
                    className="px-4 py-3 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    Quitar Avería
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const cant = Math.max(1, parseInt(averiaCantInput) || 1)
                    updateDraftItem(averiaModalDraftId, {
                      cantidad_rechazada: cant,
                      motivo_rechazo: averiaMotivoInput.trim() || "Mercadería dañada",
                    })
                    setAveriaModalDraftId(null)
                    soundAlerts.playPriceMismatchAlert()
                    toast.warning("Avería Guardada", `${cant} un. registradas como avería/rechazo.`)
                  }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-lg shadow-rose-600/25 cursor-pointer"
                >
                  Guardar Avería
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL: ASIGNACIÓN DE LOTE MASIVO ──────────────────────────────────── */}
      {showBatchLoteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Tag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Asignar Lote Masivo
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Aplica un lote de forma rápida a múltiples productos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchLoteModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                Número de Lote o Remito
              </label>
              <input
                type="text"
                value={batchLoteInput}
                onChange={(e) => setBatchLoteInput(e.target.value)}
                placeholder="Ej. L-2026-SEP-01 o REM-1248"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                ¿A qué productos aplicar?
              </label>
              <div className="space-y-2">
                {[
                  { id: "sin_lote", label: "Solo a productos que NO tienen lote cargado" },
                  { id: "todos", label: "A TODOS los productos de la orden" },
                  { id: "visibles", label: "Solo a los productos actualmente visibles" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <input
                      type="radio"
                      name="batchLoteScope"
                      checked={batchLoteScope === opt.id}
                      onChange={() => setBatchLoteScope(opt.id as any)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchLoteModal(false)}
                className="px-4 py-3.5 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBatchLote}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm text-slate-950 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                Aplicar Lote Masivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ASIGNACIÓN DE VENCIMIENTO MASIVO ───────────────────────────── */}
      {showBatchExpiryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Asignar Vencimiento Masivo
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Aplica la misma fecha de vencimiento a la orden
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchExpiryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Fecha de Vencimiento
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: "+6m", months: 6 },
                    { label: "+1a", months: 12 },
                    { label: "+2a", months: 24 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        d.setMonth(d.getMonth() + preset.months)
                        setBatchExpiryInput(d.toISOString().split("T")[0])
                      }}
                      className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="date"
                value={batchExpiryInput}
                onChange={(e) => setBatchExpiryInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                ¿A qué productos aplicar?
              </label>
              <div className="space-y-2">
                {[
                  { id: "todos", label: "A TODOS los productos de la orden" },
                  { id: "visibles", label: "Solo a los productos actualmente visibles" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <input
                      type="radio"
                      name="batchExpiryScope"
                      checked={batchExpiryScope === opt.id}
                      onChange={() => setBatchExpiryScope(opt.id as any)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchExpiryModal(false)}
                className="px-4 py-3.5 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBatchExpiry}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm text-slate-950 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                Aplicar Vencimiento Masivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INGRESO DE MERCADERÍA EXTRAORDINARIA (FUERA DE OC) ─────────── */}
      {showExtraordinaryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Mercadería Fuera de Orden
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Excepción de muelle con auditoría obligatoria
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExtraordinaryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Buscador de Producto */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                Buscar en Catálogo de Productos
              </label>
              <input
                type="text"
                value={extraSearch}
                onChange={(e) => handleSearchExtraProducts(e.target.value)}
                placeholder="Nombre, código de barras o SKU..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 font-medium"
              />
            </div>

            {/* Resultados de Búsqueda */}
            {searchingExtra ? (
              <div className="text-center py-4 text-xs text-slate-500 font-medium">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-amber-500" />
                Buscando en catálogo...
              </div>
            ) : extraSearchResults.length > 0 && !selectedExtraProduct ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {extraSearchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedExtraProduct(p)
                      setExtraSearchResults([])
                    }}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 cursor-pointer text-xs sm:text-sm space-y-1.5 transition"
                  >
                    <div className="font-extrabold text-slate-900 dark:text-white break-words">{p.nombre}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <Barcode className="w-3 h-3" />
                        {p.codigo_barra ? p.codigo_barra : "Sin EAN"}
                      </span>
                      {p.sku && (
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          SKU: {p.sku}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Producto Seleccionado */}
            {selectedExtraProduct && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                    Producto Seleccionado
                  </span>
                  <div className="font-black text-sm text-slate-900 dark:text-white break-words">
                    {selectedExtraProduct.nombre}
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Cód: {selectedExtraProduct.codigo_barra || selectedExtraProduct.sku || "Sin código"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExtraProduct(null)}
                  className="text-xs font-bold text-slate-500 hover:text-red-500 p-1 shrink-0"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Cantidad & Lote */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Cantidad (Unidades) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={extraCantidad}
                  onChange={(e) => setExtraCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Lote de Fábrica
                </label>
                <input
                  type="text"
                  value={extraLote}
                  onChange={(e) => setExtraLote(e.target.value)}
                  placeholder="Auto si se omite"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Vencimiento & Autorizado Por */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Fecha Vencimiento
                </label>
                <input
                  type="date"
                  value={extraVencimiento}
                  onChange={(e) => setExtraVencimiento(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Autorizado Por *
                </label>
                <input
                  type="text"
                  value={extraAutorizadoPor}
                  onChange={(e) => setExtraAutorizadoPor(e.target.value)}
                  placeholder="Ej. Gerente de Compras"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Motivo de Ingreso Excepcional
              </label>
              <textarea
                rows={2}
                value={extraMotivo}
                onChange={(e) => setExtraMotivo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium"
              />
            </div>

            <button
              type="button"
              onClick={handleAddExtraordinaryItem}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              Agregar a la Descarga de Muelle
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
