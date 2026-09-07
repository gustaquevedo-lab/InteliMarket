import React, { useState, useCallback } from "react"
import {
  X, Sparkles, Package, Tag, Barcode, DollarSign, TrendingUp, TrendingDown,
  Building2, ShoppingCart, Layers, Lock, Unlock, Save, AlertTriangle,
  CheckCircle2, Info, Clock, Star, Truck, Phone, Mail, MapPin,
  Zap, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Box,
  Percent, Gift, Calendar, Scale, Loader2, ChevronRight, FileText,
  RefreshCw, Eye, Hash
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line, ReferenceLine
} from "recharts"
import { type Product360Response, api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

function formatDatePY(iso: string) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("es-PY", {
      timeZone: "America/Asuncion",
      day: "2-digit", month: "short", year: "numeric"
    }).format(new Date(iso))
  } catch { return iso.slice(0, 10) }
}

function formatDateTimePY(iso: string) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("es-PY", {
      timeZone: "America/Asuncion",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(iso))
  } catch { return iso.slice(0, 16) }
}

const TIPO_LABEL: Record<string, string> = {
  precio_fijo_oferta: "Precio Fijo Oferta",
  porcentaje: "% Descuento",
  monto_fijo: "Monto Fijo",
  dos_por_uno: "2×1",
  tres_por_dos: "3×2",
  nxm: "NxM",
  cantidad_lleva: "Cantidad Lleva",
  segunda_unidad_pct: "2da Unidad %",
  combo_pack: "Combo Pack",
  combo_precio: "Combo Precio",
}

const DIAS_NOMBRES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const TAB_LIST = [
  { key: "overview", label: "Dashboard", icon: BarChart3 },
  { key: "precios", label: "Precios & Costos", icon: DollarSign },
  { key: "stock", label: "Stock", icon: Building2 },
  { key: "promociones", label: "Promociones", icon: Gift },
  { key: "kardex", label: "Kardex", icon: Layers },
  { key: "compras", label: "Compras", icon: ShoppingCart },
  { key: "ventas", label: "Ventas", icon: TrendingUp },
  { key: "codigos", label: "Códigos Alt.", icon: Barcode },
] as const

type TabKey = typeof TAB_LIST[number]["key"]

const CustomTooltipPYG = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? formatPYG(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

function KpiCard({
  label, value, sub, color = "indigo", icon: Icon
}: {
  label: string; value: string | number; sub?: string
  color?: "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky"; icon?: React.FC<any>
}) {
  const colors = {
    indigo: "from-indigo-500/10 to-indigo-600/5 border-indigo-200/60 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400",
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-200/60 dark:border-amber-900/60 text-amber-600 dark:text-amber-400",
    rose: "from-rose-500/10 to-rose-600/5 border-rose-200/60 dark:border-rose-900/60 text-rose-600 dark:text-rose-400",
    violet: "from-violet-500/10 to-violet-600/5 border-violet-200/60 dark:border-violet-900/60 text-violet-600 dark:text-violet-400",
    sky: "from-sky-500/10 to-sky-600/5 border-sky-200/60 dark:border-sky-900/60 text-sky-600 dark:text-sky-400",
  }
  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${colors[color].split(" ").filter((c: string) => c.startsWith("text-")).join(" ")}`} />}
      </div>
      <p className={`text-xl font-black font-mono tracking-tight ${colors[color].split(" ").filter((c: string) => c.startsWith("text-")).join(" ")}`}>
        {value}
      </p>
      {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
    </div>
  )
}

interface Props {
  data: Product360Response
  onClose: () => void
  onPriceUpdated?: (productId: string, newPrice: number) => void
}

export default function Product360Modal({ data, onClose, onPriceUpdated }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>("overview")
  const [iaLoading, setIaLoading] = useState(false)
  const [iaText, setIaText] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)
  const [newPrice, setNewPrice] = useState(String(data.metricas_financieras.precio_venta))
  const [savingPrice, setSavingPrice] = useState(false)

  const p = data.product
  const m = data.metricas_financieras
  const r = data.rotacion
  const s = data.stock

  const newPriceNum = parseFloat(newPrice.replace(/[^\d.]/g, "")) || 0
  const newMargenMonto = newPriceNum - m.costo_unitario
  const newMargenPct = newPriceNum > 0 ? (newMargenMonto / newPriceNum) * 100 : 0
  const newMarkup = m.costo_unitario > 0 ? (newMargenMonto / m.costo_unitario) * 100 : 0

  const handleSavePrice = useCallback(async () => {
    if (!newPriceNum || newPriceNum <= 0) { toast.error("Precio inválido", "Ingrese un precio mayor a 0"); return }
    setSavingPrice(true)
    try {
      await api.products.update(p.id, { precio_venta: newPriceNum })
      toast.success("Precio actualizado", `${p.nombre} → ${formatPYG(newPriceNum)}`)
      onPriceUpdated?.(p.id, newPriceNum)
      setLocked(true)
    } catch (e: any) { toast.error("Error al actualizar precio", e.message) }
    finally { setSavingPrice(false) }
  }, [newPriceNum, p.id, p.nombre, onPriceUpdated, toast])

  const handleAnalyzeIA = useCallback(async () => {
    setIaLoading(true)
    setIaText(null)
    try {
      const context = {
        producto: p.nombre, sku: p.sku, precio_venta: m.precio_venta, costo: m.costo_unitario,
        margen_pct: m.margen_bruto_pct, markup_pct: m.markup_pct, stock_total: s.total_fisico,
        demanda_diaria: r.demanda_diaria_estimada, autonomia_dias: r.autonomia_dias,
        ventas_30d: r.ventas_ultimos_30d_unidades, historial_ventas: data.historial_ventas_mensual,
        promociones_vigentes: (data.promociones as any[])?.filter((pr: any) => pr.es_vigente_hoy).length || 0,
        proveedor: (data.supplier_info as any)?.razon_social || "No asignado", estado_stock: r.estado_stock,
      }
      const res = await (api as any).generalAgent.chat(
        `Analizá este producto de supermercado como gerente de categoría. Datos: ${JSON.stringify(context)}. Dame: 1) diagnóstico de rentabilidad y rotación en 2 oraciones, 2) alertas críticas si las hay, 3) recomendación concreta de acción (precio, stock, promo). Español, máx 200 palabras, formato con bullets •.`,
        []
      )
      setIaText(typeof res === "string" ? res : (res as any)?.reply || (res as any)?.response || "Sin respuesta")
    } catch { setIaText("⚠️ No se pudo obtener el análisis IA en este momento.") }
    finally { setIaLoading(false) }
  }, [data, m, p, r, s])

  const promoVigente = (data.promociones as any[])?.find((pr: any) => pr.es_vigente_hoy)
  const hasPromo = !!promoVigente

  const ventasChartData = ((data as any).historial_ventas_mensual || []).map((v: any) => ({
    name: v.mes_label, unidades: Number(v.unidades), monto: Number(v.monto),
  }))
  const kostChartData = ((data as any).historial_costos_mensual || []).map((c: any) => ({
    name: c.mes_label, costo: Number(c.costo_promedio_mes), unidades_compradas: Number(c.unidades_compradas),
  }))
  const kardexChartData = (data.kardex_reciente || []).slice(0, 15).reverse().map((m: any, i: number) => ({
    name: `#${i + 1}`, cantidad: Number(m.cantidad),
  }))

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 2rem)" }}>

        {/* HEADER */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
          <div className="p-4 md:p-5 flex items-start gap-4">
            <div className="flex-shrink-0">
              {p.imagen_url ? (
                <img src={p.imagen_url} alt={p.nombre} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center shadow-lg">
                  <Package className="w-8 h-8 text-indigo-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight line-clamp-2">{p.nombre}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">SKU {p.sku}</span>
                    {p.codigo_barra && <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">{p.codigo_barra}</span>}
                    <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 px-2 py-0.5 rounded-lg">{p.categoria_nombre}</span>
                    {hasPromo && <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse"><Zap className="w-2.5 h-2.5" /> EN PROMO</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${p.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{p.activo ? "● Activo" : "○ Inactivo"}</span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <div className="flex items-center gap-1 font-black text-slate-900 dark:text-white"><DollarSign className="w-3.5 h-3.5 text-emerald-500" />{formatPYG(m.precio_venta)}</div>
                <div className="text-slate-400">•</div>
                <div className="flex items-center gap-1 text-indigo-600 font-bold"><Percent className="w-3 h-3" /> {m.margen_bruto_pct}% margen</div>
                <div className="text-slate-400">•</div>
                <div className={`font-bold ${s.total_fisico <= 0 ? "text-rose-500" : r.autonomia_dias < 7 ? "text-amber-500" : "text-emerald-500"}`}>Stock: {s.total_fisico} {p.unidad_medida}</div>
                <div className="text-slate-400">•</div>
                <div className="text-slate-500">~{r.demanda_diaria_estimada} un./día</div>
              </div>
            </div>
          </div>
          <div className="flex gap-0.5 px-5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
            {TAB_LIST.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pb-3 pt-1 px-3 text-[11px] font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${tab === t.key ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          {/* ── DASHBOARD OVERVIEW ── */}
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Precio de Venta" color="indigo" icon={DollarSign} value={formatPYG(m.precio_venta)} sub={`IVA ${p.iva_tasa}% incl.`} />
                <KpiCard label="Margen Bruto" color="emerald" icon={Percent} value={`${m.margen_bruto_pct}%`} sub={`Markup: ${m.markup_pct}%`} />
                <KpiCard label="Stock Total" color={s.total_fisico <= 0 ? "rose" : r.autonomia_dias < 7 ? "amber" : "sky"} icon={Box} value={`${s.total_fisico} ${p.unidad_medida}`} sub={`Autónomía: ${r.autonomia_dias} días`} />
                <KpiCard label="Ventas (30 días)" color="violet" icon={TrendingUp} value={`${r.ventas_ultimos_30d_unidades} un.`} sub={formatPYG(r.ventas_ultimos_30d_gs)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-indigo-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Evolución de Ventas (6 meses)</h4></div>
                  {ventasChartData.length === 0 ? <p className="text-center text-slate-400 text-xs py-8">Sin datos históricos</p> : (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={ventasChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs><linearGradient id="v360" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltipPYG />} />
                        <Area type="monotone" dataKey="unidades" name="Unidades" stroke="#6366f1" fill="url(#v360)" strokeWidth={2} dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-amber-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Evolución de Costos (6 meses)</h4></div>
                  {kostChartData.length === 0 ? <p className="text-center text-slate-400 text-xs py-8">Sin datos de compras</p> : (
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={kostChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltipPYG />} />
                        <ReferenceLine y={m.costo_unitario} stroke="#f59e0b" strokeDasharray="4 2" />
                        <Bar dataKey="costo" name="Costo Prom. Mes" fill="#f59e0b" radius={[3, 3, 0, 0]} opacity={0.85} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-violet-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Kardex (últimos mov.)</h4></div>
                  {kardexChartData.length === 0 ? <p className="text-center text-slate-400 text-xs py-6">Sin movimientos</p> : (
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={kardexChartData} margin={{ top: 2, right: 2, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" tick={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltipPYG />} />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Bar dataKey="cantidad" name="Cantidad" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-center text-[9px] text-slate-400 mt-1">{(data.kardex_reciente || []).length} mov. registrados</p>
                </div>

                <div className="bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-sky-950/30 dark:to-indigo-950/30 border border-sky-200 dark:border-sky-900/60 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><Truck className="w-4 h-4 text-sky-500" /><h4 className="text-xs font-black text-sky-700 dark:text-sky-300 uppercase tracking-wider">Proveedor</h4></div>
                  {(data.supplier_info as any) ? (
                    <div className="space-y-1.5">
                      <p className="font-black text-sm text-slate-900 dark:text-white leading-tight">{(data.supplier_info as any).razon_social}</p>
                      <p className="text-[10px] font-mono text-slate-500">RUC: {(data.supplier_info as any).ruc || "—"}</p>
                      {(data.supplier_info as any).ciudad && <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{(data.supplier_info as any).ciudad}</p>}
                      {(data.supplier_info as any).telefono && <p className="text-[10px] text-slate-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{(data.supplier_info as any).telefono}</p>}
                      {(data.supplier_info as any).contacto_nombre && <p className="text-[10px] text-slate-500">Contacto: <strong>{(data.supplier_info as any).contacto_nombre}</strong></p>}
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-600">Plazo: {(data.supplier_info as any).plazo_pago_dias || 0} días</span>
                        {((data.supplier_info as any).rating || 0) > 0 && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-600 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {(data.supplier_info as any).rating}</span>}
                      </div>
                    </div>
                  ) : <p className="text-xs text-slate-400 italic">Sin proveedor asignado</p>}
                </div>

                <div className={`rounded-2xl p-4 border ${hasPromo ? "bg-gradient-to-br from-rose-50 to-orange-50/50 dark:from-rose-950/30 dark:to-orange-950/30 border-rose-200 dark:border-rose-900/60" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-center gap-2 mb-3"><Gift className={`w-4 h-4 ${hasPromo ? "text-rose-500" : "text-slate-400"}`} /><h4 className={`text-xs font-black uppercase tracking-wider ${hasPromo ? "text-rose-700 dark:text-rose-300" : "text-slate-500"}`}>{hasPromo ? "🔥 Promo Activa" : "Promociones"}</h4></div>
                  {hasPromo ? (
                    <div className="space-y-1.5">
                      <p className="font-black text-sm text-rose-700 dark:text-rose-300">{promoVigente.nombre}</p>
                      <p className="text-[10px] font-bold uppercase bg-rose-100 text-rose-600 px-2 py-0.5 rounded inline-block">{TIPO_LABEL[promoVigente.tipo] || promoVigente.tipo}</p>
                      {promoVigente.precio_fijo_promocional && <div className="mt-1"><p className="font-black text-lg text-rose-600">{formatPYG(promoVigente.precio_fijo_promocional)}</p><p className="text-[10px] text-slate-500">Ahorro: <strong className="text-rose-500">{formatPYG(promoVigente.ahorro_por_unidad)}</strong> ({promoVigente.ahorro_pct}%)</p></div>}
                      <p className="text-[10px] text-slate-500">Hasta: <strong>{formatDatePY(promoVigente.valido_hasta)}</strong></p>
                    </div>
                  ) : <div><p className="text-xs text-slate-400 italic">Sin promoción activa hoy</p><p className="text-[10px] text-slate-400 mt-1">{((data.promociones as any[]) || []).length} promo(s) históricas</p></div>}
                </div>
              </div>

              {/* IA Panel */}
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-900/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /><h4 className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider">Análisis Inteligente — IA</h4></div>
                  <button onClick={handleAnalyzeIA} disabled={iaLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 disabled:opacity-60 transition-colors">
                    {iaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}{iaLoading ? "Analizando..." : "Analizar con IA"}
                  </button>
                </div>
                {iaText ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{iaText}</div>
                ) : <p className="text-xs text-slate-400 italic">Hacé clic en "Analizar con IA" para diagnóstico automático de rentabilidad, rotación y recomendaciones de acción.</p>}
              </div>

              {p.descripcion && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-slate-400" /><h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Descripción del Producto</h4></div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{p.descripcion}</p>
                </div>
              )}
            </div>
          )}

          {/* ── PRECIOS & COSTOS ── */}
          {tab === "precios" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Precio de Venta" color="indigo" icon={DollarSign} value={formatPYG(m.precio_venta)} sub={`IVA ${p.iva_tasa}%`} />
                <KpiCard label="Costo Promedio" color="amber" icon={TrendingDown} value={formatPYG(m.costo_unitario)} sub={`Ult. costo: ${formatPYG(p.ultimo_costo)}`} />
                <KpiCard label="Margen Bruto" color="emerald" icon={Percent} value={`${m.margen_bruto_pct}%`} sub={`${formatPYG(m.margen_bruto_monto)} / un.`} />
                <KpiCard label="Markup" color="violet" icon={ArrowUpRight} value={`${m.markup_pct}%`} sub="Sobre costo" />
              </div>

              {(m as any).costo_landed > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700 dark:text-amber-300"><strong>Costo Landed:</strong> {formatPYG((m as any).costo_landed)} — incluye flete, aranceles y gastos de importación.</span>
                </div>
              )}

              {/* Price lock */}
              <div className={`rounded-2xl border p-5 ${locked ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-gradient-to-br from-indigo-50 to-violet-50/50 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-300 dark:border-indigo-700"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {locked ? <Lock className="w-5 h-5 text-slate-400" /> : <Unlock className="w-5 h-5 text-indigo-500" />}
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">{locked ? "Precio Bloqueado" : "Edición de Precio Habilitada"}</h4>
                      <p className="text-[10px] text-slate-400">{locked ? "Desbloqueá para modificar el precio de venta" : "Escribí el nuevo precio y guardá el cambio"}</p>
                    </div>
                  </div>
                  <button onClick={() => setLocked(l => !l)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${locked ? "bg-slate-200 dark:bg-slate-800 text-slate-600 hover:bg-amber-100 hover:text-amber-700" : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700"}`}>
                    {locked ? <><Unlock className="w-3 h-3" /> Desbloquear</> : <><Lock className="w-3 h-3" /> Bloquear</>}
                  </button>
                </div>
                {!locked && (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nuevo Precio de Venta (₲)</label>
                        <input type="number" min={0} value={newPrice} onChange={e => setNewPrice(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-black text-lg text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                      </div>
                      <button onClick={handleSavePrice} disabled={savingPrice || newPriceNum <= 0} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold transition-colors">
                        {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar
                      </button>
                    </div>
                    {newPriceNum > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`p-3 rounded-xl border text-center ${newMargenPct >= 20 ? "bg-emerald-50 border-emerald-200" : newMargenPct >= 10 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"}`}>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Nuevo Margen</p>
                          <p className={`text-xl font-black font-mono ${newMargenPct >= 20 ? "text-emerald-600" : newMargenPct >= 10 ? "text-amber-600" : "text-rose-600"}`}>{newMargenPct.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Ganancia / Un.</p>
                          <p className="text-xl font-black font-mono text-slate-800 dark:text-white">{formatPYG(newMargenMonto)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Nuevo Markup</p>
                          <p className="text-xl font-black font-mono text-violet-600">{newMarkup.toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                    {newPriceNum > 0 && newPriceNum < m.costo_unitario && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs flex items-center gap-2 text-rose-700">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />⚠️ <strong>Atención:</strong> El precio ingresado es menor al costo — estarías vendiendo a pérdida.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {ventasChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-emerald-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Ingresos mensuales por este producto</h4></div>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={ventasChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs><linearGradient id="montoGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <Area type="monotone" dataKey="monto" name="Monto ₲" stroke="#10b981" fill="url(#montoGrad)" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── STOCK ── */}
          {tab === "stock" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Stock Físico" color="sky" icon={Box} value={`${s.total_fisico} ${p.unidad_medida}`} />
                <KpiCard label="Disponible" color="emerald" icon={CheckCircle2} value={`${s.total_disponible} ${p.unidad_medida}`} />
                <KpiCard label="Reservado" color="amber" icon={Clock} value={`${s.total_reservado} ${p.unidad_medida}`} />
                <KpiCard label="Valorizado" color="indigo" icon={DollarSign} value={formatPYG(s.valor_inventario_costo)} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3"><p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Demanda Diaria</p><p className="font-black text-slate-800 dark:text-white">~{r.demanda_diaria_estimada} un./día</p></div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3"><p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Autonomía</p><p className={`font-black ${r.autonomia_dias < 7 ? "text-rose-600" : r.autonomia_dias < 14 ? "text-amber-600" : "text-emerald-600"}`}>{r.autonomia_dias} días</p></div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3"><p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Stock Mínimo</p><p className="font-black text-slate-800 dark:text-white">{p.stock_minimo} {p.unidad_medida}</p></div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">Depósito</th><th className="p-3 text-right">Físico</th><th className="p-3 text-right">Reservado</th><th className="p-3 text-right">Disponible</th><th className="p-3 text-right">Costo Unit.</th><th className="p-3 text-right">Valorizado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {s.por_deposito.map((dep: any) => (
                      <tr key={dep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{dep.warehouse_nombre} <span className="text-[9px] font-mono text-slate-400">({dep.warehouse_codigo})</span></td>
                        <td className="p-3 text-right font-mono font-bold">{dep.cantidad}</td>
                        <td className="p-3 text-right font-mono text-amber-500">{dep.cantidad_reservada}</td>
                        <td className="p-3 text-right font-mono text-emerald-600 font-bold">{dep.cantidad - dep.cantidad_reservada}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(dep.costo_unitario)}</td>
                        <td className="p-3 text-right font-mono text-indigo-600 font-bold">{formatPYG(dep.cantidad * dep.costo_unitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PROMOCIONES ── */}
          {tab === "promociones" && (
            <div className="space-y-4">
              {((data.promociones as any[]) || []).length === 0 ? (
                <div className="text-center py-16"><Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-400">Este producto no tiene promociones registradas</p></div>
              ) : ((data.promociones as any[]) || []).map((pr: any) => (
                <div key={pr.id} className={`rounded-2xl border p-4 ${pr.es_vigente_hoy ? "bg-gradient-to-br from-rose-50 to-orange-50/50 dark:from-rose-950/30 dark:to-orange-950/30 border-rose-300" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">{pr.es_vigente_hoy && <Zap className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}<span className="font-black text-sm text-slate-900 dark:text-white">{pr.nombre}</span></div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-600 uppercase">{TIPO_LABEL[pr.tipo] || pr.tipo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${pr.estado === "activa" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{pr.estado?.replace(/_/g, " ")}</span>
                        {pr.es_vigente_hoy && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-600 uppercase">🔥 Vigente HOY</span>}
                      </div>
                    </div>
                    {pr.precio_fijo_promocional && (
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600 font-mono">{formatPYG(pr.precio_fijo_promocional)}</p>
                        {pr.ahorro_por_unidad > 0 && <p className="text-[10px] text-slate-500">Ahorro: <strong className="text-rose-500">{formatPYG(pr.ahorro_por_unidad)}</strong> ({pr.ahorro_pct}%)</p>}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500 mt-2">
                    <div><span className="font-bold">Desde:</span> {formatDatePY(pr.valido_desde)}</div>
                    <div><span className="font-bold">Hasta:</span> {formatDatePY(pr.valido_hasta)}</div>
                    <div><span className="font-bold">Origen:</span> {pr.origen?.replace(/_/g, " ") || "—"}</div>
                    <div><span className="font-bold">Financ.:</span> {pr.financiamiento?.replace(/_/g, " ") || "—"}</div>
                  </div>
                  {pr.dias_semana?.length > 0 && (
                    <div className="flex gap-1 mt-2">{DIAS_NOMBRES.map((d, i) => <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pr.dias_semana.includes(i) ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>{d}</span>)}</div>
                  )}
                  {pr.stock_limite_unidades && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] text-slate-500 mb-0.5"><span>Cupo: {pr.unidades_vendidas_promo || 0} / {pr.stock_limite_unidades} un.</span><span>{Math.min(100, Math.round(((pr.unidades_vendidas_promo || 0) / pr.stock_limite_unidades) * 100))}%</span></div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, ((pr.unidades_vendidas_promo || 0) / pr.stock_limite_unidades) * 100)}%` }} /></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── KARDEX ── */}
          {tab === "kardex" && (
            <div className="space-y-4">
              {kardexChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Flujo de Movimientos (últimos 15)</h4>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={kardexChartData} margin={{ top: 2, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Bar dataKey="cantidad" name="Cantidad" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">Fecha / Hora</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-right">Cantidad</th><th className="p-3 text-right">Costo Unit.</th><th className="p-3 text-left">Depósito</th><th className="p-3 text-left">Motivo</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.kardex_reciente || []).map((mov: any) => (
                      <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">{formatDateTimePY(mov.created_at)}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">{mov.tipo}</span></td>
                        <td className={`p-3 text-right font-mono font-black ${Number(mov.cantidad) > 0 ? "text-emerald-600" : "text-rose-600"}`}>{Number(mov.cantidad) > 0 ? `+${mov.cantidad}` : mov.cantidad}</td>
                        <td className="p-3 text-right font-mono">{mov.costo_unitario ? formatPYG(mov.costo_unitario) : "—"}</td>
                        <td className="p-3 text-slate-500 text-[10px]">{mov.warehouse_nombre || "—"}</td>
                        <td className="p-3 text-slate-500 text-[10px] max-w-[150px] truncate">{mov.motivo || mov.referencia_type || "—"}</td>
                      </tr>
                    ))}
                    {!(data.kardex_reciente?.length) && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin movimientos de Kardex</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COMPRAS ── */}
          {tab === "compras" && (
            <div className="space-y-4">
              {kostChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-amber-500" /> Evolución del Costo de Compra</h4>
                  <ResponsiveContainer width="100%" height={140}>
                    <ComposedChart data={kostChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <Bar yAxisId="left" dataKey="costo" name="Costo Prom." fill="#f59e0b" radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Line yAxisId="right" type="monotone" dataKey="unidades_compradas" name="Unidades" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">N° Orden</th><th className="p-3 text-left">Proveedor</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-right">Costo Unit.</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Estado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.ultimas_compras || []).map((oc: any) => (
                      <tr key={oc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-indigo-600">{oc.numero}</td>
                        <td className="p-3 font-medium">{oc.supplier_nombre || "—"}</td>
                        <td className="p-3 text-slate-500">{formatDatePY(oc.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold">{oc.cantidad}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(oc.precio_unitario)}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatPYG(oc.total)}</td>
                        <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600">{oc.estado}</span></td>
                      </tr>
                    ))}
                    {!(data.ultimas_compras?.length) && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Sin compras registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── VENTAS ── */}
          {tab === "ventas" && (
            <div className="space-y-4">
              {ventasChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Evolución de Ventas Mensual</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={ventasChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs><linearGradient id="vg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <Area yAxisId="left" type="monotone" dataKey="monto" name="Monto ₲" stroke="#10b981" fill="url(#vg2)" strokeWidth={2} />
                      <Bar yAxisId="right" dataKey="unidades" name="Unidades" fill="#6366f1" radius={[2, 2, 0, 0]} opacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">Ticket / Factura</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-right">Precio</th><th className="p-3 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.ultimas_ventas || []).map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{v.numero}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{v.customer_nombre || "Consumidor Final"}</td>
                        <td className="p-3 text-slate-500">{formatDateTimePY(v.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold">{v.cantidad}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(v.precio_unitario)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatPYG(v.subtotal)}</td>
                      </tr>
                    ))}
                    {!(data.ultimas_ventas?.length) && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin ventas recientes</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CÓDIGOS ALTERNATIVOS ── */}
          {tab === "codigos" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> Identificadores del Producto</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">SKU</p><p className="font-black font-mono text-indigo-600">{p.sku}</p></div>
                  {p.codigo_barra && <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">EAN / UPC Principal</p><p className="font-black font-mono text-slate-800 dark:text-white">{p.codigo_barra}</p></div>}
                  {p.plu_balanza && <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">PLU Balanza</p><p className="font-black font-mono text-amber-600">{p.plu_balanza}</p></div>}
                  {p.tipo_venta && <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700"><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tipo Venta</p><p className="font-black text-slate-800 dark:text-white capitalize">{p.tipo_venta}</p></div>}
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">Código Barra (Pack / Caja)</th><th className="p-3 text-left">Etiqueta</th><th className="p-3 text-center">Un. por Pack</th><th className="p-3 text-right">Precio Pack (ref.)</th><th className="p-3 text-center">Estado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {((data as any).codigos_alternativos || []).map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200"><Barcode className="w-3.5 h-3.5 text-slate-400 inline mr-1.5" />{c.codigo_barra}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{c.etiqueta}</td>
                        <td className="p-3 text-center"><span className="px-2.5 py-1 rounded-lg font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">×{c.unidades_por_paquete}</span></td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatPYG(m.precio_venta * c.unidades_por_paquete)}</td>
                        <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{c.activo ? "Activo" : "Inactivo"}</span></td>
                      </tr>
                    ))}
                    {!((data as any).codigos_alternativos?.length) && <tr><td colSpan={5} className="p-8 text-center text-slate-400"><Barcode className="w-8 h-8 mx-auto mb-2 text-slate-300" />Sin códigos de pack/caja registrados</td></tr>}
                  </tbody>
                </table>
              </div>
              {(p.peso_kg ?? 0) > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3 text-xs">
                  <Scale className="w-4 h-4 text-amber-500" />
                  <div><p className="font-bold text-slate-700 dark:text-slate-300">Peso por unidad: {p.peso_kg} kg</p><p className="text-slate-400">{p.tipo_venta === "peso" ? "Artículo pesable (vendido por kg/lt)" : "Unidad cerrada"}</p></div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
