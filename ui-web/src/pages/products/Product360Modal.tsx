import React, { useState, useCallback, useMemo } from "react"
import {
  X, Sparkles, Package, Tag, Barcode, DollarSign, TrendingUp, TrendingDown,
  Building2, ShoppingCart, Layers, Lock, Unlock, Save, AlertTriangle,
  CheckCircle2, Info, Clock, Star, Truck, Phone, Mail, MapPin,
  Zap, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Box,
  Percent, Gift, Calendar, Scale, Loader2, ChevronRight, FileText,
  RefreshCw, Eye, Hash, Filter, ArrowRight, ShieldCheck, Check
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line, ReferenceLine, Cell
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
  { key: "precios", label: "Precios & Escalas", icon: DollarSign },
  { key: "costos", label: "Costos & PPP", icon: TrendingDown },
  { key: "kardex", label: "Kardex", icon: Layers },
  { key: "stock", label: "Stock", icon: Building2 },
  { key: "promociones", label: "Promociones", icon: Gift },
  { key: "compras", label: "Compras", icon: ShoppingCart },
  { key: "ventas", label: "Ventas", icon: TrendingUp },
  { key: "codigos", label: "Códigos Alt.", icon: Barcode },
] as const

type TabKey = typeof TAB_LIST[number]["key"]

function CustomTooltipPYG({ active, payload, label }: any) {
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
  const [kardexFilter, setKardexFilter] = useState<"todos" | "salidas" | "entradas" | "ajustes">("todos")

  const p = data.product
  const m = data.metricas_financieras
  const r = data.rotacion
  const s = data.stock
  const escalas = data.escalas_precio || []

  // Estructura de costos completa
  const costos = data.costos_estructura || {
    costo_promedio: Number(m.costo_promedio || m.costo_unitario || 0),
    ultimo_costo: Number(m.ultimo_costo || p.ultimo_costo || m.costo_unitario || 0),
    costo_landed: Number(m.costo_landed || 0),
    metodo_costeo: "PPP (Promedio Ponderado)",
    variacion_costo_pct: 0,
    margen_sobre_promedio_pct: m.margen_bruto_pct,
    margen_sobre_ultimo_pct: m.margen_bruto_pct,
    markup_sobre_promedio_pct: m.markup_pct,
    markup_sobre_ultimo_pct: m.markup_pct,
    ganancia_unitaria_promedio: m.margen_bruto_monto,
    ganancia_unitaria_ultimo: m.margen_bruto_monto,
  }

  // Kardex unificado (lee kardex_reciente o kardex como fallback)
  const rawKardex = useMemo(() => {
    return (data.kardex_reciente && data.kardex_reciente.length > 0)
      ? data.kardex_reciente
      : (data.kardex || [])
  }, [data])

  const filteredKardex = useMemo(() => {
    if (kardexFilter === "salidas") return rawKardex.filter(k => !k.es_entrada || Number(k.cantidad) < 0)
    if (kardexFilter === "entradas") return rawKardex.filter(k => k.es_entrada || Number(k.cantidad) > 0)
    if (kardexFilter === "ajustes") return rawKardex.filter(k => k.tipo?.includes("ajuste") || k.tipo?.includes("merma"))
    return rawKardex
  }, [rawKardex, kardexFilter])

  const kardexResumen = data.kardex_resumen || {
    total_entradas: rawKardex.filter(k => k.es_entrada || Number(k.cantidad) > 0).reduce((acc, k) => acc + Math.abs(Number(k.cantidad)), 0),
    total_salidas: rawKardex.filter(k => !k.es_entrada && Number(k.cantidad) < 0).reduce((acc, k) => acc + Math.abs(Number(k.cantidad)), 0),
    saldo_neto_periodo: rawKardex.reduce((acc, k) => acc + Number(k.cantidad), 0),
    movimientos_count: rawKardex.length,
    total_valorizado_salidas: 0,
    total_valorizado_entradas: 0,
  }

  const newPriceNum = parseFloat(newPrice.replace(/[^\d.]/g, "")) || 0
  const costoBaseSim = costos.costo_promedio > 0 ? costos.costo_promedio : m.costo_unitario
  const newMargenMonto = newPriceNum - costoBaseSim
  const newMargenPct = newPriceNum > 0 ? (newMargenMonto / newPriceNum) * 100 : 0
  const newMarkup = costoBaseSim > 0 ? (newMargenMonto / costoBaseSim) * 100 : 0

  // Margen sobre último costo en la simulación
  const newMargenUltimo = costos.ultimo_costo > 0 && newPriceNum > 0
    ? ((newPriceNum - costos.ultimo_costo) / newPriceNum) * 100
    : newMargenPct

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
        producto: p.nombre, sku: p.sku, precio_venta: m.precio_venta,
        costo_promedio_ppp: costos.costo_promedio, ultimo_costo: costos.ultimo_costo,
        margen_promedio_pct: costos.margen_sobre_promedio_pct,
        margen_ultimo_pct: costos.margen_sobre_ultimo_pct,
        stock_total: s.total_fisico, demanda_diaria: r.demanda_diaria_estimada,
        autonomia_dias: r.autonomia_dias, ventas_30d: r.ventas_ultimos_30d_unidades,
        escalas_mayoristas: escalas.length,
        promociones_vigentes: (data.promociones as any[])?.filter((pr: any) => pr.es_vigente_hoy).length || 0,
        proveedor: (data.supplier_info as any)?.razon_social || "No asignado",
        estado_stock: r.estado_stock,
      }
      const res = await (api as any).generalAgent.chat(
        `Analizá este producto de supermercado como gerente de categoría. Datos: ${JSON.stringify(context)}.
Dame en formato estructurado:
1) Diagnóstico de rentabilidad comparando Costo Promedio (PPP) vs Último Costo de compra.
2) Evaluación de escalas mayoristas y rotación en góndola.
3) Alertas o recomendación accionable concreta (subir/mantener precio, reponer stock o armar promo).
Español paraguayo comercial, máx 200 palabras con viñetas •.`,
        []
      )
      setIaText(typeof res === "string" ? res : (res as any)?.reply || (res as any)?.response || "Sin respuesta")
    } catch { setIaText("⚠️ No se pudo obtener el análisis IA en este momento.") }
    finally { setIaLoading(false) }
  }, [data, m, p, r, s, costos, escalas])

  const promoVigente = (data.promociones as any[])?.find((pr: any) => pr.es_vigente_hoy)
  const hasPromo = !!promoVigente

  const ventasChartData = ((data as any).historial_ventas_mensual || []).map((v: any) => ({
    name: v.mes_label, unidades: Number(v.unidades), monto: Number(v.monto),
  }))
  const kostChartData = ((data as any).historial_costos_mensual || []).map((c: any) => ({
    name: c.mes_label, costo: Number(c.costo_promedio_mes), unidades_compradas: Number(c.unidades_compradas),
  }))
  const kardexChartData = rawKardex.slice(0, 15).reverse().map((mv: any, i: number) => ({
    name: mv.comprobante_numero ? mv.comprobante_numero.slice(-6) : `#${i + 1}`,
    cantidad: Number(mv.cantidad),
    tipo: mv.tipo_label || mv.tipo,
  }))

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 2rem)" }}>

        {/* ── HEADER ── */}
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
                    {escalas.length > 0 && (
                      <button onClick={() => setTab("precios")} className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-amber-100 transition-colors">
                        <Tag className="w-2.5 h-2.5" /> {escalas.length} Escala{escalas.length > 1 ? "s" : ""} Mayorista{escalas.length > 1 ? "s" : ""}
                      </button>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${p.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{p.activo ? "● Activo" : "○ Inactivo"}</span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>

              {/* Strip de métricas ejecutivas */}
              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs">
                <div className="flex items-center gap-1 font-black text-slate-900 dark:text-white">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Venta:</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />{formatPYG(m.precio_venta)}
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">PPP:</span>
                  {formatPYG(costos.costo_promedio)}
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Últ. Costo:</span>
                  {formatPYG(costos.ultimo_costo)}
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className="flex items-center gap-1 text-emerald-600 font-black">
                  <Percent className="w-3 h-3" /> {costos.margen_sobre_promedio_pct}% mg.
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className={`font-bold ${s.total_fisico <= 0 ? "text-rose-500" : r.autonomia_dias < 7 ? "text-amber-500" : "text-emerald-500"}`}>
                  Stock: {s.total_fisico} {p.unidad_medida}
                </div>
              </div>
            </div>
          </div>

          {/* Navegación por Tabs */}
          <div className="flex gap-0.5 px-5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
            {TAB_LIST.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pb-3 pt-1 px-3 text-[11px] font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${tab === t.key ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
                {t.key === "kardex" && rawKardex.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    {rawKardex.length}
                  </span>
                )}
                {t.key === "precios" && escalas.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 font-mono">
                    {escalas.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: DASHBOARD (OVERVIEW)
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Precio de Venta" color="indigo" icon={DollarSign} value={formatPYG(m.precio_venta)} sub={`IVA ${p.iva_tasa}% incl.`} />
                <KpiCard label="Margen Bruto (PPP)" color="emerald" icon={Percent} value={`${costos.margen_sobre_promedio_pct}%`} sub={`Ganancia: ${formatPYG(costos.ganancia_unitaria_promedio)}/un`} />
                <KpiCard label="Stock Total" color={s.total_fisico <= 0 ? "rose" : r.autonomia_dias < 7 ? "amber" : "sky"} icon={Box} value={`${s.total_fisico} ${p.unidad_medida}`} sub={`Autonomía: ${r.autonomia_dias} días`} />
                <KpiCard label="Ventas (30 días)" color="violet" icon={TrendingUp} value={`${r.ventas_ultimos_30d_unidades} un.`} sub={formatPYG(r.ventas_ultimos_30d_gs)} />
              </div>

              {/* Módulo Ejecutivo: Costos & Valuación */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Estructura de Costos & Valuación Oficial</h4>
                  </div>
                  <button onClick={() => setTab("costos")} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1">
                    Ver análisis detallado <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Costo Promedio (PPP)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">Oficial</span>
                    </div>
                    <p className="text-xl font-black font-mono text-slate-800 dark:text-white">{formatPYG(costos.costo_promedio)}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">Margen negocio: {costos.margen_sobre_promedio_pct}%</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Último Costo Compra</span>
                      {costos.variacion_costo_pct !== 0 && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${costos.variacion_costo_pct > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {costos.variacion_costo_pct > 0 ? `+${costos.variacion_costo_pct}%` : `${costos.variacion_costo_pct}%`}
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-black font-mono text-slate-800 dark:text-white">{formatPYG(costos.ultimo_costo)}</p>
                    <p className="text-[10px] text-indigo-600 font-bold mt-1">Margen sobre últ.: {costos.margen_sobre_ultimo_pct}%</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Escalas Mayoristas</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">{escalas.length} niveles</span>
                    </div>
                    {escalas.length > 0 ? (
                      <div>
                        <p className="text-base font-black font-mono text-slate-800 dark:text-white">Desde {formatPYG(escalas[0].precio_unitario)}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-1">Min. {escalas[0].min_qty} un. (-{escalas[0].descuento_pct}%)</p>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-[11px] italic mt-2">Sin precios escalonados</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Gráficos de Ventas y Compras */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-indigo-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Evolución de Ventas (6 meses)</h4></div>
                  {ventasChartData.length === 0 ? <p className="text-center text-slate-400 text-xs py-8">Sin datos históricos de venta</p> : (
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={ventasChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs><linearGradient id="areaVentas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltipPYG />} />
                        <Area type="monotone" dataKey="unidades" name="Unidades" stroke="#6366f1" fill="url(#areaVentas)" strokeWidth={2} dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-amber-500" /><h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Evolución de Costo de Compra</h4></div>
                  {kostChartData.length === 0 ? <p className="text-center text-slate-400 text-xs py-8">Sin compras registradas en los últimos 6 meses</p> : (
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={kostChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <YAxis yAxisId="costo" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <Tooltip content={<CustomTooltipPYG />} />
                        <Bar yAxisId="costo" dataKey="costo" name="Costo Promedio" fill="#f59e0b" radius={[3, 3, 0, 0]} opacity={0.8} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Cards de Proveedor y Promoción */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3"><Truck className="w-4 h-4 text-indigo-500" /><h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Proveedor Vinculado</h4></div>
                  {data.supplier_info ? (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-sm text-slate-900 dark:text-white">{data.supplier_info.razon_social}</p>
                          {data.supplier_info.ruc && <p className="text-xs font-mono text-slate-400">RUC: {data.supplier_info.ruc}</p>}
                        </div>
                        {data.supplier_info.rating && (
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{data.supplier_info.rating}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                        {data.supplier_info.contacto_nombre && <div><span className="text-[10px] text-slate-400 block">Contacto</span>{data.supplier_info.contacto_nombre}</div>}
                        {data.supplier_info.telefono && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{data.supplier_info.telefono}</div>}
                        {data.supplier_info.plazo_pago_dias && <div><span className="text-[10px] text-slate-400 block">Plazo Pago</span>{data.supplier_info.plazo_pago_dias} días</div>}
                        {data.supplier_info.ciudad && <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{data.supplier_info.ciudad}</div>}
                      </div>
                    </div>
                  ) : <p className="text-xs text-slate-400 italic">Sin proveedor directamente vinculado</p>}
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
                  ) : <div><p className="text-xs text-slate-400 italic">Sin promoción activa hoy</p><p className="text-[10px] text-slate-400 mt-1">{((data.promociones as any[]) || []).length} promo(s) registradas</p></div>}
                </div>
              </div>

              {/* IA Panel */}
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-900/60 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /><h4 className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider">Asesor Inteligente Retail — IA</h4></div>
                  <button onClick={handleAnalyzeIA} disabled={iaLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 disabled:opacity-60 transition-colors">
                    {iaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}{iaLoading ? "Analizando..." : "Consultar Asesor IA"}
                  </button>
                </div>
                {iaText ? (
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{iaText}</div>
                ) : <p className="text-xs text-slate-400 italic">Hacé clic en "Consultar Asesor IA" para análisis automático de elasticidad de precio, rentabilidad y rotación.</p>}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: PRECIOS & ESCALAS MAYORISTAS
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "precios" && (
            <div className="space-y-6">
              {/* KPIs de Precios y Márgenes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Precio Unitario" color="indigo" icon={DollarSign} value={formatPYG(m.precio_venta)} sub={`IVA ${p.iva_tasa}% incluido`} />
                <KpiCard label="Margen sobre PPP" color="emerald" icon={Percent} value={`${costos.margen_sobre_promedio_pct}%`} sub={`Ganancia: ${formatPYG(costos.ganancia_unitaria_promedio)}`} />
                <KpiCard label="Margen sobre Últ. Costo" color="amber" icon={Percent} value={`${costos.margen_sobre_ultimo_pct}%`} sub={`Ganancia: ${formatPYG(costos.ganancia_unitaria_ultimo)}`} />
                <KpiCard label="Markup Aplicado" color="violet" icon={ArrowUpRight} value={`${costos.markup_sobre_promedio_pct}%`} sub="Sobre costo PPP" />
              </div>

              {/* Candado de Seguridad y Modificación de Precio */}
              <div className={`rounded-2xl border p-5 ${locked ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-gradient-to-br from-indigo-50 to-violet-50/50 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-300 dark:border-indigo-700"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {locked ? <Lock className="w-5 h-5 text-slate-400" /> : <Unlock className="w-5 h-5 text-indigo-500" />}
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">{locked ? "Candado de Precio Activo" : "Modificación de Precio Desbloqueada"}</h4>
                      <p className="text-[10px] text-slate-400">{locked ? "El precio está protegido contra cambios accidentales. Presioná Desbloquear para editar." : "Modificá el precio y evaluá en tiempo real los márgenes proyectados."}</p>
                    </div>
                  </div>
                  <button onClick={() => setLocked(l => !l)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${locked ? "bg-slate-200 dark:bg-slate-800 text-slate-600 hover:bg-amber-100 hover:text-amber-700" : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700"}`}>
                    {locked ? <><Unlock className="w-3.5 h-3.5" /> Desbloquear</> : <><Lock className="w-3.5 h-3.5" /> Bloquear</>}
                  </button>
                </div>

                {!locked && (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nuevo Precio de Venta Unitario (₲)</label>
                        <input type="number" min={0} value={newPrice} onChange={e => setNewPrice(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-black text-lg text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                      </div>
                      <button onClick={handleSavePrice} disabled={savingPrice || newPriceNum <= 0} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold transition-colors">
                        {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar Precio
                      </button>
                    </div>

                    {newPriceNum > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`p-3 rounded-xl border text-center ${newMargenPct >= 20 ? "bg-emerald-50 border-emerald-200" : newMargenPct >= 10 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"}`}>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Margen sobre PPP</p>
                          <p className={`text-xl font-black font-mono ${newMargenPct >= 20 ? "text-emerald-600" : newMargenPct >= 10 ? "text-amber-600" : "text-rose-600"}`}>{newMargenPct.toFixed(1)}%</p>
                          <p className="text-[9px] text-slate-400 font-mono">Ganancia: {formatPYG(newMargenMonto)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Margen sobre Últ. Costo</p>
                          <p className="text-xl font-black font-mono text-slate-800 dark:text-white">{newMargenUltimo.toFixed(1)}%</p>
                          <p className="text-[9px] text-slate-400 font-mono">Últ: {formatPYG(costos.ultimo_costo)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Nuevo Markup</p>
                          <p className="text-xl font-black font-mono text-violet-600">{newMarkup.toFixed(1)}%</p>
                          <p className="text-[9px] text-slate-400">Sobre costo PPP</p>
                        </div>
                      </div>
                    )}

                    {newPriceNum > 0 && newPriceNum < costoBaseSim && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs flex items-center gap-2 text-rose-700">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>⚠️ <strong>Atención crítica:</strong> El precio ingresado ({formatPYG(newPriceNum)}) es inferior al costo ({formatPYG(costoBaseSim)}). Estarías vendiendo con pérdida directa.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── ESCALAS DE PRECIOS MAYORISTAS (sp_tiered_prices) ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Escalas de Precio por Volumen (Mayorista)</h4>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">{escalas.length} nivel{escalas.length !== 1 ? "es" : ""} configurado{escalas.length !== 1 ? "s" : ""}</span>
                </div>

                {escalas.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                    <Scale className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Sin escalas mayoristas registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Este producto se vende exclusivamente a precio unitario estándar ({formatPYG(m.precio_venta)}).</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Grid de Tiers */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {escalas.map((esc, idx) => (
                        <div key={esc.id || idx} className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/30 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                              Escala {idx + 1}: {esc.min_qty}+ unidades
                            </span>
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                              -{esc.descuento_pct}%
                            </span>
                          </div>

                          <div className="my-2">
                            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                              {formatPYG(esc.precio_unitario)}
                              <span className="text-xs font-normal text-slate-400"> / un.</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Ahorro cliente: <strong className="text-emerald-600">{formatPYG(esc.ahorro_por_unidad)}</strong> / unidad
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-400 block font-bold">Total Lote Mínimo</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatPYG(esc.total_minimo)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block font-bold">Margen Supermercado</span>
                              <span className={`font-mono font-bold ${esc.margen_pct >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{esc.margen_pct}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tabla comparativa formal */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-3 text-left">Nivel Escala</th>
                            <th className="p-3 text-right">Cantidad Mínima</th>
                            <th className="p-3 text-right">Precio Mayorista</th>
                            <th className="p-3 text-right">Descuento</th>
                            <th className="p-3 text-right">Ahorro / Un.</th>
                            <th className="p-3 text-right">Desembolso Mínimo</th>
                            <th className="p-3 text-right">Margen Negocio</th>
                            <th className="p-3 text-right">Markup</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {/* Fila base 1 unidad */}
                          <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                            <td className="p-3 font-bold text-slate-600">Base (Unidad)</td>
                            <td className="p-3 text-right font-mono">1 un.</td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(m.precio_venta)}</td>
                            <td className="p-3 text-right font-mono text-slate-400">—</td>
                            <td className="p-3 text-right font-mono text-slate-400">—</td>
                            <td className="p-3 text-right font-mono text-slate-700">{formatPYG(m.precio_venta)}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">{costos.margen_sobre_promedio_pct}%</td>
                            <td className="p-3 text-right font-mono text-violet-600">{costos.markup_sobre_promedio_pct}%</td>
                          </tr>
                          {escalas.map((esc, i) => (
                            <tr key={esc.id || i} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="p-3 font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center justify-center font-black">{i + 1}</span>
                                Escala {i + 1}
                              </td>
                              <td className="p-3 text-right font-mono font-bold">{esc.min_qty} {p.unidad_medida}{esc.max_qty ? ` a ${esc.max_qty}` : "+"}</td>
                              <td className="p-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{formatPYG(esc.precio_unitario)}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">-{esc.descuento_pct}%</td>
                              <td className="p-3 text-right font-mono text-slate-600">{formatPYG(esc.ahorro_por_unidad)}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(esc.total_minimo)}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">{esc.margen_pct}%</td>
                              <td className="p-3 text-right font-mono text-violet-600">{esc.markup_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: COSTOS & VALUACIÓN (PPP VS ÚLTIMO)
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "costos" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Costo Promedio Ponderado */}
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Costo Promedio Ponderado</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-800 font-bold">PPP Oficial</span>
                  </div>
                  <p className="text-3xl font-black font-mono text-amber-700 dark:text-amber-400 my-1">{formatPYG(costos.costo_promedio)}</p>
                  <p className="text-xs text-slate-500 mt-2">Valuación contable de inventario según entradas y salidas acumuladas.</p>
                  <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/60 flex justify-between text-xs">
                    <span className="text-slate-500">Margen sobre PPP:</span>
                    <span className="font-bold font-mono text-emerald-600">{costos.margen_sobre_promedio_pct}% ({formatPYG(costos.ganancia_unitaria_promedio)})</span>
                  </div>
                </div>

                {/* Último Costo de Adquisición */}
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Último Costo de Compra</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800 font-bold">Última Factura</span>
                  </div>
                  <p className="text-3xl font-black font-mono text-indigo-700 dark:text-indigo-400 my-1">{formatPYG(costos.ultimo_costo)}</p>
                  <p className="text-xs text-slate-500 mt-2">Precio unitario en la orden de compra o recepción más reciente.</p>
                  <div className="mt-4 pt-3 border-t border-indigo-200/60 dark:border-indigo-900/60 flex justify-between text-xs">
                    <span className="text-slate-500">Margen sobre Último:</span>
                    <span className="font-bold font-mono text-indigo-600">{costos.margen_sobre_ultimo_pct}% ({formatPYG(costos.ganancia_unitaria_ultimo)})</span>
                  </div>
                </div>

                {/* Comparativa & Desvío */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Variación de Reposición</span>
                    <div className="flex items-center gap-2 my-2">
                      {costos.variacion_costo_pct > 0 ? (
                        <ArrowUpRight className="w-6 h-6 text-rose-500" />
                      ) : costos.variacion_costo_pct < 0 ? (
                        <ArrowDownRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <Check className="w-6 h-6 text-slate-400" />
                      )}
                      <p className={`text-2xl font-black font-mono ${costos.variacion_costo_pct > 0 ? "text-rose-600" : costos.variacion_costo_pct < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                        {costos.variacion_costo_pct > 0 ? `+${costos.variacion_costo_pct}%` : `${costos.variacion_costo_pct}%`}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {costos.variacion_costo_pct > 0
                        ? "El último costo subió respecto al promedio. Considerar ajuste de precio de venta para defender el margen."
                        : costos.variacion_costo_pct < 0
                          ? "El costo de reposición bajó. Margen en expansión favorable."
                          : "Costo de reposición perfectamente alineado con el promedio ponderado."}
                    </p>
                  </div>
                  {costos.costo_landed > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs flex justify-between">
                      <span className="text-slate-400">Costo Landed:</span>
                      <span className="font-mono font-bold text-amber-600">{formatPYG(costos.costo_landed)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial de Costos de Compra */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" /> Evolución Mensual del Costo de Adquisición
                </h4>
                {kostChartData.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">Sin historial de costos en los últimos 6 meses</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={kostChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="costo" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <YAxis yAxisId="unidades" orientation="right" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <Bar yAxisId="costo" dataKey="costo" name="Costo Promedio (₲)" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Line yAxisId="unidades" type="monotone" dataKey="unidades_compradas" name="Unidades Compradas" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: KARDEX DE INVENTARIO (PROFESIONAL Y CON COMPROBANTES)
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "kardex" && (
            <div className="space-y-4">
              {/* KPIs de Kardex */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Entradas (+)" color="emerald" icon={ArrowUpRight} value={`+${kardexResumen.total_entradas} ${p.unidad_medida}`} sub="Compras, ajustes y dev." />
                <KpiCard label="Salidas (-)" color="rose" icon={ArrowDownRight} value={`-${kardexResumen.total_salidas} ${p.unidad_medida}`} sub="Ventas POS y mermas" />
                <KpiCard label="Saldo Neto Analizado" color={kardexResumen.saldo_neto_periodo >= 0 ? "sky" : "amber"} icon={Layers} value={`${kardexResumen.saldo_neto_periodo > 0 ? `+${kardexResumen.saldo_neto_periodo}` : kardexResumen.saldo_neto_periodo} ${p.unidad_medida}`} sub="En período de movimientos" />
                <KpiCard label="Movimientos" color="indigo" icon={Activity} value={`${kardexResumen.movimientos_count} reg.`} sub={`Stock actual: ${s.total_fisico}`} />
              </div>

              {/* Gráfico de flujo reciente */}
              {kardexChartData.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-indigo-500" /> Flujo de Movimientos Recientes
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">Verde: Entrada (+) | Rojo: Salida (-)</span>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={kardexChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b22" />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltipPYG />} />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Bar dataKey="cantidad" name="Cantidad">
                        {kardexChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cantidad > 0 ? "#10b981" : "#f43f5e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Filtros de la tabla de Kardex */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button onClick={() => setKardexFilter("todos")} className={`px-3 py-1 rounded-lg transition-colors ${kardexFilter === "todos" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    Todos ({rawKardex.length})
                  </button>
                  <button onClick={() => setKardexFilter("salidas")} className={`px-3 py-1 rounded-lg transition-colors ${kardexFilter === "salidas" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    Salidas / Ventas
                  </button>
                  <button onClick={() => setKardexFilter("entradas")} className={`px-3 py-1 rounded-lg transition-colors ${kardexFilter === "entradas" ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    Entradas / Compras
                  </button>
                  <button onClick={() => setKardexFilter("ajustes")} className={`px-3 py-1 rounded-lg transition-colors ${kardexFilter === "ajustes" ? "bg-white dark:bg-slate-700 text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    Ajustes
                  </button>
                </div>
                <span className="text-xs text-slate-400">Mostrando {filteredKardex.length} movimiento(s)</span>
              </div>

              {/* Tabla de Kardex */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 text-left">Fecha / Hora</th>
                      <th className="p-3 text-left">Comprobante</th>
                      <th className="p-3 text-left">Tipo de Movimiento</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-right">Costo Unit.</th>
                      <th className="p-3 text-right">Total Val.</th>
                      <th className="p-3 text-left">Depósito</th>
                      <th className="p-3 text-left">Motivo / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredKardex.map((mov: any) => {
                      const cantNum = Number(mov.cantidad)
                      const esPos = cantNum > 0
                      const cUnit = Number(mov.costo_unitario || costos.costo_promedio || 0)
                      const cTot = Number(mov.costo_total || Math.abs(cantNum) * cUnit)

                      return (
                        <tr key={mov.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="p-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatDateTimePY(mov.created_at)}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {mov.comprobante_numero ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${mov.comprobante_numero.startsWith("001") ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
                                {mov.comprobante_numero}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase inline-flex items-center gap-1 ${esPos ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                              {esPos ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                              {mov.tipo_label || mov.tipo?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-mono font-black text-sm ${esPos ? "text-emerald-600" : "text-rose-600"}`}>
                            {esPos ? `+${cantNum}` : cantNum}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">{p.unidad_medida}</span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {cUnit > 0 ? formatPYG(cUnit) : "—"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {cTot > 0 ? formatPYG(cTot) : "—"}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 text-[10px]">
                            {mov.warehouse_nombre || "Depósito Central"}
                          </td>
                          <td className="p-3 text-slate-500 text-[10px] max-w-[180px] truncate" title={mov.motivo || mov.referencia_type || ""}>
                            {mov.motivo || mov.referencia_type || "Operación regular"}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredKardex.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-400">
                          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold">No se encontraron movimientos registrados en este filtro.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: STOCK POR DEPÓSITO
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "stock" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Stock Físico" color="sky" icon={Box} value={`${s.total_fisico} ${p.unidad_medida}`} />
                <KpiCard label="Disponible" color="emerald" icon={CheckCircle2} value={`${s.total_disponible} ${p.unidad_medida}`} />
                <KpiCard label="Reservado" color="amber" icon={Clock} value={`${s.total_reservado} ${p.unidad_medida}`} />
                <KpiCard label="Valorizado al Costo" color="indigo" icon={DollarSign} value={formatPYG(s.valor_inventario_costo)} />
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

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: PROMOCIONES
             ════════════════════════════════════════════════════════════════════════ */}
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

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: HISTORIAL DE COMPRAS
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "compras" && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">N° Orden</th><th className="p-3 text-left">Proveedor</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-right">Costo Unit.</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Estado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.ultimas_compras || []).map((oc: any) => (
                      <tr key={oc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-indigo-600">{oc.numero}</td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{oc.supplier_nombre || "—"}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px]">{formatDatePY(oc.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold">{oc.cantidad}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(oc.precio_unitario)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(oc.total)}</td>
                        <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">{oc.estado}</span></td>
                      </tr>
                    ))}
                    {!(data.ultimas_compras?.length) && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Sin compras registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: HISTORIAL DE VENTAS
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "ventas" && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr><th className="p-3 text-left">N° Factura</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Fecha / Hora</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-right">Precio Unit.</th><th className="p-3 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.ultimas_ventas || []).map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-emerald-600">{v.numero}</td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{v.customer_nombre || "Cliente Ocasional"}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px]">{formatDateTimePY(v.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold">{v.cantidad}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(v.precio_unitario)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(v.subtotal)}</td>
                      </tr>
                    ))}
                    {!(data.ultimas_ventas?.length) && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sin ventas registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              TAB: CÓDIGOS ALTERNATIVOS & PACKS
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "codigos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Barcode className="w-4 h-4 text-indigo-500" /> Código EAN Principal</h4>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-mono font-black text-slate-900 dark:text-white">{p.codigo_barra || "—"}</p>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Principal</span>
                  </div>
                  {p.plu_balanza && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">PLU Balanza: <strong className="font-mono font-bold text-slate-900 dark:text-white">{p.plu_balanza}</strong></span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-violet-500" /> Packs y Bultos Registrados</h4>
                  {((data.codigos_alternativos as any[]) || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay códigos alternativos de caja o pack registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {((data.codigos_alternativos as any[]) || []).map((pack: any) => (
                        <div key={pack.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{pack.etiqueta}</span>
                            <span className="text-[10px] font-mono text-slate-400">{pack.codigo_barra}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-indigo-600 block">{pack.unidades_por_paquete} unidades</span>
                            <span className="text-[9px] text-slate-400">{formatPYG(pack.unidades_por_paquete * m.precio_venta)} pack</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
