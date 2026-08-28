import { useState, useEffect, useMemo } from "react"
import {
  Search, RotateCcw, Eye, Loader2, CheckCircle, XCircle, X,
  DollarSign, Clock, Undo2, Check, RefreshCw, PackageCheck, AlertCircle,
  FileText, Plus, Building2, Tag, Truck, ArrowUpRight, ShieldCheck,
  AlertTriangle, Filter, ChevronRight
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
  rechazado: { label: "Rechazada", class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" },
}

export default function ReturnsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  // Pestaña Principal
  const [mainTab, setMainTab] = useState<"customer_returns" | "supplier_credit_notes" | "supplier_returns">("customer_returns")

  // Estado: Devoluciones Clientes
  const [returns, setReturns] = useState<ReturnType[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [motivos, setMotivos] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [loadingReturns, setLoadingReturns] = useState(true)

  // Estado: Notas de Crédito Proveedores
  const [creditNotes, setCreditNotes] = useState<SupplierCreditNote[]>([])
  const [ncSearch, setNcSearch] = useState("")
  const [ncFilterMotivo, setNcFilterMotivo] = useState("todos")
  const [loadingNc, setLoadingNc] = useState(true)
  const [viewingNc, setViewingNc] = useState<SupplierCreditNote | null>(null)

  // Estado: Devoluciones a Proveedores
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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/90 text-white p-7 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 border border-rose-400/30 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <RotateCcw className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                    GESTIÓN DE MERMAS & NOTAS DE CRÉDITO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    RMA Clientes & NC Nemuha ERP
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Devoluciones & Notas de Crédito
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Auditoría de mercadería devuelta, control de RMA, reposición a góndola y notas de crédito a favor
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-400">
                🔄 {returns.length} devoluciones registradas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                💰 {creditNotes.length} NC a favor proveedores
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>

            {mainTab === "customer_returns" && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 transition shadow-lg shadow-rose-500/25 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nueva Devolución
              </button>
            )}
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {mainTab === "customer_returns" ? "Total Devuelto Clientes" : "Crédito a Favor Total"}
              </span>
              <span className="text-[10px] font-bold text-rose-400">Total</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(mainTab === "customer_returns" ? returnKpis.montoTotal : ncKpis.montoTotal)}
            </p>
            <p className="text-[11px] text-slate-400">
              {mainTab === "customer_returns" ? `${returnKpis.total} solicitudes en cartera` : `${ncKpis.total} notas registradas`}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {mainTab === "customer_returns" ? "Pendientes RMA" : "Proveedores con NC"}
              </span>
              <span className="text-[10px] font-bold text-amber-400">Revisión</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {mainTab === "customer_returns" ? returnKpis.pendientes : ncKpis.proveedoresUnicos}
            </p>
            <p className="text-[11px] text-slate-400">Requieren firma o aplicación</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {mainTab === "customer_returns" ? "Stock Restaurado" : "Promedio por Nota"}
              </span>
              <span className="text-[10px] font-bold text-emerald-400">Repuesto</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {mainTab === "customer_returns" ? returnKpis.aprobadas : formatPYG(ncKpis.avgMonto)}
            </p>
            <p className="text-[11px] text-slate-400">
              {mainTab === "customer_returns" ? `${formatPYG(returnKpis.montoAprobado)} reingresado` : "Ticket promedio NC"}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {mainTab === "customer_returns" ? "Rechazadas" : "Sincronización Nemuha"}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">Auditado</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {mainTab === "customer_returns" ? returnKpis.rechazadas : "100% OK"}
            </p>
            <p className="text-[11px] text-slate-400">Sin impacto contable negativo</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "customer_returns", label: "Devoluciones de Clientes (RMA)", icon: RotateCcw, count: returns.length },
          { id: "supplier_credit_notes", label: "Notas de Crédito Proveedores", icon: Building2, count: creditNotes.length },
          { id: "supplier_returns", label: "Devoluciones a Proveedores", icon: Truck, count: supplierReturns.length },
        ].map((t) => {
          const Icon = t.icon
          const active = mainTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DEVOLUCIONES CLIENTES ══════════════════════ */}
      {mainTab === "customer_returns" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Nº devolución, Nº venta, RUC/CI o cliente..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: "todos", label: "Todas", count: returns.length },
                { id: "pendiente", label: "Pendientes", count: returnKpis.pendientes },
                { id: "aprobado", label: "Aprobadas", count: returnKpis.aprobadas },
                { id: "rechazado", label: "Rechazadas", count: returnKpis.rechazadas },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setFilterStatus(st.id)}
                  className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                    filterStatus === st.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {st.label} ({st.count})
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nº Devolución</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Venta Origen</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Motivo Principal</th>
                    <th className="p-4 text-right">Monto Devuelto</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {loadingReturns ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                        <span>Cargando devoluciones de clientes...</span>
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        No se encontraron solicitudes de devolución coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((r: any) => {
                      const saleNum = r.sale?.numero || r.sale_id?.slice(0, 8) || "—"
                      const custName = r.customer?.razon_social || r.customer_name || "Cliente General"

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                              <span>{r.numero}</span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-500 font-mono text-[11px]">
                            {r.fecha ? formatDate(r.fecha) : "—"}
                          </td>
                          <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{saleNum}
                          </td>
                          <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                            {custName}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">{motivoLabel(r.motivo || "otro")}</span>
                            {r.motivo_detalle && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{r.motivo_detalle}</p>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                            {formatPYG(Number(r.total || 0))}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_META[r.estado || "pendiente"]?.class || ""}`}>
                              {STATUS_META[r.estado || "pendiente"]?.label || r.estado}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleViewReturn(r)}
                                className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Ver Detalle RMA"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {r.estado === "pendiente" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(r)}
                                    disabled={processing === r.id}
                                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 transition"
                                    title="Aprobar & Restaurar Stock"
                                  >
                                    {processing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    <span>Aprobar</span>
                                  </button>
                                  <button
                                    onClick={() => setRejectModal(r)}
                                    disabled={processing === r.id}
                                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition"
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

      {/* ══════════════════════ TAB 2: NC PROVEEDORES ══════════════════════ */}
      {mainTab === "supplier_credit_notes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
              <input
                type="text"
                value={ncSearch}
                onChange={(e) => setNcSearch(e.target.value)}
                placeholder="Buscar por Nº de NC, Proveedor, Factura afectada u observaciones..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ncFilterMotivo}
                onChange={(e) => setNcFilterMotivo(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="todos">Todos los Motivos ({creditNotes.length})</option>
                {ncMotivosList.map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nº Nota de Crédito</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Factura Origen</th>
                    <th className="p-4">Concepto / Motivo</th>
                    <th className="p-4 text-right">Monto Acreditado</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {loadingNc ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                        <span>Cargando notas de crédito de proveedores...</span>
                      </td>
                    </tr>
                  ) : filteredCreditNotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        No se encontraron notas de crédito de proveedores.
                      </td>
                    </tr>
                  ) : (
                    filteredCreditNotes.map((nc) => (
                      <tr key={nc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{nc.numero || "NC-" + nc.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {nc.fecha ? formatDate(nc.fecha) : "—"}
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {nc.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {nc.numero_factura_origen ? `#${nc.numero_factura_origen}` : "—"}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {(nc.motivo || "CREDITO").replace(/_/g, " ")}
                          </span>
                          {nc.observaciones && (
                            <p className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">{nc.observaciones}</p>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatPYG(Number(nc.monto || 0))}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setViewingNc(nc)}
                            className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Ver Detalle NC"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* ══════════════════════ TAB 3: DEVOLUCIONES PROVEEDORES ══════════════════════ */}
      {mainTab === "supplier_returns" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
              <input
                type="text"
                value={supRetSearch}
                onChange={(e) => setSupRetSearch(e.target.value)}
                placeholder="Buscar por Proveedor, Nº Nota de Crédito o Factura..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nº Nota de Crédito</th>
                    <th className="p-4">Fecha Devolución</th>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Factura Afectada</th>
                    <th className="p-4">Observaciones / Motivo</th>
                    <th className="p-4 text-right">Monto Devuelto</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {loadingSupRet ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                        <span>Cargando devoluciones a proveedores...</span>
                      </td>
                    </tr>
                  ) : filteredSupplierReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        No se encontraron devoluciones a proveedores.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierReturns.map((sr) => (
                      <tr key={sr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-amber-600" />
                            <span>{sr.numero_nota_credito || "DEV-" + sr.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {sr.fecha ? formatDate(sr.fecha) : "—"}
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {sr.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {sr.numero_factura_origen ? `#${sr.numero_factura_origen}` : "—"}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                          {sr.observaciones || "Devolución física a proveedor"}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatPYG(Number(sr.monto || 0))}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setViewingSupRet(sr)}
                            className="p-2 text-slate-400 hover:text-amber-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Ver Detalle"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* ── MODAL: REGISTRAR DEVOLUCIÓN CLIENTE ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Registrar Devolución de Mercadería</h3>
                <p className="text-xs text-slate-400">Seleccioná el comprobante de venta origen y los productos a reintegrar</p>
              </div>
              <button onClick={() => { setShowCreate(false); resetCreateForm() }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Comprobante de Venta Origen *</label>
                {selectedSaleId ? (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Venta #{sales.find(s => s.id === selectedSaleId)?.numero || selectedSaleId.slice(0, 8)}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Cliente: {sales.find(s => s.id === selectedSaleId)?.customer?.razon_social || (sales.find(s => s.id === selectedSaleId) as any)?.customer_name || "Consumidor Final"} · Total: {formatPYG(Number(sales.find(s => s.id === selectedSaleId)?.total || 0))}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedSaleId(""); setSaleItems([]); setSelectedItems({}) }}
                      className="text-rose-500 hover:text-rose-700 font-bold"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      value={saleSearch}
                      onChange={e => setSaleSearch(e.target.value)}
                      placeholder="Buscar por Nº comprobante, RUC o cliente..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                    {saleSearch && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredSalesForModal.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSaleId(s.id)
                              setSaleSearch("")
                              handleLoadSaleItems(s.id)
                            }}
                            className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-xs">Venta #{s.numero || s.id.slice(0, 8)}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{s.customer?.razon_social || (s as any).customer_name || "Consumidor"} · RUC {s.customer?.ruc || (s as any).customer_ruc || "—"}</p>
                            </div>
                            <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(Number(s.total || 0))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {saleItems.length > 0 && (
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1.5">Ítems a Devolver & Condición Física</label>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-[9px] font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5">Producto</th>
                          <th className="p-2.5 text-center w-24">Cant. Dev.</th>
                          <th className="p-2.5 text-center w-36">Condición</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {saleItems.map((item: any) => {
                          const sel = selectedItems[item.id] || { cantidad: 0, condicion: "buen_estado", motivo_detalle: "" }
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5">
                                <p className="font-bold">{item.product_name || item.descripcion || "Producto"}</p>
                                <p className="text-[10px] text-slate-400 font-mono">Comprado: {item.cantidad} un. @ {formatPYG(item.precio_unitario)}</p>
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.cantidad}
                                  value={sel.cantidad}
                                  onChange={e => setSelectedItems(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], cantidad: Math.min(item.cantidad, Math.max(0, parseInt(e.target.value) || 0)) }
                                  }))}
                                  className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 text-center font-mono font-bold text-xs"
                                />
                              </td>
                              <td className="p-2.5">
                                <select
                                  value={sel.condicion}
                                  onChange={e => setSelectedItems(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], condicion: e.target.value }
                                  }))}
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 text-[11px] font-bold"
                                >
                                  {Object.entries(CONDICION_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Motivo Principal *</label>
                  <select
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-bold"
                  >
                    <option value="">Seleccionar motivo...</option>
                    {motivos.map(m => (
                      <option key={m} value={m}>{motivoLabel(m)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Observaciones / Auditoría</label>
                  <input
                    type="text"
                    value={motivoDetalle}
                    onChange={e => setMotivoDetalle(e.target.value)}
                    placeholder="Detalle adicional..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setShowCreate(false); resetCreateForm() }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateReturn}
                disabled={creating}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                <span>{creating ? "Registrando..." : "Registrar Devolución"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE DEVOLUCIÓN CLIENTE ── */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Devolución Nº {viewingReturn.numero}</h3>
                <p className="text-xs text-slate-400 font-mono">Venta Origen: #{(viewingReturn as any).sale?.numero || viewingReturn.sale_id?.slice(0, 8)}</p>
              </div>
              <button onClick={() => setViewingReturn(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Cliente:</span><strong className="text-slate-900 dark:text-white">{(viewingReturn as any).customer?.razon_social || (viewingReturn as any).customer_name || "Cliente General"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Motivo:</span><span className="font-bold text-rose-500">{motivoLabel(viewingReturn.motivo || "otro")}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Estado:</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_META[viewingReturn.estado || "pendiente"]?.class}`}>{STATUS_META[viewingReturn.estado || "pendiente"]?.label}</span></div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Productos Reintegrados</span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{(item as any).product_name || (item as any).descripcion || "Producto"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{item.cantidad ?? 1} un. · Condición: {condicionLabel(item.condicion || "buen_estado")}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG(Number(item.total || ((item.cantidad || 0) * (item.precio_unitario || 0)) || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
                <span>Total Reintegrado:</span>
                <span className="font-mono text-rose-600 dark:text-rose-400">{formatPYG(Number(viewingReturn.total || 0))}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewingReturn(null)} className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER NOTA DE CRÉDITO PROVEEDOR ── */}
      {viewingNc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Nota de Crédito {viewingNc.numero}</h3>
              </div>
              <button onClick={() => setViewingNc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Proveedor:</span><strong className="text-slate-900 dark:text-white">{viewingNc.supplier_nombre}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Factura Afectada:</span><span className="font-mono text-slate-700 dark:text-slate-300">#{viewingNc.numero_factura_origen || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fecha:</span><span className="font-mono text-slate-700 dark:text-slate-300">{formatDate(viewingNc.fecha)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Motivo:</span><span className="font-bold text-emerald-600">{viewingNc.motivo}</span></div>
                {viewingNc.observaciones && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500 italic">
                    "{viewingNc.observaciones}"
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
                <span>Monto a Favor:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(Number(viewingNc.monto || 0))}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewingNc(null)} className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RECHAZAR DEVOLUCIÓN ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">Rechazar Devolución {rejectModal.numero}</h3>
                <p className="text-[11px] text-slate-400">La mercadería no reingresará al stock comercial</p>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">Motivo del Rechazo *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ej: Embalaje abierto, daño causado por el cliente..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs outline-none focus:border-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setRejectModal(null); setRejectReason("") }} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cancelar
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition">
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
