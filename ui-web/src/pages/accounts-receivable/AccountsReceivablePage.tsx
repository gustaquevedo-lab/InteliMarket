import { useState, useEffect } from "react"
import { Search, ReceiptText, Clock, AlertTriangle, DollarSign, FileText, Loader2, Calendar, Eye, X } from "lucide-react"
import { api, type AccountsReceivable } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

type TabType = "documentos" | "aging"

interface AgingData {
  total_pendiente: number
  cantidad_documentos: number
  buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[]
  por_clientes: {
    customer_id: string
    customer_name: string
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
}

export default function AccountsReceivablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsReceivable[]>([])
  const [aging, setAging] = useState<AgingData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("pendiente")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [showReciboModal, setShowReciboModal] = useState(false)
  const [reciboForm, setReciboForm] = useState({ cliente: "", monto: "", medio: "efectivo", ref: "", obs: "" })
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [docsData, agingData, summaryData] = await Promise.all([
        api.accountsReceivable.list({ estado: filterStatus }),
        api.accountsReceivable.aging(),
        api.accountsReceivable.summary(),
      ])
      setDocs(docsData)
      setAging(agingData)
      setSummary(summaryData)
    } catch {
      setDocs([])
      setAging(null)
      setSummary(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  const filtered = docs.filter(d =>
    !search || d.numero_documento?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const statusMap: Record<string, string> = {
    pendiente: "badge-warning",
    pagado: "badge-success",
    vencido: "badge-danger",
  }

  const totalSaldo = docs.reduce((a, b) => a + (b.saldo_pendiente || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ReceiptText className="w-6 h-6 text-primary" />Cuentas por Cobrar (AR)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{docs.length} documentos registrados en gestión</p>
        </div>
        <button onClick={() => setShowReciboModal(true)} className="btn-primary flex items-center gap-2">
          <span>+ Emitir Recibo de Cobranza Oficial N°</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Pendiente</span></div>
          <p className="text-2xl font-bold text-amber-500">{formatPYG(summary?.total_pendiente || 0)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><AlertTriangle className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos Vencidos</span></div>
          <p className="text-2xl font-bold text-red-500">{summary?.vencidos || 0}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto Vencido</span></div>
          <p className="text-2xl font-bold text-red-500">{formatPYG(summary?.monto_vencido || 0)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><FileText className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos Totales</span></div>
          <p className="text-2xl font-bold text-blue-500">{summary?.total || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["documentos", "aging"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${tab === t ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            {t === "documentos" ? "Documentos" : "Aging"}
          </button>
        ))}
      </div>

      {/* Documentos Tab */}
      {tab === "documentos" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por documento o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="vencido">Vencido</option>
            </select>
            <button onClick={fetchData} className="btn-primary">Actualizar</button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Nro Documento</th>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Fecha Emisión</th>
                  <th className="table-cell">Vencimiento</th>
                  <th className="table-cell text-right">Monto Original</th>
                  <th className="table-cell text-right">Saldo</th>
                  <th className="table-cell text-right">Días Mora</th>
                  <th className="table-cell">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron documentos</td></tr>
                ) : filtered.map(d => {
                  const overdue = (d.dias_mora || 0) > 0
                  return (
                    <tr key={d.id} className={`table-row ${overdue ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                      <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_documento || "—"}</td>
                      <td className="table-td"><span className={`text-sm font-medium ${overdue ? "text-red-700 dark:text-red-300" : ""}`}>{d.customer_name}</span></td>
                      <td className="table-td text-sm text-gray-500">{formatDate(d.fecha_emision)}</td>
                      <td className={`table-td text-sm ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(d.monto_original)}</td>
                      <td className={`table-td text-right font-mono font-bold ${(d.saldo_pendiente || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>{formatPYG(d.saldo_pendiente)}</td>
                      <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{(d.dias_mora || 0) > 0 ? `${d.dias_mora}d` : "—"}</td>
                      <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Aging Tab */}
      {tab === "aging" && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : aging ? (
            <>
              {/* Aging Buckets */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {aging.buckets.map(b => {
                  const barColor =
                    b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "bg-green-500" :
                    b.rango.includes("1-30") ? "bg-yellow-500" :
                    b.rango.includes("31-60") ? "bg-orange-500" :
                    b.rango.includes("61-90") ? "bg-red-500" : "bg-red-700"
                  return (
                    <div key={b.rango} className="card p-5 flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">{b.rango}</span>
                      <p className={`text-lg font-bold ${b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "text-green-500" : "text-red-500"}`}>{formatPYG(b.monto)}</p>
                      <p className="text-xs text-gray-400 mb-3">{b.cantidad} docs · {formatPercentage(b.porcentaje)}</p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-auto">
                        <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(b.porcentaje, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Customer Breakdown */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Desglose por Cliente</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Cliente</th>
                      <th className="table-cell text-right">Documentos</th>
                      <th className="table-cell text-right">Al día</th>
                      <th className="table-cell text-right">1-30</th>
                      <th className="table-cell text-right">31-60</th>
                      <th className="table-cell text-right">61-90</th>
                      <th className="table-cell text-right">+90</th>
                      <th className="table-cell text-right">Saldo Total</th>
                      <th className="table-cell"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.por_clientes.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin clientes con saldo pendiente</td></tr>
                    ) : aging.por_clientes.map(c => {
                      const overdueTotal = c.days_1_30 + c.days_31_60 + c.days_61_90 + c.days_91_plus
                      const totalBuckets = c.saldo_total || 1
                      return (
                        <tr key={c.customer_id} className="table-row">
                          <td className="table-td"><span className="text-sm font-medium">{c.customer_name}</span></td>
                          <td className="table-td text-right font-mono">{c.total_documentos}</td>
                          <td className="table-td text-right font-mono text-green-600">{formatPYG(c.current)}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_1_30 > 0 ? "#eab308" : undefined }}>{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_31_60 > 0 ? "#f97316" : undefined }}>{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_61_90 > 0 ? "#ef4444" : undefined }}>{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_91_plus > 0 ? "#b91c1c" : undefined }}>{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold">{formatPYG(c.saldo_total)}</td>
                          <td className="table-td">
                            <button
                              className="btn-ghost"
                              title="Ver detalle"
                              onClick={() => setExpandedCustomer(expandedCustomer === c.customer_id ? null : c.customer_id)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">No hay datos de aging disponibles</div>
          )}
        </div>
      )}

      {/* Customer Detail Modal */}
      {expandedCustomer && aging && (
        <div className="modal-overlay" onClick={() => setExpandedCustomer(null)}>
          <div className="modal-content max-w-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {aging.por_clientes.find(c => c.customer_id === expandedCustomer)?.customer_name || "Cliente"}
              </h3>
              <button onClick={() => setExpandedCustomer(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {aging.buckets.map(b => {
                  const matching = aging.por_clientes.find(c => c.customer_id === expandedCustomer)
                  const bucketMap: Record<string, number> = {
                    "Al día": matching?.current || 0,
                    "1-30": matching?.days_1_30 || 0,
                    "31-60": matching?.days_31_60 || 0,
                    "61-90": matching?.days_61_90 || 0,
                    "+90": matching?.days_91_plus || 0,
                  }
                  const val = bucketMap[b.rango] || 0
                  return (
                    <div key={b.rango} className="card p-4">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400">{b.rango}</span>
                      <p className="text-lg font-bold mt-1">{formatPYG(val)}</p>
                    </div>
                  )
                })}
                <div className="card p-4 border-amber-500/30">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Saldo Total</span>
                  <p className="text-lg font-bold mt-1 text-amber-500">{formatPYG(aging.por_clientes.find(c => c.customer_id === expandedCustomer)?.saldo_total || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
                {aging.buckets.map(b => {
                  const matching = aging.por_clientes.find(c => c.customer_id === expandedCustomer)
                  const bucketMap: Record<string, number> = {
                    "Al día": matching?.current || 0,
                    "1-30": matching?.days_1_30 || 0,
                    "31-60": matching?.days_31_60 || 0,
                    "61-90": matching?.days_61_90 || 0,
                    "+90": matching?.days_91_plus || 0,
                  }
                  const val = bucketMap[b.rango] || 0
                  const pct = matching?.saldo_total ? (val / matching.saldo_total) * 100 : 0
                  const barColor =
                    b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "bg-green-500" :
                    b.rango.includes("1-30") ? "bg-yellow-500" :
                    b.rango.includes("31-60") ? "bg-orange-500" :
                    b.rango.includes("61-90") ? "bg-red-500" : "bg-red-700"
                  return (
                    <div key={b.rango}>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-center">{formatPercentage(pct)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
