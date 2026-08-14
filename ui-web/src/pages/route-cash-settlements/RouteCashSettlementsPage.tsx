import { useState, useEffect } from "react"
import { Truck, Search, Loader2, DollarSign, Users, CheckCircle2, Wallet, HandCoins, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { api } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"

interface Settlement {
  id: string
  codigo_legacy: string | null
  cobrador_codigo: string
  funcionario_codigo: string | null
  fecha: string
  fecha_cierre: string | null
  cerrado: boolean
  a_rendir: number
  total: number
  efectivo: number
  anticipo: number
  descuentos: number
  otro_egreso: number
  otro_ingreso: number
  pagares: number
  observaciones: string | null
  usuario_cierre: string | null
}

interface Summary {
  total_liquidaciones: number
  cerradas: number
  cobradores: number
  total: number
  efectivo: number
  anticipo: number
  descuentos: number
  otro_egreso: number
  otro_ingreso: number
  pagares: number
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

export default function RouteCashSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [cobradorFilter, setCobradorFilter] = useState("")

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = { fecha_desde: dateFrom || undefined, fecha_hasta: dateTo || undefined }
      const [list, sum] = await Promise.all([
        api.routeCashSettlements.list({ ...params, cobrador_codigo: cobradorFilter || undefined, limit: 500 }),
        api.routeCashSettlements.summary(params),
      ])
      setSettlements(list)
      setSummary(sum)
    } catch {
      setSettlements([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = settlements.filter(s =>
    !search ||
    s.cobrador_codigo.toLowerCase().includes(search.toLowerCase()) ||
    (s.funcionario_codigo || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.observaciones || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" />Liquidación de Caja por Cobrador
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Rendiciones diarias de cobradores/vendedores de ruta — efectivo, cheques, descuentos y anticipos.
          {summary && ` ${summary.total_liquidaciones} liquidaciones en el período · ${summary.cobradores} cobradores`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-emerald-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Total Liquidado</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(summary?.total || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Rendición total del período</span>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Efectivo Rendido</span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatPYG(summary?.efectivo || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Ingreso de caja en billetes</span>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Anticipos / Cheques</span>
            <HandCoins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(summary?.anticipo || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Anticipos y valores entregados</span>
        </div>

        <div className="card p-4 border-l-4 border-l-purple-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Cobradores Activos</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{summary?.cobradores ?? 0}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Fuerza de cobranza en ruta</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por cobrador, funcionario u observación..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="input-field w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input-field w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <input className="input-field w-36" placeholder="Cód. cobrador" value={cobradorFilter} onChange={(e) => setCobradorFilter(e.target.value)} />
        <button onClick={fetchData} className="btn-primary">Buscar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Fecha</th>
              <th className="table-cell">Cobrador</th>
              <th className="table-cell">Funcionario</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell text-right">Efectivo</th>
              <th className="table-cell text-right">Anticipo</th>
              <th className="table-cell text-right">Descuentos</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin liquidaciones en el período filtrado</td></tr>
            ) : filtered.slice(0, 200).map(s => (
              <tr key={s.id} className="table-row">
                <td className="table-td text-gray-500">{formatDate(s.fecha)}</td>
                <td className="table-td font-mono font-bold text-primary">{s.funcionario_codigo || s.cobrador_codigo}</td>
                <td className="table-td font-mono text-gray-400">{s.codigo_legacy || "Ruta"}</td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(s.a_rendir || s.total)}</td>
                <td className="table-td text-right font-mono text-blue-500">{formatPYG(s.efectivo)}</td>
                <td className="table-td text-right font-mono text-amber-500">{s.anticipo > 0 ? formatPYG(s.anticipo) : "—"}</td>
                <td className="table-td text-right font-mono text-red-500">{s.descuentos > 0 ? formatPYG(s.descuentos) : "—"}</td>
                <td className="table-td">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cerrado ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                    {s.cerrado ? "Cerrada" : "Abierta"}
                  </span>
                </td>
                <td className="table-td text-gray-500 max-w-xs truncate" title={s.observaciones || ""}>{s.observaciones || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <p className="text-xs text-amber-500 text-center py-3">Mostrando las primeras 200 de {filtered.length} — acotá con los filtros de fecha o cobrador.</p>
        )}
      </div>
    </div>
  )
}
