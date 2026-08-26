import { useState, useEffect, useMemo } from "react"
import {
  Search, RotateCcw, Eye, Loader2, CheckCircle, XCircle, X,
  DollarSign, Clock, Undo2, Check, RefreshCw, PackageCheck, AlertCircle,
  FileText, Plus, Building2, Tag, Truck
} from "lucide-react"
import { api, type ReturnType, type ReturnItemType, type Sale, type Warehouse } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

interface SupplierCreditNote {
  id: string
  supplier_id: string
  supplier_nombre: string
  numero: string
  numero_factura_origen: string
  fecha: string
  motivo: string
  monto: number
  moneda: string
  observaciones: string
}

interface SupplierReturn {
  id: string
  supplier_id: string
  supplier_nombre: string
  numero_factura_origen: string
  numero_nota_credito: string
  fecha: string
  monto: number
  moneda: string
  observaciones: string
}

const MOTIVOS_LABELS: Record<string, string> = {
  producto_defectuoso: "Producto Defectuoso",
  producto_equivocado: "Producto Equivocado",
  vencimiento: "Vencimiento / Caducidad",
  dano_transporte: "Daño en Transporte",
  cliente_insatisfecho: "Cliente Insatisfecho",
  error_venta: "Error en Facturación",
  devolucion_voluntaria: "Devolución Voluntaria",
  garantia: "Garantía de Calidad",
  otro: "Otro Motivo",
}

const CONDICION_LABELS: Record<string, string> = {
  buen_estado: "Buen Estado (Apto Reventa)",
  defectuoso: "Defectuoso (Merma)",
  danado: "Dañado",
  vencido: "Vencido",
  incompleto: "Incompleto / Faltante",
}

const STATUS_META: Record<string, { label: string; class: string }> = {
  pendiente: { label: "Pendiente RMA", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  aprobado:  { label: "Aprobada (Stock Rest.)", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  rechazado: { label: "Rechazada", class: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
}

export default function ReturnsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  // Pestaña Principal
  const [mainTab, setMainTab] = useState<"customer_returns" | "supplier_credit_notes" | "supplier_returns">("customer_returns")

  // Estado: Devoluciones Clientes (ven_devolucao)
  const [returns, setReturns] = useState<ReturnType[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [motivos, setMotivos] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [loadingReturns, setLoadingReturns] = useState(true)

  // Estado: Notas de Crédito Proveedores (fin_recepcao_nota_credito)
  const [creditNotes, setCreditNotes] = useState<SupplierCreditNote[]>([])
  const [ncSearch, setNcSearch] = useState("")
  const [ncFilterMotivo, setNcFilterMotivo] = useState("todos")
  const [loadingNc, setLoadingNc] = useState(true)
  const [viewingNc, setViewingNc] = useState<SupplierCreditNote | null>(null)

  // Estado: Devoluciones a Proveedores (est_devolucao_fornecedor)
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([])
  const [supRetSearch, setSupRetSearch] = useState("")
  const [loadingSupRet, setLoadingSupRet] = useState(true)
  const [viewingSupRet, setViewingSupRet] = useState<SupplierReturn | null>(null)

  const [refreshing, setRefreshing] = useState(false)

  // Modales Devoluciones Clientes
  const [viewingReturn, setViewingReturn] = useState<ReturnType | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnItemType[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState("")
  const [saleSearch, setSaleSearch] = useState("")
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, { cantidad: number; condicion: string; motivo_detalle: string }>>({})
  const [motivo, setMotivo] = useState("")
  const [motivoDetalle, setMotivoDetalle] = useState("")
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<ReturnType | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  /* ── DATA FETCH ────────────────────────────────────────────────────────── */
  const fetchCustomerReturns = async () => {
    setLoadingReturns(true)
    try {
      const [returnsData, salesData, warehousesData, motivosData] = await Promise.allSettled([
        api.returns.list({ estado: filterStatus !== "todos" ? filterStatus : undefined }),
        api.sales.list({ estado: "confirmado" }),
        api.warehouses.list(),
        api.returns.motivos(),
      ])
      if (returnsData.status === "fulfilled") setReturns(returnsData.value)
      if (salesData.status === "fulfilled") setSales(salesData.value)
      if (warehousesData.status === "fulfilled") setWarehouses(warehousesData.value)
      if (motivosData.status === "fulfilled") setMotivos(motivosData.value)
    } catch {
      setReturns([])
    } finally {
      setLoadingReturns(false)
    }
  }

  const fetchSupplierCreditNotes = async () => {
    setLoadingNc(true)
    try {
      const data = await api.financial.creditNotes()
      setCreditNotes(Array.isArray(data) ? data : [])
    } catch {
      setCreditNotes([])
    } finally {
      setLoadingNc(false)
    }
  }

  const fetchSupplierReturns = async () => {
    setLoadingSupRet(true)
    try {
      const data = await api.financial.supplierReturns()
      setSupplierReturns(Array.isArray(data) ? data : [])
    } catch {
      setSupplierReturns([])
    } finally {
      setLoadingSupRet(false)
    }
  }

  useEffect(() => {
    fetchCustomerReturns()
    fetchSupplierCreditNotes()
    fetchSupplierReturns()
  }, [filterStatus])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchCustomerReturns(), fetchSupplierCreditNotes(), fetchSupplierReturns()])
    setRefreshing(false)
  }

  /* ── FILTRADO Y KPIS: DEVOLUCIONES CLIENTES ──────────────────────────── */
  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const matchSearch = !search.trim() ||
        (r.numero || "").toLowerCase().includes(search.toLowerCase()) ||
        ((r as any).sale?.numero || "").toLowerCase().includes(search.toLowerCase()) ||
        ((r as any).customer?.razon_social || "").toLowerCase().includes(search.toLowerCase()) ||
        ((r as any).customer?.ruc || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.motivo || "").toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === "todos" || r.estado === filterStatus
      return matchSearch && matchStatus
    })
  }, [returns, search, filterStatus])

  const returnKpis = useMemo(() => {
    const total = returns.length
    const pendientes = returns.filter(r => r.estado === "pendiente").length
    const aprobadas = returns.filter(r => r.estado === "aprobado").length
    const rechazadas = returns.filter(r => r.estado === "rechazado").length
    const montoTotal = returns.reduce((a, b) => a + Number(b.total || 0), 0)
    const montoAprobado = returns.filter(r => r.estado === "aprobado").reduce((a, b) => a + Number(b.total || 0), 0)
    return { total, pendientes, aprobadas, rechazadas, montoTotal, montoAprobado }
  }, [returns])

  /* ── FILTRADO Y KPIS: NOTAS DE CRÉDITO PROVEEDORES ───────────────────── */
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(nc => {
      const matchSearch = !ncSearch.trim() ||
        (nc.numero || "").toLowerCase().includes(ncSearch.toLowerCase()) ||
        (nc.supplier_nombre || "").toLowerCase().includes(ncSearch.toLowerCase()) ||
        (nc.numero_factura_origen || "").toLowerCase().includes(ncSearch.toLowerCase()) ||
        (nc.observaciones || "").toLowerCase().includes(ncSearch.toLowerCase())
      const matchMotivo = ncFilterMotivo === "todos" || (nc.motivo || "").toUpperCase() === ncFilterMotivo.toUpperCase()
      return matchSearch && matchMotivo
    })
  }, [creditNotes, ncSearch, ncFilterMotivo])

  const ncKpis = useMemo(() => {
    const total = creditNotes.length
    const montoTotal = creditNotes.reduce((acc, nc) => acc + Number(nc.monto || 0), 0)
    const proveedoresUnicos = new Set(creditNotes.map(nc => nc.supplier_id || nc.supplier_nombre)).size
    const avgMonto = total > 0 ? Math.round(montoTotal / total) : 0
    return { total, montoTotal, proveedoresUnicos, avgMonto }
  }, [creditNotes])

  const ncMotivosList = useMemo(() => {
    const set = new Set<string>()
    creditNotes.forEach(nc => {
      if (nc.motivo) set.add(nc.motivo)
    })
    return Array.from(set)
  }, [creditNotes])

  /* ── FILTRADO Y KPIS: DEVOLUCIONES A PROVEEDORES ─────────────────────── */
  const filteredSupplierReturns = useMemo(() => {
    return supplierReturns.filter(sr => {
      return !supRetSearch.trim() ||
        (sr.supplier_nombre || "").toLowerCase().includes(supRetSearch.toLowerCase()) ||
        (sr.numero_nota_credito || "").toLowerCase().includes(supRetSearch.toLowerCase()) ||
        (sr.numero_factura_origen || "").toLowerCase().includes(supRetSearch.toLowerCase()) ||
        (sr.observaciones || "").toLowerCase().includes(supRetSearch.toLowerCase())
    })
  }, [supplierReturns, supRetSearch])

  const supRetKpis = useMemo(() => {
    const total = supplierReturns.length
    const montoTotal = supplierReturns.reduce((acc, sr) => acc + Number(sr.monto || 0), 0)
    const proveedoresUnicos = new Set(supplierReturns.map(sr => sr.supplier_id || sr.supplier_nombre)).size
    return { total, montoTotal, proveedoresUnicos }
  }, [supplierReturns])

  /* ── ACCIONES: DEVOLUCIONES CLIENTES ─────────────────────────────────── */
  const handleLoadSaleItems = async (saleId: string) => {
    if (!saleId) {
      setSaleItems([])
      setSelectedItems({})
      return
    }
    try {
      const items = await api.sales.getItems(saleId)
      setSaleItems(items)
      const sel: Record<string, { cantidad: number; condicion: string; motivo_detalle: string }> = {}
      items.forEach((i: any) => {
        sel[i.id] = { cantidad: i.cantidad, condicion: "buen_estado", motivo_detalle: "" }
      })
      setSelectedItems(sel)
    } catch {
      setSaleItems([])
      toast.error("Error", "No se pudieron cargar los productos de la venta")
    }
  }

  const handleCreateReturn = async () => {
    if (!motivo) {
      toast.error("Error", "Seleccioná un motivo de devolución")
      return
    }
    if (!selectedSaleId) {
      toast.error("Error", "Seleccioná la venta de origen")
      return
    }
    const items = Object.entries(selectedItems)
      .filter(([_, v]) => v.cantidad > 0)
      .map(([key, v]) => {
        const item = saleItems.find((i: any) => i.id === key)
        return {
          product_id: item.product_id,
          cantidad: v.cantidad,
          precio_unitario: item.precio_unitario,
          iva_tasa: item.iva_tasa,
          condicion: v.condicion,
          motivo_detalle: v.motivo_detalle || undefined,
        }
      })
    if (items.length === 0) {
      toast.error("Error", "Indicá al menos un producto a devolver")
      return
    }
    setCreating(true)
    try {
      const sale = sales.find(s => s.id === selectedSaleId)
      await api.returns.create({
        sale_id: selectedSaleId,
        customer_id: sale?.customer_id || undefined,
        motivo,
        observaciones: motivoDetalle || undefined,
        items,
      })
      toast.success("Devolución registrada", "La solicitud fue creada correctamente")
      setShowCreate(false)
      resetCreateForm()
      fetchCustomerReturns()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo registrar la devolución")
    } finally {
      setCreating(false)
    }
  }

  const resetCreateForm = () => {
    setSelectedSaleId("")
    setSaleSearch("")
    setSaleItems([])
    setSelectedItems({})
    setMotivo("")
    setMotivoDetalle("")
  }

  const handleApprove = async (r: ReturnType) => {
    const ok = await confirm({
      title: "Aprobar Devolución de Mercadería",
      message: `¿Confirmar la aprobación de la devolución ${r.numero}? Se restaurará automáticamente el stock al inventario.`,
      confirmText: "Aprobar & Reponer Stock",
      variant: "info",
    })
    if (!ok) return
    setProcessing(r.id)
    try {
      await api.returns.approve(r.id, "supervisor")
      toast.success("Devolución Aprobada", `Devolución ${r.numero} aprobada — Stock restaurado al inventario`)
      fetchCustomerReturns()
    } catch {
      toast.error("Error", "No se pudo aprobar la devolución")
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error("Error", "Ingresá el motivo del rechazo")
      return
    }
    setProcessing(rejectModal.id)
    try {
      await api.returns.reject(rejectModal.id, rejectReason.trim())
      toast.success("Devolución Rechazada", `Devolución ${rejectModal.numero} rechazada`)
      setRejectModal(null)
      setRejectReason("")
      fetchCustomerReturns()
    } catch {
      toast.error("Error", "No se pudo rechazar la devolución")
    } finally {
      setProcessing(null)
    }
  }

  const handleViewReturn = async (r: ReturnType) => {
    setViewingReturn(r)
    try {
      const full = await api.returns.get(r.id)
      setReturnItems(full.items || [])
    } catch {
      setReturnItems([])
    }
  }

  const motivoLabel = (m: string) => MOTIVOS_LABELS[m] || m.replace(/_/g, " ")
  const condicionLabel = (c: string) => CONDICION_LABELS[c] || c.replace(/_/g, " ")

  const filteredSalesForModal = sales.filter(s =>
    !saleSearch ||
    (s.numero || "").toLowerCase().includes(saleSearch.toLowerCase()) ||
    ((s.customer?.razon_social || (s as any).customer_name || "")).toLowerCase().includes(saleSearch.toLowerCase()) ||
    ((s.customer?.ruc || (s as any).customer_ruc || "")).includes(saleSearch)
  ).slice(0, 6)

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white">
              Devoluciones & Notas de Crédito
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              RMA Clientes · Proveedores Nemuha
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Control de devoluciones de clientes, reintegros a inventario y notas de crédito de proveedores sincronizadas desde Nemuha ERP.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {mainTab === "customer_returns" && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn bg-primary text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Devolución</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPIS CONSOLIDADOS (SEGÚN LA PESTAÑA ACTIVA) ──────────────────────── */}
      {mainTab === "customer_returns" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Total Devoluciones Clientes
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
              {formatPYG(returnKpis.montoTotal)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {returnKpis.total} solicitudes en cartera
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-amber-500/30 border-l-4 border-l-amber-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pendientes de RMA
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-amber-500 mt-2">
              {returnKpis.pendientes}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Requieren revisión y firma
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Stock Restaurado
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
              {returnKpis.aprobadas}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">
              {formatPYG(returnKpis.montoAprobado)} reintegrado
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-red-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Rechazadas / Sin Efecto
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-red-600 dark:text-red-400 mt-2">
              {returnKpis.rechazadas}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Mercadería no admitida
            </p>
          </div>
        </div>
      )}

      {mainTab === "supplier_credit_notes" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Total Crédito a Favor
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
              {formatPYG(ncKpis.montoTotal)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {ncKpis.total} notas de crédito registradas
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Proveedores con NC
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
              {ncKpis.proveedoresUnicos}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Empresas proveedoras
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-purple-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Promedio por Nota
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 mt-2">
              {formatPYG(ncKpis.avgMonto)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Monto promedio liquidado
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-cyan-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Estado Sincronización
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-cyan-600 dark:text-cyan-400 mt-2">
              100%
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Conectado a Nemuha ERP
            </p>
          </div>
        </div>
      )}

      {mainTab === "supplier_returns" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-amber-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Total Devuelto a Proveedores
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 mt-2">
              {formatPYG(supRetKpis.montoTotal)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {supRetKpis.total} devoluciones físicas
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Proveedores Afectados
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
              {supRetKpis.proveedoresUnicos}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Cuentas con RMA proveedor
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-purple-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Origen de Devolución
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 mt-2">
              Vencidos / Mermas
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Reclamos por canje o crédito
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Integración Nemuha
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
              Sincronizado
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Tabla est_devolucao_fornecedor
            </p>
          </div>
        </div>
      )}

      {/* ── SELECTOR DE SECCIÓN PRINCIPAL (TABS OPERATIVAS) ────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "customer_returns", label: "Devoluciones de Clientes (RMA)", icon: RotateCcw, count: returns.length },
          { id: "supplier_credit_notes", label: "Notas de Crédito Proveedores", icon: Building2, count: creditNotes.length },
          { id: "supplier_returns", label: "Devoluciones a Proveedores", icon: Truck, count: supplierReturns.length },
        ].map((t) => {
          const active = mainTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENIDO PESTAÑA 1: DEVOLUCIONES DE CLIENTES (RMA)
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === "customer_returns" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: "todos", label: "Todas", count: returns.length },
              { id: "pendiente", label: "Pendientes RMA", count: returnKpis.pendientes },
              { id: "aprobado", label: "Aprobadas", count: returnKpis.aprobadas },
              { id: "rechazado", label: "Rechazadas", count: returnKpis.rechazadas },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterStatus === st.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                }`}
              >
                {st.label} ({st.count})
              </button>
            ))}
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Nº devolución, Nº venta, RUC/CI o cliente..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nº Devolución</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Venta Origen</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Motivo Principal</th>
                    <th className="p-3.5 text-right">Monto Devuelto</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loadingReturns ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando devoluciones de clientes...</span>
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        No se encontraron solicitudes de devolución coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((r: any) => {
                      const saleNum = r.sale?.numero || r.sale_id?.slice(0, 8) || "—"
                      const custName = r.customer?.razon_social || r.customer_name || "Cliente General"

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5 text-primary" />
                              <span>{r.numero}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                            {r.fecha ? formatDate(r.fecha) : "—"}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{saleNum}
                          </td>
                          <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                            {custName}
                          </td>
                          <td className="p-3.5 text-gray-600 dark:text-gray-300">
                            <span className="font-semibold">{motivoLabel(r.motivo || "otro")}</span>
                            {r.motivo_detalle && (
                              <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{r.motivo_detalle}</p>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                            {formatPYG(Number(r.total || 0))}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_META[r.estado || "pendiente"]?.class || ""}`}>
                              {STATUS_META[r.estado || "pendiente"]?.label || r.estado}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleViewReturn(r)}
                                className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                                title="Ver Detalle RMA"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {r.estado === "pendiente" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(r)}
                                    disabled={processing === r.id}
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1"
                                    title="Aprobar & Restaurar Stock"
                                  >
                                    {processing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    <span>Aprobar</span>
                                  </button>
                                  <button
                                    onClick={() => setRejectModal(r)}
                                    disabled={processing === r.id}
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 flex items-center gap-1"
                                    title="Rechazar"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Rechazar</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENIDO PESTAÑA 2: NOTAS DE CRÉDITO DE PROVEEDORES (NEMUHA ERP)
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === "supplier_credit_notes" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={ncSearch}
                onChange={(e) => setNcSearch(e.target.value)}
                placeholder="Buscar por Nº de NC, Proveedor, Factura afectada u observaciones..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ncFilterMotivo}
                onChange={(e) => setNcFilterMotivo(e.target.value)}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="todos">Todos los Motivos ({creditNotes.length})</option>
                {ncMotivosList.map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nº Nota de Crédito</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5">Factura Origen</th>
                    <th className="p-3.5">Concepto / Motivo</th>
                    <th className="p-3.5 text-right">Monto Acreditado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loadingNc ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando notas de crédito de proveedores...</span>
                      </td>
                    </tr>
                  ) : filteredCreditNotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No se encontraron notas de crédito de proveedores coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredCreditNotes.map((nc) => (
                      <tr key={nc.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{nc.numero || "NC-" + nc.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                          {nc.fecha ? formatDate(nc.fecha) : "—"}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                          {nc.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-3.5 font-mono text-gray-500 text-[11px]">
                          {nc.numero_factura_origen ? `#${nc.numero_factura_origen}` : "—"}
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {(nc.motivo || "CREDITO").replace(/_/g, " ")}
                          </span>
                          {nc.observaciones && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[180px] mt-0.5">{nc.observaciones}</p>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatPYG(Number(nc.monto || 0))}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setViewingNc(nc)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                            title="Ver Detalle NC"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENIDO PESTAÑA 3: DEVOLUCIONES A PROVEEDORES (NEMUHA ERP)
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === "supplier_returns" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={supRetSearch}
                onChange={(e) => setSupRetSearch(e.target.value)}
                placeholder="Buscar por Proveedor, Nº Nota de Crédito, Factura afectada u observaciones..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nº Nota de Crédito</th>
                    <th className="p-3.5">Fecha Devolución</th>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5">Factura Afectada</th>
                    <th className="p-3.5">Observaciones / Motivo</th>
                    <th className="p-3.5 text-right">Monto Devuelto</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loadingSupRet ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando devoluciones a proveedores...</span>
                      </td>
                    </tr>
                  ) : filteredSupplierReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No se encontraron devoluciones a proveedores coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierReturns.map((sr) => (
                      <tr key={sr.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-amber-600" />
                            <span>{sr.numero_nota_credito || "DEV-" + sr.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                          {sr.fecha ? formatDate(sr.fecha) : "—"}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                          {sr.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-3.5 font-mono text-gray-500 text-[11px]">
                          {sr.numero_factura_origen ? `#${sr.numero_factura_origen}` : "—"}
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300 max-w-[220px] truncate">
                          {sr.observaciones || "Devolución física a proveedor"}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatPYG(Number(sr.monto || 0))}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setViewingSupRet(sr)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                            title="Ver Detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR DEVOLUCIÓN CLIENTE ───────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Registrar Devolución de Mercadería</h3>
                <p className="text-xs text-gray-400">Seleccioná el comprobante de venta origen y los productos a reintegrar</p>
              </div>
              <button onClick={() => { setShowCreate(false); resetCreateForm() }} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Selección de Venta */}
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Comprobante de Venta Origen *</label>
                {selectedSaleId ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white">
                        Venta #{sales.find(s => s.id === selectedSaleId)?.numero || selectedSaleId.slice(0, 8)}
                      </span>
                      <p className="text-[11px] text-gray-400 font-mono">
                        Cliente: {sales.find(s => s.id === selectedSaleId)?.customer?.razon_social || (sales.find(s => s.id === selectedSaleId) as any)?.customer_name || "Consumidor Final"} · Total: {formatPYG(Number(sales.find(s => s.id === selectedSaleId)?.total || 0))}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedSaleId(""); setSaleItems([]); setSelectedItems({}) }}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      value={saleSearch}
                      onChange={e => setSaleSearch(e.target.value)}
                      placeholder="Buscar por Nº comprobante, RUC o cliente..."
                      className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary"
                    />
                    {saleSearch && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredSalesForModal.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSaleId(s.id)
                              setSaleSearch("")
                              handleLoadSaleItems(s.id)
                            }}
                            className="w-full p-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-xs">Venta #{s.numero || s.id.slice(0, 8)}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{s.customer?.razon_social || (s as any).customer_name || "Consumidor"} · RUC {s.customer?.ruc || (s as any).customer_ruc || "—"}</p>
                            </div>
                            <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(Number(s.total || 0))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items de la Venta */}
              {saleItems.length > 0 && (
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1.5">Ítems a Devolver & Condición Física</label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-800 uppercase text-[9px] font-black text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="p-2">Producto</th>
                          <th className="p-2 text-center w-24">Cant. Dev.</th>
                          <th className="p-2 text-center w-36">Condición</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                        {saleItems.map((item: any) => {
                          const sel = selectedItems[item.id] || { cantidad: 0, condicion: "buen_estado", motivo_detalle: "" }
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/50">
                              <td className="p-2">
                                <p className="font-bold">{item.product_name || item.descripcion || "Producto"}</p>
                                <p className="text-[10px] text-gray-400 font-mono">Comprado: {item.cantidad} un. @ {formatPYG(item.precio_unitario)}</p>
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.cantidad}
                                  value={sel.cantidad}
                                  onChange={e => setSelectedItems(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], cantidad: Math.min(item.cantidad, Math.max(0, parseInt(e.target.value) || 0)) }
                                  }))}
                                  className="w-16 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-center font-mono font-bold text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={sel.condicion}
                                  onChange={e => setSelectedItems(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], condicion: e.target.value }
                                  }))}
                                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-[11px] font-bold"
                                >
                                  {Object.entries(CONDICION_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {formatPYG(sel.cantidad * item.precio_unitario)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Motivo & Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Motivo Principal *</label>
                  <select
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-bold"
                  >
                    <option value="">Seleccionar motivo...</option>
                    {motivos.map(m => (
                      <option key={m} value={m}>{motivoLabel(m)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Observaciones / Auditoría</label>
                  <input
                    type="text"
                    value={motivoDetalle}
                    onChange={e => setMotivoDetalle(e.target.value)}
                    placeholder="Detalle adicional..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { setShowCreate(false); resetCreateForm() }}
                className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateReturn}
                disabled={creating}
                className="btn bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:opacity-90"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                <span>{creating ? "Registrando..." : "Registrar Devolución"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE DEVOLUCIÓN CLIENTE ─────────────────────────── */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Devolución Nº {viewingReturn.numero}</h3>
                <p className="text-xs text-gray-400 font-mono">Venta Origen: #{(viewingReturn as any).sale?.numero || viewingReturn.sale_id?.slice(0, 8)}</p>
              </div>
              <button onClick={() => setViewingReturn(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_META[viewingReturn.estado || "pendiente"]?.class || ""}`}>
                  {STATUS_META[viewingReturn.estado || "pendiente"]?.label || viewingReturn.estado}
                </span>
                <span className="text-gray-500 font-mono">{formatDate(viewingReturn.fecha)}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Cliente:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{(viewingReturn as any).customer?.razon_social || "Consumidor Final"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Motivo:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{motivoLabel(viewingReturn.motivo || "otro")}</span>
                </div>
                {viewingReturn.motivo_detalle && (
                  <div className="flex justify-between text-gray-500 italic">
                    <span>Detalle:</span>
                    <span>"{viewingReturn.motivo_detalle}"</span>
                  </div>
                )}
              </div>

              {viewingReturn.estado === "aprobado" && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">Stock restaurado y disponible en inventario.</span>
                </div>
              )}

              {/* Items */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-800 uppercase text-[9px] font-black text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-center">Condición</th>
                      <th className="p-2.5 text-right">Cant.</th>
                      <th className="p-2.5 text-right">P. Unitario</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                    {returnItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-primary" />
                          <span>Cargando detalle de ítems devueltos...</span>
                        </td>
                      </tr>
                    ) : (
                      returnItems.map((i: any) => (
                        <tr key={i.id} className="hover:bg-gray-50/50">
                          <td className="p-2.5">
                            <p className="font-bold text-gray-900 dark:text-white">
                              {i.product_name || i.descripcion || (i.producto && i.producto.nombre) || "Producto Registrado"}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {i.product_sku ? `SKU: ${i.product_sku}` : (i.product_id ? `ID: ${String(i.product_id).slice(0, 8)}` : "")}
                            </p>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                              {condicionLabel(i.condicion || "buen_estado")}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">{Number(i.cantidad || 0)}</td>
                          <td className="p-2.5 text-right font-mono text-gray-500">{formatPYG(Number(i.precio_unitario || 0))}</td>
                          <td className="p-2.5 text-right font-mono font-black text-gray-900 dark:text-white">{formatPYG(Number(i.total || (i.cantidad * i.precio_unitario) || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 font-bold text-sm">
                <span>Total Reintegrado:</span>
                <span className="font-mono font-black text-primary text-base">{formatPYG(viewingReturn.total || 0)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setViewingReturn(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE NOTA DE CRÉDITO PROVEEDOR ──────────────────── */}
      {viewingNc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-md w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Nota de Crédito Nº {viewingNc.numero}</h3>
                <p className="text-xs text-gray-400 font-mono">Proveedor: {viewingNc.supplier_nombre}</p>
              </div>
              <button onClick={() => setViewingNc(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Fecha Emisión:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{formatDate(viewingNc.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Motivo / Concepto:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{(viewingNc.motivo || "CREDITO").replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Factura Afectada:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{viewingNc.numero_factura_origen ? `#${viewingNc.numero_factura_origen}` : "Sin factura específica"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Monto Acreditado:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">{formatPYG(Number(viewingNc.monto || 0))}</span>
                </div>
              </div>

              {viewingNc.observaciones && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700/50 text-gray-600 dark:text-gray-300">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Observaciones / Detalle:</span>
                  <p className="italic">"{viewingNc.observaciones}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setViewingNc(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE DEVOLUCIÓN A PROVEEDOR ──────────────────────── */}
      {viewingSupRet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-md w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Devolución a Proveedor</h3>
                <p className="text-xs text-gray-400 font-mono">Proveedor: {viewingSupRet.supplier_nombre}</p>
              </div>
              <button onClick={() => setViewingSupRet(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Nota de Crédito Vinculada:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{viewingSupRet.numero_nota_credito || "Pendiente"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Fecha Devolución:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{formatDate(viewingSupRet.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Factura Afectada:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{viewingSupRet.numero_factura_origen ? `#${viewingSupRet.numero_factura_origen}` : "Sin factura específica"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Monto Devuelto:</span>
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-base">{formatPYG(Number(viewingSupRet.monto || 0))}</span>
                </div>
              </div>

              {viewingSupRet.observaciones && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700/50 text-gray-600 dark:text-gray-300">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Observaciones / Motivo:</span>
                  <p className="italic">"{viewingSupRet.observaciones}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setViewingSupRet(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RECHAZAR DEVOLUCIÓN CLIENTE ────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-sm w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Rechazar Solicitud de Devolución</h3>
              <p className="text-xs text-gray-400">Devolución {rejectModal.numero}</p>
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Motivo del Rechazo *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explicación del rechazo comercial..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setRejectModal(null); setRejectReason("") }}
                className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs flex-1 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={processing === rejectModal.id}
                className="btn bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                {processing === rejectModal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Rechazar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
