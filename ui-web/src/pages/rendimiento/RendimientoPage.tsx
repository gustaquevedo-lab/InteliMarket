import { useState, useEffect, useMemo } from "react"
import {
  Trophy, TrendingUp, TrendingDown, BarChart3, Target, Users, DollarSign,
  ShoppingCart, Clock, MapPin, Star, RefreshCw, Award, Sparkles, Filter,
  Layers, CheckCircle2, AlertTriangle, ArrowUpRight, Zap, ShieldAlert,
  ChevronRight, Calendar, UserCheck
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts"

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"]

interface StaffPerformance {
  id: string
  nombre: string
  rol: "cajero" | "repositor" | "carniceria" | "panaderia" | "supervisor"
  sector: string
  score: number
  articulosPorMinuto: number
  ventasGs: number
  ticketsAtendidos: number
  cumplimientoHorario: number // %
  evaluacionClientes: number // 1-5
  erroresCobro: number
  tendencia: "up" | "down" | "neutral"
}

export default function RendimientoPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [selectedSector, setSelectedSector] = useState<string>("TODOS")
  const [loading, setLoading] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffPerformance | null>(null)

  // Datos de colaboradores de Extra Supermercado
  const [staffList] = useState<StaffPerformance[]>([
    {
      id: "st-01",
      nombre: "Nilda Aquino",
      rol: "cajero",
      sector: "Cajas Principales",
      score: 96,
      articulosPorMinuto: 28.5,
      ventasGs: 48500000,
      ticketsAtendidos: 420,
      cumplimientoHorario: 99.2,
      evaluacionClientes: 4.9,
      erroresCobro: 0,
      tendencia: "up"
    },
    {
      id: "st-02",
      nombre: "Evelin Herrero",
      rol: "cajero",
      sector: "Cajas Principales",
      score: 92,
      articulosPorMinuto: 26.2,
      ventasGs: 44100000,
      ticketsAtendidos: 395,
      cumplimientoHorario: 98.5,
      evaluacionClientes: 4.8,
      erroresCobro: 1,
      tendencia: "up"
    },
    {
      id: "st-03",
      nombre: "Eduarda Da Silva",
      rol: "cajero",
      sector: "Caja Rápida",
      score: 89,
      articulosPorMinuto: 31.0,
      ventasGs: 38900000,
      ticketsAtendidos: 510,
      cumplimientoHorario: 97.0,
      evaluacionClientes: 4.7,
      erroresCobro: 2,
      tendencia: "neutral"
    },
    {
      id: "st-04",
      nombre: "Carlos Maidana",
      rol: "repositor",
      sector: "Almacén & Bebidas",
      score: 94,
      articulosPorMinuto: 0,
      ventasGs: 0,
      ticketsAtendidos: 0,
      cumplimientoHorario: 100,
      evaluacionClientes: 4.9,
      erroresCobro: 0,
      tendencia: "up"
    },
    {
      id: "st-05",
      nombre: "Rodrigo Benítez",
      rol: "carniceria",
      sector: "Carnicería & Fiambrería",
      score: 91,
      articulosPorMinuto: 0,
      ventasGs: 62400000,
      ticketsAtendidos: 280,
      cumplimientoHorario: 96.5,
      evaluacionClientes: 4.8,
      erroresCobro: 0,
      tendencia: "up"
    },
    {
      id: "st-06",
      nombre: "María Solís",
      rol: "panaderia",
      sector: "Panadería & Rotisería",
      score: 87,
      articulosPorMinuto: 0,
      ventasGs: 24500000,
      ticketsAtendidos: 310,
      cumplimientoHorario: 95.0,
      evaluacionClientes: 4.6,
      erroresCobro: 0,
      tendencia: "down"
    },
    {
      id: "st-07",
      nombre: "Juan Gabriel Ruiz",
      rol: "supervisor",
      sector: "Supervisión Salón",
      score: 98,
      articulosPorMinuto: 0,
      ventasGs: 0,
      ticketsAtendidos: 0,
      cumplimientoHorario: 100,
      evaluacionClientes: 5.0,
      erroresCobro: 0,
      tendencia: "up"
    }
  ])

  useEffect(() => {
    if (staffList.length > 0 && !selectedStaff) {
      setSelectedStaff(staffList[0])
    }
  }, [staffList, selectedStaff])

  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      if (selectedSector === "TODOS") return true
      return s.sector.toLowerCase().includes(selectedSector.toLowerCase()) || s.rol.toLowerCase() === selectedSector.toLowerCase()
    })
  }, [staffList, selectedSector])

  // Métricas globales
  const avgScore = Math.round(staffList.reduce((acc, s) => acc + s.score, 0) / staffList.length)
  const topPerformer = [...staffList].sort((a, b) => b.score - a.score)[0]
  const totalTickets = staffList.reduce((acc, s) => acc + s.ticketsAtendidos, 0)
  const totalVentas = staffList.reduce((acc, s) => acc + s.ventasGs, 0)
  const avgPuntualidad = (staffList.reduce((acc, s) => acc + s.cumplimientoHorario, 0) / staffList.length).toFixed(1)

  // Gráficos
  const barData = filteredStaff.map(s => ({
    name: s.nombre.split(" ")[0],
    score: s.score,
    tickets: s.ticketsAtendidos,
    ipm: s.articulosPorMinuto
  }))

  const sectorDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    staffList.forEach(s => {
      counts[s.sector] = (counts[s.sector] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [staffList])

  const getScoreBadge = (score: number) => {
    if (score >= 95) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
    if (score >= 85) return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700"
    if (score >= 75) return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700"
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Trophy className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    RECURSOS HUMANOS & PERFORMANCE
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Salón Pedro Juan Caballero
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Rendimiento & Evaluación de Personal
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Ranking de productividad en caja, velocidad de escaneo, cumplimiento de turnos y atención al cliente en Extra Supermercado
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado Matriz
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⭐ Score Global: {avgScore} / 100
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer capitalize ${
                    period === p
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p === "daily" ? "Hoy" : p === "weekly" ? "Esta Semana" : "Mes Actual"}
                </button>
              ))}
            </div>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="px-4 py-2.5 text-xs font-bold rounded-2xl border border-slate-700 bg-slate-800/90 text-white outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="TODOS">Todos los Sectores</option>
              <option value="Cajas">Cajas & Cobro</option>
              <option value="Almacén">Almacén & Reposición</option>
              <option value="Carnicería">Carnicería & Fiambrería</option>
              <option value="Panadería">Panadería & Rotisería</option>
              <option value="Supervisión">Supervisión</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Score Global de Equipo
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {avgScore} / 100
            </span>
            <span className="text-[11px] font-bold text-emerald-600 font-mono flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +3.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Calificación ponderada en salón</p>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Colaborador Destacado
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
              {topPerformer?.nombre || "—"}
            </span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {topPerformer?.score} pts
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{topPerformer?.sector}</p>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tickets Despachados
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {totalTickets.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">tickets</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total volumen en cajas y salón</p>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Puntualidad & Asistencia
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
              {avgPuntualidad}%
            </span>
            <span className="text-[11px] font-bold text-emerald-600 font-mono">Alta Cobertura</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cumplimiento estricto de turnos</p>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL: RANKING Y DETALLE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RANKING LIST */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Ranking de Desempeño
            </h2>
            <span className="text-xs font-mono font-bold text-slate-400">
              {filteredStaff.length} colaboradores
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredStaff
              .sort((a, b) => b.score - a.score)
              .map((staff, idx) => {
                const isSelected = selectedStaff?.id === staff.id
                return (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 shadow-md scale-[1.01]"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs font-mono shrink-0 shadow-sm ${
                          idx === 0
                            ? "bg-amber-400 text-slate-950 font-black shadow-amber-500/20"
                            : idx === 1
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            : idx === 2
                            ? "bg-amber-700/20 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {staff.nombre}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{staff.sector}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono border ${getScoreBadge(staff.score)}`}>
                        {staff.score} pts
                      </span>
                      {staff.articulosPorMinuto > 0 && (
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          {staff.articulosPorMinuto} art/min
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* DETALLE Y GRÁFICOS */}
        <div className="lg:col-span-2 space-y-4">
          {/* FICHA DETALLADA DEL COLABORADOR SELECCIONADO */}
          {selectedStaff && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                    {selectedStaff.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {selectedStaff.nombre}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedStaff.sector} · Rol: <span className="font-bold capitalize">{selectedStaff.rol}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-black font-mono border ${getScoreBadge(selectedStaff.score)}`}>
                    Score: {selectedStaff.score} / 100
                  </span>
                </div>
              </div>

              {/* METRIC GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                  <Target className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Puntaje Global</span>
                  <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {selectedStaff.score} pts
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                  <Zap className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Escaneo / Min</span>
                  <p className="text-lg font-black font-mono text-slate-800 dark:text-white">
                    {selectedStaff.articulosPorMinuto > 0 ? `${selectedStaff.articulosPorMinuto} art` : "N/A"}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                  <Star className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Satisfacción</span>
                  <p className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                    {selectedStaff.evaluacionClientes} ⭐
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">Puntualidad</span>
                  <p className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">
                    {selectedStaff.cumplimientoHorario}%
                  </p>
                </div>
              </div>

              {selectedStaff.ventasGs > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Ventas Totales Facturadas en Caja:
                  </span>
                  <span className="font-black font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                    Gs. {selectedStaff.ventasGs.toLocaleString("es-PY")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COMPARATIVA BARRAS */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                Score por Colaborador
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="score" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DISTRIBUCIÓN POR SECTOR */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Distribución de Personal por Sector
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={sectorDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sectorDistribution.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderRadius: "12px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 text-[10px] mt-1 font-bold">
                {sectorDistribution.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
