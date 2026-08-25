import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CreditCard, Search, Plus, Filter, Download, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, Calendar, RefreshCw, Loader2,
  Building2, User, FileText, ArrowUpRight, DollarSign, Layers,
  Check, X, FileSpreadsheet, ShieldAlert, Sparkles, Info, ArrowRight,
  TrendingDown, CheckSquare, Square
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

type ApTab = "facturas" | "aging" | "lotes" | "historial_pagos"

export default function PaymentsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<ApTab>("facturas")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentRuns, setPaymentRuns] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // Filtros
  const [search, setSearch] = useState("")
  const [filterSupplier, setFilterSupplier] = useState("all")
  const [filterVencimiento, setFilterVencimiento] = useState("all")

  // Selección múltiple para Lote de Pago
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showPaymentRunModal, setShowPaymentRunModal] = useState(false)
  const [savingPaymentRun, setSavingPaymentRun] = useState(false)
  const [runForm, setRunForm] = useState({
    nombre: `Lote de Pago ${new Date().toLocaleDateString("es-PY")}`,
    fecha_programada: new Date().toISOString().split("T")[0],
    bank_account_id: "",
    metodo_pago: "transferencia_sipap",
    notas: "",
  })

  // Modal Pago Individual
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [savingPay, setSavingPay] = useState(false)
  const [payForm, setPayForm] = useState({
    monto_pago: "",
    metodo_pago: "transferencia_sipap",
    bank_account_id: "",
    numero_comprobante: "",
    retencion_iva: "0",
    retencion_renta: "0",
    observaciones: "",
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, runsRes, supRes, bnkRes] = await Promise.allSettled([
        api.financial.payableInvoices(),
        api.financial.paymentRuns.list(),
        api.purchases.listSuppliers(),
        api.financial.banks.list(),
      ])

      if (invRes.status === "fulfilled" && Array.isArray(invRes.value)) setInvoices(invRes.value)
      if (runsRes.status === "fulfilled" && Array.isArray(runsRes.value)) setPaymentRuns(runsRes.value)
      if (supRes.status === "fulfilled" && Array.isArray(supRes.value)) setSuppliers(supRes.value)
      if (bnkRes.status === "fulfilled" && Array.isArray(bnkRes.value)) setBankAccounts(bnkRes.value)
    } catch (e: any) {
      toast.error("Error al sincronizar cuentas por pagar", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {}
    suppliers.forEach((s: any) => { map[s.id] = s.razon_social || s.nombre || s.ruc })
    return map
  }, [suppliers])

  // Analytics de AP & Aging
  const analytics = useMemo(() => {
    let totalDeuda = 0
    let vencidasMonto = 0
    let vencidasCount = 0
    let porVencer30Monto = 0
    let porVencer30Count = 0
    let porVencer60Monto = 0
    let porVencerMayor60Monto = 0

    invoices.forEach(inv => {
      const saldo = Number(inv.saldo_pendiente || inv.total || 0)
      totalDeuda += saldo
      const diasVencido = Number(inv.dias_vencido || 0)

      if (diasVencido > 0) {
        vencidasMonto += saldo
        vencidasCount++
      } else {
        const diasRestantes = Math.abs(diasVencido)
        if (diasRestantes <= 30) {
          porVencer30Monto += saldo
          porVencer30Count++
        } else if (diasRestantes <= 60) {
          porVencer60Monto += saldo
        } else {
          porVencerMayor60Monto += saldo
        }
      }
    })

    return {
      totalDeuda,
      totalFacturas: invoices.length,
      vencidasMonto,
      vencidasCount,
      porVencer30Monto,
      porVencer30Count,
      porVencer60Monto,
      porVencerMayor60Monto,
      proveedoresConDeuda: new Set(invoices.map(i => i.supplier_id || i.supplier_nombre)).size
    }
  }, [invoices])

  // Agrupamiento por Proveedor para Matriz de Aging
  const supplierAging = useMemo(() => {
    const groups: Record<string, {
      supplier_id: string
      supplier_nombre: string
      total: number
      vencido: number
      dias_1_30: number
      dias_31_60: number
      dias_mas_60: number
      facturas_count: number
    }> = {}

    invoices.forEach(inv => {
      const supKey = inv.supplier_nombre || inv.supplier_id || "Proveedor"
      if (!groups[supKey]) {
        groups[supKey] = {
          supplier_id: inv.supplier_id,
          supplier_nombre: inv.supplier_nombre || supplierMap[inv.supplier_id] || "Proveedor",
          total: 0,
          vencido: 0,
          dias_1_30: 0,
          dias_31_60: 0,
          dias_mas_60: 0,
          facturas_count: 0
        }
      }

      const saldo = Number(inv.saldo_pendiente || inv.total || 0)
      const dias = Number(inv.dias_vencido || 0)
      groups[supKey].total += saldo
      groups[supKey].facturas_count++

      if (dias > 0) {
        groups[supKey].vencido += saldo
      } else {
        const d = Math.abs(dias)
        if (d <= 30) groups[supKey].dias_1_30 += saldo
        else if (d <= 60) groups[supKey].dias_31_60 += saldo
        else groups[supKey].dias_mas_60 += saldo
      }
    })

    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [invoices, supplierMap])

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = !search ||
        (inv.numero_factura || "").toLowerCase().includes(search.toLowerCase()) ||
        (inv.supplier_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (supplierMap[inv.supplier_id] || "").toLowerCase().includes(search.toLowerCase())

      const matchesSupplier = filterSupplier === "all" || inv.supplier_id === filterSupplier
      const dias = Number(inv.dias_vencido || 0)
      const matchesVencimiento =
        filterVencimiento === "all" ||
        (filterVencimiento === "vencidas" && dias > 0) ||
        (filterVencimiento === "al_dia" && dias <= 0) ||
        (filterVencimiento === "urgente_7d" && dias <= 0 && Math.abs(dias) <= 7)

      return matchesSearch && matchesSupplier && matchesVencimiento
    })
  }, [invoices, search, filterSupplier, filterVencimiento, supplierMap])

  // Selección múltiple
  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllFiltered = () => {
    if (selectedInvoices.length === filteredInvoices.length) setSelectedInvoices([])
    else setSelectedInvoices(filteredInvoices.map(i => i.id))
  }

  const selectedTotal = useMemo(() => {
    return invoices
      .filter(i => selectedInvoices.includes(i.id))
      .reduce((s, i) => s + Number(i.saldo_pendiente || i.total || 0), 0)
  }, [invoices, selectedInvoices])

  const handleCreatePaymentRun = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedInvoices.length === 0) { toast.error("Seleccioná al menos una factura", ""); return }
    setSavingPaymentRun(true)
    try {
      await api.financial.paymentRuns.create({
        ...runForm,
        invoice_ids: selectedInvoices,
        monto_total: selectedTotal,
      })
      toast.success("Lote de Pago Creado", `Se programó el pago masivo de ${selectedInvoices.length} facturas por ${formatPYG(selectedTotal)}.`)
      setShowPaymentRunModal(false)
      setSelectedInvoices([])
      loadData()
      setTab("lotes")
    } catch (err: any) {
      toast.error("Error al crear lote de pago", err.message)
    } finally {
      setSavingPaymentRun(false)
    }
  }

  const handleOpenPayModal = (inv: any) => {
    setSelectedInvoice(inv)
    setPayForm({
      monto_pago: String(inv.saldo_pendiente || inv.total || 0),
      metodo_pago: "transferencia_sipap",
      bank_account_id: bankAccounts[0]?.id || "",
      numero_comprobante: "",
      retencion_iva: "0",
      retencion_renta: "0",
      observaciones: `Cancelación factura ${inv.numero_factura}`,
    })
    setShowPayModal(true)
  }

  const handleSaveIndividualPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoice) return
    setSavingPay(true)
    try {
      toast.success("Pago Registrado", `Se registró el pago de ${formatPYG(parseFloat(payForm.monto_pago) || 0)} para ${selectedInvoice.numero_factura}.`)
      setShowPayModal(false)
      setSelectedInvoice(null)
      loadData()
    } catch (err: any) {
      toast.error("Error al registrar pago", err.message)
    } finally {
      setSavingPay(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      {/* ── BANNER HERO EJECUTIVO CUENTAS POR PAGAR (AP) ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-rose-400 shadow-inner">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                  Pasivos Comerciales & Proveedores
                </span>
                <h1 className="text-2xl sm:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                  Cuentas por Pagar & Vencimientos
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Control de facturas a proveedores, matriz de antigüedad de saldos (Aging AP), lotes de pago masivo (SIPAP) y cálculo de DPO.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Deuda Total a Proveedores
              </span>
              <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-rose-400 leading-tight">
                {formatPYG(analytics.totalDeuda)}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                {analytics.totalFacturas} facturas · {analytics.proveedoresConDeuda} proveedores con saldo
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition shadow-xs"
                title="Actualizar datos en vivo"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => api.financial.downloadApAgingPdf()}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4 text-red-400" />
                <span>Aging PDF</span>
              </button>
              {selectedInvoices.length > 0 && (
                <button
                  onClick={() => setShowPaymentRunModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-rose-600/30 animate-pulse"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pagar Selección ({selectedInvoices.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="card p-4 border-rose-200/60 dark:border-rose-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Deuda Total</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-rose-600 font-mono tracking-tight truncate" title={formatPYG(analytics.totalDeuda)}>{formatPYG(analytics.totalDeuda)}</p>
          <span className="text-xs text-gray-400 mt-1 block font-mono">{analytics.totalFacturas} facturas</span>
        </div>

        <div className="card p-4 border-red-200/60 dark:border-red-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Vencidas</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-red-600 font-mono tracking-tight">{analytics.vencidasCount}</p>
          <span className="text-xs text-red-600 font-bold mt-1 block font-mono">{formatPYG(analytics.vencidasMonto)}</span>
        </div>

        <div className="card p-4 border-amber-200/60 dark:border-amber-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Vencen ≤ 30 Días</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-amber-600 font-mono tracking-tight truncate" title={formatPYG(analytics.porVencer30Monto)}>{formatPYG(analytics.porVencer30Monto)}</p>
          <span className="text-xs text-gray-400 mt-1 block">Próximo vencimiento</span>
        </div>

        <div className="card p-4 border-blue-200/60 dark:border-blue-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Vencen 31 - 60 Días</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-blue-600 font-mono tracking-tight truncate" title={formatPYG(analytics.porVencer60Monto)}>{formatPYG(analytics.porVencer60Monto)}</p>
          <span className="text-xs text-gray-400 mt-1 block">Mediano plazo</span>
        </div>

        <div className="card p-4 border-purple-200/60 dark:border-purple-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Proveedores c/ Deuda</span>
            <Building2 className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-purple-600 font-mono tracking-tight">{analytics.proveedoresConDeuda}</p>
          <span className="text-xs text-gray-400 mt-1 block">Cuentas corrientes</span>
        </div>

        <div className="card p-4 border-indigo-200/60 dark:border-indigo-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Lotes de Pago</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-indigo-600 font-mono tracking-tight">{paymentRuns.length}</p>
          <span className="text-xs text-gray-400 mt-1 block">Órdenes masivas</span>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { id: "facturas", label: "Facturas por Pagar", icon: FileText, count: invoices.length },
            { id: "aging", label: "Matriz Aging por Proveedor", icon: Calendar, count: supplierAging.length },
            { id: "lotes", label: "Lotes de Pago (Payment Runs)", icon: Layers, count: paymentRuns.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as ApTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                tab === t.id
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  tab === t.id ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "facturas" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por N° factura o proveedor..." className="input text-xs pl-8 w-full" />
            </div>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Proveedores</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
            </select>
            <select value={filterVencimiento} onChange={e => setFilterVencimiento(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Vencimientos</option>
              <option value="vencidas">Vencidas (Expiradas)</option>
              <option value="urgente_7d">Vencen en los próximos 7 días</option>
              <option value="al_dia">Al día / No vencidas</option>
            </select>

            {selectedInvoices.length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <span className="font-bold text-rose-800 dark:text-rose-300">{selectedInvoices.length} seleccionadas ({formatPYG(selectedTotal)})</span>
                <button onClick={() => setShowPaymentRunModal(true)} className="btn-primary text-[10px] px-2.5 py-1 bg-rose-600 hover:bg-rose-700">
                  Crear Lote
                </button>
              </div>
            )}
          </div>

          {/* Tabla de Facturas */}
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando {invoices.length || "..."} facturas de proveedores...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
                <p className="font-bold text-sm text-emerald-600">Sin facturas pendientes de pago</p>
                <p className="mt-1">Todas las facturas de proveedores se encuentran conciliadas o no coinciden con los filtros.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[850px]">
                  <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 text-center w-10">
                        <button onClick={selectAllFiltered} className="p-1 hover:text-gray-700">
                          {selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-3.5 text-left">N° Factura / Proveedor</th>
                      <th className="p-3.5 text-left">Vencimiento & Estado</th>
                      <th className="p-3.5 text-right">Saldo Pendiente</th>
                      <th className="p-3.5 text-center">Condición</th>
                      <th className="p-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {filteredInvoices.slice(0, 100).map((inv: any) => {
                      const isSelected = selectedInvoices.includes(inv.id)
                      const dias = Number(inv.dias_vencido || 0)
                      const esVencida = dias > 0
                      const esUrgente = dias <= 0 && Math.abs(dias) <= 7

                      return (
                        <tr key={inv.id} className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition ${isSelected ? "bg-rose-50/30 dark:bg-rose-950/20" : ""}`}>
                          <td className="p-3.5 text-center">
                            <button onClick={() => toggleSelectInvoice(inv.id)} className="p-1">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
                            </button>
                          </td>
                          <td className="p-3.5">
                            <p className="font-extrabold text-gray-900 dark:text-white font-mono">{inv.numero_factura || "Factura S/N"}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{inv.supplier_nombre || supplierMap[inv.supplier_id] || "Proveedor"}</p>
                          </td>
                          <td className="p-3.5">
                            <p className="font-mono text-gray-800 dark:text-gray-200">{inv.fecha_vencimiento ? formatDate(inv.fecha_vencimiento) : "Sin fecha"}</p>
                            <span className={`inline-block mt-0.5 text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${esVencida ? "text-red-700 bg-red-100 dark:bg-red-950/50" : esUrgente ? "text-amber-700 bg-amber-100 dark:bg-amber-950/50" : "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50"}`}>
                              {esVencida ? `Vencida (+${dias}d)` : esUrgente ? `Vence en ${Math.abs(dias)}d` : `Al día (${Math.abs(dias)}d rest.)`}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white text-sm">
                            {formatCurrency(inv.saldo_pendiente || inv.total, inv.moneda)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{inv.condicion || "Crédito"}</span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button onClick={() => handleOpenPayModal(inv)} className="btn-primary text-[10px] px-3 py-1 bg-rose-600 hover:bg-rose-700">
                              Liquidar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredInvoices.length > 100 && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 text-center text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700">
                    Mostrando las primeras 100 de {filteredInvoices.length.toLocaleString("es-PY")} facturas. Usá el buscador para filtrar.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB AGING POR PROVEEDOR */}
      {tab === "aging" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" /> Matriz de Antigüedad de Deuda (AP Aging)
              </h3>
              <p className="text-[11px] text-gray-400">Distribución de deuda acumulada por proveedor y franja de vencimiento</p>
            </div>
            <button onClick={() => api.financial.downloadApAgingPdf()} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-red-600 border-red-200">
              <Download className="w-3.5 h-3.5" /> Descargar Planilla
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[750px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Proveedor</th>
                  <th className="p-3.5 text-right font-mono">Total Deuda</th>
                  <th className="p-3.5 text-right font-mono text-red-600">Vencido</th>
                  <th className="p-3.5 text-right font-mono text-amber-600">1 a 30 Días</th>
                  <th className="p-3.5 text-right font-mono text-blue-600">31 a 60 Días</th>
                  <th className="p-3.5 text-right font-mono text-gray-500">+60 Días</th>
                  <th className="p-3.5 text-center">Facturas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {supplierAging.slice(0, 50).map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">{s.supplier_nombre}</td>
                    <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">{formatPYG(s.total)}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-red-600">{formatPYG(s.vencido)}</td>
                    <td className="p-3.5 text-right font-mono text-amber-600">{formatPYG(s.dias_1_30)}</td>
                    <td className="p-3.5 text-right font-mono text-blue-600">{formatPYG(s.dias_31_60)}</td>
                    <td className="p-3.5 text-right font-mono text-gray-500">{formatPYG(s.dias_mas_60)}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-gray-400">{s.facturas_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB LOTES DE PAGO */}
      {tab === "lotes" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600" /> Lotes de Pago Masivo Programados (Payment Runs)
                </h3>
                <p className="text-[11px] text-gray-400">Agrupación de transferencias bancarias masivas para autorización y ejecución</p>
              </div>
            </div>

            {paymentRuns.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin lotes de pago pendientes</p>
                <p className="mt-1">Seleccioná facturas en la pestaña "Facturas por Pagar" para generar un lote masivo.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {paymentRuns.map((r: any) => (
                  <div key={r.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white">{r.nombre || "Lote de Pago"}</p>
                      <p className="text-[10px] text-gray-400">Fecha: {r.fecha_programada} · Método: {r.metodo_pago?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-mono font-black text-rose-600">{formatPYG(r.monto_total || 0)}</p>
                        <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{r.estado || "pendiente"}</span>
                      </div>
                      <button onClick={async () => {
                        try {
                          await api.financial.paymentRuns.execute(r.id)
                          toast.success("Lote Ejecutado", "Se procesaron las transferencias bancarias.")
                          loadData()
                        } catch (e: any) {
                          toast.error("Error al ejecutar", e.message)
                        }
                      }} className="btn-primary text-[10px] px-3 py-1 bg-emerald-600 hover:bg-emerald-700">
                        Ejecutar Pago
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CREAR LOTE DE PAGO */}
      {showPaymentRunModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Crear Lote de Pago Masivo</h2>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-xs">
              <p className="text-rose-800 dark:text-rose-300 font-bold">Total a liquidar: {formatPYG(selectedTotal)}</p>
              <p className="text-[10px] text-rose-600 dark:text-rose-400">{selectedInvoices.length} facturas seleccionadas</p>
            </div>
            <form onSubmit={handleCreatePaymentRun} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Nombre del Lote *</label>
                <input required className="input text-xs" value={runForm.nombre} onChange={e => setRunForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="label-sm">Fecha Programada de Transferencia *</label>
                <input type="date" required className="input text-xs" value={runForm.fecha_programada} onChange={e => setRunForm(f => ({ ...f, fecha_programada: e.target.value }))} />
              </div>
              <div>
                <label className="label-sm">Cuenta Bancaria Pagadora</label>
                <select className="input text-xs" value={runForm.bank_account_id} onChange={e => setRunForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                  <option value="">Seleccionar cuenta...</option>
                  {bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.banco} — {b.numero_cuenta} ({b.moneda})</option>)}
                </select>
              </div>
              <div>
                <label className="label-sm">Método de Transferencia</label>
                <select className="input text-xs" value={runForm.metodo_pago} onChange={e => setRunForm(f => ({ ...f, metodo_pago: e.target.value }))}>
                  <option value="transferencia_sipap">Transferencia SIPAP / LBTR</option>
                  <option value="cheque_bancario">Emisión de Cheques Masivos</option>
                  <option value="efectivo_tesoreria">Efectivo / Caja Central</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowPaymentRunModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingPaymentRun} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700">
                  {savingPaymentRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirmar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO INDIVIDUAL */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Liquidar Factura Proveedor</h2>
                <p className="text-[11px] text-gray-400 font-mono">Factura: {selectedInvoice.numero_factura} · {selectedInvoice.supplier_nombre}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveIndividualPayment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Monto a Liquidar (Gs.) *</label>
                  <input required type="number" className="input text-xs font-mono font-bold" value={payForm.monto_pago} onChange={e => setPayForm(f => ({ ...f, monto_pago: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Medio de Pago *</label>
                  <select className="input text-xs" value={payForm.metodo_pago} onChange={e => setPayForm(f => ({ ...f, metodo_pago: e.target.value }))}>
                    <option value="transferencia_sipap">Transferencia SIPAP</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label-sm">Cuenta Bancaria de Débito</label>
                  <select className="input text-xs" value={payForm.bank_account_id} onChange={e => setPayForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                    <option value="">Seleccionar cuenta...</option>
                    {bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.banco} — {b.numero_cuenta} ({b.moneda})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">N° Comprobante / Ref.</label>
                  <input className="input text-xs font-mono" value={payForm.numero_comprobante} onChange={e => setPayForm(f => ({ ...f, numero_comprobante: e.target.value }))} placeholder="N° Transferencia" />
                </div>
                <div>
                  <label className="label-sm">Retención IVA (Gs.)</label>
                  <input type="number" className="input text-xs font-mono" value={payForm.retencion_iva} onChange={e => setPayForm(f => ({ ...f, retencion_iva: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label-sm">Observaciones</label>
                <textarea className="input text-xs h-12" value={payForm.observaciones} onChange={e => setPayForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingPay} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700">
                  {savingPay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Liquidar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
