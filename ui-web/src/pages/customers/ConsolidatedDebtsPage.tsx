import { useState, useEffect } from "react"
import {
  DollarSign, Search, AlertCircle, RefreshCw, Eye, Phone, ShieldAlert, CreditCard, FileText, X, AlertTriangle, CheckCircle2, UserCheck, ArrowRight, Building2
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
  const [modalTab, setModalTab] = useState<"facturas" | "cheques" | "riesgo">("facturas")

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

  // Open 360 Modal and load detailed customer debt object
  const handleOpen360Modal = async (customerId: string) => {
    setSelectedCustomerId(customerId)
    setLoading360(true)
    setModalTab("facturas")
    try {
      const detail = await (api as any).customers.customerConsolidatedDebt(COMPANY_ID, customerId)
      setCustomer360Detail(detail)
    } catch {
      toast.error("Error", "No se pudo obtener el análisis 360° del cliente")
      setCustomer360Detail(null)
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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 text-white p-6 rounded-2xl border border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Deuda Total Consolidada por Cliente</h1>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Consolidación ERP
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            Consolidado unificado: Facturas Pendientes + Cheques Cartera + Cheques Devueltos + Pagarés
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-2 border border-gray-700 hover:bg-gray-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Metric Cards Grid - Uniform & Elegant Reduced Sizes */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="card p-4 border-l-4 border-l-primary flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            <span>Deuda Total ERP</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">
            {formatPYG(summary.deuda_total_sistema)}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block">Consolidado global</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            <span>Facturas Vencidas</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
            {formatPYG(summary.total_monto_vencido)}
          </p>
          <span className="text-[10px] text-red-500/80 mt-1 block">Exige gestión de cobro</span>
        </div>

        <div className="card p-4 border-l-4 border-l-rose-600 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            <span>Cheques Rechazados</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
            {formatPYG(summary.total_cheques_rechazados)}
          </p>
          <span className="text-[10px] text-rose-600/80 mt-1 block font-semibold">Riesgo Financiero</span>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            <span>Cheques Cartera</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
            {formatPYG(summary.total_cheques_cartera)}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block">Pendiente depósito</span>
        </div>

        <div className="card p-4 border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            <span>Pagarés Activos</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">
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
                <th className="table-cell text-right bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold">
                  DEUDA TOTAL CONSOLIDADA
                </th>
                <th className="table-cell text-center">Máx. Mora</th>
                <th className="table-cell text-right">Límite Crédito</th>
                <th className="table-cell">Última Compra</th>
                <th className="table-cell text-center">Acción 360°</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Calculando deuda consolidada del ERP...
                  </td>
                </tr>
              ) : !data || data.clientes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-400">
                    No se encontraron clientes con deuda registrada según los filtros.
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
                        className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1.5 mx-auto hover:scale-105 transition-all shadow-sm"
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

      {/* Customer 360 Analysis Modal */}
      {selectedCustomerId && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerId(null)}>
          <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <Building2 className="w-7 h-7 text-blue-400" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Análisis Consolidado 360° del Cliente</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    {customer360Detail?.razon_social || "Cargando cliente..."}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-300 font-mono mt-1">
                    <span>RUC: {customer360Detail?.ruc || "Sin RUC"}</span>
                    <span>·</span>
                    <span>Tel: {customer360Detail?.telefono || "No especificado"}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomerId(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {loading360 ? (
              <div className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : customer360Detail ? (
              <div className="p-6 space-y-6 text-xs">
                {/* 360 Financial Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-wider block mb-1">Deuda Consolidada</span>
                    <p className="text-base font-bold font-mono text-blue-900 dark:text-blue-200">{formatPYG(customer360Detail.deuda_total_consolidada)}</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/40">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-wider block mb-1">Facturas Pendientes</span>
                    <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(customer360Detail.facturas_pendiente)}</p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-100 dark:border-rose-900/40">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-wider block mb-1">Cheques Rechazados</span>
                    <p className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">{formatPYG(customer360Detail.cheques_rechazados)}</p>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-gray-400 text-[10px] uppercase font-black tracking-wider block mb-1">Límite de Crédito</span>
                    <p className="text-base font-bold font-mono text-indigo-900 dark:text-indigo-200">{formatPYG(customer360Detail.limite_credito)}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setModalTab("facturas")}
                    className={`px-4 py-2 font-bold uppercase tracking-wider border-b-2 -mb-px ${modalTab === "facturas" ? "text-primary border-primary" : "text-gray-400 border-transparent"}`}
                  >
                    Facturas Pendientes ({customer360Detail.facturas_detalle?.length || 0})
                  </button>
                  <button
                    onClick={() => setModalTab("cheques")}
                    className={`px-4 py-2 font-bold uppercase tracking-wider border-b-2 -mb-px ${modalTab === "cheques" ? "text-primary border-primary" : "text-gray-400 border-transparent"}`}
                  >
                    Cheques y Pagarés ({customer360Detail.cheques_detalle?.length || 0})
                  </button>
                  <button
                    onClick={() => setModalTab("riesgo")}
                    className={`px-4 py-2 font-bold uppercase tracking-wider border-b-2 -mb-px ${modalTab === "riesgo" ? "text-primary border-primary" : "text-gray-400 border-transparent"}`}
                  >
                    Evaluación de Riesgo Crediticio
                  </button>
                </div>

                {/* Tab: Facturas */}
                {modalTab === "facturas" && (
                  <div className="space-y-3">
                    {customer360Detail.facturas_detalle?.length === 0 ? (
                      <p className="text-center py-6 text-gray-400">Sin facturas pendientes registradas</p>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                              <th className="p-2.5 text-left">N° Documento</th>
                              <th className="p-2.5 text-left">Emisión</th>
                              <th className="p-2.5 text-left">Vencimiento</th>
                              <th className="p-2.5 text-right">Monto Original</th>
                              <th className="p-2.5 text-right">Saldo Pendiente</th>
                              <th className="p-2.5 text-right">Mora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {customer360Detail.facturas_detalle?.map((f: any) => (
                              <tr key={f.id} className="table-row">
                                <td className="p-2.5 font-mono font-bold text-primary">{f.numero_documento || "Factura"}</td>
                                <td className="p-2.5 text-gray-500">{formatDate(f.fecha_emision)}</td>
                                <td className="p-2.5 font-medium">{formatDate(f.fecha_vencimiento)}</td>
                                <td className="p-2.5 text-right font-mono">{formatPYG(f.monto_original)}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-amber-500">{formatPYG(f.saldo_pendiente)}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-red-500">{f.dias_mora > 0 ? `${f.dias_mora}d` : "Al día"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Cheques y Pagarés */}
                {modalTab === "cheques" && (
                  <div className="space-y-3">
                    {customer360Detail.cheques_detalle?.length === 0 ? (
                      <p className="text-center py-6 text-gray-400">Sin cheques o pagarés registrados en cartera</p>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                              <th className="p-2.5 text-left">Tipo</th>
                              <th className="p-2.5 text-left">N° Documento</th>
                              <th className="p-2.5 text-left">Banco / Entidad</th>
                              <th className="p-2.5 text-left">Vencimiento</th>
                              <th className="p-2.5 text-right">Monto</th>
                              <th className="p-2.5 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {customer360Detail.cheques_detalle?.map((ch: any) => (
                              <tr key={ch.id} className="table-row">
                                <td className="p-2.5 font-bold uppercase">{ch.tipo}</td>
                                <td className="p-2.5 font-mono font-bold">{ch.numero}</td>
                                <td className="p-2.5">{ch.banco || "—"}</td>
                                <td className="p-2.5">{formatDate(ch.fecha_vencimiento)}</td>
                                <td className="p-2.5 text-right font-mono font-bold">{formatPYG(ch.monto)}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                    ch.estado === "rechazado" ? "bg-red-100 text-red-700" :
                                    ch.estado === "cartera" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
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

                {/* Tab: Evaluación de Riesgo */}
                {modalTab === "riesgo" && (
                  <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Nivel de Riesgo Crediticio Sugerido</span>
                      <span className={`px-3 py-1 rounded-full font-black text-xs uppercase ${
                        customer360Detail.cheques_rechazados > 0 || customer360Detail.dias_mora_max > 60
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : customer360Detail.dias_mora_max > 0
                          ? "bg-amber-100 text-amber-700 border border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      }`}>
                        {customer360Detail.cheques_rechazados > 0 || customer360Detail.dias_mora_max > 60 ? "RIESGO ALTO" :
                         customer360Detail.dias_mora_max > 0 ? "RIESGO MEDIO" : "RIESGO BAJO"}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1 font-medium">
                        <span>Consumo de Crédito: {formatPYG(customer360Detail.deuda_total_consolidada)}</span>
                        <span>Límite: {formatPYG(customer360Detail.limite_credito)}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            customer360Detail.limite_credito > 0 && (customer360Detail.deuda_total_consolidada / customer360Detail.limite_credito) > 0.9
                              ? "bg-red-500" : "bg-blue-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              customer360Detail.limite_credito > 0
                                ? (customer360Detail.deuda_total_consolidada / customer360Detail.limite_credito) * 100
                                : 100,
                              100
                            )}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs">
                      <p className="font-bold text-gray-900 dark:text-white mb-1">Dictamen del Motor Finance 360°:</p>
                      {customer360Detail.cheques_rechazados > 0 ? (
                        <p className="text-red-600 font-medium">⚠️ El cliente posee cheques rechazados impagos. Se sugiere BLOQUEO PREVENTIVO para ventas a crédito hasta regularizar.</p>
                      ) : customer360Detail.dias_mora_max > 30 ? (
                        <p className="text-amber-600 font-medium">⚡ Mora superior a 30 días registrada ({customer360Detail.dias_mora_max} días). Exigir refinanciación antes de nuevas entregas.</p>
                      ) : (
                        <p className="text-emerald-600 font-medium">✅ Comportamiento crediticio saludable. Cuenta habilitada para operaciones normales.</p>
                      )}
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
