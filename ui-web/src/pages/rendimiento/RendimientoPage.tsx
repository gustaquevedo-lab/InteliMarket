import { useState, useEffect } from "react"
import { Trophy, TrendingUp, TrendingDown, BarChart3, Target, Users, DollarSign, ShoppingCart, Clock, MapPin, Star, RefreshCw } from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts"

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export default function RendimientoPage() {
  const { user } = useAuth()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"
  const [sellers, setSellers] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const [selectedSeller, setSelectedSeller] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [period, setPeriod] = useState("daily")
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        api.distribuidora.tracking.sellers.list(companyId).catch(() => []),
        api.distribuidora.tracking.performance.ranking(companyId, period).catch(() => []),
      ])
      setSellers(s || [])
      setRanking(r || [])
    } catch {}
    setLoading(false)
  }

  const loadHistory = async (sellerId: string) => {
    try {
      const h = await api.distribuidora.tracking.performance.history(sellerId, period, 30)
      setHistory(h || [])
    } catch { setHistory([]) }
  }

  const selectSeller = (s: any) => {
    setSelectedSeller(s)
    if (s) loadHistory(s.seller_id || s.id)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    if (score >= 40) return "text-orange-500"
    return "text-red-500"
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-50 dark:bg-green-900/10 border-green-200"
    if (score >= 60) return "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200"
    if (score >= 40) return "bg-orange-50 dark:bg-orange-900/10 border-orange-200"
    return "bg-red-50 dark:bg-red-900/10 border-red-200"
  }

  // Chart data
  const barData = ranking.map((r: any) => ({
    name: sellers.find((s: any) => (s.seller_id || s.id) === r.seller_id)?.user_nombre || r.seller_id?.slice(0, 6),
    score: r.performance_score || 0,
    visits: r.completed_visits || 0,
    amount: Number((r.total_amount || 0) / 1000000).toFixed(1),
  }))

  const lineData = history.map((h: any) => ({
    period: new Date(h.period_start).toLocaleDateString(),
    score: h.performance_score || 0,
    visits: h.completed_visits || 0,
    amount: Number((h.total_amount || 0) / 1000000).toFixed(1),
  }))

  const pieData = [
    { name: "Completadas", value: ranking.reduce((s, r) => s + (r.completed_visits || 0), 0) },
    { name: "Perdidas", value: ranking.reduce((s, r) => s + (r.missed_visits || 0), 0) },
    { name: "Sin respuesta", value: ranking.reduce((s, r) => s + (r.no_answer_count || 0), 0) },
  ].filter(d => d.value > 0)

  const avgScore = ranking.length ? Math.round(ranking.reduce((s, r) => s + (r.performance_score || 0), 0) / ranking.length) : 0
  const topSeller = ranking.length > 0 ? ranking[0] : null
  const totalAmount = ranking.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const totalVisits = ranking.reduce((s, r) => s + (r.completed_visits || 0), 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rendimiento de Vendedores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Métricas, rankings y tendencias</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="daily">Diario</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
        </select>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500">Score promedio</p>
          <p className={`text-xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500">Visitas completadas</p>
          <p className="text-xl font-bold text-blue-600">{totalVisits}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500">Total Gs.</p>
          <p className="text-xl font-bold text-green-600">{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500">Vendedores activos</p>
          <p className="text-xl font-bold text-purple-600">{sellers.filter((s: any) => s.is_active !== false).length}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-3 text-white">
          <p className="text-xs opacity-80">Top vendedor</p>
          <p className="text-xl font-bold truncate">{topSeller ? sellers.find((s: any) => (s.seller_id || s.id) === topSeller.seller_id)?.user_nombre || "—" : "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking list */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Ranking</h2>
          {ranking.map((r, idx) => {
            const sellerInfo = sellers.find((s: any) => (s.seller_id || s.id) === r.seller_id)
            return (
              <div key={r.id} onClick={() => selectSeller({ ...sellerInfo, ...r })}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedSeller?.seller_id === r.seller_id ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 scale-[1.02]" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? "bg-yellow-100 text-yellow-700" : idx === 1 ? "bg-gray-100 text-gray-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"}`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{sellerInfo?.user_nombre || "Vendedor"}</p>
                  <p className="text-xs text-gray-400">{r.completed_visits || 0} visitas · Gs. {Number(r.total_amount || 0).toLocaleString()}</p>
                </div>
                <div className={`text-lg font-bold ${getScoreColor(r.performance_score || 0)}`}>{r.performance_score || 0}</div>
              </div>
            )
          })}
          {ranking.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin datos de rendimiento</p>
              <p className="text-xs mt-1">Calculá el rendimiento desde la sección de rutas</p>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Bar chart: scores */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-bold mb-4">Score de Rendimiento por Vendedor</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Line chart: history */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold mb-4">Tendencia {selectedSeller ? `— ${sellers.find((s: any) => (s.seller_id || s.id) === selectedSeller.seller_id)?.user_nombre || ""}` : ""}</h3>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  Seleccioná un vendedor para ver su tendencia
                </div>
              )}
            </div>

            {/* Pie chart: distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold mb-4">Distribución de Visitas</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400">Sin datos</div>
              )}
              <div className="flex justify-center gap-4 text-xs mt-2">
                {pieData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                    <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected seller detail */}
          {selectedSeller && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold mb-3">
                Detalle: {sellers.find((s: any) => (s.seller_id || s.id) === selectedSeller.seller_id)?.user_nombre || "Vendedor"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <Target className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                  <p className="text-xs text-gray-500">Score</p>
                  <p className={`text-lg font-bold ${getScoreColor(selectedSeller.performance_score || 0)}`}>{selectedSeller.performance_score || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <ShoppingCart className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                  <p className="text-xs text-gray-500">Pedidos/hora</p>
                  <p className="text-lg font-bold">{selectedSeller.orders_per_hour || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <DollarSign className="w-4 h-4 mx-auto mb-1 text-green-500" />
                  <p className="text-xs text-gray-500">Gs./hora</p>
                  <p className="text-lg font-bold">{Number(selectedSeller.amount_per_hour || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <p className="text-xs text-gray-500">Duración visita</p>
                  <p className="text-lg font-bold">{selectedSeller.avg_visit_duration_minutes || 0} min</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div className="text-center"><p className="text-xs text-gray-500">Visitas totales</p><p className="font-bold">{selectedSeller.total_visits || 0}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Completadas</p><p className="font-bold text-green-600">{selectedSeller.completed_visits || 0}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Perdidas</p><p className="font-bold text-red-600">{selectedSeller.missed_visits || 0}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Pedidos</p><p className="font-bold">{selectedSeller.total_orders || 0}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Monto Gs.</p><p className="font-bold">{Number(selectedSeller.total_amount || 0).toLocaleString()}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Cobrado Gs.</p><p className="font-bold">{Number(selectedSeller.total_payment_collected || 0).toLocaleString()}</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Horas trabajo</p><p className="font-bold">{selectedSeller.total_work_hours || 0}h</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Km recorridos</p><p className="font-bold">{selectedSeller.total_traveled_km || 0} km</p></div>
                <div className="text-center"><p className="text-xs text-gray-500">Rating</p><p className="font-bold">{selectedSeller.avg_customer_rating || 0} ⭐</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
