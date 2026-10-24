import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Barcode, CheckCircle2, AlertTriangle, Clock, X, Plus, Search,
  Filter, RefreshCw, Eye, UserCheck, ShieldAlert, ArrowRight,
  TrendingDown, TrendingUp, Scale, Check, Layers, ChevronRight, AlertCircle, Sparkles,
  ClipboardList, Users, Shield, ShieldCheck, ArrowLeft, Send,
  Printer, Building2, Tag, FileSpreadsheet, Loader2, Trash2
} from "lucide-react"
import {
  api,
  type PhysicalSession,
  type PhysicalSessionItem,
  type Warehouse as WarehouseType,
  type Product,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime } from "../../utils/format"
import SupplierSearchInput from "../../components/SupplierSearchInput"
import PlanillaConteoA4Modal from "./PlanillaConteoA4Modal"

interface TomaFisicaTabProps {
  warehouses: WarehouseType[]
  products: Product[]
  onGoToAdjustments?: () => void
}

const ESTADO_SESSION_CONFIG: Record<string, { label: string; bg: string; icon: any }> = {
  abierta: {
    label: "Abierta / Por Iniciar",
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Clock,
  },
  en_conteo: {
    label: "En Conteo Doble Ciego",
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Barcode,
  },
  cerrada: {
    label: "Cerrada & Ajuste Generado",
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  cancelada: {
    label: "Cancelada",
    bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    icon: AlertCircle,
  },
}

interface AdditiveCountCellProps {
  currentValue: number | null | undefined
  disabled?: boolean
  colorScheme: "emerald" | "purple"
  onSave: (newTotal: number) => Promise<void> | void
}

function AdditiveCountCell({
  currentValue,
  disabled,
  colorScheme,
  onSave,
}: AdditiveCountCellProps) {
  const [val, setVal] = useState("")
  const [saving, setSaving] = useState(false)
  const currentNum = currentValue != null ? Number(currentValue) : null

  // Cálculo en vivo del nuevo valor según lo tipeado
  const preview = useMemo(() => {
    const raw = val.trim().replace(",", ".")
    if (!raw) return null
    const base = currentNum ?? 0

    if (raw.startsWith("+")) {
      const added = parseFloat(raw.slice(1))
      if (isNaN(added)) return null
      return {
        type: "add" as const,
        newTotal: base + added,
        text: `${base} + ${added}`,
      }
    }
    if (raw.startsWith("-")) {
      const sub = parseFloat(raw.slice(1))
      if (isNaN(sub)) return null
      const res = Math.max(0, base - sub)
      return {
        type: "sub" as const,
        newTotal: res,
        text: `${base} - ${sub}`,
      }
    }
    // Soporte para sumas tipo "10+5"
    if (raw.includes("+")) {
      const parts = raw.split("+").map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p))
      if (parts.length > 0) {
        const sum = parts.reduce((a, b) => a + b, 0)
        return {
          type: "expr" as const,
          newTotal: sum,
          text: `Suma: ${sum}`,
        }
      }
    }
    // Número plano directo: fija el total
    const num = parseFloat(raw)
    if (!isNaN(num)) {
      return {
        type: "set" as const,
        newTotal: num,
        text: `Fijar total`,
      }
    }
    return null
  }, [val, currentNum])

  const commitValue = async (targetTotal: number) => {
    if (disabled || saving) return
    setSaving(true)
    try {
      await onSave(targetTotal)
      setVal("")
    } finally {
      setSaving(false)
    }
  }

  const handleApply = () => {
    if (!preview) return
    commitValue(preview.newTotal)
  }

  const handleQuickAdd = (increment: number) => {
    const base = currentNum ?? 0
    commitValue(base + increment)
  }

  const themeColors = colorScheme === "emerald"
    ? {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        btn: "hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
        preview: "text-emerald-600 dark:text-emerald-400",
      }
    : {
        badge: "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
        btn: "hover:bg-purple-100 text-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/50",
        preview: "text-purple-600 dark:text-purple-400",
      }

  return (
    <div className="flex flex-col items-end gap-1 min-w-[210px]">
      {/* Fila superior: Badge de Acumulado Actual + Input Aditivo */}
      <div className="flex items-center gap-1.5 w-full justify-end">
        {/* Badge acumulado en vivo */}
        <div
          className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-black shrink-0 transition-all ${
            currentNum != null
              ? themeColors.badge
              : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
          }`}
          title="Cantidad acumulada actualmente para este contador"
        >
          {currentNum != null ? (
            <span className="flex items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Total:</span>
              <span className="text-xs">{currentNum}</span>
            </span>
          ) : (
            <span className="text-[10px] italic">0 un</span>
          )}
        </div>

        {/* Input aditivo */}
        <div className="relative">
          <input
            type="text"
            disabled={disabled || saving}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleApply()
              }
            }}
            placeholder="+10 o total"
            className="input-field text-xs font-mono font-bold text-right py-1 px-2 w-24 pr-6 focus:ring-2 focus:ring-emerald-500"
          />
          {val && (
            <button
              type="button"
              onClick={handleApply}
              disabled={disabled || saving}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-700 font-black text-xs p-0.5"
              title="Guardar nuevo total (Enter)"
            >
              ✓
            </button>
          )}
        </div>
      </div>

      {/* Fila inferior: Vista previa en vivo o botones de suma rápida */}
      <div className="flex items-center justify-between w-full text-[10px]">
        {preview ? (
          <span className={`font-mono font-bold ${themeColors.preview} animate-pulse pl-1`}>
            {preview.text} ➔ <strong>{preview.newTotal}</strong>
          </span>
        ) : (
          <span className="text-[9px] text-slate-400 pl-1">
            {currentNum != null ? "Escribí +N para sumar" : "Sin conteo"}
          </span>
        )}

        {/* Botones de incremento rápido */}
        {!disabled && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickAdd(1)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${themeColors.btn}`}
              title="Sumar +1 unidad al acumulado"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(6)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${themeColors.btn}`}
              title="Sumar +6 unidades (medio fardo)"
            >
              +6
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(12)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${themeColors.btn}`}
              title="Sumar +12 unidades (fardo/caja)"
            >
              +12
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TomaFisicaTab({ warehouses, products, onGoToAdjustments }: TomaFisicaTabProps) {
  const { user } = useAuth()
  const toast = useToast()

  // Lista de sesiones
  const [sessions, setSessions] = useState<PhysicalSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  // Catálogos para filtros y creación por proveedor/sector
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Filtros de listado
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [filterSupplier, setFilterSupplier] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Sesión Activa / Seleccionada para Conteo
  const [activeSession, setActiveSession] = useState<PhysicalSession | null>(null)
  const [loadingActiveSession, setLoadingActiveSession] = useState(false)

  // Modo de visualización en la planilla de conteo
  // "contador1" | "contador2" | "supervisor"
  const [countMode, setCountMode] = useState<"contador1" | "contador2" | "supervisor">("contador1")
  const [itemSearch, setItemSearch] = useState("")
  const [filterDiscrepanciesOnly, setFilterDiscrepanciesOnly] = useState(false)

  // Modal Nueva Toma Física (Wizard)
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [newWhId, setNewWhId] = useState("")
  const [newTipo, setNewTipo] = useState<"proveedor" | "sector" | "total" | "parcial" | "ciclico">("proveedor")
  const [newSupplierId, setNewSupplierId] = useState("")
  const [newCategoriaId, setNewCategoriaId] = useState("")
  const [newPasillo, setNewPasillo] = useState("")
  const [newDescripcion, setNewDescripcion] = useState("")
  const [newContador1, setNewContador1] = useState("")
  const [newContador2, setNewContador2] = useState("")
  const [newNotas, setNewNotas] = useState("")
  const [submittingNew, setSubmittingNew] = useState(false)

  // Categorías del proveedor seleccionado para Toma Física
  const [supplierCategories, setSupplierCategories] = useState<{
    id: string
    nombre: string
    codigo?: string | null
    total_productos: number
  }[]>([])
  const [loadingSupplierCategories, setLoadingSupplierCategories] = useState(false)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("")

  // Carga reactiva de categorías cuando se selecciona un proveedor
  useEffect(() => {
    if (!newSupplierId || newTipo !== "proveedor") {
      setSupplierCategories([])
      setSelectedCategoryIds([])
      setCategoryFilterSearch("")
      return
    }

    let active = true
    setLoadingSupplierCategories(true)
    api.inventory.physicalSessions
      .getSupplierCategories(newSupplierId)
      .then((cats) => {
        if (!active) return
        const list = Array.isArray(cats) ? cats : []
        setSupplierCategories(list)
        // Por defecto, todas seleccionadas para conveniencia del conteo
        setSelectedCategoryIds(list.map((c) => c.id))
      })
      .catch((err) => {
        if (!active) return
        console.error("Error al cargar categorías del proveedor:", err)
        setSupplierCategories([])
        setSelectedCategoryIds([])
      })
      .finally(() => {
        if (active) setLoadingSupplierCategories(false)
      })

    return () => {
      active = false
    }
  }, [newSupplierId, newTipo])

  // Modal Planilla Imprimible de Conteo Físico A4
  const [printModalSession, setPrintModalSession] = useState<PhysicalSession | null>(null)

  // Modal Reconciliación de Ítem
  const [reconcileTarget, setReconcileTarget] = useState<PhysicalSessionItem | null>(null)
  const [reconcileQty, setReconcileQty] = useState<number>(0)
  const [reconcileNote, setReconcileNote] = useState("")
  const [submittingReconcile, setSubmittingReconcile] = useState(false)

  // Modal Cierre de Sesión
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closingSession, setClosingSession] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  // Escáner rápido
  const [scannerCode, setScannerCode] = useState("")
  const scannerInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // CARGA DE PROVEEDORES Y CATEGORÍAS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    api.purchases.listSuppliers()
      .then((res: any) => {
        if (!cancelled && Array.isArray(res)) setSuppliers(res)
      })
      .catch(() => {})

    api.categories.list()
      .then((res: any) => {
        if (!cancelled && Array.isArray(res)) setCategories(res)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // CARGA DE SESIONES
  // ---------------------------------------------------------------------------
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await api.inventory.physicalSessions.list({
        warehouse_id: filterWarehouse === "all" ? undefined : filterWarehouse,
        estado: filterEstado === "all" ? undefined : filterEstado,
        supplier_id: filterSupplier === "all" ? undefined : filterSupplier,
        categoria_id: filterCategory === "all" ? undefined : filterCategory,
      })
      setSessions(res || [])
    } catch (err: any) {
      toast.error("Error al cargar sesiones de inventario", err.message)
    } finally {
      setLoadingSessions(false)
    }
  }, [filterWarehouse, filterEstado, filterSupplier, filterCategory])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Cargar detalle completo de una sesión
  const openSessionDetail = async (session: PhysicalSession) => {
    setLoadingActiveSession(true)
    try {
      const full = await api.inventory.physicalSessions.get(session.id)
      setActiveSession(full)
      // Si la sesión está cerrada, abrir por defecto en modo supervisor
      if (full.estado === "cerrada") {
        setCountMode("supervisor")
      }
    } catch (err: any) {
      toast.error("Error al cargar planilla de conteo", err.message)
    } finally {
      setLoadingActiveSession(false)
    }
  }
  // Impresión directa de sesión desde la tabla principal (A4)
  const directPrintSession = async (session: PhysicalSession) => {
    try {
      const full = await api.inventory.physicalSessions.get(session.id)
      setPrintModalSession(full)
    } catch (err: any) {
      toast.error("Error al cargar planilla para impresión", err.message)
    }
  }

  // Refrescar la sesión activa
  const refreshActiveSession = async () => {
    if (!activeSession) return
    try {
      const full = await api.inventory.physicalSessions.get(activeSession.id)
      setActiveSession(full)
    } catch {
      // silent
    }
  }

  // ---------------------------------------------------------------------------
  // CREACIÓN DE NUEVA TOMA FÍSICA
  // ---------------------------------------------------------------------------
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWhId) {
      toast.error("Seleccione el depósito a inventariar")
      return
    }

    if (newTipo === "proveedor") {
      if (!newSupplierId) {
        toast.error("Seleccione el proveedor a inventariar")
        return
      }
      if (supplierCategories.length > 0 && selectedCategoryIds.length === 0) {
        toast.error("Debe seleccionar al menos una categoría del proveedor o pulsar 'Todas'")
        return
      }
    }

    if (newTipo === "sector" && !newCategoriaId) {
      toast.error("Seleccione el sector / categoría a inventariar")
      return
    }

    const selectedSup = suppliers.find((s) => s.id === newSupplierId)
    const selectedCat = categories.find((c) => c.id === newCategoriaId)

    // Construir alcance descriptivo
    let alcanceDesc: string | undefined = undefined
    let catNombreParaSesion: string | undefined = undefined
    let catIdParaSesion: string | undefined = undefined
    const isFilteredCats =
      newTipo === "proveedor" &&
      supplierCategories.length > 0 &&
      selectedCategoryIds.length < supplierCategories.length

    if (newTipo === "proveedor") {
      const supNom = selectedSup?.razon_social || selectedSup?.nombre || "Seleccionado"
      const totalCats = supplierCategories.length
      const selCount = selectedCategoryIds.length

      if (totalCats > 0 && selCount > 0 && selCount < totalCats) {
        const selCatObjs = supplierCategories.filter((c) => selectedCategoryIds.includes(c.id))
        const catNames = selCatObjs.map((c) => c.nombre)
        const preview = catNames.slice(0, 3).join(", ")
        const extra = catNames.length > 3 ? ` (+${catNames.length - 3} más)` : ""
        alcanceDesc = `Proveedor: ${supNom} — Categorías: ${preview}${extra} (${selCount}/${totalCats})`
        catNombreParaSesion = selCount === 1 ? selCatObjs[0].nombre : `${selCount} categorías`
        catIdParaSesion = selCount === 1 && selCatObjs[0].id !== "sin_categoria" ? selCatObjs[0].id : undefined
      } else {
        alcanceDesc = `Proveedor: ${supNom} (Catálogo completo)`
        catNombreParaSesion = "Todas las categorías"
      }
    } else if (newTipo === "sector") {
      alcanceDesc = `Sector: ${selectedCat?.nombre || "Seleccionado"}`
      catNombreParaSesion = selectedCat?.nombre
      catIdParaSesion = newCategoriaId
    } else {
      alcanceDesc = newDescripcion.trim() || undefined
    }

    setSubmittingNew(true)
    try {
      const res = await api.inventory.physicalSessions.create({
        warehouse_id: newWhId,
        tipo: newTipo,
        supplier_id: newTipo === "proveedor" ? newSupplierId : undefined,
        supplier_nombre: newTipo === "proveedor" ? (selectedSup?.razon_social || selectedSup?.nombre) : undefined,
        categoria_id: newTipo === "sector" ? newCategoriaId : catIdParaSesion,
        categoria_ids: isFilteredCats ? selectedCategoryIds : undefined,
        categoria_nombre: newTipo === "sector" ? selectedCat?.nombre : catNombreParaSesion,
        pasillo: newPasillo.trim() || undefined,
        descripcion_alcance: alcanceDesc,
        contador_1_nombre: newContador1.trim() || undefined,
        contador_2_nombre: newContador2.trim() || undefined,
        notas: newNotas.trim() || undefined,
      })
      toast.success(
        "Sesión de Toma Física Creada",
        `Código: ${res.codigo}. Se precargaron los productos para el conteo.`
      )
      setShowNewSessionModal(false)
      // reset
      setNewWhId("")
      setNewTipo("proveedor")
      setNewSupplierId("")
      setNewCategoriaId("")
      setSelectedCategoryIds([])
      setSupplierCategories([])
      setCategoryFilterSearch("")
      setNewPasillo("")
      setNewDescripcion("")
      setNewContador1("")
      setNewContador2("")
      setNewNotas("")
      loadSessions()

      // Abrir inmediatamente la nueva sesión para iniciar el conteo
      if (res.id) {
        openSessionDetail(res)
      }
    } catch (err: any) {
      toast.error("Error al crear sesión de toma física", err.message)
    } finally {
      setSubmittingNew(false)
    }
  }

  // ---------------------------------------------------------------------------
  // REGISTRAR CONTEO DE ÍTEM (DOBLE CIEGO)
  // ---------------------------------------------------------------------------
  const handleRegisterCount = async (item: PhysicalSessionItem, countNum: 1 | 2, qty: number) => {
    if (!activeSession) return
    try {
      const updated = await api.inventory.physicalSessions.registerCount(
        activeSession.id,
        item.id,
        { cantidad: qty, numero_conteo: countNum }
      )

      // Actualizar en memoria
      setActiveSession((prev) => {
        if (!prev) return prev
        const copyItems = [...(prev.items || [])]
        const idx = copyItems.findIndex((i) => i.id === item.id)
        if (idx >= 0) {
          copyItems[idx] = updated
        }
        return { ...prev, items: copyItems }
      })

      toast.success(
        `Conteo ${countNum} guardado`,
        `${item.product_nombre}: ${qty} unid.`
      )
    } catch (err: any) {
      toast.error("Error al registrar conteo", err.message)
    }
  }

  // ---------------------------------------------------------------------------
  // RECONCILIAR ÍTEM CON DISCREPANCIA (SUPERVISOR)
  // ---------------------------------------------------------------------------
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSession || !reconcileTarget) return

    setSubmittingReconcile(true)
    try {
      const updated = await api.inventory.physicalSessions.reconcileItem(
        activeSession.id,
        reconcileTarget.id,
        {
          cantidad_final: reconcileQty,
          nota_reconciliacion: reconcileNote.trim() || undefined,
        }
      )

      setActiveSession((prev) => {
        if (!prev) return prev
        const copyItems = [...(prev.items || [])]
        const idx = copyItems.findIndex((i) => i.id === reconcileTarget.id)
        if (idx >= 0) {
          copyItems[idx] = updated
        }
        return { ...prev, items: copyItems }
      })

      toast.success("Ítem Reconciliado", `Cantidad final establecida: ${reconcileQty}`)
      setReconcileTarget(null)
      setReconcileQty(0)
      setReconcileNote("")
    } catch (err: any) {
      toast.error("Error al reconciliar ítem", err.message)
    } finally {
      setSubmittingReconcile(false)
    }
  }

  // ---------------------------------------------------------------------------
  // CIERRE DE SESIÓN AUTOMÁTICO & AJUSTE DE STOCK
  // ---------------------------------------------------------------------------
  const handleCloseSession = async () => {
    if (!activeSession) return

    setClosingSession(true)
    try {
      const res = await api.inventory.physicalSessions.close(activeSession.id)
      toast.success(
        "Toma Física Cerrada Exitosamente",
        `Se generó automáticamente el ajuste de stock. ${res.items_con_diferencia} productos con diferencia.`
      )
      setShowCloseModal(false)
      loadSessions()
      // Recargar sesión cerrada
      const full = await api.inventory.physicalSessions.get(activeSession.id)
      setActiveSession(full)
      setCountMode("supervisor")
    } catch (err: any) {
      toast.error("No se pudo cerrar la sesión", err.message)
    } finally {
      setClosingSession(false)
    }
  }

  // ---------------------------------------------------------------------------
  // ELIMINAR / ANULAR SESIÓN DE CONTEO
  // ---------------------------------------------------------------------------
  const handleDeleteSession = async (session: PhysicalSession) => {
    if (session.estado === "cerrada") {
      toast.error("Acción denegada", "No se puede eliminar una sesión de inventario que ya fue cerrada con ajuste de stock.")
      return
    }

    const confirmMsg = `¿Deseas eliminar permanentemente la toma física #${session.codigo} (${session.warehouse_nombre || "Depósito"})? Se descartarán todos los ítems y conteos registrados.`
    if (!window.confirm(confirmMsg)) return

    setDeletingSessionId(session.id)
    try {
      await api.inventory.physicalSessions.delete(session.id)
      toast.success("Toma física eliminada", `La sesión #${session.codigo} ha sido eliminada.`)
      if (activeSession?.id === session.id) {
        setActiveSession(null)
      }
      loadSessions()
    } catch (err: any) {
      toast.error("Error al eliminar", err.message || "No se pudo eliminar la sesión.")
    } finally {
      setDeletingSessionId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // ESCÁNER RÁPIDO EN PLANILLA
  // ---------------------------------------------------------------------------
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannerCode.trim() || !activeSession) return

    const q = scannerCode.trim().toLowerCase()
    const targetItem = (activeSession.items || []).find((it) => {
      const cb = (it.product_codigo_barra || "").toLowerCase()
      const sku = (it.product_sku || "").toLowerCase()
      return cb === q || sku === q
    })

    if (!targetItem) {
      toast.warning("Producto no encontrado en esta sesión", scannerCode)
      setScannerCode("")
      return
    }

    // Si encontramos el producto, sumar +1 al conteo según el modo activo
    if (countMode === "contador1") {
      const current = Number(targetItem.cantidad_conteo_1 || 0)
      handleRegisterCount(targetItem, 1, current + 1)
    } else if (countMode === "contador2") {
      const current = Number(targetItem.cantidad_conteo_2 || 0)
      handleRegisterCount(targetItem, 2, current + 1)
    } else {
      setItemSearch(targetItem.product_nombre || "")
    }

    setScannerCode("")
  }

  // ---------------------------------------------------------------------------
  // CÁLCULOS & MÉTRICAS DE LA PLANILLA ACTIVA
  // ---------------------------------------------------------------------------
  const sessionStats = useMemo(() => {
    if (!activeSession || !activeSession.items) {
      return {
        total: 0,
        c1Counted: 0,
        c2Counted: 0,
        reconciled: 0,
        discrepancies: 0,
        totalSobrantesGs: 0,
        totalFaltantesGs: 0,
        balanceNetoGs: 0,
        itemsSobrantes: 0,
        itemsFaltantes: 0,
        itemsSinDiferencia: 0,
      }
    }
    const items = activeSession.items
    const total = items.length
    const c1Counted = items.filter((i) => i.cantidad_conteo_1 != null).length
    const c2Counted = items.filter((i) => i.cantidad_conteo_2 != null).length
    const reconciled = items.filter((i) => i.estado === "reconciliado").length
    const discrepancies = items.filter((i) => i.estado === "conteo_2").length

    let totalSobrantesGs = 0
    let totalFaltantesGs = 0
    let itemsSobrantes = 0
    let itemsFaltantes = 0
    let itemsSinDiferencia = 0

    items.forEach((it) => {
      const diff =
        it.diferencia != null
          ? Number(it.diferencia)
          : it.cantidad_final != null
          ? Number(it.cantidad_final) - Number(it.cantidad_sistema)
          : null
      if (diff == null) return

      const costo = Number(it.costo_unitario || 0)
      const impacto = it.impacto_gs != null ? Number(it.impacto_gs) : diff * costo

      if (diff > 0.0001) {
        totalSobrantesGs += Math.abs(impacto)
        itemsSobrantes++
      } else if (diff < -0.0001) {
        totalFaltantesGs += Math.abs(impacto)
        itemsFaltantes++
      } else {
        itemsSinDiferencia++
      }
    })

    const balanceNetoGs = totalSobrantesGs - totalFaltantesGs

    return {
      total,
      c1Counted,
      c2Counted,
      reconciled,
      discrepancies,
      totalSobrantesGs,
      totalFaltantesGs,
      balanceNetoGs,
      itemsSobrantes,
      itemsFaltantes,
      itemsSinDiferencia,
    }
  }, [activeSession])

  // Filtrado de ítems en la planilla
  const filteredItems = useMemo(() => {
    if (!activeSession || !activeSession.items) return []
    let list = activeSession.items

    if (filterDiscrepanciesOnly) {
      list = list.filter((i) => i.estado === "conteo_2")
    }

    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim()
      list = list.filter((i) => {
        const nom = (i.product_nombre || "").toLowerCase()
        const sku = (i.product_sku || "").toLowerCase()
        const cb = (i.product_codigo_barra || "").toLowerCase()
        return nom.includes(q) || sku.includes(q) || cb.includes(q)
      })
    }

    return list
  }, [activeSession, itemSearch, filterDiscrepanciesOnly])

  // Métricas de Sesiones Generales
  const generalMetrics = useMemo(() => {
    const total = sessions.length
    const abiertas = sessions.filter((s) => s.estado === "abierta" || s.estado === "en_conteo").length
    const cerradas = sessions.filter((s) => s.estado === "cerrada").length
    return { total, abiertas, cerradas }
  }, [sessions])

  // ---------------------------------------------------------------------------
  // RENDER: VISTA DE PLANILLA DE CONTEO ACTIVA
  // ---------------------------------------------------------------------------
  if (activeSession) {
    const isClosed = activeSession.estado === "cerrada"

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Barra superior de navegación / Volver al listado */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSession(null)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Sesiones</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {activeSession.codigo}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    ESTADO_SESSION_CONFIG[activeSession.estado]?.bg || "bg-slate-100"
                  }`}
                >
                  {ESTADO_SESSION_CONFIG[activeSession.estado]?.label || activeSession.estado}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-slate-500">
                  Depósito: <strong className="text-slate-800 dark:text-slate-200">{activeSession.warehouse_nombre || "Principal"}</strong> | Tipo:{" "}
                  <span className="uppercase font-bold">{activeSession.tipo}</span>
                </span>
                {activeSession.supplier_nombre && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Building2 className="w-3 h-3" />
                    <span>Proveedor: {activeSession.supplier_nombre}</span>
                  </span>
                )}
                {activeSession.categoria_nombre && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Tag className="w-3 h-3" />
                    <span>Sector: {activeSession.categoria_nombre}</span>
                  </span>
                )}
                {activeSession.pasillo && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    <span>📍 {activeSession.pasillo}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setPrintModalSession(activeSession)}
              className="px-3.5 py-2 text-xs font-black uppercase rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              title="Generar o imprimir planilla oficial de conteo físico en A4"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Imprimir Planilla A4</span>
            </button>

            <button
              onClick={refreshActiveSession}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Refrescar planilla"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Botón Eliminar / Descartar Toma */}
            {!isClosed && (
              <button
                type="button"
                onClick={() => handleDeleteSession(activeSession)}
                disabled={deletingSessionId === activeSession.id}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 dark:text-rose-400 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Eliminar y descartar esta sesión de conteo"
              >
                {deletingSessionId === activeSession.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Eliminar Toma</span>
              </button>
            )}

            {/* Botón Cierre de Sesión */}
            {!isClosed && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="btn-primary flex items-center gap-2 text-xs px-4 py-2 font-extrabold uppercase rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Cerrar Toma & Generar Ajuste</span>
              </button>
            )}

            {isClosed && activeSession.adjustment_id && onGoToAdjustments && (
              <button
                onClick={onGoToAdjustments}
                className="px-4 py-2 text-xs font-extrabold uppercase rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-1.5 transition"
              >
                <Shield className="w-4 h-4" />
                <span>Ver Ajuste en Flujo de Aprobación</span>
              </button>
            )}
          </div>
        </div>

        {/* Progreso del Conteo Doble Ciego */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Total Productos a Contar
            </span>
            <p className="text-xl font-black font-mono text-slate-900 dark:text-white">
              {sessionStats.total}
            </p>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full w-full" />
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 block mb-1">
              Conteo 1 ({activeSession.contador_1_nombre || "Op. 1"})
            </span>
            <p className="text-xl font-black font-mono text-blue-700 dark:text-blue-400">
              {sessionStats.c1Counted} / {sessionStats.total}
            </p>
            <div className="w-full bg-blue-200 dark:bg-blue-900/60 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{
                  width: `${
                    sessionStats.total > 0
                      ? (sessionStats.c1Counted / sessionStats.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-400 block mb-1">
              Conteo 2 Ciego ({activeSession.contador_2_nombre || "Op. 2"})
            </span>
            <p className="text-xl font-black font-mono text-purple-700 dark:text-purple-400">
              {sessionStats.c2Counted} / {sessionStats.total}
            </p>
            <div className="w-full bg-purple-200 dark:bg-purple-900/60 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all"
                style={{
                  width: `${
                    sessionStats.total > 0
                      ? (sessionStats.c2Counted / sessionStats.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block mb-1">
              Discrepancias a Reconciliar
            </span>
            <p className="text-xl font-black font-mono text-amber-700 dark:text-amber-400">
              {sessionStats.discrepancies}
            </p>
            <p className="text-[10px] text-amber-600/80 mt-1">
              {sessionStats.reconciled} auto/reconciliados
            </p>
          </div>
        </div>

        {/* ── BALANCE FINANCIERO: GANANCIAS (SOBRANTES) VS PÉRDIDAS (FALTANTES) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Sobrantes (Ganancia) */}
          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Sobrantes / Ganancia (+)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 font-black">
                {sessionStats.itemsSobrantes} prod.
              </span>
            </div>
            <p className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              +{formatPYG(sessionStats.totalSobrantesGs)}
            </p>
            <p className="text-[11px] text-emerald-600/80">
              Mercadería física detectada por encima del sistema
            </p>
          </div>

          {/* Faltantes (Pérdida) */}
          <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>Faltantes / Pérdida (-)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 font-black">
                {sessionStats.itemsFaltantes} prod.
              </span>
            </div>
            <p className="text-xl font-black font-mono text-rose-700 dark:text-rose-400">
              -{formatPYG(sessionStats.totalFaltantesGs)}
            </p>
            <p className="text-[11px] text-rose-600/80">
              Merma, rotura o desvío de stock a regularizar
            </p>
          </div>

          {/* Balance Neto */}
          <div
            className={`p-3.5 border rounded-2xl shadow-xs space-y-1 ${
              sessionStats.balanceNetoGs > 0
                ? "bg-emerald-100/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                : sessionStats.balanceNetoGs < 0
                ? "bg-rose-100/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Scale className="w-4 h-4 text-slate-500" />
                <span>Balance Financiero Neto</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                  sessionStats.balanceNetoGs > 0
                    ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-300"
                    : sessionStats.balanceNetoGs < 0
                    ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {sessionStats.balanceNetoGs > 0
                  ? "Superávit (+)"
                  : sessionStats.balanceNetoGs < 0
                  ? "Déficit (-)"
                  : "Cuadrado"}
              </span>
            </div>
            <p
              className={`text-xl font-black font-mono ${
                sessionStats.balanceNetoGs > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : sessionStats.balanceNetoGs < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {sessionStats.balanceNetoGs > 0
                ? `+${formatPYG(sessionStats.balanceNetoGs)}`
                : sessionStats.balanceNetoGs < 0
                ? `-${formatPYG(Math.abs(sessionStats.balanceNetoGs))}`
                : "₲ 0"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Impacto final sobre el inventario valorizado
            </p>
          </div>
        </div>

        {/* 🧭 SELECTOR DE PERSPECTIVA: MODO CONTADOR 1 / CONTADOR 2 / SUPERVISOR */}
        <div className="p-2 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase px-3">
              Perspectiva de Conteo:
            </span>

            <button
              onClick={() => setCountMode("contador1")}
              disabled={isClosed}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                countMode === "contador1"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Contador 1 (Primer Conteo)</span>
            </button>

            <button
              onClick={() => setCountMode("contador2")}
              disabled={isClosed}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                countMode === "contador2"
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Contador 2 (Doble Ciego)</span>
            </button>

            <button
              onClick={() => setCountMode("supervisor")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                countMode === "supervisor"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Supervisión & Reconciliación</span>
            </button>
          </div>

          {/* Banner explicativo del modo activo */}
          <div className="text-[11px] font-semibold text-slate-500 pr-3 hidden lg:block">
            {countMode === "contador1" &&
              "Modo Contador 1: Ingreso ciego. No ve el stock del sistema."}
            {countMode === "contador2" &&
              "Modo Doble Ciego: No ve ni el stock del sistema ni los números del Contador 1."}
            {countMode === "supervisor" &&
              "Modo Supervisión: Muestra ambos conteos, detecta desvíos y stock del sistema."}
          </div>
        </div>

        {/* Barra de Búsqueda & Escaneo Rápido */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <form
            onSubmit={handleScannerSubmit}
            className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md"
          >
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={scannerInputRef}
                type="text"
                value={scannerCode}
                onChange={(e) => setScannerCode(e.target.value)}
                placeholder="Pistoleá el código de barras o SKU para contar (+1)..."
                className="input-field pl-9 py-2 text-xs font-mono font-bold w-full"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              Contar
            </button>
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Filtrar planilla..."
                className="input-field pl-8 py-2 text-xs w-full"
              />
            </div>

            {countMode === "supervisor" && (
              <button
                onClick={() => setFilterDiscrepanciesOnly((prev) => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  filterDiscrepanciesOnly
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                Solo Discrepancias ({sessionStats.discrepancies})
              </button>
            )}
          </div>
        </div>

        {/* ── PLANILLA DE CONTEO ────────────────────────────────────────────── */}
        <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Código / SKU</th>
                  <th className="p-3.5">Producto</th>

                  {/* En modo supervisor mostramos stock sistema */}
                  {countMode === "supervisor" && (
                    <th className="p-3.5 text-right whitespace-nowrap">Stock Sistema</th>
                  )}

                  {/* Modo Contador 1 */}
                  {countMode === "contador1" && (
                    <th className="p-3.5 text-right w-64 whitespace-nowrap">Conteo 1 (Físico Aditivo)</th>
                  )}

                  {/* Modo Contador 2 */}
                  {countMode === "contador2" && (
                    <th className="p-3.5 text-right w-64 whitespace-nowrap">Conteo 2 (Físico Ciego Aditivo)</th>
                  )}

                  {/* Modo Supervisor muestra ambos */}
                  {countMode === "supervisor" && (
                    <>
                      <th className="p-3.5 text-right whitespace-nowrap">Conteo 1</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Conteo 2</th>
                      <th className="p-3.5 text-center whitespace-nowrap">Cotejo Ciego</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Cantidad Final</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Diferencia</th>
                      <th className="p-3.5 text-right whitespace-nowrap w-40 min-w-[140px]">Impacto Gs.</th>
                      <th className="p-3.5 text-center whitespace-nowrap">Acción</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredItems.map((item) => {
                  const hasC1 = item.cantidad_conteo_1 != null
                  const hasC2 = item.cantidad_conteo_2 != null
                  const isMatch =
                    hasC1 &&
                    hasC2 &&
                    Math.abs(Number(item.cantidad_conteo_1) - Number(item.cantidad_conteo_2)) < 0.001
                  const isDiscrepancy = hasC1 && hasC2 && !isMatch

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Código / SKU */}
                      <td className="p-3.5 font-mono font-bold text-slate-600 dark:text-slate-300">
                        {item.product_codigo_barra || item.product_sku || "—"}
                      </td>

                      {/* Producto */}
                      <td className="p-3.5">
                        <p className="font-extrabold text-slate-900 dark:text-white max-w-sm truncate">
                          {item.product_nombre}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.product_sku || "—"}
                        </p>
                      </td>

                      {/* Stock Sistema (Solo visible en Supervisor) */}
                      {countMode === "supervisor" && (
                        <td className="p-3.5 text-right font-mono text-slate-500 font-bold">
                          {item.cantidad_sistema}
                        </td>
                      )}

                      {/* Input Contador 1 */}
                      {countMode === "contador1" && (
                        <td className="p-3.5 text-right">
                          <AdditiveCountCell
                            currentValue={item.cantidad_conteo_1}
                            disabled={isClosed}
                            colorScheme="emerald"
                            onSave={(newTotal) => handleRegisterCount(item, 1, newTotal)}
                          />
                        </td>
                      )}

                      {/* Input Contador 2 */}
                      {countMode === "contador2" && (
                        <td className="p-3.5 text-right">
                          <AdditiveCountCell
                            currentValue={item.cantidad_conteo_2}
                            disabled={isClosed}
                            colorScheme="purple"
                            onSave={(newTotal) => handleRegisterCount(item, 2, newTotal)}
                          />
                        </td>
                      )}

                      {/* Columnas Supervisor */}
                      {countMode === "supervisor" && (
                        <>
                          <td className="p-3.5 text-right font-mono font-bold text-blue-600">
                            {item.cantidad_conteo_1 ?? "—"}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-purple-600">
                            {item.cantidad_conteo_2 ?? "—"}
                          </td>

                          {/* Cotejo Ciego */}
                          <td className="p-3.5 text-center">
                            {!hasC1 || !hasC2 ? (
                              <span className="text-[10px] text-slate-400 italic">
                                Incompleto
                              </span>
                            ) : isMatch ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Coincide</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Discrepancia</span>
                              </span>
                            )}
                          </td>

                          {/* Cantidad Final */}
                          <td className="p-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                            {item.cantidad_final != null ? item.cantidad_final : "—"}
                          </td>

                          {/* Diferencia */}
                          <td
                            className={`p-3.5 text-right font-mono font-black ${
                              item.diferencia == null
                                ? "text-slate-400"
                                : Number(item.diferencia) === 0
                                ? "text-slate-400"
                                : Number(item.diferencia) > 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {item.diferencia != null ? (
                              Number(item.diferencia) > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold uppercase">
                                    Sob
                                  </span>
                                  +{item.diferencia}
                                </span>
                              ) : Number(item.diferencia) < 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 font-bold uppercase">
                                    Falt
                                  </span>
                                  {item.diferencia}
                                </span>
                              ) : (
                                "0"
                              )
                            ) : (
                              "—"
                            )}
                          </td>

                          {/* Impacto Financiero Gs. */}
                          <td className="p-3.5 text-right font-mono font-black whitespace-nowrap w-40 min-w-[140px]">
                            {item.diferencia != null ? (
                              Number(item.diferencia) > 0 ? (
                                <div className="flex flex-col items-end whitespace-nowrap">
                                  <span className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm whitespace-nowrap">
                                    +{formatPYG(
                                      Math.abs(
                                        Number(
                                          item.impacto_gs != null
                                            ? item.impacto_gs
                                            : Number(item.diferencia) * Number(item.costo_unitario || 0)
                                        )
                                      )
                                    )}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-600/80 uppercase whitespace-nowrap">
                                    Ganancia (+)
                                  </span>
                                </div>
                              ) : Number(item.diferencia) < 0 ? (
                                <div className="flex flex-col items-end whitespace-nowrap">
                                  <span className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm whitespace-nowrap">
                                    -{formatPYG(
                                      Math.abs(
                                        Number(
                                          item.impacto_gs != null
                                            ? item.impacto_gs
                                            : Number(item.diferencia) * Number(item.costo_unitario || 0)
                                        )
                                      )
                                    )}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-rose-600/80 uppercase whitespace-nowrap">
                                    Pérdida (-)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-medium text-xs whitespace-nowrap">₲ 0</span>
                              )
                            ) : (
                              <span className="text-slate-400 whitespace-nowrap">—</span>
                            )}
                          </td>

                          {/* Acción Reconciliar */}
                          <td className="p-3.5 text-center">
                            {!isClosed && isDiscrepancy && (
                              <button
                                onClick={() => {
                                  setReconcileTarget(item)
                                  setReconcileQty(Number(item.cantidad_conteo_1 || 0))
                                }}
                                className="px-2 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition"
                              >
                                Reconciliar
                              </button>
                            )}
                            {item.nota_reconciliacion && (
                              <span
                                className="block text-[10px] text-slate-400 italic truncate max-w-[120px]"
                                title={item.nota_reconciliacion}
                              >
                                {item.nota_reconciliacion}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MODAL RECONCILIACIÓN SUPERVISOR ─────────────────────────────────── */}
        {reconcileTarget &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 bg-amber-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    <h4 className="font-extrabold text-sm">Reconciliación de Discrepancia</h4>
                  </div>
                  <button
                    onClick={() => setReconcileTarget(null)}
                    className="p-1 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleReconcileSubmit} className="p-5 space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs space-y-1">
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {reconcileTarget.product_nombre}
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Stock Sistema</span>
                        <span className="font-bold">{reconcileTarget.cantidad_sistema}</span>
                      </div>
                      <div className="text-blue-600">
                        <span className="text-[10px] text-slate-400 block">Conteo 1</span>
                        <span className="font-bold">{reconcileTarget.cantidad_conteo_1}</span>
                      </div>
                      <div className="text-purple-600">
                        <span className="text-[10px] text-slate-400 block">Conteo 2</span>
                        <span className="font-bold">{reconcileTarget.cantidad_conteo_2}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cantidad Final Arbitrada *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={reconcileQty}
                      onChange={(e) => setReconcileQty(parseFloat(e.target.value) || 0)}
                      className="input-field text-sm font-mono font-bold py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nota / Justificación del Supervisor
                    </label>
                    <textarea
                      value={reconcileNote}
                      onChange={(e) => setReconcileNote(e.target.value)}
                      rows={2}
                      placeholder="Motivo de la resolución (ej. re-verificado en góndola)..."
                      className="input-field text-xs py-2 w-full resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReconcileTarget(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReconcile}
                      className="btn-primary px-5 py-2 text-xs font-extrabold uppercase rounded-xl shadow-sm"
                    >
                      {submittingReconcile ? "Guardando..." : "Confirmar Cantidad Final"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* ── MODAL CONFIRMACIÓN CIERRE DE SESIÓN ─────────────────────────────── */}
        {showCloseModal &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <h4 className="font-extrabold text-sm">Cerrar Sesión de Toma Física</h4>
                  </div>
                  <button
                    onClick={() => setShowCloseModal(false)}
                    className="p-1 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Al cerrar esta sesión de toma física:
                  </p>
                  <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 list-disc pl-5">
                    <li>Se congelarán definitivamente los conteos registrados.</li>
                    <li>
                      El sistema <strong>generará automáticamente un Ajuste de Stock</strong> con
                      todos los productos que presenten diferencias.
                    </li>
                    <li>
                      El ajuste pasará al flujo de{" "}
                      <strong>Doble Aprobación (Gerencia y Administración)</strong> antes de
                      impactar el Kardex y stock real.
                    </li>
                  </ul>

                  {sessionStats.discrepancies > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <strong>Atención:</strong> Aún quedan {sessionStats.discrepancies} productos con
                      discrepancia sin reconciliar. Si cierra ahora, se tomará el último conteo
                      válido.
                    </div>
                  )}

                  {/* Resumen Financiero Pre-Cierre */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                      Balance Financiero a Registrar:
                    </span>
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>Sobrantes / Ganancia (+):</span>
                      <span className="font-mono font-black">
                        +{formatPYG(sessionStats.totalSobrantesGs)} ({sessionStats.itemsSobrantes} prod.)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold">
                      <span>Faltantes / Pérdida (-):</span>
                      <span className="font-mono font-black">
                        -{formatPYG(sessionStats.totalFaltantesGs)} ({sessionStats.itemsFaltantes} prod.)
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-black">
                      <span>Impacto Financiero Neto:</span>
                      <span
                        className={`font-mono text-sm ${
                          sessionStats.balanceNetoGs > 0
                            ? "text-emerald-600"
                            : sessionStats.balanceNetoGs < 0
                            ? "text-rose-600"
                            : "text-slate-500"
                        }`}
                      >
                        {sessionStats.balanceNetoGs > 0
                          ? `+${formatPYG(sessionStats.balanceNetoGs)}`
                          : sessionStats.balanceNetoGs < 0
                          ? `-${formatPYG(Math.abs(sessionStats.balanceNetoGs))}`
                          : "₲ 0"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCloseModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Continuar Contando
                    </button>
                    <button
                      type="button"
                      disabled={closingSession}
                      onClick={handleCloseSession}
                      className="btn-primary px-5 py-2 text-xs font-extrabold uppercase rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                    >
                      {closingSession ? "Cerrando..." : "Confirmar Cierre & Generar Ajuste"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* ── MODAL / PLANILLA DE CONTEO FÍSICO IMPRIMIBLE A4 ───────────────── */}
        {printModalSession && (
          <PlanillaConteoA4Modal
            session={printModalSession}
            onClose={() => setPrintModalSession(null)}
          />
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: DASHBOARD DE SESIONES DE TOMA FÍSICA
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── KPI METRICS CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Tomas Físicas</span>
            <ClipboardList className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {generalMetrics.total}
          </p>
          <p className="text-[11px] text-slate-400">Sesiones registradas en el supermercado</p>
        </div>

        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span>Sesiones Activas / En Conteo</span>
            <Barcode className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
            {generalMetrics.abiertas}
          </p>
          <p className="text-[11px] text-amber-600/80">Planillas de conteo doble ciego en curso</p>
        </div>

        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span>Sesiones Concluidas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
            {generalMetrics.cerradas}
          </p>
          <p className="text-[11px] text-emerald-600/80">Cerradas con ajuste generado</p>
        </div>
      </div>

      {/* ── TOOLBAR DE ACCIONES & FILTROS ────────────────────────────────────── */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Buscar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sesión por código o depósito..."
              className="input-field pl-9 py-2 text-xs w-full"
            />
          </div>

          {/* Depósito */}
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">Todos los depósitos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nombre} ({w.codigo})
              </option>
            ))}
          </select>

          {/* Proveedor */}
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="input-field text-xs py-2 max-w-[220px]"
          >
            <option value="all">🏭 Todos los proveedores</option>
            {suppliers.filter((s) => (s.total_productos || 0) > 0).length > 0 && (
              <optgroup label={`📦 Con Mercaderías (${suppliers.filter((s) => (s.total_productos || 0) > 0).length})`}>
                {suppliers
                  .filter((s) => (s.total_productos || 0) > 0)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razon_social || s.nombre} ({s.total_productos} prods)
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label={`📋 Otros Proveedores (${suppliers.filter((s) => (s.total_productos || 0) === 0).length})`}>
              {suppliers
                .filter((s) => (s.total_productos || 0) === 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.razon_social || s.nombre}
                  </option>
                ))}
            </optgroup>
          </select>

          {/* Sector / Categoría */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-field text-xs py-2 max-w-[170px]"
          >
            <option value="all">Todos los sectores</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">Todos los estados</option>
            <option value="abierta">Abierta</option>
            <option value="en_conteo">En Conteo</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={loadSessions}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSessions ? "animate-spin" : ""}`} />
          </button>

          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const target = sessions[0]
                if (target) directPrintSession(target)
              }}
              className="px-3 py-2.5 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title={`Imprimir Planilla Ciega de la toma física #${sessions[0]?.codigo}`}
            >
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>Imprimir Planilla #{sessions[0]?.codigo}</span>
            </button>
          )}

          <button
            onClick={() => setShowNewSessionModal(true)}
            className="btn-primary flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-extrabold uppercase shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Toma Física</span>
          </button>
        </div>
      </div>

      {/* ── TABLA DE SESIONES DE TOMA FÍSICA ─────────────────────────────────── */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loadingSessions ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500" />
            <p className="font-bold text-xs">Cargando sesiones de toma física...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <ClipboardList className="w-12 h-12 mx-auto opacity-30 text-blue-500" />
            <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
              No hay sesiones de toma física iniciadas
            </p>
            <p className="text-xs">
              Inicie una nueva sesión para habilitar el conteo doble ciego de mercadería en góndola o depósito.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1050px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Código / Fecha</th>
                  <th className="p-3.5 whitespace-nowrap">Depósito & Tipo</th>
                  <th className="p-3.5">Alcance (Proveedor / Sector)</th>
                  <th className="p-3.5">Operadores Asignados</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Total Ítems</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Discrepancias</th>
                  <th className="p-3.5 text-right whitespace-nowrap w-44 min-w-[160px]">Impacto Gs.</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Estado</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {sessions.map((session) => {
                  const estCfg = ESTADO_SESSION_CONFIG[session.estado] || {
                    label: session.estado,
                    bg: "bg-slate-100 text-slate-700",
                    icon: Clock,
                  }
                  const IconEstado = estCfg.icon

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Código & Fecha */}
                      <td className="p-3.5 space-y-0.5">
                        <span className="font-mono font-black text-slate-900 dark:text-white block">
                          {session.codigo}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 inline" />
                          {formatDateTime(session.created_at)}
                        </span>
                      </td>

                      {/* Depósito & Tipo */}
                      <td className="p-3.5">
                        <p className="font-extrabold text-slate-900 dark:text-white">
                          {session.warehouse_nombre || "Depósito"}
                        </p>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                          {session.tipo}
                        </span>
                      </td>

                      {/* Alcance / Proveedor / Sector */}
                      <td className="p-3.5">
                        {session.supplier_nombre ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[160px]">{session.supplier_nombre}</span>
                          </span>
                        ) : session.categoria_nombre ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                            <Tag className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{session.categoria_nombre}</span>
                          </span>
                        ) : session.pasillo ? (
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            📍 {session.pasillo}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Total Depósito</span>
                        )}
                      </td>

                      {/* Operadores */}
                      <td className="p-3.5 text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300">
                        <p>
                          <span className="font-bold text-blue-600">Op 1:</span>{" "}
                          {session.contador_1_nombre || "Sin asignar"}
                        </p>
                        <p>
                          <span className="font-bold text-purple-600">Op 2:</span>{" "}
                          {session.contador_2_nombre || "Sin asignar"}
                        </p>
                      </td>

                      {/* Total Ítems */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {session.total_items || 0}
                      </td>

                      {/* Discrepancias */}
                      <td className="p-3.5 text-right font-mono font-bold">
                        <span
                          className={
                            Number(session.items_con_diferencia || 0) > 0
                              ? "text-rose-600"
                              : "text-slate-400"
                          }
                        >
                          {session.items_con_diferencia || 0}
                        </span>
                      </td>

                      {/* Impacto Financiero Gs. */}
                      <td className="p-3.5 text-right font-mono font-black whitespace-nowrap w-44 min-w-[160px]">
                        {session.diferencia_total_gs != null && Number(session.diferencia_total_gs) !== 0 ? (
                          Number(session.diferencia_total_gs) > 0 ? (
                            <div className="flex flex-col items-end whitespace-nowrap">
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm whitespace-nowrap">
                                +{formatPYG(session.diferencia_total_gs)}
                              </span>
                              <span className="text-[10px] font-extrabold text-emerald-600/80 uppercase whitespace-nowrap">
                                Superávit (+)
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end whitespace-nowrap">
                              <span className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm whitespace-nowrap">
                                -{formatPYG(Math.abs(Number(session.diferencia_total_gs)))}
                              </span>
                              <span className="text-[10px] font-extrabold text-rose-600/80 uppercase whitespace-nowrap">
                                Déficit (-)
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 font-medium text-xs whitespace-nowrap">₲ 0</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${estCfg.bg}`}
                        >
                          <IconEstado className="w-3.5 h-3.5" />
                          <span>{estCfg.label}</span>
                        </span>
                      </td>

                      {/* Acción Abrir Planilla / Imprimir Directo / Eliminar */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => directPrintSession(session)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 transition shadow-2xs hover:scale-105 cursor-pointer"
                            title="Imprimir directamente esta Planilla de Conteo Ciego (A4)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {session.estado !== "cerrada" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(session)}
                              disabled={deletingSessionId === session.id}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800 transition shadow-2xs hover:scale-105 cursor-pointer disabled:opacity-50"
                              title="Eliminar sesión de conteo"
                            >
                              {deletingSessionId === session.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => openSessionDetail(session)}
                            className="btn-primary text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5"
                          >
                            <span>{session.estado === "cerrada" ? "Ver Planilla" : "Entrar a Conteo"}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL WIZARD NUEVA TOMA FÍSICA ───────────────────────────────────── */}
      {showNewSessionModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Cabecera (shrink-0) */}
              <div className="shrink-0 p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between border-b border-emerald-800">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <Barcode className="w-5 h-5" />
                    <span>Iniciar Nueva Toma Física de Inventario</span>
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Protocolo de doble conteo ciego con generación automática de ajuste
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
              <form
                id="form-nueva-toma-fisica"
                onSubmit={handleCreateSession}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {/* Depósito */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Depósito o Salón a Inventariar *
                  </label>
                  <select
                    value={newWhId}
                    onChange={(e) => setNewWhId(e.target.value)}
                    required
                    className="input-field text-xs py-2 w-full"
                  >
                    <option value="">Seleccione depósito...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nombre} ({w.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Toma / Alcance */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alcance del Conteo *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "proveedor", label: "Por Proveedor", icon: Building2 },
                      { id: "sector", label: "Por Sector / Categoría", icon: Tag },
                      { id: "total", label: "Inventario Total", icon: Layers },
                      { id: "parcial", label: "Por Pasillo / Góndola", icon: Filter },
                      { id: "ciclico", label: "Cíclico Rotativo", icon: RefreshCw },
                    ].map((t) => {
                      const Icon = t.icon
                      const isSel = newTipo === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNewTipo(t.id as any)}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 justify-center ${
                            isSel
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Selector específico: Proveedor */}
                {newTipo === "proveedor" && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                    <SupplierSearchInput
                      label="Seleccionar Proveedor a Inventariar"
                      placeholder="Buscar por Razón Social o RUC..."
                      required
                      showTypeToggle
                      showProductCount
                      allowManual={false}
                      soloMercaderia={true}
                      suppliers={suppliers}
                      supplierId={newSupplierId}
                      value={suppliers.find((s) => s.id === newSupplierId)?.razon_social || suppliers.find((s) => s.id === newSupplierId)?.nombre || ""}
                      onSelectSupplier={(res) => {
                        setNewSupplierId(res.id || "")
                      }}
                      onClear={() => {
                        setNewSupplierId("")
                        setSupplierCategories([])
                        setSelectedCategoryIds([])
                      }}
                    />

                    {newSupplierId && (
                      <div className="pt-2 border-t border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Categorías del Proveedor a Inventariar:</span>
                          </label>
                          {!loadingSupplierCategories && supplierCategories.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setSelectedCategoryIds(supplierCategories.map((c) => c.id))}
                                className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/30 font-bold transition cursor-pointer"
                              >
                                Todas ({supplierCategories.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCategoryIds([])}
                                className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-bold transition cursor-pointer"
                              >
                                Ninguna
                              </button>
                            </div>
                          )}
                        </div>

                        {loadingSupplierCategories ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-xs text-amber-700 font-medium">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                            <span>Cargando categorías y productos del proveedor...</span>
                          </div>
                        ) : supplierCategories.length === 0 ? (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                            No se encontraron productos activos asociados a este proveedor en el catálogo.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {supplierCategories.length > 5 && (
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                  type="text"
                                  placeholder="Filtrar categorías..."
                                  value={categoryFilterSearch}
                                  onChange={(e) => setCategoryFilterSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            )}

                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-amber-500/20 shadow-inner">
                              {supplierCategories
                                .filter((c) =>
                                  !categoryFilterSearch.trim() ||
                                  c.nombre.toLowerCase().includes(categoryFilterSearch.toLowerCase()) ||
                                  (c.codigo && c.codigo.toLowerCase().includes(categoryFilterSearch.toLowerCase()))
                                )
                                .map((c) => {
                                  const isChecked = selectedCategoryIds.includes(c.id)
                                  const toggle = () => {
                                    if (isChecked) {
                                      setSelectedCategoryIds((prev) => prev.filter((id) => id !== c.id))
                                    } else {
                                      setSelectedCategoryIds((prev) => [...prev, c.id])
                                    }
                                  }
                                  return (
                                    <div
                                      key={c.id}
                                      onClick={toggle}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition select-none text-xs ${
                                        isChecked
                                          ? "bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 font-bold shadow-2xs"
                                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent opacity-75"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            toggle()
                                          }}
                                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span className="truncate">{c.nombre}</span>
                                        {c.codigo && (
                                          <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-normal">
                                            ({c.codigo})
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 text-[10px] rounded-md font-extrabold shrink-0 ${
                                          isChecked
                                            ? "bg-amber-500 text-white shadow-2xs"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                        }`}
                                      >
                                        {c.total_productos} {c.total_productos === 1 ? "prod." : "prods."}
                                      </span>
                                    </div>
                                  )
                                })}
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                                {selectedCategoryIds.length === supplierCategories.length
                                  ? `Todas las categorías seleccionadas (${supplierCategories.length})`
                                  : `${selectedCategoryIds.length} de ${supplierCategories.length} categorías seleccionadas`}
                              </span>
                              <span className="font-extrabold text-amber-900 dark:text-amber-200">
                                Total: {supplierCategories
                                  .filter((c) => selectedCategoryIds.includes(c.id))
                                  .reduce((acc, c) => acc + c.total_productos, 0)}{" "}
                                productos a inventariar
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Selector específico: Sector / Categoría */}
                {newTipo === "sector" && (
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-extrabold text-blue-800 dark:text-blue-300">
                      Seleccionar Sector o Categoría *
                    </label>
                    <select
                      value={newCategoriaId}
                      onChange={(e) => setNewCategoriaId(e.target.value)}
                      required
                      className="input-field text-xs py-2 w-full bg-white dark:bg-slate-900 font-medium"
                    >
                      <option value="">Elegí un sector / categoría...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.codigo ? `(${c.codigo})` : ""}
                        </option>
                      ))}
                    </select>
                    {newCategoriaId && (
                      <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {products.filter((p) => p.categoria_id === newCategoriaId).length} productos en este sector en catálogo.
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Pasillo o Sector puntual */}
                {(newTipo === "parcial" || newTipo === "ciclico") && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Pasillo, Sector o Góndola Específica
                    </label>
                    <input
                      type="text"
                      value={newPasillo}
                      onChange={(e) => setNewPasillo(e.target.value)}
                      placeholder="Ej. Pasillo 3 - Lácteos y Refrigerados"
                      className="input-field text-xs py-2 w-full"
                    />
                  </div>
                )}

                {/* Operadores Asignados para Conteo Doble Ciego */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                      Contador 1 (Nombre)
                    </label>
                    <input
                      type="text"
                      value={newContador1}
                      onChange={(e) => setNewContador1(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="input-field text-xs py-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
                      Contador 2 Ciego (Nombre)
                    </label>
                    <input
                      type="text"
                      value={newContador2}
                      onChange={(e) => setNewContador2(e.target.value)}
                      placeholder="Ej. María Gómez"
                      className="input-field text-xs py-2 w-full"
                    />
                  </div>
                </div>

                {/* Notas / Instrucciones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notas u Observaciones Operativas
                  </label>
                  <textarea
                    value={newNotas}
                    onChange={(e) => setNewNotas(e.target.value)}
                    rows={2}
                    placeholder="Instrucciones para los operadores de piso..."
                    className="input-field text-xs py-2 w-full resize-none"
                  />
                </div>
              </form>

              {/* Pie de Acciones Fijo (shrink-0) */}
              <div className="shrink-0 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  form="form-nueva-toma-fisica"
                  type="submit"
                  disabled={submittingNew}
                  className="btn-primary px-6 py-2.5 text-xs font-extrabold uppercase rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingNew ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando...</span>
                    </>
                  ) : (
                    <>
                      <Barcode className="w-4 h-4" />
                      <span>Crear e Iniciar Toma Física</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── MODAL / PLANILLA DE CONTEO FÍSICO IMPRIMIBLE A4 ───────────────── */}
      {printModalSession && (
        <PlanillaConteoA4Modal
          session={printModalSession}
          onClose={() => setPrintModalSession(null)}
        />
      )}
    </div>
  )
}
