import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, Package, Users, ShoppingCart, Download,
  Loader2, FileSpreadsheet, Clock,
} from "lucide-react"
import { api, GerencialDashboard, GerencialDeptoPyl, GerencialProductoRanking, GerencialVentaPorHora } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"]

export default function GerencialPage() {
  const [tab, setTab] = useState<"dashboard" | "deptos" | "ranking">("dashboard")
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [dashboard, setDashboard] = useState<GerencialDashboard | null>(null)
  const [deptos, setDeptos] = useState<GerencialDeptoPyl[]>([])
  const [ranking, setRanking] = useState<GerencialProductoRanking[]>([])
  const [sortBy, setSortBy] = useState<"total_ventas" | "margen" | "rotacion_dias">("total_ventas")
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta

    try {
      if (tab === "dashboard") {
        const data = await api.gerencial.dashboard(params as any)
        setDashboard(data)
      } else if (tab === "deptos") {
        const data = await api.gerencial.deptos(params as any)
        setDeptos(data)
      } else {
        const data = await api.gerencial.ranking({ ...params, limit: 20 } as any)
        setRanking(data)
      }
    } catch {
      toast.error("Error", "No se pudieron cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [tab])

  const sortedRanking = [...ranking].sort((a, b) => {
    if (sortBy === "margen") return b.margen - a.margen
    if (sortBy === "rotacion_dias") return (a.rotacion_dias ?? 999) - (b.rotacion_dias ?? 999)
    return b.total_ventas - a.total_ventas
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes Gerenciales</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Dashboard, P&L y ranking de productos</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="input-field w-fit text-sm" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="input-field w-fit text-sm" />
          <button onClick={fetchData} className="btn-outline text-sm"><Download className="w-4 h-4" />Actualizar</button>
          <button
            onClick={() => api.gerencial.exportExcel(tab, {
              ...(desde && { desde }),
              ...(hasta && { hasta }),
            })}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <FileSpreadsheet className="w-4 h-4" />Exportar
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(["dashboard", "deptos", "ranking"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${tab === t ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            {t === "dashboard" ? "Dashboard" : t === "deptos" ? "P&L por Departamento" : "Ranking Productos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : tab === "dashboard" && dashboard ? (
        <DashboardView data={dashboard} />
      ) : tab === "deptos" ? (
        <DeptosView data={deptos} />
      ) : (
        <RankingView data={sortedRanking} sortBy={sortBy} onSort={setSortBy} />
      )}
    </div>
  )
}

function DashboardView({ data }: { data: GerencialDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-green-500" />} label="Hoy" value={formatPYG(data.ventas_hoy)} />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-blue-500" />} label="Semana" value={formatPYG(data.ventas_semana)} />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-primary" />} label="Mes" value={formatPYG(data.ventas_mes)} />
        <KpiCard icon={<BarChart3 className="w-5 h-5 text-purple-500" />} label="Margen" value={`${data.margen_promedio}%`} />
        <KpiCard icon={<ShoppingCart className="w-5 h-5 text-amber-500" />} label="Ticket Prom" value={formatPYG(data.ticket_promedio)} />
        <KpiCard icon={<Users className="w-5 h-5 text-teal-500" />} label="Clientes" value={String(data.clientes_atendidos)} />
        <KpiCard icon={<Package className="w-5 h-5 text-pink-500" />} label="Productos" value={String(data.productos_vendidos)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Ventas por Hora</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.ventas_por_hora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hora" tickFormatter={(h) => `${h}:00`} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => formatPYG(v)} />
              <Bar dataKey="total_ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">P&L por Departamento</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.deptos} dataKey="ventas" nameKey="depto" cx="50%" cy="50%" outerRadius={90} label={({ depto, ventas }: any) => `${depto} (${((ventas / Math.max(...data.deptos.map(d => d.ventas))) * 100).toFixed(0)}%)`}>
                {data.deptos.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatPYG(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Top 10 Productos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Cantidad</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Ventas</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Margen</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Participación</th>
              </tr>
            </thead>
            <tbody>
              {data.top_productos.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3">
                    <div className="font-medium">{p.producto_nombre}</div>
                    {p.categoria && <div className="text-xs text-gray-400">{p.categoria}</div>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{p.cantidad_vendida}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(p.total_ventas)}</td>
                  <td className="py-2 px-3 text-right font-mono">{p.margen}%</td>
                  <td className="py-2 px-3 text-right font-mono text-gray-500">{p.participacion_porcentaje}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span></div>
      <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  )
}

function DeptosView({ data }: { data: GerencialDeptoPyl[] }) {
  if (data.length === 0) {
    return <div className="card p-8 text-center text-gray-400">Sin datos de departamentos</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">P&L por Departamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Departamento</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Ventas</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Costo</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Margen</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Margen %</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Merma</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Markdowns</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 px-3 font-medium">{d.depto}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatPYG(d.ventas)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatPYG(d.costo_ventas)}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-green-600">{formatPYG(d.margen_bruto)}</td>
                  <td className="py-2 px-3 text-right font-mono">{d.margen_porcentaje}%</td>
                  <td className="py-2 px-3 text-right font-mono text-red-500">{formatPYG(d.merma_total)}</td>
                  <td className="py-2 px-3 text-right font-mono">{d.markdowns_activos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Ventas por Departamento</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" fontSize={11} />
            <YAxis dataKey="depto" type="category" width={100} fontSize={11} />
            <Tooltip formatter={(v: number) => formatPYG(v)} />
            <Bar dataKey="ventas" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="costo_ventas" fill="#EF4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RankingView({
  data, sortBy, onSort,
}: {
  data: GerencialProductoRanking[]
  sortBy: string
  onSort: (s: "total_ventas" | "margen" | "rotacion_dias") => void
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Ranking de Productos</h3>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { key: "total_ventas", label: "Ventas" },
            { key: "margen", label: "Margen" },
            { key: "rotacion_dias", label: "Rotación" },
          ].map((opt) => (
            <button key={opt.key} onClick={() => onSort(opt.key as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === opt.key ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">#</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Producto</th>
              <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Categoría</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Cantidad</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Ventas</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Margen %</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Rotación (días)</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Participación</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 px-3 text-gray-400 font-mono">{i + 1}</td>
                <td className="py-2 px-3">
                  <div className="font-medium">{p.producto_nombre}</div>
                </td>
                <td className="py-2 px-3 text-gray-500">{p.categoria || "—"}</td>
                <td className="py-2 px-3 text-right font-mono">{p.cantidad_vendida}</td>
                <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(p.total_ventas)}</td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-mono font-bold ${p.margen >= 0 ? "text-green-500" : "text-red-500"}`}>{p.margen}%</span>
                </td>
                <td className="py-2 px-3 text-right font-mono">{p.rotacion_dias != null ? p.rotacion_dias.toFixed(1) : "—"}</td>
                <td className="py-2 px-3 text-right font-mono text-gray-500">{p.participacion_porcentaje}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
