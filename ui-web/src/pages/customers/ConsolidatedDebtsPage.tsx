import { useState, useEffect } from "react"
import {
  DollarSign, Search, Filter, AlertTriangle, AlertCircle, CheckCircle, Clock, FileText,
  CreditCard, TrendingUp, RefreshCw, Eye, Phone, Building2, ShieldAlert, ArrowUpDown, ChevronRight, User
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
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
    } catch (err: any) {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-800/40">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black tracking-tight">Deuda Total Consolidada por Cliente</h1>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide">
              Motor Legacy Recreado
            </span>
          </div>
          <p className="text-blue-200 text-sm">
            Suma unificada de 4 fuentes: Facturas por Cobrar + Cheques en Cartera + Cheques Devueltos/Rechazados + Pagarés
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2 border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar Datos
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-5 border-l-4 border-l-primary bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Deuda Total ERP</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatPYG(summary.deuda_total_sistema)}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Consolidado general</span>
        </div>

        <div className="card p-5 border-l-4 border-l-red-500 bg-gradient-to-br from-white to-red-50/30 dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Facturas Vencidas</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
            {formatPYG(summary.total_monto_vencido)}
          </p>
          <span className="text-[11px] text-red-500/80 mt-1 block font-medium">Requieren gestión inmediata</span>
        </div>

        <div className="card p-5 border-l-4 border-l-rose-600 bg-gradient-to-br from-white to-rose-50/30 dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Cheques Rechazados</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatPYG(summary.total_cheques_rechazados)}
          </p>
          <span className="text-[11px] text-rose-600/80 mt-1 block font-bold">Riesgo Financiero Alto</span>
        </div>

        <div className="card p-5 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Cheques en Cartera</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatPYG(summary.total_cheques_cartera)}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">A depositar / acreditación</span>
        </div>

        <div className="card p-5 border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Pagarés</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatPYG(summary.total_pagares)}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Documentos pagaré a cobrar</span>
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
              className="input-field pl-9 w-full text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary text-sm px-4">
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
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
            <span>Ver solo con Cheques Rechazados</span>
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-600 dark:text-gray-300">
                <th className="p-3.5">Cliente / RUC</th>
                <th className="p-3.5 text-right">Facturas Pendientes</th>
                <th className="p-3.5 text-right">Cheques Cartera</th>
                <th className="p-3.5 text-right">Cheques Rechazados</th>
                <th className="p-3.5 text-right">Pagarés</th>
                <th className="p-3.5 text-right bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300">
                  DEUDA TOTAL CONSOLIDADA
                </th>
                <th className="p-3.5 text-center">Máx. Mora</th>
                <th className="p-3.5 text-right">Límite Crédito</th>
                <th className="p-3.5">Última Compra</th>
                <th className="p-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
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
                  <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{c.razon_social}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                        <span>RUC: {c.ruc || "Sin RUC"}</span>
                        {c.telefono && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Phone className="w-3 h-3" /> {c.telefono}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3.5 text-right font-mono font-medium">
                      {c.facturas_pendiente > 0 ? (
                        <span>{formatPYG(c.facturas_pendiente)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono font-medium text-amber-700 dark:text-amber-400">
                      {c.cheques_cartera > 0 ? (
                        <span>{formatPYG(c.cheques_cartera)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold">
                      {c.cheques_rechazados > 0 ? (
                        <span className="inline-block px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded font-black">
                          {formatPYG(c.cheques_rechazados)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono font-medium text-indigo-700 dark:text-indigo-400">
                      {c.pagares > 0 ? (
                        <span>{formatPYG(c.pagares)}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono font-black text-base text-blue-900 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                      {formatPYG(c.deuda_total_consolidada)}
                    </td>

                    <td className="p-3.5 text-center">
                      {c.dias_mora_max > 0 ? (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                            c.dias_mora_max > 60
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : c.dias_mora_max > 30
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                        >
                          {c.dias_mora_max} días
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">Al día</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono text-xs text-gray-600 dark:text-gray-400">
                      <div>{formatPYG(c.limite_credito)}</div>
                      {c.saldo_disponible > 0 && (
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          Disp: {formatPYG(c.saldo_disponible)}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-xs text-gray-500">
                      {c.ultima_compra ? (
                        <div>
                          <div className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                            N° {c.ultima_compra.numero}
                          </div>
                          <div>{c.ultima_compra.fecha ? new Date(c.ultima_compra.fecha).toLocaleDateString("es-PY") : ""}</div>
                          <div className="font-mono font-medium">{formatPYG(c.ultima_compra.total)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">Sin compras</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedCustomerId(c.customer_id)}
                        className="btn-outline text-xs px-2.5 py-1 flex items-center gap-1 ml-auto hover:bg-primary hover:text-white transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> 360°
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
  )
}
