import { useState, useEffect } from "react"
import {
  Search, ReceiptText, Clock, AlertTriangle, DollarSign, FileText, Loader2,
  Calendar, Eye, X, Package, Wallet, Sparkles, PhoneCall, CreditCard, Plus,
  TrendingUp, FileSpreadsheet, FileDown, CheckCircle2, ChevronDown, ChevronRight,
  User, Check, Phone, ArrowUpRight, ShieldCheck, RefreshCw, BarChart2
} from "lucide-react"
import { api, type AccountsReceivable, type Sale, type SaleItem, type CreditAccount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TabType = "documentos" | "aging" | "scoring" | "recibos"

interface CustomerScore {
  id: string
  customer_id: string
  customer_nombre: string | null
  score: number
  pago_puntual: number
  dias_mora_promedio: number
  antiguedad_dias: number
  total_compras: number
  total_pagos: number
  veces_mora: number
  ultima_actualizacion: string | null
}

interface AgingData {
  total_pendiente: number
  cantidad_documentos: number
  buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[]
  por_clientes: {
    customer_id: string
    customer_name: string
    customer_ruc?: string
    customer_telefono?: string
    saldo_total: number
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_91_plus: number
    total_documentos: number
  }[]
}

interface SummaryData {
  total: number
  total_pendiente: number
  pagados: number
  pendientes: number
  vencidos: number
  monto_vencido: number
  dso: number | null
}

interface PendingDoc {
  id: string
  numero_documento: string
  fecha_emision: string
  fecha_vencimiento: string | null
  moneda: string
  monto_original: number
  saldo_pendiente: number
  dias_mora: number
}

interface CollectionAction {
  id: string
  customer_id: string
  receivable_id?: string | null
  tipo: string
  fecha: string
  resultado?: string | null
  notas?: string | null
  contacto?: string | null
  proximo_contacto?: string | null
  compromiso_pago?: string | null
  monto_comprometido?: number | null
}

export default function AccountsReceivablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsReceivable[]>([])
  const [aging, setAging] = useState<AgingData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [scores, setScores] = useState<CustomerScore[]>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<AccountsReceivable | null>(null)
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<SaleItem[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [docPayments, setDocPayments] = useState<{ id: string; fecha: string; forma_pago: string | null; referencia: string | null; monto: number }[]>([])
  const [customerDocs, setCustomerDocs] = useState<AccountsReceivable[]>([])

  // Recibos e Historial de Cobros
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // Reportes exportables (Aging / Cobranzas)
  const [reportFechaDesde, setReportFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [reportFechaHasta, setReportFechaHasta] = useState(() => new Date().toISOString().split("T")[0])

  // Registrar pago
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null)
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [payFormaPago, setPayFormaPago] = useState("efectivo")
  const [payReferencia, setPayReferencia] = useState("")
  const [payFecha, setPayFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [payObservaciones, setPayObservaciones] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Cobranzas + linea de credito
  const [collectionActions, setCollectionActions] = useState<CollectionAction[]>([])
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [collectionForm, setCollectionForm] = useState({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })

  const toast = useToast()

  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const [docsTotal, setDocsTotal] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const estadoParam = filterStatus !== "todos" ? filterStatus : undefined
      const [docsData, countData, agingData, summaryData] = await Promise.all([
        api.accountsReceivable.list({ estado: estadoParam, search: search || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        api.accountsReceivable.count({ estado: estadoParam }),
        api.accountsReceivable.aging(),
        api.accountsReceivable.summary(),
      ])
      setDocs(docsData)
      setDocsTotal(countData.total)
      setAging(agingData)
      setSummary(summaryData)
    } catch {
      setDocs([])
      setDocsTotal(0)
      setAging(null)
      setSummary(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [filterStatus, page])
  useEffect(() => { setPage(0) }, [filterStatus, search])

  const fetchScoring = async () => {
    setScoresLoading(true)
    try {
      const data = await api.integratedFinance.listCustomerScores(COMPANY_ID)
      setScores(data)
    } catch {
      toast.error("Error", "No se pudieron cargar los scores de crédito")
    } finally {
      setScoresLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "scoring" && scores.length === 0) fetchScoring()
  }, [tab])

  const openInvoice = async (doc: AccountsReceivable) => {
    setSelectedDoc(doc)
    setInvoiceSale(null)
    setInvoiceItems([])
    setDocPayments([])
    api.accountsReceivable.documentPayments(doc.id).then(setDocPayments).catch(() => setDocPayments([]))
    if (!doc.sale_id) return
    setInvoiceLoading(true)
    try {
      const [sale, items] = await Promise.all([
        api.sales.get(doc.sale_id),
        api.sales.items(doc.sale_id),
      ])
      setInvoiceSale(sale)
      setInvoiceItems(items)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la factura")
    } finally {
      setInvoiceLoading(false)
    }
  }

  const openCustomer = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
      return
    }
    setExpandedCustomer(customerId)
    setCollectionActions([])
    setCreditAccount(null)
    setCustomerDocs([])
    api.integratedFinance.listCollectionActions(COMPANY_ID, customerId).then(setCollectionActions).catch(() => setCollectionActions([]))
    api.creditAccounts.getByCustomer(customerId).then(setCreditAccount).catch(() => setCreditAccount(null))
    api.accountsReceivable.list({ customer_id: customerId, limit: 500 }).then(setCustomerDocs).catch(() => setCustomerDocs([]))
  }

  const openPaymentModal = async (customerId: string) => {
    setShowPaymentModal(customerId)
    setAllocations({})
    setPayReferencia("")
    setPayObservaciones("")
    setPendingLoading(true)
    try {
      const docs = await api.accountsReceivable.pendingForCustomer(customerId)
      setPendingDocs(docs)
    } catch {
      toast.error("Error", "No se pudieron cargar los documentos pendientes")
      setPendingDocs([])
    } finally {
      setPendingLoading(false)
    }
  }

  const montoTotalPago = Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)

  const handleAutoDistribuir = () => {
    const monto = prompt("¿Cuánto pagó el cliente en total? (₲)")
    if (!monto) return
    let restante = parseFloat(monto) || 0
    const nuevas: Record<string, string> = {}
    for (const d of pendingDocs) {
      if (restante <= 0) break
      const aplicar = Math.min(restante, d.saldo_pendiente)
      if (aplicar > 0) { nuevas[d.id] = String(aplicar); restante -= aplicar }
    }
    setAllocations(nuevas)
  }

  const handleSubmitPayment = async () => {
    if (!showPaymentModal) return
    const allocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([id, v]) => ({ accounts_receivable_id: id, monto: parseFloat(v) }))
    if (allocs.length === 0) { toast.error("Error", "Asigná un monto a al menos un documento"); return }
    setSubmittingPayment(true)
    try {
      const res = await api.accountsReceivable.registerPayment({
        customer_id: showPaymentModal, monto_total: montoTotalPago, forma_pago: payFormaPago,
        referencia: payReferencia || undefined, fecha: payFecha, observaciones: payObservaciones || undefined,
        allocations: allocs,
      })
      toast.success("Pago registrado", `${formatPYG(montoTotalPago)} aplicado a ${allocs.length} documento(s)`)
      setShowPaymentModal(null)
      fetchData()
      if (expandedCustomer) openCustomer(expandedCustomer)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar el pago")
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleCreateCollectionAction = async () => {
    if (!expandedCustomer) return
    try {
      await api.integratedFinance.createCollectionAction({
        company_id: COMPANY_ID, customer_id: expandedCustomer,
        receivable_id: selectedDoc?.id,
        tipo: collectionForm.tipo, resultado: collectionForm.resultado || undefined,
        notas: collectionForm.notas || undefined, contacto: collectionForm.contacto || undefined,
        proximo_contacto: collectionForm.proximo_contacto || undefined,
        compromiso_pago: collectionForm.compromiso_pago || undefined,
        monto_comprometido: collectionForm.monto_comprometido ? Number(collectionForm.monto_comprometido) : undefined,
      })
      toast.success("Gestión registrada")
      setShowCollectionForm(false)
      setCollectionForm({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })
      openCustomer(expandedCustomer)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar la gestión")
    }
  }

  const handleRecalculateScoring = async () => {
    try {
      await api.integratedFinance.recalculateAllScores(COMPANY_ID)
      toast.success("Scoring actualizado", "Los puntajes de todos los clientes han sido recalculados")
      fetchScoring()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo recalcular el scoring")
    }
  }

  const reportParams = { fecha_desde: reportFechaDesde, fecha_hasta: reportFechaHasta }
  const handleDownloadAgingExcel = () => api.accountsReceivable.downloadAgingExcel(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadAgingPdf = () => api.accountsReceivable.downloadAgingPdf(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadCobranzasExcel = () => api.accountsReceivable.downloadCobranzasExcel(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadCobranzasPdf = () => api.accountsReceivable.downloadCobranzasPdf(reportParams).catch((e: any) => toast.error("Error", e.message))

  const filteredDocs = docs.filter(d =>
    !search ||
    d.numero_documento?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Excelente", class: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200" }
    if (score >= 60) return { label: "Bueno", class: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200" }
    if (score >= 40) return { label: "Regular", class: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200" }
    return { label: "Riesgoso", class: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200" }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      {/* ── BANNER HERO EJECUTIVO CUENTAS POR COBRAR ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-emerald-400 shadow-inner">
                <ReceiptText className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Créditos de Socios Extra Club & Cobranzas
                </span>
                <h1 className="text-2xl sm:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                  Cuentas por Cobrar & Matriz Aging
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Gestión de líneas de crédito a clientes, scoring crediticio, seguimiento de cuotas vencidas y planillas de cobranza.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Cartera por Cobrar
              </span>
              <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-emerald-400 leading-tight">
                {formatPYG(summary?.total_pendiente || 0)}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                {summary?.pendientes || 0} cuentas activas · DSO: {summary?.dso != null ? `${summary.dso.toFixed(0)}d` : "—"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setRefreshing(true); fetchData(); if (tab === "scoring") fetchScoring(); }}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition shadow-xs"
                title="Actualizar datos en vivo"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button onClick={handleDownloadAgingPdf} className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shadow-xs">
                <FileDown className="w-4 h-4 text-red-400" />
                <span>Aging PDF</span>
              </button>
              <button onClick={handleDownloadAgingExcel} className="px-3.5 py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/30 text-xs font-bold transition flex items-center gap-2 shadow-xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Aging Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="card p-4 border-amber-200/60 dark:border-amber-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Total Pendiente</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-amber-600 font-mono tracking-tight truncate">{formatPYG(summary?.total_pendiente || 0)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{summary?.pendientes || 0} facturas por cobrar</span>
        </div>

        <div className="card p-4 border-purple-200/60 dark:border-purple-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">DSO (Plazo Medio)</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-purple-600 font-mono tracking-tight truncate">{summary?.dso != null ? `${summary.dso.toFixed(0)} días` : "—"}</p>
          <span className="text-xs text-gray-400 mt-1 block">Días venta pendientes</span>
        </div>

        <div className="card p-4 border-red-200/60 dark:border-red-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Documentos Vencidos</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-red-600 font-mono tracking-tight truncate">{summary?.vencidos || 0}</p>
          <span className="text-xs text-gray-400 mt-1 block">En mora activa</span>
        </div>

        <div className="card p-4 border-red-200/60 dark:border-red-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Monto Vencido</span>
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-red-600 font-mono tracking-tight truncate">{formatPYG(summary?.monto_vencido || 0)}</p>
          <span className="text-xs text-gray-400 mt-1 block">Cartera en riesgo</span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Documentos Totales</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-gray-900 dark:text-white font-mono tracking-tight truncate">{docsTotal.toLocaleString("es-PY")}</p>
          <span className="text-xs text-gray-400 mt-1 block">{summary?.pagados || 0} ya cancelados</span>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "documentos", label: "Documentos por Cobrar", icon: ReceiptText, count: docsTotal },
            { key: "aging", label: "Matriz de Aging (Antigüedad)", icon: BarChart2, count: aging?.por_clientes?.length },
            { key: "scoring", label: "Scoring Crediticio & Riesgo", icon: ShieldCheck, count: scores.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  tab === t.key ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* TAB 1: DOCUMENTOS POR COBRAR */}
          {tab === "documentos" && (
            <div className="space-y-5">
              {/* Barra de Filtros */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-48">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="todos">Todos los estados</option>
                      <option value="pendiente">Solo Pendientes</option>
                      <option value="pagado">Solo Pagados</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[240px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="N° factura, cliente, RUC..."
                        className="input-field pl-9 w-full text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Documentos */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Documento</th>
                        <th className="p-3.5">Cliente</th>
                        <th className="p-3.5">Emisión</th>
                        <th className="p-3.5">Vencimiento</th>
                        <th className="p-3.5">Monto Original</th>
                        <th className="p-3.5">Saldo Pendiente</th>
                        <th className="p-3.5">Mora</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {filteredDocs.map(d => {
                        const isMora = (d.dias_mora || 0) > 0 && d.estado === "pendiente"
                        return (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {d.numero_documento || "—"}
                            </td>
                            <td className="p-3.5 font-medium text-gray-900 dark:text-white max-w-xs truncate" title={d.customer_name}>
                              {d.customer_name || "Cliente general"}
                            </td>
                            <td className="p-3.5 text-xs text-gray-500 font-mono">
                              {d.fecha_emision ? new Date(d.fecha_emision).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 text-xs font-mono">
                              {d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                              {formatPYG(d.monto_original)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {formatPYG(d.saldo_pendiente)}
                            </td>
                            <td className="p-3.5 text-xs font-mono font-semibold">
                              {isMora ? (
                                <span className="text-red-600">{d.dias_mora} días</span>
                              ) : d.estado === "pendiente" ? (
                                <span className="text-emerald-600">Al día</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                d.estado === "pagado"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                  : isMora
                                  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                              }`}>
                                {d.estado === "pagado" ? "Pagado" : isMora ? "Vencido" : "Pendiente"}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openInvoice(d)}
                                  className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Detalle
                                </button>
                                {d.estado === "pendiente" && d.customer_id && (
                                  <button
                                    onClick={() => openPaymentModal(d.customer_id!)}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Cobrar
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

                {/* Paginación */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                  <span>Mostrando página {page + 1} de {Math.ceil(docsTotal / PAGE_SIZE) || 1}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="btn-outline py-1 px-3 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= docsTotal}
                      className="btn-outline py-1 px-3 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIZ DE AGING */}
          {tab === "aging" && (
            <div className="space-y-6">
              {/* Tarjetas de Buckets de Antigüedad */}
              {aging && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {aging.buckets.map((b, i) => {
                    const isMoraAlta = b.rango.includes("61-90") || b.rango.includes("+90")
                    return (
                      <div key={b.rango} className={`card p-5 ${isMoraAlta ? "border-red-200 dark:border-red-900/30 bg-red-50/10" : ""}`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{b.rango}</div>
                        <div className={`text-xl font-extrabold mt-1 font-mono ${isMoraAlta ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
                          {formatPYG(b.monto)}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <span>{b.cantidad} facturas</span>
                          <span className="font-semibold">{b.porcentaje}% del total</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Tabla de Clientes con Deuda */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Desglose de Deuda por Cliente ({aging?.por_clientes?.length || 0})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Hacé clic en un cliente para ver sus documentos y registrar gestiones</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Cliente</th>
                        <th className="p-3.5">Al Día</th>
                        <th className="p-3.5">1-30d</th>
                        <th className="p-3.5">31-60d</th>
                        <th className="p-3.5">61-90d</th>
                        <th className="p-3.5">+90d</th>
                        <th className="p-3.5">Saldo Total</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {aging?.por_clientes.map(c => {
                        const isExpanded = expandedCustomer === c.customer_id
                        return (
                          <>
                            <tr
                              key={c.customer_id}
                              onClick={() => openCustomer(c.customer_id)}
                              className={`cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}
                            >
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                  <div>
                                    <div>{c.customer_name}</div>
                                    <div className="text-xs text-gray-400 font-mono font-normal">
                                      {c.customer_ruc ? `RUC: ${c.customer_ruc}` : ""} {c.customer_telefono ? `· Tel: ${c.customer_telefono}` : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono text-xs text-emerald-600 font-semibold">{c.current > 0 ? formatPYG(c.current) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-amber-600">{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-orange-600">{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-red-500 font-bold">{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-red-700 font-black">{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                              <td className="p-3.5 font-mono font-extrabold text-gray-900 dark:text-white">{formatPYG(c.saldo_total)}</td>
                              <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => api.accountsReceivable.downloadStatementPdf(c.customer_id)}
                                    className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                    title="Descargar Estado de Cuenta en PDF"
                                  >
                                    <FileDown className="w-3.5 h-3.5 text-red-500" /> Estado de Cuenta
                                  </button>
                                  <button
                                    onClick={() => openPaymentModal(c.customer_id)}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Cobrar
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Detalle Desplegable del Cliente */}
                            {isExpanded && (
                              <tr className="bg-gray-50/70 dark:bg-slate-800/40">
                                <td colSpan={8} className="p-5">
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
                                      <div className="flex items-center gap-4 text-xs">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">Documentos del Cliente ({customerDocs.length})</span>
                                        {creditAccount && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">
                                            Límite: {formatPYG(creditAccount.limite_credito)} (Disponible: {formatPYG(creditAccount.saldo_disponible)})
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setShowCollectionForm(true)}
                                        className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                      >
                                        <PhoneCall className="w-3.5 h-3.5 text-primary" /> Registrar Gestión de Cobro
                                      </button>
                                    </div>

                                    {/* Lista de facturas de este cliente */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {customerDocs.map(d => (
                                        <div key={d.id} className="p-3 rounded-lg border bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                                          <div>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{d.numero_documento}</span>
                                            <div className="text-gray-400 text-[11px] mt-0.5">
                                              Emisión: {d.fecha_emision} · Vence: {d.fecha_vencimiento}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(d.saldo_pendiente)}</div>
                                            <span className={`text-[10px] font-semibold ${d.estado === "pagado" ? "text-emerald-600" : "text-amber-600"}`}>
                                              {d.estado === "pagado" ? "Pagado" : `${d.dias_mora || 0}d mora`}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Gestiones de Cobranza Registradas */}
                                    {collectionActions.length > 0 && (
                                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Historial de Gestiones de Cobro</h5>
                                        <div className="space-y-1.5">
                                          {collectionActions.map(act => (
                                            <div key={act.id} className="p-2.5 rounded bg-white dark:bg-slate-800 text-xs flex items-center justify-between">
                                              <div>
                                                <span className="font-semibold capitalize text-primary">{act.tipo}</span>: {act.resultado || act.notas || "Sin detalle"}
                                              </div>
                                              <span className="text-[11px] text-gray-400 font-mono">{act.fecha}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCORING & RIESGO */}
          {tab === "scoring" && (
            <div className="space-y-5">
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-slate-800/90 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider block">Evaluación Automatizada de Riesgo</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Scoring Crediticio de Clientes</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    El puntaje se calcula analizando el porcentaje de pagos puntuales, promedio de días de atraso, volumen total comprado y frecuencia de pago.
                  </p>
                </div>
                <button
                  onClick={handleRecalculateScoring}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" /> Recalcular Scores
                </button>
              </div>

              <div className="card p-0 overflow-hidden">
                {scoresLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : scores.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No hay scores calculados aún. Hacé clic en "Recalcular Scores".</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Cliente</th>
                          <th className="p-3.5">Score (1-100)</th>
                          <th className="p-3.5">Calificación</th>
                          <th className="p-3.5">Pago Puntual</th>
                          <th className="p-3.5">Mora Promedio</th>
                          <th className="p-3.5">Total Compras</th>
                          <th className="p-3.5">Total Pagos</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {scores.map(s => {
                          const badge = getScoreBadge(s.score)
                          return (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                {s.customer_nombre || "Cliente"}
                              </td>
                              <td className="p-3.5 font-mono font-extrabold text-base text-gray-900 dark:text-white">
                                {s.score}
                              </td>
                              <td className="p-3.5">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.class}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-xs">
                                <span className="font-bold text-emerald-600">{(s.pago_puntual * 100).toFixed(0)}%</span>
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                {s.dias_mora_promedio > 0 ? `${s.dias_mora_promedio} días` : "0 días"}
                              </td>
                              <td className="p-3.5 font-mono font-semibold text-gray-900 dark:text-white">
                                {formatPYG(s.total_compras)}
                              </td>
                              <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                                {formatPYG(s.total_pagos)}
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => openPaymentModal(s.customer_id)}
                                  className="btn-outline py-1 px-2.5 text-xs"
                                >
                                  Cobrar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Registrar Cobro Multi-Factura */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Registrar Cobro de Cliente
              </h3>
              <p className="text-xs text-gray-500 mt-1">Imputá el monto recibido entre las facturas pendientes del cliente</p>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label-field">Forma de Pago</label>
                  <select className="input-field text-xs" value={payFormaPago} onChange={e => setPayFormaPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta_debito">Tarjeta Débito</option>
                    <option value="tarjeta_credito">Tarjeta Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">N° Referencia / Boleta</label>
                  <input className="input-field text-xs" placeholder="Ej: Transf. 984124" value={payReferencia} onChange={e => setPayReferencia(e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Fecha de Cobro</label>
                  <input className="input-field text-xs" type="date" value={payFecha} onChange={e => setPayFecha(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Facturas Pendientes de Cobro</span>
                <button onClick={handleAutoDistribuir} className="btn-outline py-1 px-2.5 text-xs text-primary font-semibold">
                  Distribuir Automáticamente (FIFO)
                </button>
              </div>

              {pendingLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pendingDocs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">Este cliente no tiene facturas pendientes de cobro</div>
              ) : (
                <div className="space-y-2">
                  {pendingDocs.map(doc => (
                    <div key={doc.id} className="p-3 rounded-lg border bg-gray-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white font-mono">{doc.numero_documento}</div>
                        <div className="text-gray-400 text-[11px]">
                          Vence: {doc.fecha_vencimiento} · Saldo actual: <span className="font-bold text-gray-700 dark:text-gray-300">{formatPYG(doc.saldo_pendiente)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-[11px]">₲</span>
                        <input
                          type="number"
                          placeholder="0"
                          className="input-field text-right w-32 font-mono font-bold text-xs"
                          value={allocations[doc.id] || ""}
                          onChange={e => setAllocations({ ...allocations, [doc.id]: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Total a Imputar</span>
                <span className="text-xl font-extrabold text-primary font-mono">{formatPYG(montoTotalPago)}</span>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSubmitPayment} disabled={submittingPayment || montoTotalPago <= 0} className="btn-primary text-xs disabled:opacity-50 flex items-center gap-2">
                {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detalle de Factura */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Documento N° {selectedDoc.numero_documento}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedDoc.customer_name}</p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-800">
                <div><span className="text-gray-400 block text-[11px]">Monto Original</span><span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{formatPYG(selectedDoc.monto_original)}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Saldo Pendiente</span><span className="font-mono font-bold text-sm text-primary">{formatPYG(selectedDoc.saldo_pendiente)}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Fecha Emisión</span><span className="font-mono text-gray-700 dark:text-gray-300">{selectedDoc.fecha_emision}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Fecha Vencimiento</span><span className="font-mono text-gray-700 dark:text-gray-300">{selectedDoc.fecha_vencimiento || "—"}</span></div>
              </div>

              {invoiceItems.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-2 text-[11px]">Ítems Facturados</h5>
                  <div className="space-y-1">
                    {invoiceItems.map(item => (
                      <div key={item.id} className="p-2 rounded border flex items-center justify-between">
                        <span>{item.descripcion || item.producto?.nombre || "Producto"} (x{item.cantidad || 1})</span>
                        <span className="font-mono font-semibold">{formatPYG(item.total || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {docPayments.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-2 text-[11px]">Historial de Pagos Aplicados</h5>
                  <div className="space-y-1">
                    {docPayments.map(p => (
                      <div key={p.id} className="p-2 rounded bg-emerald-50/50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between">
                        <span>{p.fecha} · {p.forma_pago || "Pago"} {p.referencia ? `(${p.referencia})` : ""}</span>
                        <span className="font-mono font-bold">{formatPYG(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setSelectedDoc(null)} className="btn-outline text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Gestión de Cobranza */}
      {showCollectionForm && (
        <div className="modal-overlay" onClick={() => setShowCollectionForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Gestión de Cobranza</h3>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Tipo de Contacto</label>
                <select className="input-field" value={collectionForm.tipo} onChange={e => setCollectionForm({ ...collectionForm, tipo: e.target.value })}>
                  <option value="llamada">Llamada Telefónica</option>
                  <option value="whatsapp">Mensaje de WhatsApp</option>
                  <option value="visita">Visita Presencial</option>
                  <option value="correo">Correo Electrónico</option>
                </select>
              </div>
              <div>
                <label className="label-field">Resultado / Acuerdo</label>
                <input className="input-field" placeholder="Ej: Prometió pagar el viernes" value={collectionForm.resultado} onChange={e => setCollectionForm({ ...collectionForm, resultado: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Fecha Compromiso de Pago</label>
                <input className="input-field" type="date" value={collectionForm.compromiso_pago} onChange={e => setCollectionForm({ ...collectionForm, compromiso_pago: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Monto Comprometido (₲)</label>
                <input className="input-field font-mono" type="number" value={collectionForm.monto_comprometido} onChange={e => setCollectionForm({ ...collectionForm, monto_comprometido: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCollectionForm(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleCreateCollectionAction} className="btn-primary text-xs">Guardar Gestión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
