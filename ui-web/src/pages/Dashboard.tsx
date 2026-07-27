import { useState, useEffect, useRef, useCallback } from "react"
import {
  TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle, Wallet,
  Clock, RefreshCw, ChevronRight, CreditCard, Percent, Ban as Banknote,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { api, type StockItem, type CreditAccount } from "../api"
import { KPICard } from "../components/KPICard"
import { Widget } from "../components/Widget"
import { AnimatedPage } from "../components/AnimatedPage"
import { formatPYG } from "../utils/format"
import { useSSE } from "../hooks/useSSE"
import { GeneralAgentChat } from "../components/GeneralAgentChat"

interface ActivityEvent {
  id: string
  type: "sale" | "alert" | "caja"
  message: string
  time: string
  link?: string
}

interface TopProduct {
  producto: string
  sku: string
  unidad_medida: string
  cantidad: number
  monto: number
  margen: number
}

interface IVASummary {
  base_10: number
  base_5: number
  exenta: number
  iva_10: number
  iva_5: number
  total_iva: number
}

interface WeekDay {
  label: string
  fecha: string
  monto: number
  monto_prev: number
}

const TODAY = new Date().toISOString().slice(0, 10)
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
const FOURTEEN_DAYS_AGO = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

interface LowStockItem {
  product_id: string
  warehouse_id: string
  nombre: string
  sku: string
  cantidad: number
  stock_minimo: number
  stock_maximo: number
  costo_unitario: number
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // KPI state
  const [salesSummary, setSalesSummary] = useState<{ total_ventas: number; monto_total: number; ticket_promedio: number; total_items: number } | null>(null)
  const [inventorySummary, setInventorySummary] = useState<{ bajo_stock: number; sin_stock: number } | null>(null)
  const [financial, setFinancial] = useState<{ cuentas_por_cobrar: number } | null>(null)
  const [creditUsed, setCreditUsed] = useState(0)
  const [marginAvg, setMarginAvg] = useState<number | null>(null)

  // Widget state
  const [weekData, setWeekData] = useState<WeekDay[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [ivaSummary, setIvaSummary] = useState<IVASummary | null>(null)
  const [agingData, setAgingData] = useState<{ total_pendiente: number; buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[] } | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([])

  // Widget loading states
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [loadingTop, setLoadingTop] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingIVA, setLoadingIVA] = useState(true)
  const [loadingAging, setLoadingAging] = useState(true)
  const [errorWeek, setErrorWeek] = useState<string | null>(null)
  const [errorTop, setErrorTop] = useState<string | null>(null)
  const [errorStock, setErrorStock] = useState<string | null>(null)
  const [errorIVA, setErrorIVA] = useState<string | null>(null)
  const [errorAging, setErrorAging] = useState<string | null>(null)

  const feedRef = useRef<HTMLDivElement>(null)
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  // SSE
  useSSE({
    companyId: "00000000-0000-0000-0000-000000000010",
    enabled: !loading,
    onEvent: (event) => {
      const now = new Date().toISOString()
      const link = event.type === "sale_completed" && (event.data as { sale_id?: string })?.sale_id
        ? `/sales/${(event.data as { sale_id: string }).sale_id}`
        : undefined
      const activityType: "sale" | "alert" | "caja" | null = event.type === "sale_completed" ? "sale" : event.type === "stock_alert" ? "alert" : event.type === "cash_session" ? "caja" : null
      if (!activityType) return
      const newEvent: ActivityEvent = { id: crypto.randomUUID(), type: activityType, message: event.message as string, time: now, link }
      setRecentActivity(prev => [newEvent, ...prev].slice(0, 20))
    },
  })

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    // KPIs
    try {
      const [sales, inventory, fin, creditAccs] = await Promise.allSettled([
        api.reports.salesSummary({ fecha_desde: TODAY, fecha_hasta: TODAY }),
        api.reports.inventorySummary(),
        api.reports.financialSummary(),
        api.creditAccounts.list({ activo: true }),
      ])
      if (sales.status === "fulfilled") setSalesSummary(sales.value)
      if (inventory.status === "fulfilled") setInventorySummary(inventory.value)
      if (fin.status === "fulfilled") setFinancial(fin.value)
      if (creditAccs.status === "fulfilled") {
        setCreditUsed(creditAccs.value.reduce((s: number, a: CreditAccount) => s + (a.saldo_utilizado || 0), 0))
      }
    } catch { /* errores por widget ya se manejan abajo */ }

    // Week chart
    setLoadingWeek(true)
    setErrorWeek(null)
    try {
      const periods: { periodo: string; monto: number }[] = await api.reports.salesByPeriod({
        agrupar_por: "dia",
        fecha_desde: FOURTEEN_DAYS_AGO,
        fecha_hasta: TODAY,
      })
      const last7: WeekDay[] = []
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const fechaKey = d.toISOString().slice(0, 10)
        const current = periods.find(p => p.periodo === fechaKey)
        const prevD = new Date(now)
        prevD.setDate(prevD.getDate() - i - 7)
        const prevKey = prevD.toISOString().slice(0, 10)
        const previous = periods.find(p => p.periodo === prevKey)
        last7.push({
          label: dayLabels[d.getDay()],
          fecha: fechaKey,
          monto: current?.monto ?? 0,
          monto_prev: previous?.monto ?? 0,
        })
      }
      setWeekData(last7)
    } catch {
      setErrorWeek("No se pudieron cargar las ventas")
      setWeekData([])
    } finally {
      setLoadingWeek(false)
    }

    // Top products — vía reports.salesByProduct (agregado real en el backend,
    // con unidad de medida real y sin el N+1 de traer cada venta + sus ítems)
    setLoadingTop(true)
    setErrorTop(null)
    try {
      const top = await api.reports.salesByProduct({ fecha_desde: SEVEN_DAYS_AGO, fecha_hasta: TODAY, limit: 10 })
      setTopProducts(top)
    } catch {
      setErrorTop("No se pudieron cargar los productos")
      setTopProducts([])
    } finally {
      setLoadingTop(false)
    }

    // Low stock
    setLoadingStock(true)
    setErrorStock(null)
    try {
      const low = await api.stock.lowStock()
      const mapped: LowStockItem[] = low.map((s: StockItem) => ({
        product_id: s.product_id || "",
        warehouse_id: s.warehouse_id || "",
        nombre: (s as any).nombre || s.product?.nombre || "Producto",
        sku: (s as any).sku || s.product?.sku || "",
        cantidad: s.cantidad || 0,
        stock_minimo: (s as any).stock_minimo || 10,
        stock_maximo: (s as any).stock_maximo || 100,
        costo_unitario: s.costo_unitario || 0,
      }))
      setLowStock(mapped.slice(0, 6))
    } catch {
      setErrorStock("No se pudieron cargar los stocks")
      setLowStock([])
    } finally {
      setLoadingStock(false)
    }

    // IVA
    setLoadingIVA(true)
    setErrorIVA(null)
    try {
      const iva = await api.reports.salesSummary({ fecha_desde: SEVEN_DAYS_AGO, fecha_hasta: TODAY })
      setIvaSummary({
        base_10: iva.monto_iva_10 * 10,
        base_5: iva.monto_iva_5 * 20,
        exenta: iva.monto_exento,
        iva_10: iva.monto_iva_10,
        iva_5: iva.monto_iva_5,
        total_iva: iva.monto_iva_10 + iva.monto_iva_5,
      })
    } catch {
      setErrorIVA("No se pudo cargar el resumen IVA")
      setIvaSummary(null)
    } finally {
      setLoadingIVA(false)
    }

    // Aging
    setLoadingAging(true)
    setErrorAging(null)
    try {
      const aging = await api.accountsReceivable.aging()
      setAgingData({ total_pendiente: aging.total_pendiente, buckets: aging.buckets })
    } catch {
      setErrorAging("No se pudieron cargar las cuentas")
      setAgingData(null)
    } finally {
      setLoadingAging(false)
    }

    setLoading(false)
    if (isRefresh) setTimeout(() => setRefreshing(false), 400)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [recentActivity])

  return (
    <AnimatedPage className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="btn-ghost p-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          label="Ventas Hoy"
          value={salesSummary ? formatPYG(salesSummary.monto_total) : "₲ 0"}
          sublabel={salesSummary ? `${salesSummary.total_ventas} transacciones` : undefined}
          color="green"
          loading={loading && !salesSummary}
        />
        <KPICard
          icon={ShoppingCart}
          label="Transacciones"
          value={salesSummary?.total_ventas ?? 0}
          color="blue"
          loading={loading && !salesSummary}
        />
        <KPICard
          icon={Banknote}
          label="Ticket Promedio"
          value={salesSummary ? formatPYG(salesSummary.ticket_promedio) : "₲ 0"}
          color="primary"
          loading={loading && !salesSummary}
        />
        <KPICard
          icon={Package}
          label="Productos Vendidos"
          value={salesSummary?.total_items ?? 0}
          color="purple"
          sublabel={salesSummary ? `en ${salesSummary.total_ventas} ventas` : undefined}
          loading={loading && !salesSummary}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={CreditCard}
          label="Cuentas x Cobrar"
          value={financial ? formatPYG(financial.cuentas_por_cobrar) : "₲ 0"}
          color="indigo"
          loading={loading}
        />
        <KPICard
          icon={AlertTriangle}
          label="Stock Bajo"
          value={inventorySummary?.bajo_stock ?? 0}
          sublabel={inventorySummary?.sin_stock ? `${inventorySummary.sin_stock} sin stock` : undefined}
          color="red"
          loading={loading}
        />
        <KPICard
          icon={Wallet}
          label="Crédito Usado"
          value={formatPYG(creditUsed)}
          color="amber"
          loading={loading}
        />
        <KPICard
          icon={Percent}
          label="Margen Promedio"
          value={marginAvg !== null ? formatPYG(marginAvg) : "—"}
          color="green"
          loading={loading}
        />
      </div>

      {/* Gerente General IA */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <GeneralAgentChat />
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Ventas últimos 7 días */}
        <Widget title="Ventas últimos 7 días" subtitle="Comparativa vs semana anterior" size="md" loading={loadingWeek} error={errorWeek}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={0} />
              <Tooltip formatter={(v: number) => formatPYG(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "monto" ? "Esta semana" : "Semana anterior"} />
              <Bar dataKey="monto" fill="#104c91" radius={[4, 4, 0, 0]} />
              <Bar dataKey="monto_prev" fill="#104c9155" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Widget>

        {/* Top 10 Productos */}
        <Widget title="Top 10 Productos" subtitle="Más vendidos (7 días)" size="sm" loading={loadingTop} error={errorTop}>
          {topProducts.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin ventas en los últimos 7 días</div>
          ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {topProducts.map((p, i) => {
              const maxMonto = topProducts.length > 0 ? Math.max(...topProducts.map(t => t.monto)) : 1
              const pct = Math.min((p.monto / maxMonto) * 100, 100)
              const esKg = p.unidad_medida === "KG"
              const cantidadFmt = esKg ? `${p.cantidad.toFixed(2)} kg` : `${Math.round(p.cantidad)} uds`
              return (
                <div key={`${p.sku}-${i}`} className="group cursor-default">
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-gray-500/50"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.producto}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{p.sku} · {cantidadFmt}</p>
                    </div>
                    <p className="text-sm font-bold text-primary flex-shrink-0">{formatPYG(p.monto)}</p>
                  </div>
                  <div className="pl-7">
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          )}
        </Widget>

        {/* Stock Bajo */}
        <Widget title="Stock Bajo" subtitle="Productos bajo mínimo" size="sm" loading={loadingStock} error={errorStock}
          action={
            <a href="/inventory" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight className="w-3 h-3" />
            </a>
          }
        >
          {lowStock.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin productos bajo el mínimo</div>
          ) : (
          <div className="space-y-3">
            {lowStock.slice(0, 5).map((item) => {
              const min = item.stock_minimo || 10
              const critical = item.cantidad === 0
              const danger = item.cantidad <= min * 0.3
              const barPct = min > 0 ? Math.min((item.cantidad / min) * 100, 100) : 0
              return (
                <div key={item.product_id} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.nombre}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className={`text-sm font-bold ${critical ? "text-red-500" : danger ? "text-amber-500" : "text-amber-600"}`}>
                        {item.cantidad}
                      </p>
                      <p className="text-[10px] text-gray-400">mín: {min}</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        critical ? "bg-red-500" : danger ? "bg-amber-500" : "bg-amber-400"
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          )}
        </Widget>

        {/* Actividad Reciente */}
        <Widget title="Actividad Reciente" subtitle="Tiempo real via SSE" size="md"
          action={
            recentActivity.length > 0 && (
              <span className="text-[10px] text-gray-400">{recentActivity.length} eventos</span>
            )
          }
        >
          <div ref={feedRef} className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {recentActivity.length > 0 ? (
              recentActivity.map((a) => (
                <a
                  key={a.id}
                  href={a.link || "#"}
                  className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                    a.link ? "hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    a.type === "sale" ? "bg-green-50 dark:bg-green-900/20" :
                    a.type === "alert" ? "bg-red-50 dark:bg-red-900/20" :
                    "bg-blue-50 dark:bg-blue-900/20"
                  }`}>
                    {a.type === "sale" ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : a.type === "alert" ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <DollarSign className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{a.message}</p>
                    <p className="text-[10px] text-gray-400">{relativeTime(a.time)}</p>
                  </div>
                  {a.link && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                </a>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Clock className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-sm">Esperando actividad...</p>
              </div>
            )}
          </div>
        </Widget>

        {/* Resumen IVA */}
        <Widget title="Resumen IVA" subtitle="Últimos 7 días" size="sm" loading={loadingIVA} error={errorIVA}>
          {ivaSummary && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500">Base 10%</span>
                <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{formatPYG(ivaSummary.base_10)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500">Base 5%</span>
                <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{formatPYG(ivaSummary.base_5)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500">Exenta</span>
                <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{formatPYG(ivaSummary.exenta)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500">IVA 10%</span>
                <span className="text-xs font-mono font-semibold text-green-600 dark:text-green-400">{formatPYG(ivaSummary.iva_10)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500">IVA 5%</span>
                <span className="text-xs font-mono font-semibold text-green-600 dark:text-green-400">{formatPYG(ivaSummary.iva_5)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Total IVA</span>
                <span className="text-sm font-bold text-primary">{formatPYG(ivaSummary.total_iva)}</span>
              </div>
            </div>
          )}
        </Widget>

        {/* Cuentas x Cobrar */}
        <Widget title="Cuentas x Cobrar" subtitle="Aging" size="sm" loading={loadingAging} error={errorAging}>
          {agingData && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-500">{formatPYG(agingData.total_pendiente)}</p>
                <p className="text-[10px] text-gray-400">Total pendiente</p>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden flex">
                {agingData.buckets.map((b, i) => {
                  const colors = ["bg-green-500", "bg-amber-400", "bg-amber-500", "bg-orange-500", "bg-red-500"]
                  return (
                    <div
                      key={i}
                      className={`${colors[i] || "bg-gray-400"} h-full transition-all`}
                      style={{ width: `${b.porcentaje}%` }}
                      title={`${b.rango}: ${formatPYG(b.monto)}`}
                    />
                  )
                })}
              </div>
              <div className="space-y-1.5">
                {agingData.buckets.map((b, i) => {
                  const dotColors = ["bg-green-500", "bg-amber-400", "bg-amber-500", "bg-orange-500", "bg-red-500"]
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <span className={`w-2 h-2 rounded-full ${dotColors[i]}`} />
                        {b.rango}
                      </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">{formatPYG(b.monto)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Widget>
      </div>
    </AnimatedPage>
  )
}
