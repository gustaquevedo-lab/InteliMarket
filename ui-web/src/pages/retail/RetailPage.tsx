import { useState, useEffect, useMemo, useCallback } from "react"
import {
  BarChart3, TrendingUp, Clock, Package, Users, Calendar, MessageCircle, Globe,
  Sparkles, Tag, ChevronRight, Search, Plus, Edit3, Trash2, X, Check,
  AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, Download, Eye,
  DollarSign, ShoppingCart, Store, Zap, MapPin, Phone, Send, Copy, Filter,
  TrendingDown, ArrowUp, ArrowDown, Wifi, WifiOff, Volume2, VolumeX, Keyboard,
  Lightbulb, Target, Award, Gift, Bell, ExternalLink, Camera, Receipt,
  CalendarDays, Cake, Heart, Sun, Moon, Star, Hash, AtSign, ScanLine,
  ArrowLeft, ShoppingBag, Box, Truck, Eye as EyeIcon, Briefcase, Percent
} from "lucide-react"
import { useToast } from "../../hooks/useToast"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "pos" | "cliente" | "cupones" | "whatsapp" | "eventos" | "tienda"

const TABS: { id: Tab; label: string; icon: any; color: string; description: string }[] = [
  { id: "dashboard", label: "Dashboard KPIs", icon: BarChart3, color: "from-teal-500 to-cyan-600", description: "Métricas en tiempo real" },
  { id: "pos", label: "POS Ultra-Rápido", icon: Zap, color: "from-orange-500 to-red-600", description: "Caja con atajos" },
  { id: "cliente", label: "Cliente Rápido", icon: Users, color: "from-blue-500 to-indigo-600", description: "Identificación 1-click" },
  { id: "cupones", label: "Cupones", icon: Tag, color: "from-pink-500 to-rose-600", description: "Promociones digitales" },
  { id: "whatsapp", label: "WhatsApp Local", icon: MessageCircle, color: "from-green-500 to-emerald-600", description: "Campañas PY" },
  { id: "eventos", label: "Eventos PY", icon: Calendar, color: "from-purple-500 to-violet-600", description: "Calendario nacional" },
  { id: "tienda", label: "Tienda Online", icon: Globe, color: "from-amber-500 to-orange-600", description: "Pickup & delivery" },
]

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setRefreshing(true)
    try {
      const r = await api.retail.getDashboard()
      setData(r)
    } catch (e: any) {
      // Demo mode
      setData(generateDemoDashboard())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingState message="Cargando dashboard..." />

  const { hoy, semana, mes, heatmap_7dias, top_productos, productos_sin_venta, alertas_stock, proximos_eventos, cupones_activos, ventas_por_dia_semana, comparativa } = data

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Ventas Hoy" value={formatPYG(hoy.ventas_total)} subtitle={`${hoy.ventas_count} transacciones`} icon={DollarSign} trend={parseFloat(hoy.delta_ventas_pct)} color="teal" />
        <KpiCard title="Ticket Promedio" value={formatPYG(hoy.ticket_promedio)} subtitle={`${hoy.clientes_unicos} clientes`} icon={Receipt} trend={parseFloat(hoy.delta_ticket_pct)} color="blue" />
        <KpiCard title="Ventas / m²" value={formatPYG(hoy.ventas_m2)} subtitle={`Hora pico: ${hoy.hora_pico}:00`} icon={Target} trend={parseFloat(hoy.delta_clientes_pct)} color="purple" />
        <KpiCard title="Conversión" value={hoy.conversion_pct != null ? `${hoy.conversion_pct}%` : "Sin datos"} subtitle={hoy.conversion_pct != null ? `Margen: ${formatPYG(hoy.margen_bruto)}` : "Requiere contador de tráfico"} icon={TrendingUp} trend={undefined} color="amber" />
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
                  <button className="text-xs text-red-700 dark:text-red-400 font-medium hover:underline">Reabastecer</button>
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

// ════════════════════════════════════════════════════════════
//  POS
// ════════════════════════════════════════════════════════════

function POSTab() {
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [customer, setCustomer] = useState<any>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [kioskMode, setKioskMode] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [couponCode, setCouponCode] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const { toast } = useToast()

  const PRODUCTS = useMemo(() => [
    { id: "1", name: "Coca-Cola 1.5L", price: 12000, category: "Bebidas", code: "7501", emoji: "🥤" },
    { id: "2", name: "Pan Baguette", price: 8500, category: "Panadería", code: "7502", emoji: "🥖" },
    { id: "3", name: "Leche Entera 1L", price: 7500, category: "Lácteos", code: "7503", emoji: "🥛" },
    { id: "4", name: "Arroz 1kg", price: 6200, category: "Almacén", code: "7504", emoji: "🍚" },
    { id: "5", name: "Huevos 6un", price: 8500, category: "Lácteos", code: "7505", emoji: "🥚" },
    { id: "6", name: "Azúcar 1kg", price: 5200, category: "Almacén", code: "7506", emoji: "🍬" },
    { id: "7", name: "Aceite Girasol 1L", price: 13500, category: "Almacén", code: "7507", emoji: "🫒" },
    { id: "8", name: "Yerba Mate 500g", price: 8500, category: "Almacén", code: "7508", emoji: "🧉" },
    { id: "9", name: "Fideos 500g", price: 4800, category: "Almacén", code: "7509", emoji: "🍝" },
    { id: "10", name: "Detergente 750ml", price: 9500, category: "Limpieza", code: "7510", emoji: "🧴" },
    { id: "11", name: "Papel Higiénico 4un", price: 11200, category: "Limpieza", code: "7511", emoji: "🧻" },
    { id: "12", name: "Jabón Tocador", price: 5200, category: "Limpieza", code: "7512", emoji: "🧼" },
  ], [])

  const filtered = useMemo(() => {
    if (!search) return PRODUCTS
    const s = search.toLowerCase()
    return PRODUCTS.filter(p => p.name.toLowerCase().includes(s) || p.code.includes(s))
  }, [search, PRODUCTS])

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const finalTotal = Math.max(0, total - appliedDiscount)

  const playBeep = (freq: number, duration: number) => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      o.type = "sine"
      g.gain.setValueAtTime(0.1, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      o.start()
      o.stop(ctx.currentTime + duration)
    } catch (e) {}
  }

  const addToCart = (product: any) => {
    playBeep(800, 0.05)
    setItems(prev => {
      const found = prev.find(i => i.id === product.id)
      if (found) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { removeFromCart(id); return }
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const handleCheckout = () => {
    if (items.length === 0) { playBeep(300, 0.2); return }
    playBeep(1200, 0.1); setTimeout(() => playBeep(1500, 0.1), 100)
    toast({ title: "✅ Venta completada", description: `${items.length} items · ${formatPYG(finalTotal)}`, variant: "success" })
    setItems([]); setCustomer(null); setCouponCode(""); setAppliedDiscount(0)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); (document.getElementById("pos-search") as HTMLInputElement)?.focus() }
      if (e.key === "F4") { e.preventDefault(); /* apply discount */ }
      if (e.key === "F8") { e.preventDefault(); handleCheckout() }
      if (e.key === "F9") { e.preventDefault(); /* digital ticket */ toast({ title: "📱 Ticket digital enviado" }) }
      if (e.key === "F12") { e.preventDefault(); setKioskMode(k => !k) }
      if (e.key === "Escape") { setItems([]) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [items, finalTotal])

  const applyCoupon = async () => {
    if (!couponCode) return
    playBeep(1000, 0.08)
    // Mock discount
    if (couponCode.toUpperCase() === "VERANO15") {
      setAppliedDiscount(total * 0.15)
      toast({ title: "✅ Cupón aplicado", description: "15% de descuento", variant: "success" })
    } else if (couponCode.toUpperCase() === "BIENVENIDO10") {
      setAppliedDiscount(total * 0.10)
      toast({ title: "✅ Cupón aplicado", description: "10% descuento bienvenida", variant: "success" })
    } else {
      playBeep(300, 0.3)
      toast({ title: "❌ Cupón inválido", variant: "destructive" })
    }
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${kioskMode ? "bg-slate-900 -m-4 p-4 rounded-2xl" : ""}`}>
      {/* Products grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className={`rounded-2xl p-4 shadow-sm border ${kioskMode ? "bg-slate-800 border-slate-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${kioskMode ? "text-slate-400" : "text-slate-400"}`} />
              <input
                id="pos-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto o escanear código (F2)..."
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-lg font-medium ${
                  kioskMode
                    ? "bg-slate-700 text-white border-slate-600 placeholder:text-slate-400"
                    : "bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-600"
                } border focus:ring-2 focus:ring-teal-500 outline-none`}
                autoFocus
              />
            </div>
            <button onClick={() => setKioskMode(k => !k)} className={`p-3 rounded-xl ${kioskMode ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`} title="Modo Kiosko (F12)">
              <Store className="w-5 h-5" />
            </button>
            <button onClick={() => setSoundEnabled(s => !s)} className={`p-3 rounded-xl ${soundEnabled ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`} title="Sonidos">
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className={`p-4 rounded-xl text-left transition transform hover:scale-105 active:scale-95 ${
                  kioskMode
                    ? "bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                    : "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 hover:from-teal-50 hover:to-cyan-50 dark:hover:from-teal-900/30 dark:hover:to-cyan-900/30 border-slate-200 dark:border-slate-600"
                } border`}
              >
                <div className="text-3xl mb-2">{p.emoji}</div>
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs opacity-70 mt-0.5">{p.category}</div>
                <div className="font-bold text-teal-600 dark:text-teal-400 mt-1">{formatPYG(p.price)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-xl p-3 text-xs flex items-center gap-3 ${kioskMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
          <Keyboard className="w-4 h-4" />
          <span className="font-medium">Atajos:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded">F2</kbd> Buscar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded">F8</kbd> Cobrar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded">F9</kbd> Ticket Digital</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded">F12</kbd> Kiosko</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded">Esc</kbd> Cancelar</span>
        </div>
      </div>

      {/* Cart */}
      <div className={`rounded-2xl shadow-lg border-2 flex flex-col ${
        kioskMode ? "bg-slate-800 border-teal-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      }`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-bold flex items-center gap-2 ${kioskMode ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
              <ShoppingCart className="w-5 h-5 text-teal-600" />
              Carrito ({items.length})
            </h3>
            {customer && (
              <div className="flex items-center gap-2 px-2 py-1 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Users className="w-3 h-3 text-teal-700 dark:text-teal-300" />
                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">{customer.nombre?.split(" ")[0]}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCustomerModal(true)}
            className="w-full text-sm py-2 px-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 font-medium flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" />
            {customer ? "Cambiar cliente" : "Identificar cliente (rápido)"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: "400px" }}>
          {items.length === 0 ? (
            <div className={`text-center py-12 ${kioskMode ? "text-slate-400" : "text-slate-400"}`}>
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Carrito vacío</p>
              <p className="text-xs mt-1">Click productos o F2 para buscar</p>
            </div>
          ) : items.map(item => (
            <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg ${kioskMode ? "bg-slate-700" : "bg-slate-50 dark:bg-slate-700/50"}`}>
              <div className="text-2xl">{item.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${kioskMode ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>{item.name}</div>
                <div className={`text-xs ${kioskMode ? "text-slate-400" : "text-slate-500"}`}>{formatPYG(item.price)} c/u</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">-</button>
                <span className={`w-7 text-center text-sm font-bold ${kioskMode ? "text-white" : ""}`}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">+</button>
              </div>
              <div className={`font-bold text-sm w-20 text-right ${kioskMode ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>{formatPYG(item.price * item.qty)}</div>
              <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className={`p-4 border-t border-slate-200 dark:border-slate-700 space-y-2`}>
          <div className="flex items-center gap-2">
            <input
              value={couponCode}
              onChange={e => setCouponCode(e.target.value)}
              placeholder="Código cupón (ej: VERANO15)"
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                kioskMode ? "bg-slate-700 text-white border-slate-600 placeholder:text-slate-400" : "bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-600"
              } border`}
            />
            <button onClick={applyCoupon} className="px-3 py-2 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 font-medium">
              <Tag className="w-4 h-4" />
            </button>
          </div>
          <Row label="Subtotal" value={formatPYG(total)} dark={kioskMode} />
          {appliedDiscount > 0 && (
            <div className="flex items-center justify-between text-pink-600">
              <span className="text-sm">Descuento</span>
              <span className="font-semibold">-{formatPYG(appliedDiscount)}</span>
            </div>
          )}
          <div className={`flex items-center justify-between pt-2 border-t ${kioskMode ? "border-slate-600" : "border-slate-200 dark:border-slate-600"}`}>
            <span className={`font-bold ${kioskMode ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>TOTAL</span>
            <span className="text-2xl font-bold text-teal-600">{formatPYG(finalTotal)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={items.length === 0}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-bold text-lg hover:from-teal-700 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            <Zap className="w-5 h-5" />
            COBRAR (F8)
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => toast({ title: "📱 Ticket digital enviado" })} className="py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <button onClick={() => toast({ title: "📧 Ticket enviado por email" })} className="py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
              <Receipt className="w-4 h-4" /> Email
            </button>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={(c) => { setCustomer(c); setShowCustomerModal(false); toast({ title: "✅ Cliente identificado", description: c.nombre, variant: "success" }) }}
        />
      )}
    </div>
  )
}

function CustomerModal({ onClose, onSelect }: any) {
  const [ident, setIdent] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const lookup = async () => {
    if (!ident) return
    setLoading(true)
    try {
      const r = await api.retail.quickCustomer.lookup({ identificador: ident, tipo: "auto" })
      setResult(r)
    } catch (e: any) {
      // Demo
      const seed = ident.length
      const nombres = ["Juan Pérez", "María González", "Carlos Rodríguez", "Ana Martínez"]
      setResult({
        encontrado: true, customer_id: "demo",
        nombre: nombres[seed % nombres.length], telefono: `+5959${(seed * 123) % 1000000}`,
        puntos: 1500, segmento: "Frecuente", proxima_recompensa: "💎 15% descuento",
        descuento_aplicable: 50000, sugerencias: ["Aplicar cupón automático", "Ofrecer producto top"],
        mensaje: "Cliente identificado"
      })
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
        {result && (
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
  const { toast } = useToast()

  const lookup = async () => {
    if (!ident) return
    setLoading(true)
    try {
      const r = await api.retail.quickCustomer.lookup({ identificador: ident, tipo: "auto" })
      setResult(r)
    } catch (e: any) {
      toast({ title: "Error", description: "No se pudo identificar", variant: "destructive" })
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
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([api.retail.coupons.list(), api.retail.coupons.stats()])
      setCoupons(c); setStats(s)
    } catch (e) {
      // Demo
      setCoupons(DEMO_COUPONS)
      setStats({ total_coupons: 12, activos: 8, expirados: 3, agotados: 1, canjes: 47, descuento_total: 1234000, tasa_canje_pct: 38.5, roi_estimado: 4.2 })
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
          <CouponCard key={c.id} coupon={c} onCopy={() => { navigator.clipboard.writeText(c.codigo); toast({ title: "📋 Copiado", description: c.codigo }) }} />
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
  const { toast } = useToast()

  const submit = async () => {
    try {
      await api.retail.coupons.create({
        ...data, valor: parseFloat(data.valor.toString()),
        fecha_desde: new Date(data.fecha_desde).toISOString(),
        fecha_hasta: new Date(data.fecha_hasta).toISOString(),
      })
      toast({ title: "✅ Cupón creado", variant: "success" })
      onCreate()
    } catch (e: any) {
      toast({ title: "✅ Cupón creado (demo)", variant: "success" })
      onCreate()
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
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const e = await api.retail.calendar.events.list()
      setEvents(e)
    } catch (err) {
      // Demo
      setEvents(DEMO_EVENTS)
    } finally {
      setLoading(false)
    }
  }

  const seedCalendar = async () => {
    try {
      await api.retail.calendar.seedPy()
      toast({ title: "✅ Calendario inicializado", description: "15 eventos PY cargados", variant: "success" })
      load()
    } catch (e) {
      toast({ title: "✅ Calendario cargado (demo)", variant: "success" })
      setEvents(DEMO_EVENTS)
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
  const { toast } = useToast()

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
            <button onClick={() => { toast({ title: "✅ Tienda actualizada" }); setEdit(false) }} className="w-full py-2 bg-teal-600 text-white rounded-xl font-medium">Guardar</button>
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

// ════════════════════════════════════════════════════════════
//  DEMO DATA
// ════════════════════════════════════════════════════════════

function generateDemoDashboard() {
  return {
    hoy: { ventas_total: 4520000, ventas_count: 38, ticket_promedio: 118947, ventas_m2: 18833, margen_bruto: 1446000, clientes_unicos: 28, productos_vendidos: 124, descuento_total: 226000, delta_ventas_pct: 12.4, delta_ticket_pct: 3.2, delta_clientes_pct: 5.2, hora_pico: 13, hora_pico_ventas: 813600, conversion_pct: 65.5 },
    semana: { ventas_total: 28900000, ventas_count: 234, ticket_promedio: 123504, ventas_m2: 120416, margen_bruto: 9248000, clientes_unicos: 187, productos_vendidos: 782, descuento_total: 1445000, delta_ventas_pct: 8.1, delta_ticket_pct: -1.2, delta_clientes_pct: 4.5, hora_pico: 12, hora_pico_ventas: 5202000, conversion_pct: 68.2 },
    mes: { ventas_total: 124800000, ventas_count: 1056, ticket_promedio: 118181, ventas_m2: 520000, margen_bruto: 39936000, clientes_unicos: 832, productos_vendidos: 3524, descuento_total: 6240000, delta_ventas_pct: 15.7, delta_ticket_pct: 2.1, delta_clientes_pct: 8.3, hora_pico: 13, hora_pico_ventas: 22464000, conversion_pct: 67.4 },
    heatmap_7dias: [],
    top_productos: [],
    productos_sin_venta: [],
    alertas_stock: [],
    proximos_eventos: [],
    cupones_activos: 8,
    ventas_por_dia_semana: [],
    comparativa: { mejor_dia_semana: "Sábado", mejor_hora: "13:00" },
  }
}

const DEMO_COUPONS = [
  { id: "1", codigo: "VERANO15", nombre: "15% Verano", descripcion: "Descuento del 15% en productos de verano", tipo: "porcentaje", valor: 15, usos_actuales: 47, usos_maximos: 200, estado: "activo", fecha_desde: "2026-06-01", fecha_hasta: "2026-08-31" },
  { id: "2", codigo: "BIENVENIDO10", nombre: "10% Bienvenida", descripcion: "Descuento para nuevos clientes", tipo: "porcentaje", valor: 10, usos_actuales: 23, usos_maximos: 100, estado: "activo", fecha_desde: "2026-01-01", fecha_hasta: "2026-12-31" },
  { id: "3", codigo: "BLACK30", nombre: "Black Friday 30%", descripcion: "Descuento agresivo Black Friday", tipo: "porcentaje", valor: 30, usos_actuales: 540, usos_maximos: 0, estado: "expirado", fecha_desde: "2025-11-25", fecha_hasta: "2025-11-30" },
  { id: "4", codigo: "2X1JUGUETES", nombre: "2x1 Juguetes", descripcion: "2x1 en categoría juguetes", tipo: "2x1", valor: 0, usos_actuales: 12, usos_maximos: 50, estado: "activo", fecha_desde: "2026-08-10", fecha_hasta: "2026-08-20" },
  { id: "5", codigo: "ENVIO0", nombre: "Envío Gratis", descripcion: "Envío gratis en compras +50k", tipo: "envio_gratis", valor: 0, usos_actuales: 89, usos_maximos: 200, estado: "activo", fecha_desde: "2026-05-01", fecha_hasta: "2026-07-31" },
  { id: "6", codigo: "REGALO5K", nombre: "Regalo 5.000 Gs", descripcion: "Descuento fijo de 5.000 Gs", tipo: "monto_fijo", valor: 5000, usos_actuales: 234, usos_maximos: 500, estado: "activo", fecha_desde: "2026-01-15", fecha_hasta: "2026-12-31" },
]

const DEMO_EVENTS = [
  { id: "1", codigo: "dia_madre", nombre: "Día de la Madre", fecha_evento: "2026-05-15", icono: "💐", categoria: "festividad", descripcion: "Regalos, cenas, desayunos. Categorías top: belleza, joyería, gastronomía, ropa." },
  { id: "2", codigo: "dia_padre", nombre: "Día del Padre", fecha_evento: "2026-03-19", icono: "👔", categoria: "festividad", descripcion: "Herramientas, ropa, electrónica, experiencias." },
  { id: "3", codigo: "san_juan", nombre: "San Juan", fecha_evento: "2026-06-24", icono: "🔥", categoria: "festividad", descripcion: "Chipa, mbeyú, dulces tradicionales. Pico histórico 18-24 jun." },
  { id: "4", codigo: "vuelta_clases", nombre: "Vuelta a Clases", fecha_evento: "2026-02-15", fecha_fin: "2026-03-05", icono: "📚", categoria: "escolar", descripcion: "Útiles, mochilas, uniformes, tecnología." },
  { id: "5", codigo: "black_friday", nombre: "Black Friday Paraguay", fecha_evento: "2026-11-27", icono: "🛍️", categoria: "comercial", descripcion: "Saldos masivos, descuentos agresivos, alto tráfico." },
  { id: "6", codigo: "navidad", nombre: "Navidad", fecha_evento: "2026-12-25", fecha_fin: "2026-12-24", icono: "🎄", categoria: "festividad", descripcion: "Regalos, cena, pan dulce. Pico 20-24 dic." },
  { id: "7", codigo: "amor_amistad", nombre: "Día del Amor y la Amistad", fecha_evento: "2026-09-14", icono: "❤️", categoria: "festividad", descripcion: "Flores, chocolates, cenas, joyería." },
  { id: "8", codigo: "dia_nino", nombre: "Día del Niño", fecha_evento: "2026-08-16", icono: "🧸", categoria: "festividad", descripcion: "Juguetes, ropa infantil, libros, golosinas." },
  { id: "9", codigo: "halloween", nombre: "Halloween", fecha_evento: "2026-10-31", icono: "🎃", categoria: "comercial", descripcion: "Disfraces, decoración, dulces." },
  { id: "10", codigo: "ano_nuevo", nombre: "Año Nuevo", fecha_evento: "2026-12-31", icono: "🎆", categoria: "festividad", descripcion: "Brindis, decoración, ropa blanca." },
  { id: "11", codigo: "pascua", nombre: "Pascua", fecha_evento: "2026-04-05", icono: "🐰", categoria: "festividad", descripcion: "Chocolate, huevos de pascua, gastronomía." },
  { id: "12", codigo: "independencia_py", nombre: "Independencia Paraguay", fecha_evento: "2026-05-14", icono: "🇵🇾", categoria: "festividad", descripcion: "Patrio, gastronomía típica." },
  { id: "13", codigo: "verano", nombre: "Temporada de Verano", fecha_evento: "2026-12-21", fecha_fin: "2027-03-20", icono: "🏖️", categoria: "estacional", descripcion: "Ropa de baño, protector solar, bebidas." },
  { id: "14", codigo: "san_valentin", nombre: "San Valentín", fecha_evento: "2026-02-14", icono: "💝", categoria: "festividad", descripcion: "Detalle romántico, cena, flores, joyería." },
  { id: "15", codigo: "cyber_monday", nombre: "Cyber Monday", fecha_evento: "2026-11-30", icono: "💻", categoria: "comercial", descripcion: "Online, electrónica, moda." },
]

// ════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════

export default function RetailPage() {
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
          {tab === "pos" && <POSTab />}
          {tab === "cliente" && <ClienteTab />}
          {tab === "cupones" && <CuponesTab />}
          {tab === "whatsapp" && <WhatsAppTab />}
          {tab === "eventos" && <EventosTab />}
          {tab === "tienda" && <TiendaTab />}
        </div>
      </div>
    </div>
  )
}
