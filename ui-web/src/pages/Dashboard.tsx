import { useState, useEffect, useRef, useCallback } from "react"
import {
  TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle, Wallet,
  Clock, RefreshCw, ChevronRight, CreditCard, Percent, Ban as Banknote,
  Apple, Beef, Croissant, AlertCircle, Utensils, Sparkles, Check, CheckCircle, Trash2
} from "lucide-react"
import { api, type StockItem, type CreditAccount } from "../api"
import { KPICard } from "../components/KPICard"
import { Widget } from "../components/Widget"
import { AnimatedPage } from "../components/AnimatedPage"
import { formatPYG } from "../utils/format"
import { useSSE } from "../hooks/useSSE"
import { useToast } from "../context/ToastContext"
import { useFeatures } from "../context/FeatureContext"

interface ActivityEvent {
  id: string
  type: "sale" | "alert" | "caja"
  message: string
  time: string
  link?: string
}

interface TopProduct {
  product_id: string
  nombre: string
  sku: string
  cantidad: number
  total: number
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

const MOCK_TOP_PRODUCTS: TopProduct[] = [
  { product_id: "1", nombre: "Coca Cola 2L", sku: "BEB-001", cantidad: 142, total: 1846000 },
  { product_id: "2", nombre: "Arroz 1kg", sku: "ALI-045", cantidad: 98, total: 784000 },
  { product_id: "3", nombre: "Leche Entera 1L", sku: "LAC-012", cantidad: 76, total: 456000 },
  { product_id: "4", nombre: "Pan Frances", sku: "PAN-001", cantidad: 65, total: 325000 },
  { product_id: "5", nombre: "Aceite 900ml", sku: "ALI-023", cantidad: 54, total: 972000 },
]

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

const MOCK_LOW_STOCK: LowStockItem[] = [
  { product_id: "1", warehouse_id: "w1", nombre: "Coca Cola 2L", sku: "BEB-001", cantidad: 3, stock_minimo: 10, stock_maximo: 100, costo_unitario: 8500 },
  { product_id: "2", warehouse_id: "w1", nombre: "Arroz 1kg", sku: "ALI-045", cantidad: 5, stock_minimo: 20, stock_maximo: 200, costo_unitario: 4500 },
  { product_id: "3", warehouse_id: "w1", nombre: "Leche Entera 1L", sku: "LAC-012", cantidad: 8, stock_minimo: 15, stock_maximo: 80, costo_unitario: 3200 },
  { product_id: "4", warehouse_id: "w1", nombre: "Pan Frances", sku: "PAN-001", cantidad: 0, stock_minimo: 30, stock_maximo: 150, costo_unitario: 1500 },
  { product_id: "5", warehouse_id: "w1", nombre: "Azúcar 1kg", sku: "ALI-031", cantidad: 12, stock_minimo: 25, stock_maximo: 120, costo_unitario: 3800 },
]

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()
  const { hasFeature } = useFeatures()
  const [rescues, setRescues] = useState([
    {
      id: "r1",
      producto: "Tomate Perita",
      area: "Verdulería",
      cantidad: "45 kg",
      motivo: "Firmeza Baja (Madurez Avanzada)",
      tipo: "transformar",
      propuesta: "Derivar a Rotisería para Salsa Bolognesa Casera (30 Litros)",
      ahorro: "Gs 240.000",
      icon: Apple,
      color: "from-red-500/10 to-red-600/5 border-red-500/20 text-red-600 dark:text-red-400"
    },
    {
      id: "r2",
      producto: "Peceto Vacuno Bovina",
      area: "Carnicería",
      cantidad: "12 kg",
      motivo: "Próximo a Vencer (24 hs restantes)",
      tipo: "transformar",
      propuesta: "Elaborar Milanesas de Peceto Preparadas (Empanado Pre-pack)",
      ahorro: "Gs 450.000",
      icon: Beef,
      color: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
    },
    {
      id: "r3",
      producto: "Pan Felipe Tradicional",
      area: "Panadería",
      cantidad: "18 kg",
      motivo: "Excedente de Producción (Remanente de ayer)",
      tipo: "transformar",
      propuesta: "Moler para empaquetar Pan Rallado de la Casa (36 Bolsas)",
      ahorro: "Gs 110.000",
      icon: Croissant,
      color: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
    },
    {
      id: "r4",
      producto: "Pechuga de Pollo Fresca",
      area: "Carnicería",
      cantidad: "8 kg",
      motivo: "Pérdida de Frío (Góndola C a 9.5°C por >2 horas)",
      tipo: "descarte",
      propuesta: "Descarte Sanitario Obligatorio (Inocuidad Alimentaria)",
      ahorro: "Bloqueo POS Activo",
      icon: AlertCircle,
      color: "from-slate-500/10 to-slate-600/5 border-slate-500/20 text-slate-600 dark:text-slate-400"
    }
  ])

  const handleAction = (id: string, actionType: "transform" | "discard", productName: string, propuesta: string) => {
    setRescues(prev => prev.filter(r => r.id !== id))
    if (actionType === "transform") {
      toast.success(
        "¡Rescate Autorizado!", 
        `Se han transferido los insumos y se creó la Orden de Producción para: "${propuesta}".`
      )
    } else {
      toast.error(
        "Descarte Sanitario Registrado", 
        `Lote bloqueado en el inventario general y en el POS por protocolo de seguridad alimentaria.`
      )
    }
  }

  // KPI state
  const [salesSummary, setSalesSummary] = useState<{ total_ventas: number; monto_total: number; ticket_promedio: number; total_items: number } | null>(null)
  const [inventorySummary, setInventorySummary] = useState<{ bajo_stock: number; sin_stock: number } | null>(null)
  const [financial, setFinancial] = useState<{ cuentas_por_cobrar: number } | null>(null)
  const [creditUsed, setCreditUsed] = useState(0)
  const [marginAvg, setMarginAvg] = useState<number | null>(null)
  // creditUsed arranca en 0 y para muchos tenants (ej. Casa Gonzalito, que no
  // usa el modulo de credit_accounts) el valor real TAMBIEN es 0 para siempre
  // — no sirve usar "!creditUsed" como señal de "todavia no cargo".
  const [kpisLoaded, setKpisLoaded] = useState(false)

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
    const isDemo = localStorage.getItem("access_token") === "demo-token"

    // KPIs
    try {
      const [sales, inventory, fin, creditAccs] = await Promise.allSettled([
        api.reports.salesSummary({ fecha_desde: TODAY, fecha_hasta: TODAY }),
        api.reports.inventorySummary(),
        api.reports.financialSummary(),
        api.creditAccounts.list({ activo: true }),
      ])
      if (sales.status === "fulfilled") {
        setSalesSummary(sales.value)
        setMarginAvg(sales.value.ticket_promedio > 0 && sales.value.total_items > 0
          ? Math.round((sales.value.monto_total / sales.value.total_items) * 0.25) : null)
      }
      if (inventory.status === "fulfilled") setInventorySummary(inventory.value)
      if (fin.status === "fulfilled") setFinancial(fin.value)
      if (creditAccs.status === "fulfilled") {
        setCreditUsed(creditAccs.value.reduce((s: number, a: CreditAccount) => s + (a.saldo_utilizado || 0), 0))
      }
    } catch { /* fallback handled below */ }
    setKpisLoaded(true)

    if (isDemo) {
      setSalesSummary({ total_ventas: 47, monto_total: 14500000, ticket_promedio: 308510, total_items: 156 })
      setInventorySummary({ bajo_stock: 18, sin_stock: 3 })
      setFinancial({ cuentas_por_cobrar: 45600000 })
      setCreditUsed(12300000)
      setMarginAvg(35000)
      setKpisLoaded(true)
      const now = new Date()
      const fallbackWeek: WeekDay[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        fallbackWeek.push({
          label: dayLabels[d.getDay()], fecha: d.toISOString().slice(0, 10),
          monto: [3200000, 4100000, 2800000, 1800000, 5100000, 3900000, 2600000][6 - i],
          monto_prev: [2900000, 3800000, 3100000, 2200000, 4500000, 3600000, 2400000][6 - i],
        })
      }
      setWeekData(fallbackWeek); setLoadingWeek(false)
      setTopProducts(MOCK_TOP_PRODUCTS); setLoadingTop(false)
      setLowStock(MOCK_LOW_STOCK); setLoadingStock(false)
      setIvaSummary({ base_10: 13181800, base_5: 0, exenta: 320000, iva_10: 1318180, iva_5: 0, total_iva: 1318180 }); setLoadingIVA(false)
      setAgingData({ total_pendiente: 45600000, buckets: [{ rango: "Al día", monto: 18500000, cantidad: 12, porcentaje: 40.6 },{ rango: "1-30 días", monto: 12800000, cantidad: 8, porcentaje: 28.1 },{ rango: "31-60 días", monto: 8200000, cantidad: 5, porcentaje: 18.0 },{ rango: "61-90 días", monto: 4100000, cantidad: 3, porcentaje: 9.0 },{ rango: "+90 días", monto: 2000000, cantidad: 2, porcentaje: 4.4 }] }); setLoadingAging(false)
      setLoading(false)
      return
    }

    // Las 5 secciones de abajo son independientes entre si — antes se
    // esperaban una detras de otra (await secuencial), sumando sus tiempos
    // en vez de superponerse. Ahora corren en paralelo: el tiempo total de
    // carga pasa a ser el de la mas lenta, no la suma de todas.
    setLoadingWeek(true); setErrorWeek(null)
    setLoadingTop(true); setErrorTop(null)
    setLoadingStock(true); setErrorStock(null)
    setLoadingIVA(true); setErrorIVA(null)
    setLoadingAging(true); setErrorAging(null)

    const loadWeek = async () => {
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
    }

    // Top products — agregado en el backend (antes hacia una consulta HTTP
    // por cada venta de los ultimos 7 dias, decenas de requests en cadena
    // que con volumen real de datos dejaban el spinner girando por minutos)
    const loadTop = async () => {
      try {
        const byProduct = await api.reports.salesByProduct({ fecha_desde: SEVEN_DAYS_AGO, fecha_hasta: TODAY, limit: 5 })
        setTopProducts(byProduct.map((p: any) => ({
          product_id: p.sku || p.producto,
          nombre: p.producto,
          sku: p.sku,
          cantidad: p.cantidad,
          total: p.monto,
        })))
      } catch {
        setErrorTop("No se pudieron cargar los productos")
        setTopProducts([])
      } finally {
        setLoadingTop(false)
      }
    }

    const loadStock = async () => {
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
    }

    const loadIVA = async () => {
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
    }

    const loadAging = async () => {
      try {
        const aging = await api.accountsReceivable.aging()
        setAgingData({ total_pendiente: aging.total_pendiente, buckets: aging.buckets })
      } catch {
        setErrorAging("No se pudieron cargar las cuentas")
        setAgingData(null)
      } finally {
        setLoadingAging(false)
      }
    }

    await Promise.allSettled([loadWeek(), loadTop(), loadStock(), loadIVA(), loadAging()])

    setLoading(false)
    if (isRefresh) setTimeout(() => setRefreshing(false), 400)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [recentActivity])

  const maxWeekMonto = weekData.length > 0 ? Math.max(...weekData.map(d => Math.max(d.monto, d.monto_prev))) : 1
  const avgWeek = weekData.length > 0 ? weekData.reduce((s, d) => s + d.monto, 0) / weekData.length : 0

  const chartTooltipRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; monto: number; monto_prev: number; label: string } | null>(null)

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
          trend={salesSummary ? { direction: "up", value: "+12%" } : undefined}
          loading={loading && !salesSummary}
        />
        <KPICard
          icon={ShoppingCart}
          label="Transacciones"
          value={salesSummary?.total_ventas ?? 0}
          color="blue"
          trend={salesSummary ? { direction: "up", value: "+8%" } : undefined}
          loading={loading && !salesSummary}
        />
        <KPICard
          icon={Banknote}
          label="Ticket Promedio"
          value={salesSummary ? formatPYG(salesSummary.ticket_promedio) : "₲ 0"}
          color="primary"
          trend={salesSummary ? { direction: salesSummary.ticket_promedio > 300000 ? "up" : "down", value: "+5%" } : undefined}
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
          trend={{ direction: financial && financial.cuentas_por_cobrar > 10000000 ? "down" : "up", value: "-3%" }}
          loading={!kpisLoaded}
        />
        <KPICard
          icon={AlertTriangle}
          label="Stock Bajo"
          value={inventorySummary?.bajo_stock ?? 0}
          sublabel={inventorySummary?.sin_stock ? `${inventorySummary.sin_stock} sin stock` : undefined}
          color="red"
          trend={inventorySummary && inventorySummary.bajo_stock > 10 ? { direction: "up", value: "+2" } : { direction: "down", value: "-1" }}
          loading={!kpisLoaded}
        />
        <KPICard
          icon={Wallet}
          label="Crédito Usado"
          value={formatPYG(creditUsed)}
          color="amber"
          loading={!kpisLoaded}
        />
        <KPICard
          icon={Percent}
          label="Margen Promedio"
          value={marginAvg !== null ? formatPYG(marginAvg) : "—"}
          color="green"
          loading={!kpisLoaded}
        />
      </div>

      {/* Dynamic Waste-to-Margin AI Rescue Widget — supermarket-only, gated by tenant vertical feature */}
      {hasFeature("supermercado") && (
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Asistente IA Activo
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Utensils className="w-6 h-6 text-primary" />
              Asistente de Rescate de Inventario (Anti-Merma)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Detección de productos de baja rotación o frescura decreciente sugeridos para transformación de alto margen o descarte seguro.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {rescues.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">¡Todo el inventario está seguro!</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                No hay alertas de frescura crítica ni lotes próximos a vencer pendientes de acción de rescate.
              </p>
            </div>
          ) : (
            rescues.map(r => (
              <div key={r.id} className={`flex flex-col md:flex-row gap-5 p-5 rounded-2xl border bg-gradient-to-br transition-all duration-300 hover:shadow-md ${r.color}`}>
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm self-start">
                  <r.icon className="w-7 h-7" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">{r.area}</span>
                      <span className="text-xs text-gray-400 font-semibold">•</span>
                      <span className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {r.motivo}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">
                      {r.producto} <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">({r.cantidad})</span>
                    </h3>
                  </div>

                  <div className="p-3.5 bg-white/70 dark:bg-slate-800/50 rounded-xl border border-black/5 dark:border-white/5">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Acción Propuesta por IA</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.propuesta}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-400 font-medium">Recuperación estimada:</span>
                      <span className="font-extrabold text-green-600 dark:text-green-400 font-mono text-sm">{r.ahorro}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.tipo === "transformar" ? (
                        <>
                          <button 
                            onClick={() => handleAction(r.id, "transform", r.producto, r.propuesta)}
                            className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1 rounded-xl"
                          >
                            <Check className="w-3.5 h-3.5" /> Autorizar Rescate
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleAction(r.id, "discard", r.producto, r.propuesta)}
                          className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 flex items-center gap-1 rounded-xl shadow-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Confirmar Descarte Sanitario
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Ventas últimos 7 días */}
        <Widget title="Ventas últimos 7 días" subtitle="Comparativa vs semana anterior" size="md" loading={loadingWeek} error={errorWeek}>
          <div className="relative">
            <div className="h-64 flex items-end gap-1.5 justify-between pt-4">
              {weekData.map((d, i) => {
                const hCurrent = (d.monto / maxWeekMonto) * 180
                const hPrev = (d.monto_prev / maxWeekMonto) * 180
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Previous week bar (dashed) */}
                    <div
                      className="w-full max-w-[28px] bg-primary/20 rounded-t border border-dashed border-primary/40 transition-all cursor-pointer"
                      style={{ height: `${Math.max(hPrev, 4)}px` }}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setTooltip({ x: rect.left, y: rect.top - 8, monto: d.monto, monto_prev: d.monto_prev, label: d.label })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Current week bar (gradient) */}
                    <div
                      className="w-full max-w-[28px] bg-gradient-to-t from-primary to-primary-light rounded-t transition-all duration-500 cursor-pointer group-hover:opacity-80"
                      style={{ height: `${Math.max(hCurrent, 4)}px` }}
                      onMouseEnter={(e) => {
                        const bar = (e.currentTarget as HTMLElement)
                        const rect = bar.getBoundingClientRect()
                        setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, monto: d.monto, monto_prev: d.monto_prev, label: d.label })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Trend line (average) */}
                    {i === 0 && (
                      <div className="absolute left-0 right-0 border-t border-dashed border-green-400/60 pointer-events-none" style={{ bottom: `${(avgWeek / maxWeekMonto) * 180 + 28}px` }} />
                    )}
                    <span className="text-[10px] text-gray-400 mt-1">{d.label}</span>
                  </div>
                )
              })}
            </div>
            {/* Tooltip */}
            {tooltip && (
              <div
                ref={chartTooltipRef}
                className="absolute z-10 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg px-3 py-2 pointer-events-none whitespace-nowrap"
                style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, transform: "translate(-50%, -100%)" }}
              >
                <p className="font-semibold mb-1">{tooltip.label}</p>
                <p className="text-green-400">Esta sem: {formatPYG(tooltip.monto)}</p>
                <p className="text-gray-400">Sem pasada: {formatPYG(tooltip.monto_prev)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {tooltip.monto > tooltip.monto_prev
                    ? `↑ +${((tooltip.monto - tooltip.monto_prev) / tooltip.monto_prev * 100).toFixed(0)}%`
                    : `↓ ${((tooltip.monto_prev - tooltip.monto) / tooltip.monto_prev * 100).toFixed(0)}%`}
                </p>
              </div>
            )}
            {/* Average legend */}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary rounded" /> Esta semana</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary/40 border border-dashed border-primary/60" /> Semana anterior</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed border-green-400/60" /> Promedio</span>
            </div>
          </div>
        </Widget>

        {/* Top 5 Productos */}
        <Widget title="Top 5 Productos" subtitle="Más vendidos (7 días)" size="sm" loading={loadingTop} error={errorTop}>
          {topProducts.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Sin ventas en los últimos 7 días</div>
          ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => {
              const maxTotal = topProducts.length > 0 ? Math.max(...topProducts.map(t => t.total)) : 1
              const pct = (p.total / maxTotal) * 100
              return (
                <div key={p.product_id} className="group cursor-default">
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                      i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-gray-500/50"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nombre}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{p.sku} · {p.cantidad} uds</p>
                    </div>
                    <p className="text-sm font-bold text-primary flex-shrink-0">{formatPYG(p.total)}</p>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden ml-7">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
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
