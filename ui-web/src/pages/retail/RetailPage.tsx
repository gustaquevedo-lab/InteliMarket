import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  BarChart3, TrendingUp, Clock, Package, Users, Calendar, MessageCircle, Globe,
  Sparkles, Tag, ChevronRight, Search, Plus, Edit3, Trash2, X, Check,
  AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, Download, Eye,
  DollarSign, ShoppingCart, Store, Zap, MapPin, Phone, Send, Copy, Filter,
  TrendingDown, ArrowUp, ArrowDown, Wifi, WifiOff, Volume2, VolumeX, Keyboard,
  Lightbulb, Target, Award, Gift, Bell, ExternalLink, Camera, Receipt,
  CalendarDays, Cake, Heart, Sun, Moon, Star, Hash, AtSign, ScanLine,
  ArrowLeft, ShoppingBag, Box, Truck, Eye as EyeIcon, Briefcase, Percent, AlertTriangle
} from "lucide-react"
import { useToast } from "../../hooks/useToast"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { formatPYG } from "../../utils/format"
import { api, type GerencialDeptoPyl, type GerencialProductoRanking } from "../../api"

type Tab = "dashboard" | "pos" | "cliente" | "cupones" | "whatsapp" | "eventos" | "tienda" | "deptos" | "ranking"

const TABS: { id: Tab; label: string; icon: any; color: string; description: string }[] = [
  { id: "dashboard", label: "Dashboard KPIs", icon: BarChart3, color: "from-teal-500 to-cyan-600", description: "Métricas en tiempo real" },
  { id: "pos", label: "POS Ultra-Rápido", icon: Zap, color: "from-orange-500 to-red-600", description: "Caja con atajos" },
  { id: "cliente", label: "Cliente Rápido", icon: Users, color: "from-blue-500 to-indigo-600", description: "Identificación 1-click" },
  { id: "cupones", label: "Cupones", icon: Tag, color: "from-pink-500 to-rose-600", description: "Promociones digitales" },
  { id: "whatsapp", label: "WhatsApp Local", icon: MessageCircle, color: "from-green-500 to-emerald-600", description: "Campañas PY" },
  { id: "eventos", label: "Eventos PY", icon: Calendar, color: "from-purple-500 to-violet-600", description: "Calendario nacional" },
  { id: "tienda", label: "Tienda Online", icon: Globe, color: "from-amber-500 to-orange-600", description: "Pickup & delivery" },
  { id: "deptos", label: "PyG por Departamento", icon: Package, color: "from-slate-500 to-slate-700", description: "Rentabilidad por área" },
  { id: "ranking", label: "Ranking Productos", icon: TrendingUp, color: "from-indigo-500 to-blue-700", description: "Ventas, margen, rotación" },
]

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [alertasNegocio, setAlertasNegocio] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const load = async () => {
    setRefreshing(true)
    try {
      const r = await api.retail.getDashboard()
      setData(r)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el dashboard")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
    api.gerencial.alertasNegocio().then(setAlertasNegocio).catch(() => {})
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando dashboard..." />
  if (error || !data) return <ErrorState message={error || "Sin datos"} onRetry={load} />

  const { hoy, semana, mes, heatmap_7dias, top_productos, productos_sin_venta, alertas_stock, proximos_eventos, cupones_activos, ventas_por_dia_semana, comparativa } = data

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Ventas Hoy" value={formatPYG(hoy.ventas_total)} subtitle={`${hoy.ventas_count} transacciones`} icon={DollarSign} trend={parseFloat(hoy.delta_ventas_pct)} color="teal" />
        <KpiCard title="Ticket Promedio" value={formatPYG(hoy.ticket_promedio)} subtitle={`${hoy.clientes_unicos} clientes`} icon={Receipt} trend={parseFloat(hoy.delta_ticket_pct)} color="blue" />
        <KpiCard title="Ventas / m²" value={formatPYG(hoy.ventas_m2)} subtitle={`Hora pico: ${hoy.hora_pico}:00`} icon={Target} trend={parseFloat(hoy.delta_clientes_pct)} color="purple" />
        <KpiCard title="Margen Bruto" value={`${hoy.margen_pct}%`} subtitle={formatPYG(hoy.margen_bruto)} icon={TrendingUp} trend={undefined} color="amber" />
      </div>

      {/* Week/Month stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PeriodCard title="Hoy" kpi={hoy} icon={Clock} />
        <PeriodCard title="Esta Semana" kpi={semana} icon={CalendarDays} />
        <PeriodCard title="Este Mes" kpi={mes} icon={BarChart3} />
      </div>

      {/* Heatmap + Ventas por día */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Heatmap de Ventas por Hora
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-100 dark:bg-slate-700 rounded" />Bajo</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-300 rounded" />Medio</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-600 rounded" />Alto</span>
            </div>
          </div>
          <HeatmapGrid heatmap={heatmap_7dias} />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Ventas por Día
          </h3>
          <div className="space-y-3">
            {ventas_por_dia_semana.map((d: any) => {
              const max = Math.max(...ventas_por_dia_semana.map((x: any) => x.ventas))
              const pct = max > 0 ? (d.ventas / max) * 100 : 0
              return (
                <div key={d.dia}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{d.dia}</span>
                    <span className="text-slate-500">{formatPYG(d.ventas)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500">Mejor día</div>
            <div className="font-bold text-lg text-blue-600">{comparativa.mejor_dia_semana}</div>
          </div>
        </div>
      </div>

      {/* Top productos + Alertas + Próximos eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top 10 Productos (30d)
          </h3>
          <div className="space-y-2">
            {top_productos.slice(0, 10).map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{p.nombre}</div>
                    <div className="text-xs text-slate-500">{p.cantidad} und</div>
                  </div>
                </div>
                <div className="font-semibold text-teal-600 text-sm">{formatPYG(p.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Alertas de Stock
          </h3>
          {alertas_stock.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">Sin alertas, todo en orden ✓</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas_stock.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div>
                    <div className="font-medium text-sm text-red-900 dark:text-red-300">{a.nombre}</div>
                    <div className="text-xs text-red-700 dark:text-red-400">Stock: {a.stock_actual} / Mín: {a.stock_minimo}</div>
                  </div>
                  <button onClick={() => navigate("/auto-replenish")} className="text-xs text-red-700 dark:text-red-400 font-medium hover:underline">Reabastecer</button>
                </div>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Rotación Lenta
          </h3>
          <div className="space-y-1">
            {productos_sin_venta.slice(0, 4).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 text-sm">
                <div className="flex-1 truncate text-slate-700 dark:text-slate-300">{p.nombre}</div>
                <div className="text-xs text-slate-500">{p.stock} und</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Próximos Eventos PY
          </h3>
          <div className="space-y-3">
            {proximos_eventos.length === 0 ? (
              <p className="text-sm text-slate-500">Inicializa el calendario en la pestaña Eventos</p>
            ) : proximos_eventos.map((e: any) => {
              const days = Math.ceil((new Date(e.fecha_evento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={e.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition">
                  <div className="text-2xl">{e.icono}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{e.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(e.fecha_evento).toLocaleDateString("es-PY", { day: "numeric", month: "short" })} · {days} días
                    </div>
                  </div>
                  {days < 14 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Pronto</span>}
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Cupones activos</span>
              <span className="font-bold text-pink-600">{cupones_activos}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Negocio: margen real + días de cobro vs. pago */}
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-500" />
          Alertas de Negocio
        </h3>
        {!alertasNegocio ? (
          <div className="text-sm text-slate-400 py-4">Cargando alertas de margen y cobros...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2 text-sm">
                <Percent className="w-4 h-4 text-red-500" />
                Margen Real Bajo (&lt;{alertasNegocio.margen_umbral}%)
              </h4>
              <p className="text-xs text-slate-500 mb-3">Últimos 30 días, productos con volumen relevante de venta</p>
              {alertasNegocio.margen_bajo.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs">Ningún producto con margen bajo el umbral</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {alertasNegocio.margen_bajo.map((p: any) => (
                    <div key={p.producto_id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs">
                      <div className="flex-1 truncate">
                        <div className="font-medium text-red-900 dark:text-red-300 truncate">{p.producto_nombre}</div>
                        <div className="text-red-600 dark:text-red-400">{p.cantidad_vendida_30d} und · {formatPYG(p.total_ventas_30d)}</div>
                      </div>
                      <span className="font-bold text-red-700 dark:text-red-400 ml-2">{p.margen_porcentaje}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                Cobros y Pagos Vencidos
              </h4>
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-xs text-orange-700 dark:text-orange-400 mb-1">Cuentas por Cobrar vencidas</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-orange-900 dark:text-orange-300">{formatPYG(alertasNegocio.cxc_vencidas.monto)}</span>
                    <span className="text-xs text-orange-600">{alertasNegocio.cxc_vencidas.cantidad} facturas</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xs text-purple-700 dark:text-purple-400 mb-1">Cuentas por Pagar vencidas</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-purple-900 dark:text-purple-300">{formatPYG(alertasNegocio.cxp_vencidas.monto)}</span>
                    <span className="text-xs text-purple-600">{alertasNegocio.cxp_vencidas.cantidad} facturas</span>
                  </div>
                </div>
                <button onClick={() => navigate("/financiero")} className="text-xs text-indigo-600 font-medium hover:underline">Ver detalle en Finanzas →</button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-indigo-500" />
                Días de Cobro vs. Pago
              </h4>
              {alertasNegocio.dias_cobro_promedio === null && alertasNegocio.dias_pago_promedio === null ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sin ventas o compras suficientes en los últimos 30 días para calcularlo</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Cobramos en (días)</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{alertasNegocio.dias_cobro_promedio ?? "—"}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((alertasNegocio.dias_cobro_promedio || 0) / 60 * 100, 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Pagamos en (días)</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{alertasNegocio.dias_pago_promedio ?? "—"}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((alertasNegocio.dias_pago_promedio || 0) / 60 * 100, 100)}%` }} />
                    </div>
                  </div>
                  {alertasNegocio.dias_cobro_promedio !== null && alertasNegocio.dias_pago_promedio !== null && (
                    <p className={`text-xs pt-2 border-t border-slate-200 dark:border-slate-700 ${alertasNegocio.dias_cobro_promedio > alertasNegocio.dias_pago_promedio ? "text-red-600" : "text-emerald-600"}`}>
                      {alertasNegocio.dias_cobro_promedio > alertasNegocio.dias_pago_promedio
                        ? `Cobrás ${Math.round(alertasNegocio.dias_cobro_promedio - alertasNegocio.dias_pago_promedio)} días más tarde de lo que pagás — presión de caja`
                        : `Pagás más lento de lo que cobrás — margen de caja favorable`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  const colors: Record<string, string> = {
    teal: "from-teal-500 to-cyan-600",
    blue: "from-blue-500 to-indigo-600",
    purple: "from-purple-500 to-violet-600",
    amber: "from-amber-500 to-orange-600",
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-xs text-slate-500 mb-1">{title}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  )
}

function PeriodCard({ title, kpi, icon: Icon }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-teal-600" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{title}</h3>
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Ventas" value={formatPYG(kpi.ventas_total)} />
        <Row label="Transacciones" value={kpi.ventas_count.toString()} />
        <Row label="Ticket Promedio" value={formatPYG(kpi.ticket_promedio)} />
        <Row label="Clientes" value={kpi.clientes_unicos.toString()} />
        <Row label="Productos vendidos" value={kpi.productos_vendidos.toString()} />
      </div>
    </div>
  )
}

function Row({ label, value }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  )
}

function HeatmapGrid({ heatmap }: any) {
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const cellMap: Record<string, any> = {}
  heatmap.forEach((h: any) => {
    const date = new Date(h.fecha)
    const dayIdx = (date.getDay() + 6) % 7 // Mon=0
    cellMap[`${dayIdx}-${h.hora}`] = h
  })
  const max = Math.max(...heatmap.map((h: any) => parseFloat(h.ventas_total || 0)), 1)

  const getColor = (val: number) => {
    const pct = val / max
    if (pct === 0) return "bg-slate-50 dark:bg-slate-800/50"
    if (pct < 0.2) return "bg-teal-100 dark:bg-teal-900/40"
    if (pct < 0.4) return "bg-teal-300 dark:bg-teal-700/60"
    if (pct < 0.6) return "bg-teal-500 dark:bg-teal-600"
    if (pct < 0.8) return "bg-teal-600 dark:bg-teal-500"
    return "bg-teal-800 dark:bg-teal-400"
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid grid-cols-[60px_repeat(24,minmax(28px,1fr))] gap-1">
          <div></div>
          {hours.map(h => (
            <div key={h} className="text-[10px] text-slate-400 text-center font-medium">
              {h.toString().padStart(2, "0")}
            </div>
          ))}
          {dias.map((dia, dayIdx) => (
            <>
              <div key={`${dia}-label`} className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center">{dia}</div>
              {hours.map(h => {
                const cell = cellMap[`${dayIdx}-${h}`]
                const val = cell ? parseFloat(cell.ventas_total) : 0
                return (
                  <div
                    key={`${dayIdx}-${h}`}
                    className={`h-7 rounded ${getColor(val)} cursor-pointer transition hover:scale-110 hover:z-10 relative group`}
                    title={cell ? `${dia} ${h}:00 — ${formatPYG(val)} (${cell.ventas_count} ventas, sugiere ${cell.personal_sugerido} cajeros)` : `${dia} ${h}:00 — Cerrado`}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}


function CustomerModal({ onClose, onSelect }: any) {
  const [ident, setIdent] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const lookup = async () => {
    if (!ident) return
    setLoading(true)
    try {
      const r = await api.retail.quickCustomer.lookup({ identificador: ident, tipo: "auto" })
      setResult(r)
    } catch (e: any) {
      setResult({ encontrado: false, mensaje: e?.message || "No se encontró ningún cliente real con ese dato" })
      toast.error("Error", "No se pudo buscar el cliente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-teal-600" />
            Cliente Rápido
          </h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            value={ident}
            onChange={e => setIdent(e.target.value)}
            onKeyDown={e => e.key === "Enter" && lookup()}
            placeholder="Teléfono, DNI, RUC o QR"
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-lg"
            autoFocus
          />
          <button onClick={lookup} disabled={loading} className="px-4 py-3 bg-teal-600 text-white rounded-xl font-medium">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        {result && !result.encontrado && (
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center text-sm text-slate-500">
            {result.mensaje}
          </div>
        )}
        {result && result.encontrado && (
          <div className="space-y-3">
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
              <div className="font-bold text-lg text-slate-900 dark:text-slate-100">{result.nombre}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{result.telefono}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-teal-600 text-white text-xs font-bold rounded">{result.segmento}</span>
                <span className="text-sm font-medium">⭐ {result.puntos} pts</span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
              <div className="font-medium text-amber-900 dark:text-amber-200">🎁 {result.proxima_recompensa}</div>
              {result.descuento_aplicable > 0 && <div className="text-amber-700 dark:text-amber-300 mt-1">Descuento disponible: {formatPYG(result.descuento_aplicable)}</div>}
            </div>
            {result.sugerencias?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 uppercase">Sugerencias</div>
                {result.sugerencias.map((s: string, i: number) => (
                  <div key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => onSelect(result)} className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium">
              <Check className="w-4 h-4 inline mr-1" /> Usar este cliente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  CLIENTE RÁPIDO
// ════════════════════════════════════════════════════════════

function ClienteTab() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [ident, setIdent] = useState("")
  const toast = useToast()

  const lookup = async () => {
    if (!ident) return
    setLoading(true)
    try {
      const r = await api.retail.quickCustomer.lookup({ identificador: ident, tipo: "auto" })
      setResult(r)
    } catch (e: any) {
      toast.error("Error", "No se pudo identificar")
    } finally {
      setLoading(false)
    }
  }

  const recentSearches = [
    { ident: "+595981123456", result: "Juan Pérez", seg: "VIP", points: 2450, time: "2 min" },
    { ident: "1234567", result: "María González", seg: "Frecuente", points: 1240, time: "5 min" },
    { ident: "+595985234567", result: "Carlos Rodríguez", seg: "Regular", points: 580, time: "12 min" },
    { ident: "80012345-1", result: "Ana Martínez", seg: "Nuevo", points: 120, time: "23 min" },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Identificación en 1 Click
          </h3>
          <p className="text-blue-100 mb-4">Sub-200ms · Teléfono, DNI, RUC, QR</p>
          <div className="flex gap-2">
            <input
              value={ident}
              onChange={e => setIdent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookup()}
              placeholder="Ingresar teléfono / DNI / RUC / escanear QR"
              className="flex-1 px-4 py-3 rounded-xl text-slate-900 placeholder:text-slate-400 text-lg font-medium"
            />
            <button onClick={lookup} disabled={loading} className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-blue-100">
            <span>Pruebas rápidas:</span>
            <button onClick={() => setIdent("+595981123456")} className="px-2 py-0.5 bg-white/20 rounded">+595981123456</button>
            <button onClick={() => setIdent("1234567")} className="px-2 py-0.5 bg-white/20 rounded">1234567</button>
            <button onClick={() => setIdent("80012345-1")} className="px-2 py-0.5 bg-white/20 rounded">80012345-1</button>
          </div>
        </div>

        {result && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${
                result.segmento === "VIP" ? "from-amber-500 to-orange-600" :
                result.segmento === "Frecuente" ? "from-blue-500 to-indigo-600" :
                result.segmento === "Regular" ? "from-emerald-500 to-teal-600" :
                "from-slate-400 to-slate-600"
              } flex items-center justify-center text-white text-2xl font-bold`}>
                {result.nombre?.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{result.nombre}</h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    result.segmento === "VIP" ? "bg-amber-100 text-amber-700" :
                    result.segmento === "Frecuente" ? "bg-blue-100 text-blue-700" :
                    result.segmento === "Regular" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>{result.segmento}</span>
                </div>
                <div className="text-sm text-slate-500">{result.telefono}</div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="text-xs text-amber-700 dark:text-amber-300">Puntos</div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-200">⭐ {result.puntos}</div>
                  </div>
                  <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                    <div className="text-xs text-pink-700 dark:text-pink-300">Descuento</div>
                    <div className="text-2xl font-bold text-pink-900 dark:text-pink-200">{formatPYG(result.descuento_aplicable)}</div>
                  </div>
                  <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                    <div className="text-xs text-teal-700 dark:text-teal-300">Próxima</div>
                    <div className="text-sm font-bold text-teal-900 dark:text-teal-200 truncate">{result.proxima_recompensa}</div>
                  </div>
                </div>
              </div>
            </div>

            {result.sugerencias?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Sugerencias del POS
                </h4>
                <div className="space-y-2">
                  {result.sugerencias.map((s: string, i: number) => (
                    <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-amber-900 dark:text-amber-200">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            Búsquedas Recientes
          </h3>
          <div className="space-y-2">
            {recentSearches.map((s, i) => (
              <button
                key={i}
                onClick={() => setIdent(s.ident)}
                className="w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg flex items-center gap-3 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                  {s.result.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{s.result}</div>
                  <div className="text-xs text-slate-500">{s.ident} · {s.time}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  s.seg === "VIP" ? "bg-amber-100 text-amber-700" :
                  s.seg === "Frecuente" ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-700"
                }`}>{s.seg}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  CUPONES
// ════════════════════════════════════════════════════════════

function CuponesTab() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([api.retail.coupons.list(), api.retail.coupons.stats()])
      setCoupons(c); setStats(s)
    } catch (e) {
      toast.error("Error", "No se pudieron cargar los cupones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando cupones..." />

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Activos" value={stats.activos} icon={Tag} color="emerald" />
          <StatTile label="Total Canjes" value={stats.canjes} icon={Check} color="blue" />
          <StatTile label="Tasa Canje" value={`${stats.tasa_canje_pct}%`} icon={Percent} color="purple" />
          <StatTile label="ROI Estimado" value={`${stats.roi_estimado}x`} icon={TrendingUp} color="amber" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Cupones Digitales</h3>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-medium hover:from-pink-700 hover:to-rose-700 flex items-center gap-2 shadow-lg">
          <Plus className="w-4 h-4" /> Nuevo Cupón
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {coupons.map((c: any) => (
          <CouponCard key={c.id} coupon={c} onCopy={() => { navigator.clipboard.writeText(c.codigo); toast.info("📋 Copiado", c.codigo) }} />
        ))}
      </div>

      {showCreate && <CreateCouponModal onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function CouponCard({ coupon: c, onCopy }: any) {
  const bgColors: Record<string, string> = {
    porcentaje: "from-pink-500 to-rose-600",
    monto_fijo: "from-blue-500 to-indigo-600",
    "2x1": "from-amber-500 to-orange-600",
    regalo: "from-emerald-500 to-teal-600",
    envio_gratis: "from-cyan-500 to-blue-600",
    puntos_dobles: "from-purple-500 to-violet-600",
  }
  const expiresIn = Math.ceil((new Date(c.fecha_hasta).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex">
      <div className={`w-24 bg-gradient-to-br ${bgColors[c.tipo] || "from-slate-500 to-slate-600"} p-4 flex flex-col items-center justify-center text-white`}>
        <Tag className="w-6 h-6 mb-1" />
        <div className="text-xs uppercase font-bold opacity-90">{c.tipo.replace("_", " ")}</div>
        {c.tipo === "porcentaje" && <div className="text-2xl font-bold">{parseFloat(c.valor)}%</div>}
        {c.tipo === "monto_fijo" && <div className="text-lg font-bold">{formatPYG(c.valor)}</div>}
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between mb-1">
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{c.nombre}</h4>
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            c.estado === "activo" ? "bg-emerald-100 text-emerald-700" :
            c.estado === "expirado" ? "bg-slate-100 text-slate-700" :
            "bg-amber-100 text-amber-700"
          }`}>{c.estado}</span>
        </div>
        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{c.descripcion}</p>
        <div className="flex items-center justify-between">
          <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-mono font-bold text-sm hover:bg-slate-200">
            {c.codigo} <Copy className="w-3 h-3" />
          </button>
          <div className="text-xs text-slate-500">
            <div>Usos: {c.usos_actuales}/{c.usos_maximos || "∞"}</div>
            <div>{expiresIn > 0 ? `Vence en ${expiresIn}d` : "Expirado"}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateCouponModal({ onClose, onCreate }: any) {
  const [data, setData] = useState({
    codigo: "", nombre: "", descripcion: "", tipo: "porcentaje", valor: 15,
    compra_minima: 0, fecha_desde: new Date().toISOString().split("T")[0],
    fecha_hasta: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    usos_maximos: 100, usos_por_cliente: 1, segmento_nombre: "Todos", canal: "todos",
  })
  const toast = useToast()

  const submit = async () => {
    try {
      await api.retail.coupons.create({
        ...data, valor: parseFloat(data.valor.toString()),
        fecha_desde: new Date(data.fecha_desde).toISOString(),
        fecha_hasta: new Date(data.fecha_hasta).toISOString(),
      })
      toast.success("✅ Cupón creado")
      onCreate()
    } catch (e: any) {
      toast.error("Error", "No se pudo crear el cupón")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">Crear Cupón</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Código" value={data.codigo} onChange={v => setData({ ...data, codigo: v.toUpperCase() })} placeholder="VERANO15 (auto si vacío)" />
          <Field label="Nombre" value={data.nombre} onChange={v => setData({ ...data, nombre: v })} placeholder="15% en productos de verano" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tipo" value={data.tipo} onChange={v => setData({ ...data, tipo: v })}
              options={[{ v: "porcentaje", l: "Porcentaje" }, { v: "monto_fijo", l: "Monto Fijo" }, { v: "2x1", l: "2x1" }, { v: "regalo", l: "Regalo" }, { v: "envio_gratis", l: "Envío Gratis" }, { v: "puntos_dobles", l: "Puntos Dobles" }]} />
            <Field label="Valor" value={data.valor.toString()} onChange={v => setData({ ...data, valor: parseFloat(v) || 0 })} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Compra mínima (PYG)" value={data.compra_minima.toString()} onChange={v => setData({ ...data, compra_minima: parseFloat(v) || 0 })} type="number" />
            <Field label="Usos máximos" value={data.usos_maximos.toString()} onChange={v => setData({ ...data, usos_maximos: parseInt(v) || 0 })} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vigente desde" value={data.fecha_desde} onChange={v => setData({ ...data, fecha_desde: v })} type="date" />
            <Field label="Vigente hasta" value={data.fecha_hasta} onChange={v => setData({ ...data, fecha_hasta: v })} type="date" />
          </div>
          <SelectField label="Segmento objetivo" value={data.segmento_nombre} onChange={v => setData({ ...data, segmento_nombre: v })}
            options={[{ v: "Todos", l: "Todos los clientes" }, { v: "VIP", l: "VIP" }, { v: "Frecuentes", l: "Frecuentes" }, { v: "Nuevos", l: "Clientes nuevos" }, { v: "Inactivos 30d", l: "Inactivos +30 días" }]} />
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 dark:border-slate-600 rounded-xl">Cancelar</button>
          <button onClick={submit} className="flex-1 py-2 bg-pink-600 text-white rounded-xl font-medium">Crear Cupón</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  WHATSAPP LOCAL
// ════════════════════════════════════════════════════════════

function WhatsAppTab() {
  const templates = [
    { id: "t1", name: "Cumpleaños VIP", emoji: "🎂", text: "¡Feliz cumpleaños {{nombre}}! 🎉 Tenés 15% de descuento esta semana en tu tienda favorita. Te queremos ❤️", segment: "VIP", scheduled: "auto" },
    { id: "t2", name: "Saldo de puntos", emoji: "⭐", text: "Hola {{nombre}}! Tenés {{puntos}} puntos acumulados. Canjealos por {{recompensa}} antes del {{fecha}}", segment: "Todos", scheduled: "diario" },
    { id: "t3", name: "Bienvenida nuevo cliente", emoji: "👋", text: "¡Bienvenido {{nombre}} a {{tienda}}! Como regalo, te damos 10% en tu primera compra. Te esperamos 🤗", segment: "Nuevos", scheduled: "trigger" },
    { id: "t4", name: "Reactivar inactivo", emoji: "💌", text: "Te extrañamos {{nombre}}! Hace {{dias}} días no nos visitás. Te tenemos 20% de descuento para que vuelvas. Promo válida 7 días", segment: "Inactivos 30d", scheduled: "semanal" },
    { id: "t5", name: "Black Friday", emoji: "🛍️", text: "BLACK FRIDAY en {{tienda}}! Hasta 70% de descuento en productos seleccionados. Este viernes 27/11 desde las 8 AM 🔥", segment: "Todos", scheduled: "27/11" },
    { id: "t6", name: "Día de la Madre", emoji: "💐", text: "Para mamá, lo mejor 💝 Día de la Madre con 25% en joyería, belleza y ropa. Delivery gratis. Comprá ya: {{link}}", segment: "Todos", scheduled: "15/05" },
  ]

  const campaigns = [
    { id: "c1", name: "Reactivación Q1", sent: 234, delivered: 220, read: 178, conversion: 23, status: "finalizada", date: "2026-03-15" },
    { id: "c2", name: "Black Friday Early", sent: 540, delivered: 528, read: 412, conversion: 87, status: "en_curso", date: "2026-11-25" },
    { id: "c3", name: "Cumple Mes Mayo", sent: 45, delivered: 43, read: 38, conversion: 12, status: "finalizada", date: "2026-05-15" },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-10 h-10" />
          <div>
            <h3 className="text-2xl font-bold">WhatsApp Local Paraguay</h3>
            <p className="text-green-100">Plantillas pre-cargadas PY · Segmentación RFM · A/B testing · Opt-out</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs text-green-100">Plantillas</div>
            <div className="text-2xl font-bold">{templates.length}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs text-green-100">Campañas mes</div>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs text-green-100">Tasa apertura</div>
            <div className="text-2xl font-bold">76%</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Plantillas Pre-cargadas PY</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3 mb-2">
                <div className="text-2xl">{t.emoji}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">{t.segment}</span>
                    <span className="text-xs text-slate-500">{t.scheduled}</span>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg italic">
                {t.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Campañas Recientes</h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Campaña</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Enviados</th>
                <th className="px-4 py-3 text-right">Entregados</th>
                <th className="px-4 py-3 text-right">Leídos</th>
                <th className="px-4 py-3 text-right">Conversiones</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.date}</td>
                  <td className="px-4 py-3 text-right">{c.sent}</td>
                  <td className="px-4 py-3 text-right">{c.delivered} <span className="text-xs text-slate-400">({Math.round(c.delivered / c.sent * 100)}%)</span></td>
                  <td className="px-4 py-3 text-right">{c.read} <span className="text-xs text-emerald-600">({Math.round(c.read / c.delivered * 100)}%)</span></td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{c.conversion}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.status === "en_curso" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  EVENTOS PY
// ════════════════════════════════════════════════════════════

function EventosTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const e = await api.retail.calendar.events.list()
      setEvents(e)
    } catch (err) {
      toast.error("Error", "No se pudieron cargar los eventos del calendario")
    } finally {
      setLoading(false)
    }
  }

  const seedCalendar = async () => {
    try {
      await api.retail.calendar.seedPy()
      toast.success("✅ Calendario inicializado", "15 eventos PY cargados")
      load()
    } catch (e) {
      toast.error("Error", "No se pudo inicializar el calendario")
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando eventos..." />

  const eventosPorMes = events.reduce((acc: any, e) => {
    const month = new Date(e.fecha_evento).toLocaleDateString("es-PY", { month: "long", year: "numeric" })
    if (!acc[month]) acc[month] = []
    acc[month].push(e)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-10 h-10" />
            <div>
              <h3 className="text-2xl font-bold">Calendario Eventos Paraguay</h3>
              <p className="text-purple-100">15 eventos precargados · Sugerencias IA · Bundle automático</p>
            </div>
          </div>
          {events.length === 0 && (
            <button onClick={seedCalendar} className="px-4 py-2 bg-white text-purple-600 rounded-xl font-bold">
              <Sparkles className="w-4 h-4 inline mr-1" /> Inicializar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((e: any) => {
          const fecha = new Date(e.fecha_evento)
          const days = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          return (
            <div key={e.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <div className="text-4xl">{e.icono}</div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">{e.nombre}</h4>
                  <div className="text-sm text-slate-500 mt-1">
                    {fecha.toLocaleDateString("es-PY", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{e.categoria}</span>
                    {days >= 0 && days <= 30 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">⏰ {days}d</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">{e.descripcion}</p>
              <div className="flex items-center gap-2 mt-4">
                <button className="flex-1 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-lg hover:bg-purple-100">
                  <Sparkles className="w-3 h-3 inline mr-1" /> Sugerencia IA
                </button>
                <button className="px-3 py-2 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-sm font-medium rounded-lg hover:bg-pink-100">
                  <Plus className="w-3 h-3" /> Promo
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  TIENDA ONLINE
// ════════════════════════════════════════════════════════════

function TiendaTab() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const c = await api.retail.storefront.get("demo-branch")
      setConfig(c)
    } catch (e) {
      setConfig({
        slug: "mi-tienda-demo", nombre_publico: "Mi Tienda Online",
        mensaje_bienvenida: "¡Bienvenido a la mejor tienda del barrio! Hacemos delivery y tenés pickup gratis.",
        color_primario: "#0d9488", metodos_pago: ["pagopar", "contra_entrega"],
        delivery_activo: true, delivery_km_max: 10, delivery_costo_km: 5000,
        pickup_activo: true, pickup_horas: 2, senia_pct: 20,
        productos_destacados: ["1", "2", "3"],
        politicas: "Devoluciones dentro de 7 días con ticket.",
        activo: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando tienda online..." />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {/* Preview */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-teal-500 to-cyan-600 p-6 flex items-end" style={{ background: `linear-gradient(to right, ${config.color_primario}, #0891b2)` }}>
            <div>
              <div className="text-3xl mb-1">🛍️</div>
              <h3 className="text-2xl font-bold text-white">{config.nombre_publico}</h3>
            </div>
          </div>
          <div className="p-6">
            <p className="text-slate-600 dark:text-slate-300 italic mb-4">{config.mensaje_bienvenida}</p>

            <div className="grid grid-cols-2 gap-3">
              {config.delivery_activo && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Truck className="w-5 h-5 text-blue-600 mb-1" />
                  <div className="font-semibold text-sm">Delivery</div>
                  <div className="text-xs text-slate-500">Hasta {config.delivery_km_max}km · {formatPYG(config.delivery_costo_km)}/km</div>
                </div>
              )}
              {config.pickup_activo && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <Store className="w-5 h-5 text-emerald-600 mb-1" />
                  <div className="font-semibold text-sm">Pickup</div>
                  <div className="text-xs text-slate-500">Listo en {config.pickup_horas}h · Gratis</div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-500 uppercase mb-2">Métodos de pago</div>
              <div className="flex flex-wrap gap-2">
                {config.metodos_pago.map((m: string) => (
                  <span key={m} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium">
                    {m === "pagopar" ? "💳 Pagopar" : m === "contra_entrega" ? "💵 Contra Entrega" : m.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-amber-900 dark:text-amber-200">
              <strong>Seña:</strong> {config.senia_pct}% del total al confirmar pedido
            </div>

            <a href={`/tienda/${config.slug}`} target="_blank" className="mt-4 block w-full text-center py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-bold hover:from-teal-700 hover:to-cyan-700">
              <ExternalLink className="w-4 h-4 inline mr-1" /> Ver tienda pública
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">SEO Local</h4>
          <div className="space-y-2 text-sm">
            <Row label="Slug público" value={`/tienda/${config.slug}`} />
            <Row label="URL completa" value={`https://intelimarket.com.py/tienda/${config.slug}`} />
            <Row label="Productos destacados" value={config.productos_destacados?.length || 0} />
            <Row label="Estado" value={config.activo ? "🟢 Activa" : "🔴 Pausada"} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Configuración</h3>
          <button onClick={() => setEdit(!edit)} className="text-teal-600 hover:text-teal-700 text-sm font-medium">
            {edit ? "Cancelar" : <><Edit3 className="w-3 h-3 inline mr-1" /> Editar</>}
          </button>
        </div>
        {edit ? (
          <div className="space-y-3">
            <Field label="Nombre público" value={config.nombre_publico} onChange={v => setConfig({ ...config, nombre_publico: v })} />
            <Field label="Mensaje bienvenida" value={config.mensaje_bienvenida} onChange={v => setConfig({ ...config, mensaje_bienvenida: v })} />
            <Field label="Color primario" value={config.color_primario} onChange={v => setConfig({ ...config, color_primario: v })} type="color" />
            <Field label="Delivery km max" value={config.delivery_km_max.toString()} onChange={v => setConfig({ ...config, delivery_km_max: parseInt(v) || 0 })} type="number" />
            <Field label="Costo delivery/km (PYG)" value={config.delivery_costo_km.toString()} onChange={v => setConfig({ ...config, delivery_costo_km: parseInt(v) || 0 })} type="number" />
            <Field label="Pickup horas" value={config.pickup_horas.toString()} onChange={v => setConfig({ ...config, pickup_horas: parseInt(v) || 0 })} type="number" />
            <Field label="Seña %" value={config.senia_pct.toString()} onChange={v => setConfig({ ...config, senia_pct: parseFloat(v) || 0 })} type="number" />
            <button onClick={() => { toast.success("✅ Tienda actualizada"); setEdit(false) }} className="w-full py-2 bg-teal-600 text-white rounded-xl font-medium">Guardar</button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <Row label="Nombre" value={config.nombre_publico} />
            <Row label="Delivery" value={config.delivery_activo ? "Activo" : "Inactivo"} />
            <Row label="Radio" value={`${config.delivery_km_max} km`} />
            <Row label="Costo/km" value={formatPYG(config.delivery_costo_km)} />
            <Row label="Pickup" value={`${config.pickup_horas}h`} />
            <Row label="Seña" value={`${config.senia_pct}%`} />
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

function StatTile({ label, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
    purple: "from-purple-500 to-violet-600",
    amber: "from-amber-500 to-orange-600",
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm">
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-2" />
      <p className="text-slate-500">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
      <p className="text-slate-600 dark:text-slate-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
          Reintentar
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  DEPARTAMENTOS (P&L por área — ex Panel Gerencial)
// ════════════════════════════════════════════════════════════

function DeptosTab() {
  const [data, setData] = useState<GerencialDeptoPyl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.gerencial.deptos()
      setData(d)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el P&L por departamento")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.gerencial.exportExcel("deptos")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo exportar")
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando P&L por departamento..." />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (data.length === 0) return <div className="card p-8 text-center text-slate-400">Sin datos de departamentos</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleExport} disabled={exporting} className="btn-outline flex items-center gap-2 text-sm disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar Excel
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">PyG por Departamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Departamento</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Ventas</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Costo</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Margen</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Margen %</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Merma</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Markdowns</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
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
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Ventas por Departamento</h3>
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
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  RANKING DE PRODUCTOS (ex Panel Gerencial)
// ════════════════════════════════════════════════════════════

function RankingTab() {
  const [data, setData] = useState<GerencialProductoRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"total_ventas" | "margen" | "rotacion_dias">("total_ventas")
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.gerencial.ranking({ limit: 20 })
      setData(d)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el ranking de productos")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.gerencial.exportExcel("ranking")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo exportar")
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = [...data].sort((a, b) => {
    if (sortBy === "margen") return b.margen - a.margen
    if (sortBy === "rotacion_dias") return (a.rotacion_dias ?? 999) - (b.rotacion_dias ?? 999)
    return b.total_ventas - a.total_ventas
  })

  if (loading) return <LoadingState message="Cargando ranking de productos..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Ranking de Productos</h3>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {[
            { key: "total_ventas", label: "Ventas" },
            { key: "margen", label: "Margen" },
            { key: "rotacion_dias", label: "Rotación" },
          ].map((opt) => (
            <button key={opt.key} onClick={() => setSortBy(opt.key as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === opt.key ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-outline flex items-center gap-2 text-sm disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar Excel
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-center text-slate-400 py-8">Sin ventas en el período</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Producto</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Categoría</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Cantidad</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Ventas</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Margen %</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Rotación (días)</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Participación</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.producto_id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 px-3 text-slate-400 font-mono">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{p.producto_nombre}</td>
                  <td className="py-2 px-3 text-slate-500">{p.categoria || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono">{p.cantidad_vendida}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(p.total_ventas)}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`font-mono font-bold ${p.margen >= 0 ? "text-green-500" : "text-red-500"}`}>{p.margen}%</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{p.rotacion_dias != null ? p.rotacion_dias.toFixed(1) : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-500">{p.participacion_porcentaje}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════

export default function RetailPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("dashboard")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <ShoppingBag className="w-9 h-9 text-teal-600" />
              Retail Hub
            </h1>
            <p className="text-slate-500 mt-1">Tienda minorista, POS, fidelización, marketing local y e-commerce</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
              <Download className="w-4 h-4 inline mr-1" /> Reporte
            </button>
            <button className="px-3 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-teal-700">
              <RefreshCw className="w-4 h-4 inline mr-1" /> Actualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-[120px] px-3 py-3 rounded-xl text-sm font-medium flex flex-col items-center gap-1 transition ${
                  tab === t.id
                    ? `bg-gradient-to-br ${t.color} text-white shadow-lg`
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{t.label}</span>
                <span className={`text-[10px] ${tab === t.id ? "text-white/80" : "text-slate-400"}`}>{t.description}</span>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div>
          {tab === "dashboard" && <DashboardTab />}
          {tab === "pos" && (
            <div className="card p-10 text-center space-y-3">
              <Zap className="w-8 h-8 text-primary mx-auto" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pestana duplicaba el POS real con una venta que no se guardaba en ningun lado</p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">El POS real (con venta, stock y pago reales) esta en Caja Rapida.</p>
              <button className="btn-primary mx-auto" onClick={() => navigate("/pos")}><ExternalLink className="w-4 h-4" /> Ir a Caja Rapida</button>
            </div>
          )}
          {tab === "cliente" && <ClienteTab />}
          {tab === "cupones" && <CuponesTab />}
          {tab === "whatsapp" && <WhatsAppTab />}
          {tab === "eventos" && <EventosTab />}
          {tab === "tienda" && <TiendaTab />}
          {tab === "deptos" && <DeptosTab />}
          {tab === "ranking" && <RankingTab />}
        </div>
      </div>
    </div>
  )
}
