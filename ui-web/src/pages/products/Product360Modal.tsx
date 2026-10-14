import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  X, Sparkles, Package, Tag, Barcode, DollarSign, TrendingUp, TrendingDown,
  Building2, ShoppingCart, Layers, Lock, Unlock, Save, AlertTriangle,
  CheckCircle2, Info, Clock, Star, Truck, Phone, Mail, MapPin,
  Zap, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Box,
  Percent, Gift, Calendar, Scale, Loader2, ChevronRight, FileText,
  RefreshCw, Eye, Hash, Filter, ArrowRight, ShieldCheck, Check, Calculator, User,
  Plus, Pencil, Trash2, Boxes, Split, Link2, Unlink
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line, ReferenceLine, Cell
} from "recharts"
import { type Product360Response, api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import { usePermissions } from "../../context/PermissionsContext"
import CurrencyInput from "../../components/CurrencyInput"

const PACK_PRESETS_360 = [
  { label: "Pack x6", unidades: 6, tag: "Pack x6" },
  { label: "Pack x12", unidades: 12, tag: "Pack x12" },
  { label: "Fardo x12", unidades: 12, tag: "Fardo x12" },
  { label: "Caja x24", unidades: 24, tag: "Caja x24" },
  { label: "Caja x48", unidades: 48, tag: "Caja x48" },
  { label: "Display x12", unidades: 12, tag: "Display x12" },
  { label: "Six-Pack", unidades: 6, tag: "Six-Pack" },
  { label: "Pack x4", unidades: 4, tag: "Pack x4" },
  { label: "🏷️ Sinónimo 1:1", unidades: 1, tag: "Sinónimo Multiorigen" },
]

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
  { key: "codigos", label: "Códigos & Presentaciones", icon: Barcode },
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
  onTiersUpdated?: (productId: string, precioMayorista: number | null, minQty: number | null) => void
}

export default function Product360Modal({ data: initialData, onClose, onPriceUpdated, onTiersUpdated }: Props) {
  const toast = useToast()
  const { hasPermission, isAdministrador } = usePermissions()
  const canEditPrice = isAdministrador || hasPermission("products:edit_price") || hasPermission("products:update")
  const [tab, setTab] = useState<TabKey>("overview")
  const [iaLoading, setIaLoading] = useState(false)
  const [iaText, setIaText] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)

  const [data, setData] = useState<Product360Response>(initialData)
  useEffect(() => {
    setData(initialData)
  }, [initialData])

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

  const [newPrice, setNewPrice] = useState(String(data.metricas_financieras?.precio_venta || data.product?.precio_venta || 0))
  const [savingPrice, setSavingPrice] = useState(false)
  const [kardexFilter, setKardexFilter] = useState<"todos" | "salidas" | "entradas" | "ajustes">("todos")

  const [unitTargetMargin, setUnitTargetMargin] = useState<string>(() => {
    const pU = Number(data.metricas_financieras?.precio_venta || data.product?.precio_venta || 0)
    const cU = Number(data.costos_estructura?.costo_promedio || data.metricas_financieras?.costo_promedio || data.product?.costo_promedio || data.metricas_financieras?.costo_unitario || 0)
    if (pU > 0 && cU > 0) {
      return (((pU - cU) / pU) * 100).toFixed(1)
    }
    return "25"
  })

  useEffect(() => {
    setLocalEscalas(data.escalas_precio || [])
    const pU = Number(data.metricas_financieras?.precio_venta || data.product?.precio_venta || 0)
    const cU = Number(data.costos_estructura?.costo_promedio || data.metricas_financieras?.costo_promedio || data.product?.costo_promedio || data.metricas_financieras?.costo_unitario || 0)
    if (pU > 0 && cU > 0) {
      setUnitTargetMargin((((pU - cU) / pU) * 100).toFixed(1))
    }
    setNewPrice(String(pU))
  }, [data])

  // ── ESTADOS PARA CÓDIGOS ALTERNATIVOS Y FRACCIONAMIENTO ──
  const [altCodes, setAltCodes] = useState<any[]>(() => (data.codigos_alternativos as any[]) || [])
  const [fracInfo, setFracInfo] = useState<any>(() => (data as any).fractionation_info || null)
  useEffect(() => {
    setAltCodes((data.codigos_alternativos as any[]) || [])
    setFracInfo((data as any).fractionation_info || null)
  }, [data])

  // Modal Nuevo Código Alternativo / Pack
  const [showAddAltCodeModal, setShowAddAltCodeModal] = useState(false)
  const [newAltBarcode, setNewAltBarcode] = useState("")
  const [newAltLabel, setNewAltLabel] = useState("")
  const [newAltType, setNewAltType] = useState<"synonym" | "pack">("pack")
  const [newAltUnits, setNewAltUnits] = useState<number>(6)
  const [savingAltCode, setSavingAltCode] = useState(false)
  const altBarcodeInputRef = useRef<HTMLInputElement>(null)
  const altEtiquetaInputRef = useRef<HTMLInputElement>(null)

  // Modal Fraccionar Displays a Góndola
  const [showFractionateModal, setShowFractionateModal] = useState(false)
  const [fractionateQty, setFractionateQty] = useState<number>(1)
  const [executingFractionate, setExecutingFractionate] = useState(false)

  // Modal Vincular Fraccionamiento (Display -> Unidad)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkMode, setLinkMode] = useState<"quick_create" | "existing">("quick_create")
  const [quickChildName, setQuickChildName] = useState("")
  const [quickChildBarcode, setQuickChildBarcode] = useState("")
  const [quickChildFactor, setQuickChildFactor] = useState<number>(24)
  const [quickChildPrice, setQuickChildPrice] = useState<number>(0)
  const [existingChildId, setExistingChildId] = useState("")
  const [existingFactor, setExistingFactor] = useState<number>(24)
  const [savingLink, setSavingLink] = useState(false)
  const [unlinkingFrac, setUnlinkingFrac] = useState(false)

  const costoDisplayPadre = Number(m.costo_promedio || p.costo_promedio || m.costo_unitario || 0)
  const precioDisplayPadre = Number(m.precio_venta || p.precio_venta || 0)
  const factorActual = quickChildFactor > 0 ? quickChildFactor : 24
  const costoUnitarioProrrateado = costoDisplayPadre > 0 ? Math.round(costoDisplayPadre / factorActual) : 0
  const precioUnitarioVenta = quickChildPrice || 0

  const margenComercialPct = (precioUnitarioVenta > 0 && costoUnitarioProrrateado > 0)
    ? (((precioUnitarioVenta - costoUnitarioProrrateado) / precioUnitarioVenta) * 100)
    : 0
  const markupPct = (costoUnitarioProrrateado > 0)
    ? (((precioUnitarioVenta - costoUnitarioProrrateado) / costoUnitarioProrrateado) * 100)
    : 0
  const gananciaUnitariaGs = Math.max(0, precioUnitarioVenta - costoUnitarioProrrateado)
  const gananciaTotalDisplayGs = gananciaUnitariaGs * factorActual
  const diferenciaVsDisplayCerrado = (precioUnitarioVenta * factorActual) - precioDisplayPadre

  const MARGENES_RAPIDOS = [15, 20, 25, 30, 35, 40]
  const aplicarMargenRapido = useCallback((margenDeseado: number) => {
    if (costoUnitarioProrrateado <= 0) return
    const precioCalculado = Math.round(costoUnitarioProrrateado / (1 - margenDeseado / 100))
    const precioRedondeado = Math.ceil(precioCalculado / 50) * 50
    setQuickChildPrice(precioRedondeado)
  }, [costoUnitarioProrrateado])

  const handleOpenLinkModal = useCallback(() => {
    setQuickChildName(`${p.nombre} (Unidad)`)
    setQuickChildBarcode("")
    const f = 24
    setQuickChildFactor(f)
    const cDisplay = Number(m.costo_promedio || p.costo_promedio || m.costo_unitario || 0)
    const cProrrateado = cDisplay > 0 ? Math.round(cDisplay / f) : 0
    const pSugerido = cProrrateado > 0 ? Math.ceil(Math.round(cProrrateado / (1 - 0.25)) / 50) * 50 : (
      Number(m.precio_venta || p.precio_venta || 0) > 0 ? Math.round(Number(m.precio_venta || p.precio_venta || 0) / f) : 0
    )
    setQuickChildPrice(pSugerido)
    setExistingChildId("")
    setExistingFactor(f)
    setLinkMode("quick_create")
    setShowLinkModal(true)
  }, [p.nombre, p.costo_promedio, p.precio_venta, m.costo_promedio, m.costo_unitario, m.precio_venta])

  const handleCreateAltCode = useCallback(async (e?: React.FormEvent, keepOpen = false) => {
    if (e) e.preventDefault()
    if (!newAltBarcode.trim()) {
      toast.error("Código requerido", "Ingrese el código de barras.")
      altBarcodeInputRef.current?.focus()
      return
    }
    const units = Number(newAltUnits) || 1
    if (units <= 0) {
      toast.error("Unidades inválidas", "Las unidades deben ser mayores a 0.")
      return
    }
    const label = newAltLabel.trim() || (units === 1 ? "Código Secundario (Multiorigen)" : `Pack x${units}`)
    setSavingAltCode(true)
    try {
      await api.products.packBarcodes.create(p.id, {
        codigo_barra: newAltBarcode.trim(),
        etiqueta: label,
        unidades_por_paquete: units,
      })
      toast.success("Código registrado", `Código ${newAltBarcode.trim()} (${label}) agregado con éxito.`)
      
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) {
        setData(fresh360)
        setAltCodes((fresh360.codigos_alternativos as any[]) || [])
      }

      setNewAltBarcode("")
      setNewAltLabel("")
      setNewAltUnits(6)
      setNewAltType("pack")

      if (keepOpen) {
        setTimeout(() => altBarcodeInputRef.current?.focus(), 80)
      } else {
        setShowAddAltCodeModal(false)
      }
    } catch (err: any) {
      toast.error("Error al registrar código", err.message)
    } finally {
      setSavingAltCode(false)
    }
  }, [newAltBarcode, newAltLabel, newAltUnits, p.id, toast])

  const handleDeleteAltCode = useCallback(async (packId: string) => {
    if (!confirm("¿Está seguro de eliminar este código alternativo / pack?")) return
    try {
      await api.products.packBarcodes.delete(p.id, packId)
      toast.success("Código eliminado", "El código fue eliminado exitosamente.")
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) setData(fresh360)
    } catch (err: any) {
      toast.error("Error al eliminar", err.message)
    }
  }, [p.id, toast])

  const handleExecuteFractionate = useCallback(async () => {
    if (fractionateQty <= 0) {
      toast.error("Cantidad inválida", "Ingrese al menos 1 display a fraccionar.")
      return
    }
    setExecutingFractionate(true)
    try {
      const res = await api.products.fractionation.executeStock(p.id, {
        cantidad_displays: fractionateQty,
        motivo: "Apertura y fraccionamiento de display para góndola",
      })
      toast.success(
        "Fraccionamiento exitoso",
        `Se abrieron ${res.displays_fraccionados} display(s). Se sumaron ${res.unidades_ingresadas} unidades al stock de góndola.`
      )
      setShowFractionateModal(false)
      setFractionateQty(1)
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) setData(fresh360)
    } catch (err: any) {
      toast.error("Error al fraccionar", err.message)
    } finally {
      setExecutingFractionate(false)
    }
  }, [fractionateQty, p.id, toast])

  const handleSaveLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingLink(true)
    try {
      if (linkMode === "quick_create") {
        if (!quickChildName.trim()) {
          toast.error("Nombre requerido", "Ingrese el nombre de la unidad individual.")
          setSavingLink(false)
          return
        }
        if (!quickChildBarcode.trim()) {
          toast.error("Código requerido", "Ingrese el código de barras de la unidad individual.")
          setSavingLink(false)
          return
        }
        if (quickChildFactor <= 1) {
          toast.error("Factor inválido", "El factor de conversión debe ser mayor a 1 unidad.")
          setSavingLink(false)
          return
        }
        await api.products.fractionation.quickCreate(p.id, {
          nombre: quickChildName.trim(),
          codigo_barra: quickChildBarcode.trim(),
          factor_conversion: quickChildFactor,
          precio_unitario: quickChildPrice > 0 ? quickChildPrice : undefined,
        })
        toast.success("Unidad creada y vinculada", "El producto unitario fue dado de alta y vinculado al display.")
      } else {
        if (!existingChildId.trim()) {
          toast.error("Producto requerido", "Seleccione o ingrese el ID del producto unitario.")
          setSavingLink(false)
          return
        }
        if (existingFactor <= 1) {
          toast.error("Factor inválido", "El factor de conversión debe ser mayor a 1 unidad.")
          setSavingLink(false)
          return
        }
        await api.products.fractionation.link(p.id, {
          child_product_id: existingChildId.trim(),
          factor_conversion: existingFactor,
        })
        toast.success("Fraccionamiento vinculado", "El display se vinculó exitosamente a la unidad individual.")
      }
      setShowLinkModal(false)
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) setData(fresh360)
    } catch (err: any) {
      toast.error("Error al vincular", err.message)
    } finally {
      setSavingLink(false)
    }
  }, [linkMode, quickChildName, quickChildBarcode, quickChildFactor, quickChildPrice, existingChildId, existingFactor, p.id, toast])

  const handleUnlinkFractionation = useCallback(async (relacionId: string) => {
    if (!confirm("¿Está seguro de eliminar la relación de fraccionamiento entre este display y su unidad?")) return
    setUnlinkingFrac(true)
    try {
      await api.products.fractionation.unlink(relacionId)
      toast.success("Desvinculado", "La relación de fraccionamiento fue eliminada.")
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) setData(fresh360)
    } catch (err: any) {
      toast.error("Error al desvincular", err.message)
    } finally {
      setUnlinkingFrac(false)
    }
  }, [p.id, toast])

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

  const handleUnitMarginChange = useCallback((valStr: string) => {
    setUnitTargetMargin(valStr)
    const mNum = parseFloat(valStr)
    if (!isNaN(mNum) && mNum < 100 && costoBaseSim > 0) {
      const rawPrice = Math.round(costoBaseSim / (1 - (mNum / 100)))
      setNewPrice(String(rawPrice))
    }
  }, [costoBaseSim])

  const handleUnitPriceChange = useCallback((numValue: number) => {
    setNewPrice(String(numValue))
    if (numValue > 0 && costoBaseSim > 0) {
      const mPct = ((numValue - costoBaseSim) / numValue) * 100
      setUnitTargetMargin(mPct.toFixed(1))
    }
  }, [costoBaseSim])

  const applyUnitPsychological = useCallback((type: "77" | "900" | "500" | "000") => {
    const currentP = newPriceNum || costoBaseSim
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
    setNewPrice(String(newP))
    if (costoBaseSim > 0 && newP > 0) {
      const mPct = ((newP - costoBaseSim) / newP) * 100
      setUnitTargetMargin(mPct.toFixed(1))
    }
  }, [newPriceNum, costoBaseSim])

  const handleSavePrice = useCallback(async () => {
    if (!newPriceNum || newPriceNum <= 0) { toast.error("Precio inválido", "Ingrese un precio mayor a 0"); return }
    setSavingPrice(true)
    try {
      await api.products.update(p.id, { precio_venta: newPriceNum })
      toast.success("Precio actualizado", `${p.nombre} → ${formatPYG(newPriceNum)}`)

      // Refrescar Ficha 360 en vivo sin salir del modal
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) {
        setData(fresh360)
        setLocalEscalas(fresh360.escalas_precio || [])
      }

      onPriceUpdated?.(p.id, newPriceNum)
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
      if (fresh360) {
        setData(fresh360)
        if (fresh360.escalas_precio) {
          setLocalEscalas(fresh360.escalas_precio)
        }
        const activeTiers = fresh360.escalas_precio || []
        const firstTier = activeTiers.length > 0 ? activeTiers[0] : null
        onTiersUpdated?.(p.id, firstTier ? firstTier.precio_unitario : null, firstTier ? firstTier.min_qty : null)
      }
      setEditingTierId(null)
    } catch (e: any) {
      toast.error("Error al guardar escala", e.message)
    } finally {
      setSavingTier(false)
    }
  }, [tierPrice, tierMinQty, tierMaxQty, editingTierId, p.id, onTiersUpdated, toast])

  const handleDeleteTier = useCallback(async (tierId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta escala de precio mayorista?")) return
    setDeletingTierId(tierId)
    try {
      await api.smartPricing.deleteTieredPrice(tierId)
      toast.success("Escala eliminada", "La escala fue eliminada correctamente")
      const fresh360 = await api.products.get360(p.id)
      if (fresh360) {
        setData(fresh360)
        if (fresh360.escalas_precio) {
          setLocalEscalas(fresh360.escalas_precio)
        } else {
          setLocalEscalas(prev => prev.filter(e => e.id !== tierId))
        }
        const activeTiers = fresh360.escalas_precio || []
        const firstTier = activeTiers.length > 0 ? activeTiers[0] : null
        onTiersUpdated?.(p.id, firstTier ? firstTier.precio_unitario : null, firstTier ? firstTier.min_qty : null)
      } else {
        setLocalEscalas(prev => prev.filter(e => e.id !== tierId))
        onTiersUpdated?.(p.id, null, null)
      }
      if (editingTierId === tierId) setEditingTierId(null)
    } catch (e: any) {
      toast.error("Error al eliminar escala", e.message)
    } finally {
      setDeletingTierId(null)
    }
  }, [p.id, editingTierId, onTiersUpdated, toast])

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
              <div className={`rounded-2xl border p-5 ${locked ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 border-2 border-indigo-400/80 dark:border-indigo-600 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {locked ? <Lock className="w-5 h-5 text-slate-400" /> : <Unlock className="w-5 h-5 text-indigo-500" />}
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">{locked ? "Candado de Precio Activo" : "Modificación de Precio Desbloqueada"}</h4>
                      <p className="text-[10px] text-slate-400">{locked ? "El precio de lista está protegido contra cambios accidentales. Presioná Desbloquear para editar." : "Modificá el precio y evaluá en tiempo real los márgenes proyectados con terminaciones psicológicas."}</p>
                    </div>
                  </div>
                  {canEditPrice ? (
                    <button onClick={() => setLocked(l => !l)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${locked ? "bg-slate-200 dark:bg-slate-800 text-slate-600 hover:bg-amber-100 hover:text-amber-700" : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700"}`}>
                      {locked ? <><Unlock className="w-3.5 h-3.5" /> Desbloquear</> : <><Lock className="w-3.5 h-3.5" /> Bloquear</>}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl">
                      <Lock className="w-3 h-3 text-slate-400" /> Protegido (Sin Permiso)
                    </span>
                  )}
                </div>

                {!locked && canEditPrice && (
                  <div className="space-y-4 pt-2 border-t border-indigo-100 dark:border-slate-800">
                    <div className="flex items-center justify-between border-b border-indigo-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white uppercase tracking-wider">
                          Modificar Precio Unitario de Lista
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                          Costo PPP de Referencia: <strong className="font-mono text-amber-600 dark:text-amber-400">{formatPYG(costoBaseSim)}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLocked(true)
                          setNewPrice(String(m.precio_venta))
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Margen Objetivo Deseado */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Margen Objetivo Comercial (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={unitTargetMargin}
                            onChange={e => handleUnitMarginChange(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-bold font-mono text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                        </div>
                      </div>

                      {/* Referencia de Últ. Costo */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Últ. Costo de Compra</label>
                        <div className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-slate-700 dark:text-slate-300">
                          {costos.ultimo_costo > 0 ? formatPYG(costos.ultimo_costo) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Presets rápidos de margen */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Márgenes Rápidos:</span>
                      {["15", "18", "20", "22", "25", "28", "30", "35"].map(mVal => (
                        <button
                          key={mVal}
                          type="button"
                          onClick={() => handleUnitMarginChange(mVal)}
                          className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
                            unitTargetMargin === mVal
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
                          onClick={() => applyUnitPsychological("77")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors shadow-sm cursor-pointer"
                        >
                          <span>✨ Final .77</span>
                          <span className="text-[10px] opacity-75 font-mono">
                            ({formatPYG(Math.floor((newPriceNum || costoBaseSim) / 100) * 100 + 77)})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyUnitPsychological("900")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                        >
                          <span>🎯 Final .900</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyUnitPsychological("000")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <span>⚪ Redondo .000</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyUnitPsychological("500")}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <span>🪙 Final .500</span>
                        </button>
                      </div>
                    </div>

                    {/* Input Principal: Precio Unitario Editable */}
                    <div className="flex flex-wrap items-end gap-3 pt-1">
                      <div className="flex-1 min-w-[220px]">
                        <label className="text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-200 block mb-1">
                          Precio Unitario Final Resultante (₲ / unidad) — 100% editable
                        </label>
                        <div className="relative">
                          <CurrencyInput
                            currency="PYG"
                            value={newPriceNum}
                            onChangeValue={(num) => handleUnitPriceChange(num)}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 font-black text-xl text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSavePrice}
                          disabled={savingPrice || newPriceNum <= 0}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                        >
                          {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Guardar Precio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLocked(true)
                            setNewPrice(String(m.precio_venta))
                          }}
                          className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {/* Métricas Proyectadas en Vivo */}
                    {newPriceNum > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`p-3 rounded-xl border text-center ${newMargenPct >= 20 ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" : newMargenPct >= 10 ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"}`}>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Margen Proyectado sobre PPP</p>
                          <p className={`text-xl font-black font-mono ${newMargenPct >= 20 ? "text-emerald-600 dark:text-emerald-400" : newMargenPct >= 10 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>{newMargenPct.toFixed(1)}%</p>
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
                          <p className="text-xl font-black font-mono text-violet-600 dark:text-violet-400">{newMarkup.toFixed(1)}%</p>
                          <p className="text-[9px] text-slate-400">Sobre costo PPP</p>
                        </div>
                      </div>
                    )}

                    {newPriceNum > 0 && newPriceNum < costoBaseSim && (
                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-xs flex items-center gap-2 text-rose-700 dark:text-rose-300">
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
                          <CurrencyInput
                            currency="PYG"
                            value={parseFloat(tierPrice) || 0}
                            onChangeValue={(num) => handlePriceManualChange(String(num))}
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 font-black text-xl text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                          />
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
                      <th className="p-3 text-left">Usuario / Operador</th>
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
                          <td className="p-3">
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs">
                                {(mov.usuario_nombre || "S")[0].toUpperCase()}
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate leading-tight" title={mov.usuario_email ? `${mov.usuario_nombre} (${mov.usuario_email})` : mov.usuario_nombre || "Sistema"}>
                                  {mov.usuario_nombre || "Sistema"}
                                </p>
                                {mov.usuario_rol && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium capitalize">
                                    {mov.usuario_rol}
                                  </span>
                                )}
                              </div>
                            </div>
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
                        <td colSpan={9} className="p-10 text-center text-slate-400">
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
              TAB: CÓDIGOS ALTERNATIVOS & FRACCIONAMIENTO DE DISPLAY
             ════════════════════════════════════════════════════════════════════════ */}
          {tab === "codigos" && (
            <div className="space-y-6">
              {/* Tarjetas Superiores de Identificación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EAN Principal */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-indigo-500" /> Código EAN Principal
                    </h4>
                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                      Base / Góndola
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-mono font-black text-slate-900 dark:text-white tracking-wider">
                      {p.codigo_barra || "—"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Identificador primario de venta y escaneo en cajas.</p>
                  {p.plu_balanza && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        PLU Balanza: <strong className="font-mono font-bold text-slate-900 dark:text-white">{p.plu_balanza}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Estado de Presentación / Fraccionamiento */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-violet-500" /> Estado de Presentación
                    </h4>
                    {fracInfo?.es_display ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 flex items-center gap-1.5">
                            <Box className="w-3.5 h-3.5" /> Display de Compra (Caja Cerrada)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Contiene <strong className="text-slate-900 dark:text-white font-bold">{fracInfo.factor_conversion} unidades</strong> de venta individual.
                        </p>
                      </div>
                    ) : fracInfo?.es_unidad_fraccionada ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" /> Unidad Individual Fraccionada
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Viene desglosada del display: <strong className="text-slate-900 dark:text-white font-bold">{fracInfo.display_parent?.nombre}</strong>
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            Presentación Estándar
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Este artículo no está configurado como Display fraccionable ni como unidad desglosada.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 text-right">
                    <span className="text-[11px] text-slate-400">
                      Stock total registrado: <strong className="text-slate-700 dark:text-slate-200 font-bold">{s.total_fisico}</strong> {p.unidad_medida || "UN"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── SECCIÓN 1: FRACCIONAMIENTO DE DISPLAY (CAJA -> GÓNDOLA) ── */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                      Fraccionamiento de Displays (Caja Cerrada a Góndola)
                    </h3>
                  </div>
                  {fracInfo?.es_display && (
                    <button
                      type="button"
                      onClick={() => setShowFractionateModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm shadow-violet-500/20 flex items-center gap-1.5 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      ⚡ Fraccionar Displays a Góndola
                    </button>
                  )}
                </div>

                <div className="p-5">
                  {fracInfo?.es_display ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400">
                            Unidad Individual en Góndola
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {fracInfo.unidad_child?.nombre || "Unidad Vinculada"}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <span>EAN Unitario: <strong className="font-mono text-slate-800 dark:text-slate-200">{fracInfo.unidad_child?.codigo_barra || "—"}</strong></span>
                            <span>•</span>
                            <span>Costo Prorrateado: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(fracInfo.unidad_child?.costo_promedio || 0)}</strong></span>
                            <span>•</span>
                            <span>Precio Góndola: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatPYG(fracInfo.unidad_child?.precio_promedio || 0)}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-violet-200/60 dark:border-violet-900/40">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock en Góndola</span>
                            <span className="text-lg font-mono font-black text-slate-900 dark:text-white">
                              {fracInfo.unidad_child?.stock_actual || 0} <span className="text-xs font-normal text-slate-500">unid.</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={unlinkingFrac}
                            onClick={() => fracInfo.relacion_id && handleUnlinkFractionation(fracInfo.relacion_id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Desvincular relación de fraccionamiento"
                          >
                            <Unlink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span>Factor de conversión: <strong>1 display = {fracInfo.factor_conversion} unidades</strong></span>
                        <span>Displays disponibles en depósito: <strong>{s.total_fisico}</strong> cajas</span>
                      </div>
                    </div>
                  ) : fracInfo?.es_unidad_fraccionada ? (
                    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Display / Caja Padre Registrada
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {fracInfo.display_parent?.nombre || "Display Padre"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                          <span>EAN Caja: <strong className="font-mono text-slate-800 dark:text-slate-200">{fracInfo.display_parent?.codigo_barra || "—"}</strong></span>
                          <span>•</span>
                          <span>Costo Display: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(fracInfo.display_parent?.costo_promedio || 0)}</strong></span>
                          <span>•</span>
                          <span>Factor: <strong className="text-slate-800 dark:text-slate-200">{fracInfo.factor_conversion} unidades por caja</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Displays en Depósito</span>
                        <span className="text-lg font-mono font-black text-slate-900 dark:text-white">
                          {fracInfo.display_parent?.stock_actual || 0} <span className="text-xs font-normal text-slate-500">cajas</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 px-4 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto">
                        <Split className="w-6 h-6" />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          ¿Este producto se adquiere en Display/Caja y se vende fraccionado?
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Ideal para golosinas, chocolates, galletitas o packs recibidos en bulto que contienen artículos con código de barra propio para la venta individual en góndola.
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleOpenLinkModal}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm shadow-violet-500/20 inline-flex items-center gap-2 transition-all"
                        >
                          <Link2 className="w-4 h-4" /> Configurar como Display Fraccionable
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SECCIÓN 2: CÓDIGOS DE BARRA ALTERNATIVOS (1:1 MULTIORIGEN) Y PACKS ── */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Barcode className="w-4 h-4 text-indigo-500" /> Códigos Secundarios & Packs
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Códigos 1:1 para productos multiorigen (Brasil/Argentina/Paraguay) y bultos por cantidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAltBarcode("")
                      setNewAltLabel("Pack x6")
                      setNewAltType("pack")
                      setNewAltUnits(6)
                      setShowAddAltCodeModal(true)
                      setTimeout(() => altBarcodeInputRef.current?.focus(), 80)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Registrar Código
                  </button>
                </div>

                <div className="p-5">
                  {altCodes.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      No hay códigos de barra alternativos ni packs registrados para este producto.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {altCodes.map((pack: any) => {
                        const isSynonym = Number(pack.unidades_por_paquete) === 1
                        return (
                          <div
                            key={pack.id}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                    isSynonym
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                      : "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300"
                                  }`}
                                >
                                  {isSynonym ? "Sinónimo 1:1 Multiorigen" : `Pack x${pack.unidades_por_paquete}`}
                                </span>
                              </div>
                              <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                {pack.codigo_barra}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {pack.etiqueta || (isSynonym ? "Multiorigen" : "Pack cerrado")}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {!isSynonym && (
                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                                    {formatPYG(pack.unidades_por_paquete * m.precio_venta)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">por pack</span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAltCode(pack.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Eliminar código alternativo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── MODAL: REGISTRAR CÓDIGO ALTERNATIVO O PACK (CANONICAL PACKS DESIGN) ── */}
              {showAddAltCodeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full flex flex-col my-8">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20 rounded-t-3xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                          <Box className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            Nuevo Código de Pack / Caja
                          </h3>
                          <p className="text-xs text-slate-500">
                            Asignar código de barra a una presentación por cantidad (ej. Six-Pack, Caja x24)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddAltCodeModal(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={(e) => handleCreateAltCode(e, false)} className="p-6 space-y-5">
                      {/* Ficha del Producto Base Fijo */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Producto Base *
                        </label>
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-xs">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {p.nombre}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 mt-0.5">
                                {p.codigo_barra && (
                                  <span>
                                    Cod: <strong className="text-slate-600 dark:text-slate-300">{p.codigo_barra}</strong>
                                  </span>
                                )}
                                {p.sku && <span>SKU: {p.sku}</span>}
                                <span>PVP Unitario: <strong className="text-emerald-600 dark:text-emerald-400">{formatPYG(m.precio_venta || p.precio_venta || 0)}</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Presets Rápidos */}
                      <div className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/50 dark:border-amber-900/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Atajos de Presentación Frecuentes:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {PACK_PRESETS_360.map((pr) => (
                            <button
                              key={pr.label}
                              type="button"
                              onClick={() => {
                                setNewAltLabel(pr.tag)
                                setNewAltUnits(pr.unidades)
                                setNewAltType(pr.unidades === 1 ? "synonym" : "pack")
                                altBarcodeInputRef.current?.focus()
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                            >
                              {pr.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Código de Barras de la Caja */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Código de Barras de la Caja/Pack *
                        </label>
                        <div className="relative">
                          <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            ref={altBarcodeInputRef}
                            type="text"
                            required
                            autoFocus
                            placeholder="Escaneá con la lectora o tipeá el código impreso en la caja"
                            value={newAltBarcode}
                            onChange={(e) => setNewAltBarcode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (!newAltLabel.trim()) {
                                  e.preventDefault()
                                  altEtiquetaInputRef.current?.focus()
                                }
                              }
                            }}
                            className="w-full text-xs font-mono font-bold pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Etiqueta y Unidades */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Etiqueta Descriptiva *
                          </label>
                          <input
                            ref={altEtiquetaInputRef}
                            type="text"
                            required
                            placeholder="Ej. Caja x24, Six-Pack, Fardo x12"
                            value={newAltLabel}
                            onChange={(e) => setNewAltLabel(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Unidades sueltas contenidas *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min="1"
                              step="1"
                              value={newAltUnits}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1)
                                setNewAltUnits(val)
                                setNewAltType(val === 1 ? "synonym" : "pack")
                              }}
                              className="w-full text-xs font-mono font-black text-amber-600 dark:text-amber-400 text-right pr-14 pl-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="text-[10px] font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              unidades
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Resumen precio resultante */}
                      {newAltUnits > 1 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-amber-800 dark:text-amber-300 font-medium">Precio resultante del pack:</span>
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                            {formatPYG(newAltUnits * (m.precio_venta || p.precio_venta || 0))}
                          </span>
                        </div>
                      )}

                      {/* Botonera de Acciones */}
                      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowAddAltCodeModal(false)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Cancelar
                        </button>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            disabled={savingAltCode || !newAltBarcode.trim() || !newAltLabel.trim()}
                            onClick={() => handleCreateAltCode(undefined, true)}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                            title="Guarda este pack y deja el formulario listo para agregar la siguiente presentación"
                          >
                            {savingAltCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Guardar y agregar otro pack
                          </button>
                          <button
                            type="submit"
                            disabled={savingAltCode || !newAltBarcode.trim() || !newAltLabel.trim()}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 flex items-center gap-1.5 shadow-md disabled:opacity-60 transition-colors"
                          >
                            {savingAltCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar y Cerrar
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ── MODAL: FRACCIONAR DISPLAYS A GÓNDOLA ── */}
              {showFractionateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> Desarmar Displays para Góndola
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowFractionateModal(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Display (Caja cerrada):</span>
                          <strong className="text-slate-900 dark:text-white">{p.nombre}</strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Unidad de Góndola:</span>
                          <strong className="text-slate-900 dark:text-white">{fracInfo?.unidad_child?.nombre || "Unidad"}</strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Factor de Conversión:</span>
                          <strong className="text-violet-600 dark:text-violet-400">{fracInfo?.factor_conversion} unidades por display</strong>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Stock disponible de displays:</span>
                          <strong className="font-mono text-slate-900 dark:text-white">{s.total_fisico} cajas</strong>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Cantidad de Displays a abrir y fraccionar
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, s.total_fisico)}
                          value={fractionateQty}
                          onChange={(e) => setFractionateQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold focus:ring-2 focus:ring-violet-500"
                        />
                      </div>

                      {/* Resumen de Impacto en Stock */}
                      <div className="p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 space-y-1.5 text-xs">
                        <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                          <span>Salida de Displays:</span>
                          <strong className="font-mono">-{fractionateQty} caja(s)</strong>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>Ingreso a Góndola:</span>
                          <strong className="font-mono">+{fractionateQty * (fracInfo?.factor_conversion || 1)} unidades</strong>
                        </div>
                        <div className="flex justify-between text-slate-500 pt-1 border-t border-violet-200/60 dark:border-violet-900/40 text-[11px]">
                          <span>Nuevo stock de displays:</span>
                          <strong className="font-mono text-slate-700 dark:text-slate-300">{Math.max(0, s.total_fisico - fractionateQty)} cajas</strong>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>Nuevo stock en góndola:</span>
                          <strong className="font-mono text-slate-700 dark:text-slate-300">
                            {Number(fracInfo?.unidad_child?.stock_actual || 0) + (fractionateQty * (fracInfo?.factor_conversion || 1))} unid.
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowFractionateModal(false)}
                          className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={executingFractionate || fractionateQty <= 0 || (s.total_fisico > 0 && fractionateQty > s.total_fisico)}
                          onClick={handleExecuteFractionate}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-violet-500/20 transition-colors"
                        >
                          {executingFractionate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                          Confirmar Fraccionamiento
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MODAL: CONFIGURAR DISPLAY FRACCIONABLE (VINCULAR / CREAR) ── */}
              {showLinkModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-violet-500" /> Configurar Relación Display &rarr; Unidad
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowLinkModal(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveLink} className="space-y-4">
                      {/* Modo */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setLinkMode("quick_create")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                            linkMode === "quick_create"
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          }`}
                        >
                          ✨ Crear Unidad Nueva
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkMode("existing")}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                            linkMode === "existing"
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          }`}
                        >
                          🔗 Vincular Existente
                        </button>
                      </div>

                      {linkMode === "quick_create" ? (
                        <div className="space-y-4">
                          {/* ── CARD: ESTRUCTURA DEL DISPLAY PADRE ── */}
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                              📦 Datos del Producto Display Padre (Caja Cerrada)
                            </span>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 block">Costo Compra</span>
                                <strong className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {formatPYG(costoDisplayPadre)}
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 block">Precio Display</span>
                                <strong className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {formatPYG(precioDisplayPadre)}
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 block">Margen Display</span>
                                <strong className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {costoDisplayPadre > 0 && precioDisplayPadre > 0
                                    ? (((precioDisplayPadre - costoDisplayPadre) / precioDisplayPadre) * 100).toFixed(1) + "%"
                                    : "—"}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Nombre de la Unidad en Góndola <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={quickChildName}
                              onChange={(e) => setQuickChildName(e.target.value)}
                              placeholder="Ej: Oblea Nik Chocolate 30g"
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                Código de Barras Unitario <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={quickChildBarcode}
                                onChange={(e) => setQuickChildBarcode(e.target.value)}
                                placeholder="Escanee la unidad..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-violet-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                Factor (Unidades por display) <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="2"
                                step="1"
                                required
                                value={quickChildFactor}
                                onChange={(e) => {
                                  const f = Math.max(2, parseInt(e.target.value) || 2)
                                  setQuickChildFactor(f)
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-violet-500"
                              />
                            </div>
                          </div>

                          {/* ── BANNER DESTACADO: COSTO PRORRATEADO ── */}
                          <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/60 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 block">
                                Costo Unitario Prorrateado
                              </span>
                              <span className="text-base font-mono font-black text-violet-900 dark:text-violet-200">
                                ₲ {formatPYG(costoUnitarioProrrateado)}
                              </span>
                            </div>
                            <span className="text-[11px] text-violet-700 dark:text-violet-300 font-medium bg-violet-100 dark:bg-violet-900/60 px-2 py-1 rounded-lg">
                              {formatPYG(costoDisplayPadre)} ÷ {factorActual} unid.
                            </span>
                          </div>

                          {/* ── BOTONES DE MÁRGENES RÁPIDOS ── */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Márgenes Rápidos Comerciales:
                              </label>
                              <span className="text-[10px] text-slate-400">Clic para sugerir precio</span>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5">
                              {MARGENES_RAPIDOS.map((mObj) => {
                                const isSelected = Math.abs(margenComercialPct - mObj) < 1.5
                                return (
                                  <button
                                    key={mObj}
                                    type="button"
                                    onClick={() => aplicarMargenRapido(mObj)}
                                    className={`py-1.5 px-1 rounded-lg text-xs font-bold font-mono transition-all border ${
                                      isSelected
                                        ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400"
                                    }`}
                                  >
                                    +{mObj}%
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* ── INPUT DE PRECIO UNITARIO MINORISTA ── */}
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Precio Unitario Minorista (PYG) <span className="text-rose-500">*</span>
                            </label>
                            <CurrencyInput
                              value={quickChildPrice}
                              onChangeValue={(val) => setQuickChildPrice(val || 0)}
                              placeholder="0"
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-lg focus:ring-2 focus:ring-violet-500"
                            />
                          </div>

                          {/* ── PANEL DE ANÁLISIS EN VIVO DE MARGEN & RENTABILIDAD ── */}
                          <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Indicadores de Rentabilidad en Góndola
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  margenComercialPct >= 25
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : margenComercialPct >= 15
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {margenComercialPct >= 25 ? "Margen Óptimo" : margenComercialPct >= 15 ? "Margen Aceptable" : "Margen Ajustado"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                              <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                                <span className="text-[10px] text-slate-400 block font-medium">Margen Comercial</span>
                                <strong
                                  className={`text-sm font-mono font-black ${
                                    margenComercialPct >= 20 ? "text-emerald-400" : "text-amber-400"
                                  }`}
                                >
                                  {margenComercialPct.toFixed(1)}%
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                                <span className="text-[10px] text-slate-400 block font-medium">Markup (Marcación)</span>
                                <strong className="text-sm font-mono font-black text-indigo-300">
                                  {markupPct.toFixed(1)}%
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                                <span className="text-[10px] text-slate-400 block font-medium">Ganancia x Unidad</span>
                                <strong className="text-sm font-mono font-black text-emerald-400">
                                  +{formatPYG(gananciaUnitariaGs)}
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                                <span className="text-[10px] text-slate-400 block font-medium">Total x Display</span>
                                <strong className="text-sm font-mono font-black text-amber-300">
                                  +{formatPYG(gananciaTotalDisplayGs)}
                                </strong>
                              </div>
                            </div>

                            {diferenciaVsDisplayCerrado > 0 && (
                              <p className="text-[11px] text-emerald-400 text-center font-medium pt-1">
                                ✨ Vender fraccionado genera <strong>+{formatPYG(diferenciaVsDisplayCerrado)}</strong> más por display que venderlo cerrado.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              ID o UUID del Producto Unitario <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={existingChildId}
                              onChange={(e) => setExistingChildId(e.target.value)}
                              placeholder="Pegue el ID del producto unitario..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-violet-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Factor de Conversión (Unidades por display) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="2"
                              step="1"
                              required
                              value={existingFactor}
                              onChange={(e) => setExistingFactor(Math.max(2, parseInt(e.target.value) || 2))}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowLinkModal(false)}
                          className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingLink}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-violet-500/20 transition-colors"
                        >
                          {savingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Vincular Display
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
