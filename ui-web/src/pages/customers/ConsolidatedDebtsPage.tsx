import { useState, useEffect } from "react"
import {
  DollarSign, Search, AlertCircle, RefreshCw, Eye, Phone, ShieldAlert, CreditCard,
  FileText, X, AlertTriangle, CheckCircle2, UserCheck, ArrowRight, Building2,
  TrendingUp, ShoppingBag, Calendar, Package, MapPin, User, BarChart2
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export interface ConsolidatedCustomerDebt {
  customer_id: string
  razon_social: string
  ruc: string | null
  telefono: string | null
  facturas_pendiente: number
  monto_vencido: number
  dias_mora_max: number
  cheques_cartera: number
  cheques_rechazados: number
  pagares: number
  deuda_total_consolidada: number
  limite_credito: number
  saldo_disponible: number
  ultima_compra?: {
    numero: string
    fecha: string
    total: number
  } | null
}

export interface ConsolidatedDebtsResponse {
  summary: {
    deuda_total_sistema: number
    total_facturas_pendiente: number
    total_monto_vencido: number
    total_cheques_cartera: number
    total_cheques_rechazados: number
    total_pagares: number
  }
  clientes: ConsolidatedCustomerDebt[]
}

export default function ConsolidatedDebtsPage() {
  const [data, setData] = useState<ConsolidatedDebtsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [soloConDeuda, setSoloConDeuda] = useState(true)
  const [soloRechazados, setSoloRechazados] = useState(false)
  
  // Selected Customer for 360 Analysis Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customer360Detail, setCustomer360Detail] = useState<any | null>(null)
  const [loading360, setLoading360] = useState(false)
  const [modalTab, setModalTab] = useState<"facturas" | "analytics" | "cheques" | "riesgo">("analytics")

  const toast = useToast()

  async function loadData() {
    setLoading(true)
    try {
      const res = await (api as any).customers.consolidatedDebts(COMPANY_ID, {
        search: search || undefined,
        solo_con_deuda: soloConDeuda,
        solo_con_rechazados: soloRechazados,
        limit: 100,
      })
      setData(res)
    } catch {
      toast.error("Error", "No se pudo cargar el consolidado de deudas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [soloConDeuda, soloRechazados])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  async function handleOpen360Modal(customerId: string) {
    setSelectedCustomerId(customerId)
    setLoading360(true)
    setModalTab("analytics")
    try {
      const detail = await (api as any).customers.customerConsolidatedDebt(COMPANY_ID, customerId)
      setCustomer360Detail(detail)
    } catch {
      toast.error("Error", "No se pudo obtener el detalle 360° del cliente")
      setSelectedCustomerId(null)
    } finally {
      setLoading360(false)
    }
  }

  const summary = data?.summary || {
    deuda_total_sistema: 0,
    total_facturas_pendiente: 0,
    total_monto_vencido: 0,
    total_cheques_cartera: 0,
    total_cheques_rechazados: 0,
    total_pagares: 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Deuda Total Consolidada
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Matriz de riesgo crediticio y consolidación 360° de Facturas, Cheques y Pagarés
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4 border-l-4 border-l-primary flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Deuda Total Sistema</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-mono text-gray-900 dark:text-white">
            {formatPYG(summary.deuda_total_sistema)}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block">Consolidado global</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Facturas Vencidas</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
            {formatPYG(summary.total_monto_vencido)}
          </p>
          <span className="text-[10px] text-red-500/80 mt-1 block font-semibold">Exige gestión de cobro</span>
        </div>

        <div className="card p-4 border-l-4 border-l-rose-600 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Cheques Rechazados</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {formatPYG(summary.total_cheques_rechazados)}
          </p>
          <span className="text-[10px] text-rose-600/80 mt-1 block font-semibold">Riesgo Financiero</span>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Cheques Cartera</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(summary.total_cheques_cartera)}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block">Pendiente depósito</span>
        </div>

        <div className="card p-4 border-l-4 border-l-indigo-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Pagarés Activos</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {formatPYG(summary.total_pagares)}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block">Documentos pagares</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por Razón Social, RUC o Cédula..."
              className="input-field pl-9 w-full text-xs font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary text-xs px-4">
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloConDeuda}
              onChange={(e) => setSoloConDeuda(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
            />
            <span>Solo clientes con Deuda ({">"} ₲ 0)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-rose-600 font-semibold">
            <input
              type="checkbox"
              checked={soloRechazados}
              onChange={(e) => setSoloRechazados(e.target.checked)}
              className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
            />
            <span>Solo con Cheques Rechazados</span>
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Cliente / RUC</th>
                <th className="table-cell text-right">Facturas Pendientes</th>
                <th className="table-cell text-right">Cheques Cartera</th>
                <th className="table-cell text-right">Cheques Rechazados</th>
                <th className="table-cell text-right">Pagarés</th>
                <th className="table-cell text-right bg-blue-50/50 dark:bg-blue-950/20 font-black">Deuda Consolidada</th>
                <th className="table-cell text-center">Mora Máx</th>
                <th className="table-cell text-right">Línea de Crédito</th>
                <th className="table-cell">Última Compra</th>
                <th className="table-cell text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <span className="text-xs text-gray-400 mt-2 block font-medium">
                      Consolidando deudas y riesgo crediticio...
                    </span>
                  </td>
                </tr>
              ) : !data || data.clientes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    No se encontraron clientes con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                data.clientes.map((c) => (
                  <tr key={c.customer_id} className="table-row">
                    <td className="table-td">
                      <div className="font-bold text-gray-900 dark:text-white">{c.razon_social}</div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono mt-0.5">
                        <span>RUC: {c.ruc || "Sin RUC"}</span>
                        {c.telefono && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Phone className="w-3 h-3" /> {c.telefono}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="table-td text-right font-mono font-medium">
                      {c.facturas_pendiente > 0 ? (
                        <span>{formatPYG(c.facturas_pendiente)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="table-td text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                      {c.cheques_cartera > 0 ? (
                        <span>{formatPYG(c.cheques_cartera)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="table-td text-right font-mono font-bold">
                      {c.cheques_rechazados > 0 ? (
                        <span className="inline-block px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded font-black">
                          {formatPYG(c.cheques_rechazados)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="table-td text-right font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {c.pagares > 0 ? (
                        <span>{formatPYG(c.pagares)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="table-td text-right font-mono font-bold text-sm text-blue-900 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                      {formatPYG(c.deuda_total_consolidada)}
                    </td>

                    <td className="table-td text-center">
                      {c.dias_mora_max > 0 ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            c.dias_mora_max > 60
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : c.dias_mora_max > 30
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                        >
                          {c.dias_mora_max}d mora
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-bold">Al día</span>
                      )}
                    </td>

                    <td className="table-td text-right font-mono text-[11px] text-gray-600 dark:text-gray-400">
                      <div>{formatPYG(c.limite_credito)}</div>
                      {c.saldo_disponible > 0 && (
                        <div className="text-[10px] text-emerald-600 font-bold">
                          Disp: {formatPYG(c.saldo_disponible)}
                        </div>
                      )}
                    </td>

                    <td className="table-td text-[11px] text-gray-500">
                      {c.ultima_compra ? (
                        <div>
                          <div className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                            N° {c.ultima_compra.numero}
                          </div>
                          <div>{c.ultima_compra.fecha ? formatDate(c.ultima_compra.fecha) : ""}</div>
                          <div className="font-mono font-medium text-gray-900 dark:text-gray-200">{formatPYG(c.ultima_compra.total)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">Sin compras</span>
                      )}
                    </td>

                    <td className="table-td text-center">
                      <button
                        onClick={() => handleOpen360Modal(c.customer_id)}
                        className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1.5 mx-auto hover:scale-105 transition-all shadow-sm font-bold"
                        title="Ver Análisis 360° Completo del Cliente"
                      >
                        <Eye className="w-3.5 h-3.5" /> <span>360°</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer 360 Analysis WOW Modal */}
      {selectedCustomerId && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerId(null)}>
          <div className="modal-content max-w-5xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-900 via-slate-900 to-blue-950 text-white rounded-t-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
                    <Building2 className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-400/20">
                        Expediente Comercial & Financiero 360°
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white mt-1">
                      {customer360Detail?.razon_social || "Cargando cliente..."}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300 font-mono mt-1.5">
                      <span>RUC: <strong className="text-white">{customer360Detail?.ruc || "Sin RUC"}</strong></span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> {customer360Detail?.telefono || "No especificado"}</span>
                      {customer360Detail?.ciudad && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {customer360Detail.ciudad}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button onClick={() => setSelectedCustomerId(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Vendedor Asignado Banner */}
              {customer360Detail?.vendedor_asignado && (
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">Vendedor Asignado</span>
                      <p className="text-sm font-bold text-white">
                        {customer360Detail.vendedor_asignado.nombre} <span className="text-xs text-gray-400 font-mono font-normal">({customer360Detail.vendedor_asignado.codigo})</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Canal / Rama</span>
                      <span className="font-bold uppercase text-white">{customer360Detail.vendedor_asignado.rama || "Mix"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Ventas Atendidas</span>
                      <span className="font-mono font-bold text-emerald-400">{customer360Detail.vendedor_asignado.ventas_atendidas} compras</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {loading360 ? (
              <div className="p-16 text-center">
                <RefreshCw className="w-10 h-10 animate-spin mx-auto text-primary" />
                <p className="text-sm text-gray-500 mt-3 font-semibold">Generando análisis 360° del cliente...</p>
              </div>
            ) : customer360Detail ? (
              <div className="p-6 space-y-6 text-xs">
                {/* 360 Metric Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-3.5 border-l-4 border-l-blue-600 bg-blue-50/50 dark:bg-blue-950/20">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest block mb-1">Deuda Consolidada</span>
                    <p className="text-lg font-black font-mono text-blue-900 dark:text-blue-200">{formatPYG(customer360Detail.deuda_total)}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">Total cartera + cheques</span>
                  </div>

                  <div className="card p-3.5 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest block mb-1">Facturas Pendientes</span>
                    <p className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{formatPYG(customer360Detail.facturas_pendiente)}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">{customer360Detail.cantidad_facturas} facturas activas</span>
                  </div>

                  <div className="card p-3.5 border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest block mb-1">Total Comprado (LTV)</span>
                    <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(customer360Detail.comportamiento?.ltv || 0)}</p>
                    <span className="text-[10px] text-emerald-600/80 mt-1 block font-bold">{customer360Detail.comportamiento?.total_compras || 0} compras históricas</span>
                  </div>

                  <div className="card p-3.5 border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest block mb-1">Ticket Promedio</span>
                    <p className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">{formatPYG(customer360Detail.comportamiento?.ticket_promedio || 0)}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">Promedio por pedido</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                  {[
                    { k: "analytics" as const, l: "Análisis de Compras & Productos", i: TrendingUp },
                    { k: "facturas" as const, l: `Facturas Pendientes (${customer360Detail.facturas_detalle?.length || 0})`, i: FileText },
                    { k: "cheques" as const, l: `Cheques & Pagarés (${customer360Detail.cheques_detalle?.length || 0})`, i: CreditCard },
                    { k: "riesgo" as const, l: "Score & Límite Crediticio", i: ShieldAlert },
                  ].map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setModalTab(t.k)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                        modalTab === t.k
                          ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <t.i className="w-3.5 h-3.5" />
                      {t.l}
                    </button>
                  ))}
                </div>

                {/* TAB 1: ANALYTICS & WOW PRODUCT BREAKDOWN */}
                {modalTab === "analytics" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Products */}
                    <div className="card p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-primary" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                            Productos Que Más Compra (Top 6)
                          </h4>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Por Facturación ₲</span>
                      </div>

                      {customer360Detail.top_productos?.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Sin historial de productos comprados</p>
                      ) : (
                        <div className="space-y-3">
                          {customer360Detail.top_productos.map((prod: any, idx: number) => {
                            const maxGs = customer360Detail.top_productos[0]?.total_gs || 1
                            const pct = Math.round((prod.total_gs / maxGs) * 100)
                            return (
                              <div key={idx} className="space-y-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-mono text-[10px] font-bold text-primary mr-1.5">{prod.sku}</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{prod.nombre}</span>
                                  </div>
                                  <span className="font-mono font-black text-gray-900 dark:text-white ml-2">{formatPYG(prod.total_gs)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-400">
                                  <span>{Math.round(prod.unidades)} unidades adquiridas</span>
                                  <span className="font-mono">{pct}% del producto top</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Seasonality / Monthly Trend */}
                    <div className="card p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-emerald-500" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                            Estacionalidad y Períodos de Compra
                          </h4>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">Historial Mensual</span>
                      </div>

                      {customer360Detail.estacionalidad_compras?.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Sin historial de períodos registrado</p>
                      ) : (
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                          {customer360Detail.estacionalidad_compras.map((t: any, idx: number) => {
                            const maxGs = Math.max(...customer360Detail.estacionalidad_compras.map((x: any) => x.total_gs))
                            const barPct = Math.round((t.total_gs / (maxGs || 1)) * 100)
                            return (
                              <div key={idx} className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> {t.mes}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">{formatPYG(t.total_gs)}</span>
                                    <span className="text-[10px] text-gray-400">{t.compras} compras en el mes</span>
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barPct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: DETALLE DE FACTURAS */}
                {modalTab === "facturas" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2">
                      <span className="font-bold uppercase tracking-wider text-gray-500 text-xs">
                        Facturas Pendientes de Cobro ({customer360Detail.facturas_detalle?.length || 0})
                      </span>
                      <span className="font-mono font-bold text-amber-600 text-xs">
                        Total Adeudado: {formatPYG(customer360Detail.facturas_pendiente)}
                      </span>
                    </div>

                    {customer360Detail.facturas_detalle?.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Sin facturas pendientes registradas</p>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="table-header">
                              <th className="table-cell">N° Factura</th>
                              <th className="table-cell">Fecha Emisión</th>
                              <th className="table-cell">Fecha Vencimiento</th>
                              <th className="table-cell text-right">Monto Original</th>
                              <th className="table-cell text-right">Saldo Pendiente</th>
                              <th className="table-cell text-center">Estado Mora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {customer360Detail.facturas_detalle.map((f: any) => (
                              <tr key={f.id} className="table-row">
                                <td className="table-td font-mono font-bold text-primary">{f.numero_documento || "Factura"}</td>
                                <td className="table-td text-gray-500 font-mono">{f.fecha_emision.slice(0, 10)}</td>
                                <td className="table-td font-mono font-medium">{f.fecha_vencimiento.slice(0, 10)}</td>
                                <td className="table-td text-right font-mono">{formatPYG(f.monto_original)}</td>
                                <td className="table-td text-right font-mono font-bold text-amber-600 dark:text-amber-400">{formatPYG(f.saldo_pendiente)}</td>
                                <td className="table-td text-center">
                                  {f.dias_mora > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                      {f.dias_mora}d mora
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Al día
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: CHEQUES & PAGARES */}
                {modalTab === "cheques" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2">
                      <span className="font-bold uppercase tracking-wider text-gray-500 text-xs">
                        Valores en Cartera, Rechazados y Pagarés ({customer360Detail.cheques_detalle?.length || 0})
                      </span>
                    </div>

                    {customer360Detail.cheques_detalle?.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">Sin cheques ni pagarés registrados para este cliente</p>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="table-header">
                              <th className="table-cell">Tipo</th>
                              <th className="table-cell">N° Valor</th>
                              <th className="table-cell">Banco Emisor</th>
                              <th className="table-cell">Vencimiento</th>
                              <th className="table-cell text-right">Monto (₲)</th>
                              <th className="table-cell text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {customer360Detail.cheques_detalle.map((ch: any) => (
                              <tr key={ch.id} className="table-row">
                                <td className="table-td uppercase font-bold text-primary">{ch.tipo}</td>
                                <td className="table-td font-mono font-bold">{ch.numero}</td>
                                <td className="table-td text-gray-600 dark:text-gray-300 font-medium">{ch.banco}</td>
                                <td className="table-td font-mono">{ch.fecha_vencimiento.slice(0, 10)}</td>
                                <td className="table-td text-right font-mono font-bold">{formatPYG(ch.monto)}</td>
                                <td className="table-td text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    ch.estado === "rechazado"
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                      : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {ch.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: RIESGO CREDITICIO */}
                {modalTab === "riesgo" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="card p-5 space-y-3 border-l-4 border-l-primary">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Línea de Crédito Comercial</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Límite Aprobado:</span>
                          <span className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(customer360Detail.limite_credito)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Saldo Utilizado:</span>
                          <span className="font-mono font-bold text-amber-600">{formatPYG(customer360Detail.saldo_utilizado)}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold">
                          <span className="text-gray-900 dark:text-white">Saldo Disponible:</span>
                          <span className="font-mono text-emerald-600">{formatPYG(customer360Detail.saldo_disponible)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card p-5 space-y-3 border-l-4 border-l-red-500">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Comportamiento & Mora</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Mora Máxima:</span>
                          <span className="font-mono font-bold text-red-600">{customer360Detail.dias_mora_max} días</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Monto Vencido:</span>
                          <span className="font-mono font-bold text-red-600">{formatPYG(customer360Detail.monto_vencido)}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold">
                          <span className="text-gray-900 dark:text-white">Riesgo General:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            customer360Detail.dias_mora_max > 60 || customer360Detail.cheques_rechazados > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {customer360Detail.dias_mora_max > 60 || customer360Detail.cheques_rechazados > 0 ? "Alto Riesgo" : "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
