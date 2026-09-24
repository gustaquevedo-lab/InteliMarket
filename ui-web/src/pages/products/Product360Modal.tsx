import React, { useState, useCallback, useMemo, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  X, Sparkles, Package, Tag, Barcode, DollarSign, TrendingUp, TrendingDown,
  Building2, ShoppingCart, Layers, Lock, Unlock, Save, AlertTriangle,
  CheckCircle2, Info, Clock, Star, Truck, Phone, Mail, MapPin,
  Zap, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Box,
  Percent, Gift, Calendar, Scale, Loader2, ChevronRight, FileText,
  RefreshCw, Eye, Hash, Filter, ArrowRight, ShieldCheck, Check, Calculator, User,
  Plus, Pencil, Trash2
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
  const [localEscalas, setLocalEscalas] = useState<any[]>(() => data.escalas_precio || [])
  const [editingTierId, setEditingTierId] = useState<string | null>(null) // null | "new" | string (tier.id)
  const [tierMinQty, setTierMinQty] = useState<number>(6)
  const [tierMaxQty, setTierMaxQty] = useState<string>("")
  const [tierTargetMargin, setTierTargetMargin] = useState<string>("15")
  const [tierPrice, setTierPrice] = useState<string>("")
  const [savingTier, setSavingTier] = useState<boolean>(false)
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null)

  useEffect(() => {
    setLocalEscalas(data.escalas_precio || [])
  }, [data.escalas_precio])

  const escalas = localEscalas

  // Estructura de Costos y Margen Ponderado Real
  const margenPond = data.margen_ponderado_analisis || {
    precio_lista: m.precio_venta,
    precio_promedio_real: m.precio_venta_promedio_real || m.precio_venta,
    precio_promedio_30d: m.precio_venta_promedio_30d || m.precio_venta,
    costo_promedio_ppp: m.costo_promedio || m.costo_unitario || 0,
    ultimo_costo: m.ultimo_costo || p.ultimo_costo || m.costo_unitario || 0,
    margen_bruto_real_pct: m.margen_bruto_pct,
    margen_bruto_real_monto: m.margen_bruto_monto,
    markup_real_pct: m.markup_pct,
    margen_bruto_real_30d_pct: m.margen_bruto_pct,
    margen_lista_nominal_pct: m.margen_lista_pct || m.margen_bruto_pct,
    margen_lista_nominal_monto: m.margen_lista_monto || m.margen_bruto_monto,
    markup_lista_pct: m.markup_pct,
    descuento_medio_escala_pct: m.descuento_medio_escala_pct || 0,
    diferencial_margen_pct: m.diferencial_margen_pct || 0,
    unidades_totales_vendidas: r.ventas_ultimos_30d_unidades,
    monto_total_vendido: r.ventas_ultimos_30d_gs,
    tickets_totales_count: 0,
  }

  const costos = data.costos_estructura || {
    costo_promedio: margenPond.costo_promedio_ppp,
    ultimo_costo: margenPond.ultimo_costo,
    costo_landed: Number(m.costo_landed || 0),
    metodo_costeo: "PPP (Promedio Ponderado)",
    variacion_costo_pct: 0,
    margen_sobre_promedio_pct: margenPond.margen_bruto_real_pct,
    margen_sobre_ultimo_pct: margenPond.margen_bruto_real_pct,
    markup_sobre_promedio_pct: margenPond.markup_real_pct,
    markup_sobre_ultimo_pct: margenPond.markup_real_pct,
    ganancia_unitaria_promedio: margenPond.margen_bruto_real_monto,
    ganancia_unitaria_ultimo: margenPond.margen_bruto_real_monto,
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

  const handleStartNewTier = useCallback(() => {
    setEditingTierId("new")
    const nextMin = localEscalas.length > 0 ? Math.max(...localEscalas.map(e => Number(e.min_qty) || 0)) + 6 : 6
    setTierMinQty(nextMin)
    setTierMaxQty("")
    setTierTargetMargin("15")
    if (costoBaseSim > 0) {
      const pCalc = Math.round(costoBaseSim / (1 - 0.15))
      const p77 = Math.floor(pCalc / 100) * 100 + 77
      setTierPrice(String(p77))
    } else {
      setTierPrice("")
    }
  }, [localEscalas, costoBaseSim])

  const handleEditTier = useCallback((esc: any) => {
    setEditingTierId(esc.id)
    setTierMinQty(esc.min_qty || 1)
    setTierMaxQty(esc.max_qty ? String(esc.max_qty) : "")
    setTierPrice(String(esc.precio_unitario || ""))
    const pU = Number(esc.precio_unitario || 0)
    if (pU > 0 && costoBaseSim > 0) {
      const mPct = ((pU - costoBaseSim) / pU) * 100
      setTierTargetMargin(mPct.toFixed(1))
    } else {
      setTierTargetMargin("15")
    }
  }, [costoBaseSim])

  const handleMarginChange = useCallback((valStr: string) => {
    setTierTargetMargin(valStr)
    const mNum = parseFloat(valStr)
    if (!isNaN(mNum) && mNum < 100 && costoBaseSim > 0) {
      const rawPrice = Math.round(costoBaseSim / (1 - (mNum / 100)))
      setTierPrice(String(rawPrice))
    }
  }, [costoBaseSim])

  const handlePriceManualChange = useCallback((valStr: string) => {
    setTierPrice(valStr)
    const pNum = parseFloat(valStr)
    if (!isNaN(pNum) && pNum > 0 && costoBaseSim > 0) {
      const mPct = ((pNum - costoBaseSim) / pNum) * 100
      setTierTargetMargin(mPct.toFixed(1))
    }
  }, [costoBaseSim])

  const applyPsychological = useCallback((type: "77" | "900" | "500" | "000") => {
    const currentP = parseFloat(tierPrice) || costoBaseSim
    if (currentP <= 0) return
    let newP = currentP
    if (type === "77") {
      newP = Math.floor(currentP / 100) * 100 + 77
      if (newP < 77) newP = 77
    } else if (type === "900") {
      newP = Math.floor(currentP / 1000) * 1000 + 900
    } else if (type === "500") {
      newP = Math.floor(currentP / 1000) * 1000 + 500
    } else if (type === "000") {
      newP = Math.round(currentP / 1000) * 1000
    }
    setTierPrice(String(newP))
    if (costoBaseSim > 0) {
      const mPct = ((newP - costoBaseSim) / newP) * 100
      setTierTargetMargin(mPct.toFixed(1))
    }
  }, [tierPrice, costoBaseSim])

  const handleSaveTier = useCallback(async () => {
    const pNum = parseFloat(tierPrice)
    const qNum = Number(tierMinQty)
    if (!pNum || pNum <= 0) {
      toast.error("Precio inválido", "El precio mayorista debe ser mayor a 0")
      return
    }
    if (!qNum || qNum < 1) {
      toast.error("Cantidad inválida", "La cantidad mínima debe ser al menos 1")
      return
    }

    setSavingTier(true)
    try {
      if (editingTierId === "new") {
        await api.smartPricing.createTieredPrice({
          product_id: p.id,
          min_qty: qNum,
          max_qty: tierMaxQty ? Number(tierMaxQty) : null,
          precio_unitario: pNum,
          moneda: "PYG",
        })
        toast.success("Escala creada", `Nueva escala para ${qNum}+ unidades guardada a ${formatPYG(pNum)}`)
      } else if (editingTierId) {
        await api.smartPricing.updateTieredPrice(editingTierId, {
          min_qty: qNum,
          max_qty: tierMaxQty ? Number(tierMaxQty) : null,
          precio_unitario: pNum,
        })
        toast.success("Escala actualizada", `Escala para ${qNum}+ unidades actualizada a ${formatPYG(pNum)}`)
      }

      // Refrescar Ficha 360 en vivo
      const fresh360 = await api.products.get360(p.id)
      if (fresh360?.escalas_precio) {
        setLocalEscalas(fresh360.escalas_precio)
      }
      setEditingTierId(null)
    } catch (e: any) {
      toast.error("Error al guardar escala", e.message)
    } finally {
      setSavingTier(false)
    }
  }, [tierPrice, tierMinQty, tierMaxQty, editingTierId, p.id, toast])

  const handleDeleteTier = useCallback(async (tierId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta escala de precio mayorista?")) return
    setDeletingTierId(tierId)
    try {
      await api.smartPricing.deleteTieredPrice(tierId)
      toast.success("Escala eliminada", "La escala fue eliminada correctamente")
      const fresh360 = await api.products.get360(p.id)
      if (fresh360?.escalas_precio) {
        setLocalEscalas(fresh360.escalas_precio)
      } else {
        setLocalEscalas(prev => prev.filter(e => e.id !== tierId))
      }
      if (editingTierId === tierId) setEditingTierId(null)
    } catch (e: any) {
      toast.error("Error al eliminar escala", e.message)
    } finally {
      setDeletingTierId(null)
    }
  }, [p.id, editingTierId, toast])

  const handleAnalyzeIA = useCallback(async () => {
    setIaLoading(true)
    setIaText(null)
    try {
      const context = {
        producto: p.nombre, sku: p.sku,
        precio_lista: margenPond.precio_lista,
        precio_venta_promedio_real: margenPond.precio_promedio_real,
        costo_promedio_ppp: margenPond.costo_promedio_ppp,
        ultimo_costo: margenPond.ultimo_costo,
        margen_bruto_real_pct: margenPond.margen_bruto_real_pct,
        margen_lista_nominal_pct: margenPond.margen_lista_nominal_pct,
        erosion_margen_escalas_pct: margenPond.diferencial_margen_pct,
        descuento_medio_escala_pct: margenPond.descuento_medio_escala_pct,
        unidades_vendidas: margenPond.unidades_totales_vendidas,
        stock_total: s.total_fisico, demanda_diaria: r.demanda_diaria_estimada,
        autonomia_dias: r.autonomia_dias, escalas_mayoristas: escalas.length,
        promociones_vigentes: (data.promociones as any[])?.filter((pr: any) => pr.es_vigente_hoy).length || 0,
        proveedor: (data.supplier_info as any)?.razon_social || "No asignado",
      }
      const res = await (api as any).generalAgent.chat(
        `Analizá este producto de supermercado como gerente comercial y de categoría mayorista. Datos: ${JSON.stringify(context)}.
Dame en formato estructurado:
1) Diagnóstico de Margen Real Ponderado (PVP promedio real vs Costo PPP) y el impacto del escalonado mayorista.
2) Evaluación de si la escala de precios actual defiende la rentabilidad o erosiona demasiado el margen.
3) Acción sugerida concreta: renegociar con proveedor, ajustar precios o modificar la cantidad mínima de escala.
Español paraguayo comercial, máx 200 palabras con viñetas •.`,
        []
      )
      setIaText(typeof res === "string" ? res : (res as any)?.reply || (res as any)?.response || "Sin respuesta")
    } catch { setIaText("⚠️ No se pudo obtener el análisis IA en este momento.") }
    finally { setIaLoading(false) }
  }, [data, m, p, r, s, costos, escalas, margenPond])

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:py-10 md:px-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-6xl my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ maxHeight: "min(85vh, 840px)" }}
      >

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

              {/* Strip de métricas ejecutivas con MARGEN REAL PONDERADO */}
              <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">PVP Promedio:</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(margenPond.precio_promedio_real)}</span>
                  {margenPond.precio_promedio_real !== m.precio_venta && (
                    <span className="text-[10px] text-slate-400 font-mono">(Lista: {formatPYG(m.precio_venta)})</span>
                  )}
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Costo PPP:</span>
                  {formatPYG(costos.costo_promedio)}
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Margen Real:</span>
                  <span className={`font-black font-mono text-sm px-2 py-0.5 rounded-md ${margenPond.margen_bruto_real_pct >= 20 ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600" : margenPond.margen_bruto_real_pct >= 10 ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600" : "bg-rose-50 dark:bg-rose-950/60 text-rose-600"}`}>
                    {margenPond.margen_bruto_real_pct}%
                  </span>
                  {margenPond.diferencial_margen_pct !== 0 && (
                    <span className="text-[10px] text-slate-400" title={`Margen Teórico de Lista: ${margenPond.margen_lista_nominal_pct}%`}>
                      ({margenPond.diferencial_margen_pct > 0 ? `+${margenPond.diferencial_margen_pct}%` : `${margenPond.diferencial_margen_pct}%`})
                    </span>
                  )}
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
              {/* KPIs Principales con Margen Real Ponderado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Venta Promedio (PVP Real)" color="indigo" icon={DollarSign} value={formatPYG(margenPond.precio_promedio_real)} sub={`Lista: ${formatPYG(m.precio_venta)}`} />
                <KpiCard label="Margen Real Ponderado" color={margenPond.margen_bruto_real_pct >= 20 ? "emerald" : margenPond.margen_bruto_real_pct >= 10 ? "amber" : "rose"} icon={Percent} value={`${margenPond.margen_bruto_real_pct}%`} sub={`Ganancia: ${formatPYG(margenPond.margen_bruto_real_monto)} / un.`} />
                <KpiCard label="Costo Promedio (PPP)" color="amber" icon={TrendingDown} value={formatPYG(costos.costo_promedio)} sub={`Último: ${formatPYG(costos.ultimo_costo)}`} />
                <KpiCard label="Stock Total" color={s.total_fisico <= 0 ? "rose" : r.autonomia_dias < 7 ? "amber" : "sky"} icon={Box} value={`${s.total_fisico} ${p.unidad_medida}`} sub={`Autonomía: ${r.autonomia_dias} días`} />
              </div>

              {/* Módulo Especial: Análisis de Margen Real Ponderado vs Margen de Lista */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-indigo-900/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">Margen Bruto Ponderado por Escalas de Precio</h3>
                      <p className="text-[11px] text-slate-400">Calculado rigurosamente: <strong>(PVP Promedio Real - Costo PPP) ÷ PVP Promedio Real</strong></p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Retail & Mayorista
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-1">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Precio Venta Promedio (Real)</span>
                    <p className="text-2xl font-black font-mono text-emerald-400">{formatPYG(margenPond.precio_promedio_real)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Ponderado en caja sobre {margenPond.unidades_totales_vendidas > 0 ? `${Number(margenPond.unidades_totales_vendidas).toLocaleString("es-PY")} un.` : "catálogo"}</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Costo Promedio (PPP)</span>
                    <p className="text-2xl font-black font-mono text-amber-400">{formatPYG(costos.costo_promedio)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Valuación contable de inventario</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Margen Bruto Real Efectivo</span>
                    <p className={`text-2xl font-black font-mono ${margenPond.margen_bruto_real_pct >= 20 ? "text-emerald-400" : margenPond.margen_bruto_real_pct >= 10 ? "text-amber-400" : "text-rose-400"}`}>
                      {margenPond.margen_bruto_real_pct}%
                    </p>
                    <p className="text-[10px] text-slate-300 font-mono mt-1">Ganancia: {formatPYG(margenPond.margen_bruto_real_monto)} / un.</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Impacto Escalas Mayoristas</span>
                    <p className="text-2xl font-black font-mono text-violet-400">
                      {margenPond.descuento_medio_escala_pct > 0 ? `-${margenPond.descuento_medio_escala_pct}%` : "0%"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Lista: {margenPond.margen_lista_nominal_pct}% ({margenPond.diferencial_margen_pct}%)</p>
                  </div>
                </div>

                {margenPond.descuento_medio_escala_pct > 0 && (
                  <div className="mt-3 text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>
                      Al venderse por escalas mayoristas, el precio promedio real alcanzado ({formatPYG(margenPond.precio_promedio_real)}) es menor al precio unitario de lista ({formatPYG(margenPond.precio_lista)}). Esto genera un <strong>descuento ponderado del {margenPond.descuento_medio_escala_pct}%</strong> absorbido por el negocio a cambio de mayor rotación y volumen.
                    </span>
                  </div>
                )}
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
                    <div className="space-y-2">
                      <p className="font-black text-sm text-rose-700 dark:text-rose-300">{promoVigente.nombre}</p>
                      <p className="text-[10px] font-bold uppercase bg-rose-100 text-rose-600 px-2 py-0.5 rounded inline-block">{TIPO_LABEL[promoVigente.tipo] || promoVigente.tipo}</p>
                      {promoVigente.precio_fijo_promocional && <div className="mt-1"><p className="font-black text-lg text-rose-600 font-mono">{formatPYG(promoVigente.precio_fijo_promocional)}</p><p className="text-[10px] text-slate-500">Ahorro: <strong className="text-rose-500">{formatPYG(promoVigente.ahorro_por_unidad)}</strong> ({promoVigente.ahorro_pct}%)</p></div>}
                      <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/50 text-[11px] space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Vigencia: <strong>{formatDatePY(promoVigente.valido_desde)}</strong> al <strong>{formatDatePY(promoVigente.valido_hasta)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Registrado por: <strong className="text-slate-900 dark:text-white font-bold">{promoVigente.usuario_registro || "Sistema"}</strong></span>
                        </div>
                      </div>
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
              {/* Comparador de Precios y Márgenes Ponderados */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Precio Unitario de Lista</span>
                  <p className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300">{formatPYG(m.precio_venta)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Margen teórico: <strong>{margenPond.margen_lista_nominal_pct}%</strong></p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">PVP Promedio Real (en Caja)</span>
                  <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(margenPond.precio_promedio_real)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Margen Real: <strong className="text-emerald-600">{margenPond.margen_bruto_real_pct}%</strong> (PVP vs PPP)</p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Costo Promedio Ponderado (PPP)</span>
                  <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{formatPYG(costos.costo_promedio)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Últ. Costo de compra: {formatPYG(costos.ultimo_costo)}</p>
                </div>
              </div>

              {/* Candado de Seguridad y Modificación de Precio */}
              <div className={`rounded-2xl border p-5 ${locked ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-gradient-to-br from-indigo-50 to-violet-50/50 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-300 dark:border-indigo-700"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {locked ? <Lock className="w-5 h-5 text-slate-400" /> : <Unlock className="w-5 h-5 text-indigo-500" />}
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">{locked ? "Candado de Precio Activo" : "Modificación de Precio Desbloqueada"}</h4>
                      <p className="text-[10px] text-slate-400">{locked ? "El precio de lista está protegido contra cambios accidentales. Presioná Desbloquear para editar." : "Modificá el precio y evaluá en tiempo real los márgenes proyectados."}</p>
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nuevo Precio de Venta Unitario de Lista (₲)</label>
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
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Margen Proyectado sobre PPP</p>
                          <p className={`text-xl font-black font-mono ${newMargenPct >= 20 ? "text-emerald-600" : newMargenPct >= 10 ? "text-amber-600" : "text-rose-600"}`}>{newMargenPct.toFixed(1)}%</p>
                          <p className="text-[9px] text-slate-400 font-mono">Ganancia: {formatPYG(newMargenMonto)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Margen sobre Últ. Costo</p>
                          <p className="text-xl font-black font-mono text-slate-800 dark:text-white">
                            {costos.ultimo_costo > 0 ? (((newPriceNum - costos.ultimo_costo) / newPriceNum) * 100).toFixed(1) : newMargenPct.toFixed(1)}%
                          </p>
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
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-indigo-500" />
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Escalas de Precio por Volumen (Mayorista)</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Precios por escala calculados por margen comercial sobre costo PPP con terminaciones psicológicas.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">{escalas.length} nivel{escalas.length !== 1 ? "es" : ""} configurado{escalas.length !== 1 ? "s" : ""}</span>
                    {!editingTierId && (
                      <button
                        onClick={handleStartNewTier}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow"
                      >
                        <Plus className="w-4 h-4" /> Agregar Escala
                      </button>
                    )}
                  </div>
                </div>

                {/* ── PANEL DE EDICIÓN / ALTA DE ESCALA INTERACTIVO ── */}
                {editingTierId && (
                  <div className="rounded-2xl border-2 border-indigo-400/80 dark:border-indigo-600 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white uppercase tracking-wider">
                          {editingTierId === "new" ? "Nueva Escala" : "Editar Escala"}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                          Costo PPP de Referencia: <strong className="font-mono text-amber-600 dark:text-amber-400">{formatPYG(costoBaseSim)}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingTierId(null)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Cantidad Mínima */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cantidad Mínima ({p.unidad_medida || "UN"})</label>
                        <input
                          type="number"
                          min={1}
                          value={tierMinQty}
                          onChange={e => setTierMinQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Cantidad Máxima (Opcional) */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cantidad Máxima (Opcional)</label>
                        <input
                          type="number"
                          min={tierMinQty}
                          placeholder="Sin límite (+)"
                          value={tierMaxQty}
                          onChange={e => setTierMaxQty(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* % Margen Objetivo Deseado */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Margen Objetivo Comercial (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={tierTargetMargin}
                            onChange={e => handleMarginChange(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-bold font-mono text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Presets rápidos de margen */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Márgenes Rápidos:</span>
                      {["10", "12.5", "15", "18", "20", "22", "25"].map(mVal => (
                        <button
                          key={mVal}
                          type="button"
                          onClick={() => handleMarginChange(mVal)}
                          className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border transition-colors ${
                            tierTargetMargin === mVal
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                          }`}
                        >
                          {mVal}%
                        </button>
                      ))}
                    </div>

                    {/* Barra de Atajos: Precios Psicológicos */}
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Reglas de Precios Psicológicos (Supermercado):
                        </span>
                        <span className="text-[10px] text-slate-400">Click para ajustar terminación</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => applyPsychological("77")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors shadow-sm"
                        >
                          <span>✨ Final .77</span>
                          <span className="text-[10px] opacity-75 font-mono">
                            ({formatPYG(Math.floor((parseFloat(tierPrice) || costoBaseSim) / 100) * 100 + 77)})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyPsychological("900")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                        >
                          <span>🎯 Final .900</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyPsychological("000")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span>⚪ Redondo .000</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyPsychological("500")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span>🪙 Final .500</span>
                        </button>
                      </div>
                    </div>

                    {/* Input Principal: Precio Mayorista Editable */}
                    <div className="flex flex-wrap items-end gap-3 pt-1">
                      <div className="flex-1 min-w-[220px]">
                        <label className="text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-200 block mb-1">
                          Precio Mayorista Final Resultante (₲ / unidad) — 100% editable
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={tierPrice}
                            onChange={e => handlePriceManualChange(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 font-black text-xl text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                          />
                          <span className="absolute right-4 top-3 text-xs font-bold text-slate-400 font-mono">PYG</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveTier}
                          disabled={savingTier || !parseFloat(tierPrice) || parseFloat(tierPrice) <= 0}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-md hover:shadow-lg"
                        >
                          {savingTier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Guardar Escala
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTierId(null)}
                          className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {/* Resumen en vivo de Rentabilidad y Ahorro */}
                    {parseFloat(tierPrice) > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-indigo-100 dark:border-slate-800 text-xs">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Margen Real</span>
                          <span className={`font-mono font-black text-sm ${
                            ((parseFloat(tierPrice) - costoBaseSim) / parseFloat(tierPrice) * 100) >= 15
                              ? "text-emerald-600"
                              : ((parseFloat(tierPrice) - costoBaseSim) / parseFloat(tierPrice) * 100) >= 8
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}>
                            {costoBaseSim > 0 ? (((parseFloat(tierPrice) - costoBaseSim) / parseFloat(tierPrice)) * 100).toFixed(1) : "—"}%
                          </span>
                          <p className="text-[9px] text-slate-400 font-mono">Ganancia: {formatPYG(parseFloat(tierPrice) - costoBaseSim)}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Descuento Cliente</span>
                          <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                            {m.precio_venta > 0 && parseFloat(tierPrice) < m.precio_venta
                              ? `-${(((m.precio_venta - parseFloat(tierPrice)) / m.precio_venta) * 100).toFixed(1)}%`
                              : "0%"}
                          </span>
                          <p className="text-[9px] text-slate-400 font-mono">Ahorro: {formatPYG(Math.max(0, m.precio_venta - parseFloat(tierPrice)))}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Lote Mínimo</span>
                          <span className="font-mono font-black text-sm text-slate-800 dark:text-white">
                            {formatPYG(Math.round((parseFloat(tierPrice) || 0) * tierMinQty))}
                          </span>
                          <p className="text-[9px] text-slate-400">{tierMinQty} {p.unidad_medida || "un."}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Markup s/ Costo</span>
                          <span className="font-mono font-black text-sm text-violet-600">
                            {costoBaseSim > 0 ? (((parseFloat(tierPrice) - costoBaseSim) / costoBaseSim) * 100).toFixed(1) : "—"}%
                          </span>
                          <p className="text-[9px] text-slate-400">Sobre PPP</p>
                        </div>
                      </div>
                    )}

                    {parseFloat(tierPrice) > 0 && parseFloat(tierPrice) < costoBaseSim && (
                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl p-3 text-xs flex items-center gap-2 text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                        <span>⚠️ <strong>Alerta de margen negativo:</strong> El precio mayorista ingresado ({formatPYG(parseFloat(tierPrice))}) es inferior al costo PPP ({formatPYG(costoBaseSim)}). El supermercado perdería {formatPYG(costoBaseSim - parseFloat(tierPrice))} por unidad.</span>
                      </div>
                    )}
                  </div>
                )}

                {escalas.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                    <Scale className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Sin escalas mayoristas registradas</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">Este producto se vende exclusivamente a precio unitario estándar ({formatPYG(m.precio_venta)}).</p>
                    {!editingTierId && (
                      <button
                        onClick={handleStartNewTier}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Crear Primera Escala
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Grid de Tiers */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {escalas.map((esc, idx) => (
                        <div key={esc.id || idx} className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/30 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-indigo-400 transition-all group">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                                Escala {idx + 1}: {esc.min_qty}+ unidades
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                  -{esc.descuento_pct}%
                                </span>
                                {esc.id && (
                                  <div className="flex items-center gap-0.5 ml-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTier(esc)}
                                      title="Editar Escala"
                                      className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-slate-800 text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTier(esc.id)}
                                      disabled={deletingTierId === esc.id}
                                      title="Eliminar Escala"
                                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-500 hover:text-rose-700 transition-colors"
                                    >
                                      {deletingTierId === esc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                )}
                              </div>
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
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-400 block font-bold">Total Lote Mínimo</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatPYG(esc.total_minimo)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block font-bold">Margen Supermercado</span>
                              <span className={`font-mono font-bold ${esc.margen_pct >= 20 ? "text-emerald-600" : esc.margen_pct >= 10 ? "text-amber-600" : "text-rose-600"}`}>{esc.margen_pct}%</span>
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
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {/* Fila base 1 unidad */}
                          <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                            <td className="p-3 font-bold text-slate-600">Base (Unidad Minorista)</td>
                            <td className="p-3 text-right font-mono">1 un.</td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(m.precio_venta)}</td>
                            <td className="p-3 text-right font-mono text-slate-400">—</td>
                            <td className="p-3 text-right font-mono text-slate-400">—</td>
                            <td className="p-3 text-right font-mono text-slate-700">{formatPYG(m.precio_venta)}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">{margenPond.margen_lista_nominal_pct}%</td>
                            <td className="p-3 text-right font-mono text-violet-600">{margenPond.markup_lista_pct}%</td>
                            <td className="p-3 text-center text-slate-400 text-[10px]">Fija</td>
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
                              <td className="p-3 text-center">
                                {esc.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTier(esc)}
                                      title="Editar"
                                      className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-slate-800 text-indigo-600 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTier(esc.id)}
                                      disabled={deletingTierId === esc.id}
                                      title="Eliminar"
                                      className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-500 transition-colors"
                                    >
                                      {deletingTierId === esc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">—</span>
                                )}
                              </td>
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
                    <span className="text-slate-500">Margen Real sobre PPP:</span>
                    <span className="font-bold font-mono text-emerald-600">{margenPond.margen_bruto_real_pct}% ({formatPYG(margenPond.margen_bruto_real_monto)})</span>
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
                <div key={pr.id} className={`rounded-2xl border p-4.5 ${pr.es_vigente_hoy ? "bg-gradient-to-br from-rose-50 to-orange-50/50 dark:from-rose-950/30 dark:to-orange-950/30 border-rose-300 dark:border-rose-900/70" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {pr.es_vigente_hoy && <Zap className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
                        <span className="font-black text-sm text-slate-900 dark:text-white">{pr.nombre}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{TIPO_LABEL[pr.tipo] || pr.tipo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${pr.estado === "activa" ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{pr.estado?.replace(/_/g, " ")}</span>
                        {pr.es_vigente_hoy && <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 uppercase tracking-wider">🔥 Vigente HOY</span>}
                      </div>
                    </div>
                    {pr.precio_fijo_promocional && (
                      <div className="text-right">
                        <p className="text-xl font-black text-rose-600 font-mono">{formatPYG(pr.precio_fijo_promocional)}</p>
                        {pr.ahorro_por_unidad > 0 && <p className="text-[10px] text-slate-500">Ahorro: <strong className="text-rose-500">{formatPYG(pr.ahorro_por_unidad)}</strong> ({pr.ahorro_pct}%)</p>}
                      </div>
                    )}
                  </div>

                  {/* Franja de Vigencia & Usuario que Registró la Promoción */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inicio de Vigencia</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{formatDatePY(pr.valido_desde)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fin de Vigencia</span>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{formatDatePY(pr.valido_hasta)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registrado Por</span>
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate block" title={pr.usuario_registro || "Sistema"}>
                          {pr.usuario_registro || "Sistema"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metadatos adicionales */}
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 mt-2.5 px-1">
                    <div><span className="font-semibold text-slate-500">Origen:</span> {pr.origen?.replace(/_/g, " ") || "—"}</div>
                    <div><span className="font-semibold text-slate-500">Financiamiento:</span> {pr.financiamiento?.replace(/_/g, " ") || "—"}</div>
                    {pr.created_at && <div><span className="font-semibold text-slate-500">Fecha Carga:</span> {formatDatePY(pr.created_at)}</div>}
                  </div>

                  {pr.dias_semana?.length > 0 && (
                    <div className="flex gap-1 mt-2.5">{DIAS_NOMBRES.map((d, i) => <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pr.dias_semana.includes(i) ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>{d}</span>)}</div>
                  )}
                  {pr.stock_limite_unidades && (
                    <div className="mt-2.5">
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
                    <tr>
                      <th className="p-3 text-left">N° Factura</th>
                      <th className="p-3 text-left">Cajera</th>
                      <th className="p-3 text-left">Cliente</th>
                      <th className="p-3 text-left">Fecha / Hora</th>
                      <th className="p-3 text-right">Cant.</th>
                      <th className="p-3 text-right">Precio Unit.</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.ultimas_ventas || []).map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-emerald-600">{v.numero}</td>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs">{v.cajero_nombre || "—"}</span>
                            {v.caja_nombre && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                                {v.caja_nombre}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{v.customer_nombre || "Cliente Ocasional"}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px]">{formatDateTimePY(v.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold">{v.cantidad}</td>
                        <td className="p-3 text-right font-mono">{formatPYG(v.precio_unitario)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(v.subtotal)}</td>
                      </tr>
                    ))}
                    {!(data.ultimas_ventas?.length) && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Sin ventas registradas</td></tr>}
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
    </div>,
    document.body
  )
}
