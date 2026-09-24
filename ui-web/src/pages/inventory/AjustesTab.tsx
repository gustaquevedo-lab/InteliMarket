import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import {
  ShieldAlert, ShieldCheck, AlertCircle, CheckCircle2, Clock, X,
  Plus, Search, Filter, RefreshCw, FileText, UploadCloud, Trash2,
  ExternalLink, Eye, ChevronRight, Check, AlertTriangle, ArrowRight,
  TrendingDown, TrendingUp, Layers, HelpCircle, UserCheck, Shield
} from "lucide-react"
import {
  api,
  type InventoryAdjustmentRecord,
  type AdjustmentMotivo,
  type AdjustmentAuditLog,
  type Warehouse as WarehouseType,
  type Product,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime } from "../../utils/format"

interface AjustesTabProps {
  warehouses: WarehouseType[]
  products: Product[]
}

const RIESGO_CONFIG = {
  bajo: {
    label: "Bajo",
    bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-500 text-white",
  },
  medio: {
    label: "Medio",
    bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    badge: "bg-blue-500 text-white",
  },
  alto: {
    label: "Alto",
    bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    badge: "bg-amber-500 text-white",
  },
  severo: {
    label: "Severo",
    bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    badge: "bg-rose-600 text-white",
  },
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; icon: any }> = {
  pendiente_gerencia: {
    label: "Paso 1: Firma Gerencia",
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  pendiente_administracion: {
    label: "Paso 2: Firma Administración",
    bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    icon: Shield,
  },
  aprobado: {
    label: "Aprobado & Aplicado",
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rechazado: {
    label: "Rechazado",
    bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: AlertCircle,
  },
}

export default function AjustesTab({ warehouses, products }: AjustesTabProps) {
  const { user } = useAuth()
  const toast = useToast()

  // Estados de datos
  const [adjustments, setAdjustments] = useState<InventoryAdjustmentRecord[]>([])
  const [motivos, setMotivos] = useState<AdjustmentMotivo[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [filterRiesgo, setFilterRiesgo] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailAdjustment, setDetailAdjustment] = useState<InventoryAdjustmentRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modales de Acción (Aprobar/Rechazar)
  const [actionTarget, setActionTarget] = useState<{
    adjustment: InventoryAdjustmentRecord
    type: "gerencia" | "administracion" | "rechazar"
  } | null>(null)
  const [actionComment, setActionComment] = useState("")
  const [submittingAction, setSubmittingAction] = useState(false)

  // Formulario de Creación
  const [createWarehouseId, setCreateWarehouseId] = useState("")
  const [createMotivoCodigo, setCreateMotivoCodigo] = useState("")
  const [createMotivoDetalle, setCreateMotivoDetalle] = useState("")
  const [createObservaciones, setCreateObservaciones] = useState("")
  const [createItems, setCreateItems] = useState<
    Array<{
      product: Product
      cantidad_sistema: number
      cantidad_fisica: number
      costo_unitario: number
      diferencia: number
      impacto_gs: number
    }>
  >([])
  const [createEvidenciaUrls, setCreateEvidenciaUrls] = useState<string[]>([])
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false)
  const [submittingCreate, setSubmittingCreate] = useState(false)

  // Buscador de productos dentro del modal de creación
  const [productSearch, setProductSearch] = useState("")
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])

  // ---------------------------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------------------------
  const loadAdjustments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.inventory.listAdjustments({
        warehouse_id: filterWarehouse === "all" ? undefined : filterWarehouse,
        estado: filterEstado === "all" ? undefined : filterEstado,
        riesgo: filterRiesgo === "all" ? undefined : filterRiesgo,
        limit: 100,
      })
      setAdjustments(res || [])
    } catch (e: any) {
      toast.error("Error al cargar ajustes", e.message)
    } finally {
      setLoading(false)
    }
  }, [filterWarehouse, filterEstado, filterRiesgo])

  const loadMotivos = useCallback(async () => {
    try {
      const res = await api.inventory.getAdjustmentMotivos()
      setMotivos(res || [])
    } catch {
      // fallback
    }
  }, [])

  useEffect(() => {
    loadAdjustments()
  }, [loadAdjustments])

  useEffect(() => {
    loadMotivos()
  }, [loadMotivos])

  // Motivo seleccionado actual en el form de creación
  const selectedMotivoInfo = useMemo(() => {
    return motivos.find((m) => m.codigo === createMotivoCodigo)
  }, [motivos, createMotivoCodigo])

  // Cálculo en vivo del impacto total en el formulario
  const totalImpactoEstimado = useMemo(() => {
    return createItems.reduce((acc, item) => acc + Math.abs(item.impacto_gs), 0)
  }, [createItems])

  // Búsqueda de productos en el modal
  useEffect(() => {
    if (!productSearch.trim() || productSearch.length < 2) {
      setProductSearchResults([])
      return
    }
    const q = productSearch.toLowerCase().trim()
    const matches = products
      .filter((p) => {
        const nom = (p.nombre || "").toLowerCase()
        const sku = (p.sku || "").toLowerCase()
        const cb = (p.codigo_barra || "").toLowerCase()
        return nom.includes(q) || sku.includes(q) || cb.includes(q)
      })
      .slice(0, 8)
    setProductSearchResults(matches)
  }, [productSearch, products])

  // Abrir detalle
  const openDetail = async (adj: InventoryAdjustmentRecord) => {
    setLoadingDetail(true)
    setDetailAdjustment(adj)
    try {
      const detail = await api.inventory.getAdjustmentDetail(adj.id)
      setDetailAdjustment(detail)
    } catch (e: any) {
      toast.error("Error al cargar auditoría del ajuste", e.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Subir archivo de evidencia
  const handleUploadEvidencia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingEvidencia(true)
    try {
      const res = await api.inventory.uploadEvidencia(file)
      if (res?.url) {
        setCreateEvidenciaUrls((prev) => [...prev, res.url])
        toast.success("Evidencia adjuntada", file.name)
      }
    } catch (err: any) {
      toast.error("Error al subir archivo de evidencia", err.message)
    } finally {
      setUploadingEvidencia(false)
      e.target.value = ""
    }
  }

  // Agregar ítem al formulario de creación
  const addItemToCreate = async (product: Product) => {
    if (createItems.some((i) => i.product.id === product.id)) {
      toast.warning("El producto ya está en la lista de ajuste")
      return
    }

    let stockSistema = 0
    let costoUnitario = Number(product.costo_promedio || product.ultimo_costo || 0)

    // Intentar consultar el stock real del depósito seleccionado
    if (createWarehouseId) {
      try {
        const stRes = await api.inventory.getProductStock(product.id)
        if (stRes?.stock_by_warehouse) {
          const match = stRes.stock_by_warehouse.find((w: any) => w.warehouse_id === createWarehouseId)
          if (match) {
            stockSistema = Number(match.cantidad || 0)
            if (!costoUnitario && match.costo_unitario) {
              costoUnitario = Number(match.costo_unitario)
            }
          }
        }
      } catch {
        // use defaults
      }
    }

    const cantidadFisica = stockSistema // inicializar con stock sistema para que la diff sea 0 al inicio
    const diff = cantidadFisica - stockSistema
    const impacto = diff * costoUnitario

    setCreateItems((prev) => [
      ...prev,
      {
        product,
        cantidad_sistema: stockSistema,
        cantidad_fisica: cantidadFisica,
        costo_unitario: costoUnitario,
        diferencia: diff,
        impacto_gs: impacto,
      },
    ])
    setProductSearch("")
    setProductSearchResults([])
  }

  // Actualizar cantidad física de un ítem
  const updateItemQty = (index: number, newQty: number) => {
    setCreateItems((prev) => {
      const copy = [...prev]
      const it = copy[index]
      const diff = newQty - it.cantidad_sistema
      const impacto = diff * it.costo_unitario
      copy[index] = {
        ...it,
        cantidad_fisica: newQty,
        diferencia: diff,
        impacto_gs: impacto,
      }
      return copy
    })
  }

  const removeItemFromCreate = (index: number) => {
    setCreateItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Guardar Ajuste
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createWarehouseId) {
      toast.error("Seleccione un depósito")
      return
    }
    if (!createMotivoCodigo) {
      toast.error("Seleccione el motivo del ajuste")
      return
    }
    if (!createMotivoDetalle || createMotivoDetalle.trim().length < 20) {
      toast.error("La justificación debe tener al menos 20 caracteres obligatorios")
      return
    }
    if (createItems.length === 0) {
      toast.error("Debe agregar al menos un producto a ajustar")
      return
    }

    // Validación de evidencia para riesgo alto/severo
    if (selectedMotivoInfo?.requiere_evidencia && createEvidenciaUrls.length === 0) {
      toast.error(
        `El motivo seleccionado tiene riesgo ${selectedMotivoInfo.riesgo.toUpperCase()} y exige al menos una evidencia fotográfica o documental adjunta.`
      )
      return
    }

    setSubmittingCreate(true)
    try {
      await api.inventory.createAdjustment({
        warehouse_id: createWarehouseId,
        motivo_codigo: createMotivoCodigo,
        motivo_detalle: createMotivoDetalle.trim(),
        observaciones: createObservaciones.trim() || undefined,
        evidencia_urls: createEvidenciaUrls.length > 0 ? createEvidenciaUrls : undefined,
        items: createItems.map((it) => ({
          product_id: it.product.id,
          cantidad_sistema: it.cantidad_sistema,
          cantidad_fisica: it.cantidad_fisica,
          costo_unitario: it.costo_unitario,
        })),
      })
      toast.success(
        "Ajuste registrado",
        "Enviado al workflow con estado: Pendiente Firma de Gerencia"
      )
      setShowCreateModal(false)
      // reset form
      setCreateWarehouseId("")
      setCreateMotivoCodigo("")
      setCreateMotivoDetalle("")
      setCreateObservaciones("")
      setCreateItems([])
      setCreateEvidenciaUrls([])
      loadAdjustments()
    } catch (err: any) {
      toast.error("Error al crear ajuste", err.message)
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Ejecutar Acción (Aprobar Gerencia / Aprobar Administración / Rechazar)
  const handleExecuteAction = async () => {
    if (!actionTarget) return

    const { adjustment, type } = actionTarget
    setSubmittingAction(true)

    try {
      if (type === "gerencia") {
        const res = await api.inventory.approveAdjustmentGerencia(adjustment.id, {
          comentario: actionComment.trim() || undefined,
        })
        toast.success("Paso 1 Completado", res.mensaje || "Aprobado por Gerencia")
      } else if (type === "administracion") {
        const res = await api.inventory.approveAdjustmentAdministracion(adjustment.id, {
          comentario: actionComment.trim() || undefined,
        })
        toast.success("Ajuste Aplicado Definitivamente", res.mensaje || "Stock actualizado en Kardex")
      } else if (type === "rechazar") {
        if (!actionComment.trim() || actionComment.trim().length < 10) {
          toast.error("El motivo de rechazo debe contener al menos 10 caracteres")
          setSubmittingAction(false)
          return
        }
        const res = await api.inventory.rejectAdjustment(adjustment.id, {
          motivo_rechazo: actionComment.trim(),
        })
        toast.info("Ajuste Rechazado", res.mensaje || "El ajuste ha sido cancelado definitivamente")
      }

      setActionTarget(null)
      setActionComment("")
      if (detailAdjustment?.id === adjustment.id) {
        setDetailAdjustment(null)
      }
      loadAdjustments()
    } catch (err: any) {
      toast.error("Error al procesar acción", err.message)
    } finally {
      setSubmittingAction(false)
    }
  }

  // Filtrado en memoria por texto
  const filteredAdjustments = useMemo(() => {
    if (!searchTerm.trim()) return adjustments
    const q = searchTerm.toLowerCase().trim()
    return adjustments.filter((a) => {
      const cod = (a.codigo || "").toLowerCase()
      const mot = (a.motivo_label || a.motivo || "").toLowerCase()
      const det = (a.motivo_detalle || "").toLowerCase()
      const wh = (a.warehouse_nombre || "").toLowerCase()
      return cod.includes(q) || mot.includes(q) || det.includes(q) || wh.includes(q)
    })
  }, [adjustments, searchTerm])

  // Métricas
  const metrics = useMemo(() => {
    const total = adjustments.length
    const pGerencia = adjustments.filter((a) => a.estado === "pendiente_gerencia").length
    const pAdmin = adjustments.filter((a) => a.estado === "pendiente_administracion").length
    const aprobados = adjustments.filter((a) => a.estado === "aprobado").length
    const impactoTotalPendiente = adjustments
      .filter((a) => a.estado === "pendiente_gerencia" || a.estado === "pendiente_administracion")
      .reduce((acc, a) => acc + Math.abs(Number(a.impacto_financiero_gs || 0)), 0)

    return { total, pGerencia, pAdmin, aprobados, impactoTotalPendiente }
  }, [adjustments])

  return (
    <div className="space-y-6">
      {/* ── KPI METRICS CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Ajustes</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {metrics.total}
          </p>
          <p className="text-[11px] text-slate-400">Historial completo en sistema</p>
        </div>

        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span>Firma Gerencia</span>
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
            {metrics.pGerencia}
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80">
            Pendientes de Paso 1
          </p>
        </div>

        <div className="p-4 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400">
            <span>Firma Administración</span>
            <Shield className="w-4 h-4 text-purple-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black font-mono text-purple-700 dark:text-purple-400">
            {metrics.pAdmin}
          </p>
          <p className="text-[11px] text-purple-600/80 dark:text-purple-500/80">
            Pendientes de Paso 2 (Aplicación)
          </p>
        </div>

        <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
            <span>Impacto Pendiente</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black font-mono text-rose-700 dark:text-rose-400 truncate">
            {formatPYG(metrics.impactoTotalPendiente)}
          </p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-500/80">
            En espera de doble resolución
          </p>
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
              placeholder="Buscar por código, motivo o depósito..."
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

          {/* Estado */}
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente_gerencia">Firma Gerencia (Paso 1)</option>
            <option value="pendiente_administracion">Firma Administración (Paso 2)</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          {/* Riesgo */}
          <select
            value={filterRiesgo}
            onChange={(e) => setFilterRiesgo(e.target.value)}
            className="input-field text-xs py-2"
          >
            <option value="all">Todos los riesgos</option>
            <option value="bajo">Riesgo Bajo</option>
            <option value="medio">Riesgo Medio</option>
            <option value="alto">Riesgo Alto (Exige Evidencia)</option>
            <option value="severo">Riesgo Severo (Exige Evidencia)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={loadAdjustments}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-extrabold uppercase shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Ajuste de Stock</span>
          </button>
        </div>
      </div>

      {/* ── TABLA PRINCIPAL DE AJUSTES ──────────────────────────────────────── */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500" />
            <p className="font-bold text-xs">Cargando auditoría de ajustes...</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500/50" />
            <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
              No se encontraron ajustes de stock
            </p>
            <p className="text-xs">
              Los ajustes registrados bajo el protocolo de doble aprobación aparecerán aquí con su trazabilidad inmutable.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Código / Fecha</th>
                  <th className="p-3.5">Depósito</th>
                  <th className="p-3.5">Motivo & Riesgo</th>
                  <th className="p-3.5 text-right">Impacto Gs.</th>
                  <th className="p-3.5 text-center">Estado Workflow</th>
                  <th className="p-3.5">Trazabilidad Firmas</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredAdjustments.map((adj) => {
                  const estCfg = ESTADO_CONFIG[adj.estado] || {
                    label: adj.estado,
                    bg: "bg-slate-100 text-slate-700 border-slate-200",
                    icon: HelpCircle,
                  }
                  const IconEstado = estCfg.icon
                  const rKey = (adj.riesgo || "bajo") as keyof typeof RIESGO_CONFIG
                  const rCfg = RIESGO_CONFIG[rKey] || RIESGO_CONFIG.bajo

                  return (
                    <tr
                      key={adj.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Código & Fecha */}
                      <td className="p-3.5 space-y-0.5">
                        <span className="font-mono font-black text-slate-900 dark:text-white block">
                          {adj.codigo}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 inline" />
                          {formatDateTime(adj.created_at)}
                        </span>
                      </td>

                      {/* Depósito */}
                      <td className="p-3.5 font-bold text-slate-700 dark:text-slate-200">
                        {adj.warehouse_nombre || "Depósito Central"}
                      </td>

                      {/* Motivo & Riesgo */}
                      <td className="p-3.5 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {adj.motivo_label || adj.motivo}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${rCfg.bg}`}
                          >
                            {rCfg.label}
                          </span>
                        </div>
                        {adj.motivo_detalle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">
                            {adj.motivo_detalle}
                          </p>
                        )}
                        {adj.evidencia_urls && adj.evidencia_urls.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            <UploadCloud className="w-3 h-3" />
                            {adj.evidencia_urls.length} archivo(s) de evidencia
                          </span>
                        )}
                      </td>

                      {/* Impacto Financiero Gs. */}
                      <td className="p-3.5 text-right font-mono font-black text-sm text-slate-900 dark:text-white">
                        {formatPYG(adj.impacto_financiero_gs || 0)}
                      </td>

                      {/* Estado Workflow */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${estCfg.bg}`}
                        >
                          <IconEstado className="w-3.5 h-3.5" />
                          <span>{estCfg.label}</span>
                        </span>
                      </td>

                      {/* Trazabilidad Firmas */}
                      <td className="p-3.5 text-[11px] space-y-1 text-slate-500">
                        {adj.estado === "rechazado" ? (
                          <div className="text-rose-600 dark:text-rose-400">
                            <span className="font-bold">Rechazado por:</span>{" "}
                            {adj.rechazado_por_nombre || "Auditor"}
                            {adj.motivo_rechazo && (
                              <p className="italic text-[10px] text-slate-400 line-clamp-1">
                                "{adj.motivo_rechazo}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  adj.aprobado_por_gerencia_nombre
                                    ? "bg-emerald-500"
                                    : "bg-slate-300 dark:bg-slate-600"
                                }`}
                              />
                              <span className="font-bold">Gerencia:</span>{" "}
                              {adj.aprobado_por_gerencia_nombre ? (
                                <span className="text-slate-800 dark:text-slate-200">
                                  {adj.aprobado_por_gerencia_nombre}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">Pendiente</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  adj.aprobado_por_administracion_nombre
                                    ? "bg-emerald-500"
                                    : "bg-slate-300 dark:bg-slate-600"
                                }`}
                              />
                              <span className="font-bold">Administración:</span>{" "}
                              {adj.aprobado_por_administracion_nombre ? (
                                <span className="text-slate-800 dark:text-slate-200">
                                  {adj.aprobado_por_administracion_nombre}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">Pendiente</span>
                              )}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Botones de Acción */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetail(adj)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                            title="Ver Detalle & Auditoría Inmutable"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Botón Gerencia (Paso 1) */}
                          {adj.estado === "pendiente_gerencia" && (
                            <button
                              onClick={() =>
                                setActionTarget({ adjustment: adj, type: "gerencia" })
                              }
                              className="px-2 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition flex items-center gap-1"
                              title="Firmar como Gerencia (Paso 1)"
                            >
                              <Check className="w-3 h-3" />
                              <span>Firma Gcia</span>
                            </button>
                          )}

                          {/* Botón Administración (Paso 2) */}
                          {adj.estado === "pendiente_administracion" && (
                            <button
                              onClick={() =>
                                setActionTarget({ adjustment: adj, type: "administracion" })
                              }
                              className="px-2 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs transition flex items-center gap-1"
                              title="Firmar como Administración y Aplicar Stock (Paso 2)"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Firma Admin</span>
                            </button>
                          )}

                          {/* Botón Rechazo */}
                          {(adj.estado === "pendiente_gerencia" ||
                            adj.estado === "pendiente_administracion") && (
                            <button
                              onClick={() =>
                                setActionTarget({ adjustment: adj, type: "rechazar" })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              title="Rechazar Ajuste"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
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

      {/* ── MODAL NUEVO AJUSTE DE STOCK ──────────────────────────────────────── */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-300" />
                    <span>Solicitud de Ajuste de Stock</span>
                  </h3>
                  <p className="text-xs text-blue-100">
                    Sujeto a workflow de doble aprobación: Gerencia y Administración
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
                {/* Depósito & Motivo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Depósito Afectado *
                    </label>
                    <select
                      value={createWarehouseId}
                      onChange={(e) => setCreateWarehouseId(e.target.value)}
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Motivo Oficial de Ajuste *
                    </label>
                    <select
                      value={createMotivoCodigo}
                      onChange={(e) => setCreateMotivoCodigo(e.target.value)}
                      required
                      className="input-field text-xs py-2 w-full"
                    >
                      <option value="">Seleccione motivo del catálogo...</option>
                      {motivos.map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.label} ({m.riesgo.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Banner de Nivel de Riesgo & Alerta */}
                {selectedMotivoInfo && (
                  <div
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs ${
                      RIESGO_CONFIG[selectedMotivoInfo.riesgo].bg
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-extrabold uppercase tracking-wide">
                        Nivel de Riesgo Operativo: {selectedMotivoInfo.riesgo}
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        {selectedMotivoInfo.requiere_evidencia
                          ? "Este motivo requiere OBLIGATORIAMENTE adjuntar al menos un archivo de evidencia (fotografía del daño, acta de auditoría o informe policial)."
                          : "Este motivo requiere doble aprobación estándar (Gerencia y Administración)."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Justificación Detallada */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Justificación Detallada (Obligatoria) *
                    </label>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        createMotivoDetalle.length >= 20
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      }`}
                    >
                      {createMotivoDetalle.length}/20 caracteres mínimos
                    </span>
                  </div>
                  <textarea
                    value={createMotivoDetalle}
                    onChange={(e) => setCreateMotivoDetalle(e.target.value)}
                    rows={2}
                    placeholder="Explique con precisión la causa raíz del desvío de stock (mínimo 20 caracteres)..."
                    className="input-field text-xs py-2 w-full resize-none"
                    required
                  />
                </div>

                {/* Buscador de Productos para Agregar */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Agregar Productos a Ajustar
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre, SKU o código de barra..."
                      className="input-field pl-9 text-xs py-2 w-full"
                    />

                    {/* Resultados desplegables */}
                    {productSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {productSearchResults.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => addItemToCreate(p)}
                            className="p-3 hover:bg-blue-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {p.nombre}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">
                                SKU: {p.sku || "—"} | CB: {p.codigo_barra || "—"}
                              </p>
                            </div>
                            <span className="btn-primary text-[10px] px-2 py-1 rounded-lg">
                              + Agregar
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Planilla de Productos Agregados */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {createItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-1">
                      <Layers className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-xs font-bold">No hay productos seleccionados aún</p>
                      <p className="text-[10px]">Buscá y agregá los productos a ajustar.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="p-2.5">Producto</th>
                            <th className="p-2.5 text-right">Stock Sistema</th>
                            <th className="p-2.5 text-right w-28">Conteo Real</th>
                            <th className="p-2.5 text-right">Diferencia</th>
                            <th className="p-2.5 text-right">Costo Unit.</th>
                            <th className="p-2.5 text-right">Impacto Gs.</th>
                            <th className="p-2.5 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {createItems.map((item, idx) => (
                            <tr key={item.product.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5">
                                <p className="font-extrabold text-slate-900 dark:text-white truncate max-w-xs">
                                  {item.product.nombre}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  {item.product.sku}
                                </p>
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-500">
                                {item.cantidad_sistema}
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.cantidad_fisica}
                                  onChange={(e) =>
                                    updateItemQty(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="input-field text-xs font-mono font-bold text-right py-1 px-2 w-24"
                                />
                              </td>
                              <td
                                className={`p-2.5 text-right font-mono font-bold ${
                                  item.diferencia === 0
                                    ? "text-slate-400"
                                    : item.diferencia > 0
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPYG(item.costo_unitario)}
                              </td>
                              <td
                                className={`p-2.5 text-right font-mono font-extrabold ${
                                  item.impacto_gs < 0 ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {formatPYG(item.impacto_gs)}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItemFromCreate(idx)}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Subida de Evidencia (Upload) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Evidencia Fotográfica / Documental
                      {selectedMotivoInfo?.requiere_evidencia && " (Obligatoria)"}
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700">
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadingEvidencia ? "Subiendo..." : "Subir Archivo"}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleUploadEvidencia}
                        disabled={uploadingEvidencia}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {createEvidenciaUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {createEvidenciaUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs border border-slate-200 dark:border-slate-700 font-mono"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span className="truncate max-w-[160px]">
                            {url.split("/").pop()}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCreateEvidenciaUrls((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-slate-400 hover:text-rose-600 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      No se han adjuntado fotos ni documentos aún.
                    </p>
                  )}
                </div>

                {/* Total Impacto Calculado en Tiempo Real */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Impacto Financiero Total Estimado
                    </span>
                    <span className="text-xs text-slate-500">
                      {createItems.length} producto(s) incluidos
                    </span>
                  </div>
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    {formatPYG(totalImpactoEstimado)}
                  </span>
                </div>

                {/* Footer Modal */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="btn-primary px-6 py-2 text-xs font-extrabold uppercase rounded-xl shadow-sm flex items-center gap-2"
                  >
                    {submittingCreate ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Registrar & Enviar a Gerencia</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── MODAL DETALLE & AUDITORÍA INMUTABLE ──────────────────────────────── */}
      {detailAdjustment &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black font-mono">
                      {detailAdjustment.codigo}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        ESTADO_CONFIG[detailAdjustment.estado]?.bg || "bg-slate-800"
                      }`}
                    >
                      {ESTADO_CONFIG[detailAdjustment.estado]?.label || detailAdjustment.estado}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Depósito: {detailAdjustment.warehouse_nombre} | Creado:{" "}
                    {formatDateTime(detailAdjustment.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setDetailAdjustment(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Datos generales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Motivo Oficial
                    </span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {detailAdjustment.motivo_label || detailAdjustment.motivo}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Nivel de Riesgo
                    </span>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        RIESGO_CONFIG[
                          (detailAdjustment.riesgo || "bajo") as keyof typeof RIESGO_CONFIG
                        ]?.bg
                      }`}
                    >
                      {detailAdjustment.riesgo}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Impacto Financiero Total
                    </span>
                    <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                      {formatPYG(detailAdjustment.impacto_financiero_gs || 0)}
                    </span>
                  </div>
                </div>

                {/* Justificación */}
                {detailAdjustment.motivo_detalle && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Justificación Detallada
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                      {detailAdjustment.motivo_detalle}
                    </p>
                  </div>
                )}

                {/* Evidencia Adjunta */}
                {detailAdjustment.evidencia_urls && detailAdjustment.evidencia_urls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Evidencias Adjuntas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detailAdjustment.evidencia_urls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs border border-blue-200 dark:border-blue-900 font-semibold hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Evidencia {idx + 1}</span>
                          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabla de Productos */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Productos Afectados ({detailAdjustment.items?.length || 0})
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="p-3">Producto</th>
                          <th className="p-3 text-right">Stock Sistema</th>
                          <th className="p-3 text-right">Conteo Físico</th>
                          <th className="p-3 text-right">Diferencia</th>
                          <th className="p-3 text-right">Costo Unit.</th>
                          <th className="p-3 text-right">Impacto Gs.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(detailAdjustment.items || []).map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {it.product_nombre}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">
                                {it.product_sku}
                              </p>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500">
                              {it.cantidad_sistema}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {it.cantidad_fisica}
                            </td>
                            <td
                              className={`p-3 text-right font-mono font-black ${
                                it.diferencia === 0
                                  ? "text-slate-400"
                                  : it.diferencia > 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {it.diferencia > 0 ? `+${it.diferencia}` : it.diferencia}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              {formatPYG(it.costo_unitario)}
                            </td>
                            <td
                              className={`p-3 text-right font-mono font-extrabold ${
                                it.impacto_gs < 0 ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {formatPYG(it.impacto_gs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail Inmutable (Timeline) */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Registro Inmutable de Auditoría (Audit Trail)</span>
                  </h4>

                  {loadingDetail ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                      Cargando firmas y eventos...
                    </div>
                  ) : (detailAdjustment.audit_logs || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No hay eventos registrados aún.
                    </p>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {(detailAdjustment.audit_logs || []).map((log) => (
                        <div key={log.id} className="relative space-y-1">
                          <span className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-blue-600" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                              {log.accion} — {log.rol_firmante || "Usuario"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Por: <span className="font-bold">{log.user_nombre || "Sistema"}</span>
                          </p>
                          {log.comentario && (
                            <p className="text-xs italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                              "{log.comentario}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── MODAL ACCIÓN (APROBAR GERENCIA / APROBAR ADMIN / RECHAZAR) ─────── */}
      {actionTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div
                className={`p-4 text-white flex items-center justify-between ${
                  actionTarget.type === "rechazar"
                    ? "bg-rose-600"
                    : actionTarget.type === "administracion"
                    ? "bg-purple-700"
                    : "bg-amber-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  {actionTarget.type === "rechazar" ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  <h4 className="font-extrabold text-sm">
                    {actionTarget.type === "gerencia" && "Firma Gerencial (Paso 1 de 2)"}
                    {actionTarget.type === "administracion" &&
                      "Firma de Administración & Aplicación (Paso 2 de 2)"}
                    {actionTarget.type === "rechazar" && "Rechazar Solicitud de Ajuste"}
                  </h4>
                </div>
                <button
                  onClick={() => setActionTarget(null)}
                  className="p-1 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs space-y-1">
                  <p>
                    <span className="font-bold">Ajuste:</span> {actionTarget.adjustment.codigo}
                  </p>
                  <p>
                    <span className="font-bold">Motivo:</span>{" "}
                    {actionTarget.adjustment.motivo_label || actionTarget.adjustment.motivo}
                  </p>
                  <p>
                    <span className="font-bold">Impacto Financiero:</span>{" "}
                    <span className="font-mono font-black">
                      {formatPYG(actionTarget.adjustment.impacto_financiero_gs || 0)}
                    </span>
                  </p>
                </div>

                {actionTarget.type === "gerencia" && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Al firmar como Gerencia, este ajuste avanzará a la etapa de{" "}
                    <strong className="text-purple-600 dark:text-purple-400">
                      Firma de Administración
                    </strong>
                    . No se afectará el stock real hasta que Administración coloque su firma final.
                  </p>
                )}

                {actionTarget.type === "administracion" && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-rose-600">ATENCIÓN:</strong> Esta es la firma definitiva.
                    Al confirmar, el sistema modificará inmediatamente el stock físico en el
                    depósito y registrará los movimientos inmutables en el Kardex.
                  </p>
                )}

                {actionTarget.type === "rechazar" && (
                  <p className="text-xs text-rose-600 font-semibold">
                    Esta acción es definitiva e irreversible. Debe proporcionar el motivo detallado
                    del rechazo (mínimo 10 caracteres).
                  </p>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {actionTarget.type === "rechazar"
                      ? "Motivo Obligatorio del Rechazo *"
                      : "Comentario u Observaciones (Opcional)"}
                  </label>
                  <textarea
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    rows={3}
                    placeholder={
                      actionTarget.type === "rechazar"
                        ? "Escriba la razón de rechazo (mínimo 10 caracteres)..."
                        : "Ingrese cualquier observación para el registro de auditoría..."
                    }
                    className="input-field text-xs py-2 w-full resize-none"
                    required={actionTarget.type === "rechazar"}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionTarget(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleExecuteAction}
                    className={`px-5 py-2 text-xs font-extrabold uppercase rounded-xl text-white shadow-sm flex items-center gap-1.5 ${
                      actionTarget.type === "rechazar"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : actionTarget.type === "administracion"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    {submittingAction ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {actionTarget.type === "rechazar" ? "Rechazar Ajuste" : "Confirmar Firma"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
