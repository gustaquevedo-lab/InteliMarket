import { useState, useEffect } from "react"
import { api, type Product, type SupermerRecipe, type SupermerOrder, type SupermerWaste, type SupermerPerishableConfig, type SupermerMarkdown, type SupermerSuggestion, type SupermerDashboard, type SupermerBatch, type SupermerForecast, type ButcheryTemplate, type DesposteResponse, type DesposteCorteResult, type BakeryPlan, type ScaleRecipeResult, type ExecutePlanResult, type ProduceReceiveBatch, type ProduceFreshnessAudit, type ProduceSupplierScorecard, type ProduceDashboard, type AutoApplyMarkdownResult } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, AlertTriangle, TrendingUp, Utensils, Trash2, PackageOpen, ShoppingCart, CheckCircle, XCircle, Eye, EyeOff, BarChart3, Layers, ClipboardList, Sparkles, Beef, Croissant, Apple, X, ChevronRight, Settings, Thermometer, ShieldCheck, Tag, TrendingDown, Wifi, Battery, AlertCircle, Settings2, Gauge, Check, Database, ChefHat, Truck, RotateCcw } from "lucide-react"
import DesposteWizard from "./DesposteWizard"
import RotiseriaTab from "./RotiseriaTab"
import HaccpTab from "./HaccpTab"
import AuditsTab from "./AuditsTab"
import EquipmentTab from "./EquipmentTab"
import DsdTab from "./DsdTab"
import InventoryTab from "./InventoryTab"
import ReplenishmentTab from "./ReplenishmentTab"
import ReturnsTab from "./ReturnsTab"
import { formatPYG } from "../../utils/format"

type Tab = "dashboard" | "recipes" | "orders" | "waste" | "perishables" | "forecast" | "butchery" | "bakery" | "produce" | "licensing" | "esl" | "rotiseria" | "haccp" | "audits" | "equipment" | "dsd" | "inventory" | "replenishment" | "returns"

// ── Mock Seed Data for Demo/Offline Mode ──────────────────────────────
const MOCK_DASHBOARD: any = {
  ordenes_activas: 5,
  ordenes_hoy: 12,
  total_producido_hoy: 450,
  merma_diaria_total: 12.4,
  merma_diaria_porcentaje: 2.7,
  productos_en_markdown: 8,
  productos_por_vencer_30d: 14,
  alertas_criticas: 2,
  sugerencias_pendientes: 4,
  rendimiento_promedio: 94.2,
  forecast_actualizacion: new Date().toISOString()
}

const MOCK_RECIPES: SupermerRecipe[] = [
  { id: "1", nombre: "Pan Felipe Tradicional", area: "panadería", producto_terminado_nombre: "Pan Felipe (Bolsa 500g)", rendimiento_esperado: 95, items: [{}, {}, {}] as any, activa: true },
  { id: "2", nombre: "Mignon Tradicional", area: "panadería", producto_terminado_nombre: "Pan Mignon (kg)", rendimiento_esperado: 92, items: [{}, {}] as any, activa: true },
  { id: "3", nombre: "Prepizza de Tomate", area: "panadería", producto_terminado_nombre: "Prepizza de Tomate c/u", rendimiento_esperado: 98, items: [{}, {}, {}, {}] as any, activa: true },
  { id: "4", nombre: "Medialunas de Manteca", area: "panadería", producto_terminado_nombre: "Medialunas de Manteca (Docena)", rendimiento_esperado: 90, items: [{}, {}, {}] as any, activa: true },
  { id: "5", nombre: "Desposte Cuarto Trasero", area: "carnicería", producto_terminado_nombre: "Cortes Traseros Varios", rendimiento_esperado: 97, items: [{}, {}] as any, activa: true }
]

const MOCK_ORDERS: any[] = [
  { id: "1", receta_nombre: "Pan Felipe Tradicional", area: "panadería", estado: "en_progreso", cantidad_objetivo: 120, producto_obtenido: undefined, rendimiento_real: undefined, created_at: new Date().toISOString(), notas: "Lote matutino" },
  { id: "2", receta_nombre: "Prepizza de Tomate", area: "panadería", estado: "completada", cantidad_objetivo: 50, producto_obtenido: 49, rendimiento_real: 98, created_at: new Date(Date.now() - 3600000).toISOString(), fecha_fin: new Date().toISOString(), notas: "Pedido especial rotisería" },
  { id: "3", receta_nombre: "Desposte Cuarto Trasero", area: "carnicería", estado: "completada", cantidad_objetivo: 150, producto_obtenido: 147.5, rendimiento_real: 98.3, created_at: new Date(Date.now() - 86400000).toISOString(), fecha_fin: new Date(Date.now() - 86400000 + 5400000).toISOString(), notas: "Media res bovina" }
]

const MOCK_BATCHES: SupermerBatch[] = [
  { id: "1", producto_nombre: "Pan Felipe (Bolsa 500g)", lote_codigo: "PAN-20260527-A", cantidad_obtenida: 118, fecha_vencimiento: "2026-05-29", costo_unitario: 3500 },
  { id: "2", producto_nombre: "Carnaza de Segunda", lote_codigo: "CAR-20260526-B", cantidad_obtenida: 85, fecha_vencimiento: "2026-05-31", costo_unitario: 28000 }
]

const MOCK_WASTE: SupermerWaste[] = [
  { id: "1", producto_nombre: "Lechuga Repollada", area: "verdulería", tipo_merma: "merma_natural", cantidad: 4.5, costo_total: 35000, motivo: "Deshidratación natural en góndola", fecha: new Date().toISOString() },
  { id: "2", producto_nombre: "Pan Mignon (kg)", area: "panadería", tipo_merma: "produccion", cantidad: 2.1, costo_total: 18000, motivo: "Exceso de cocción / quemado", fecha: new Date().toISOString() },
  { id: "3", producto_nombre: "Yogur Entero 1L", area: "lácteos", tipo_merma: "vencimiento", cantidad: 6, costo_total: 72000, motivo: "Vencido sin vender", fecha: new Date(Date.now() - 86400000).toISOString() }
]

const MOCK_PERISHABLES: SupermerPerishableConfig[] = [
  { id: "1", producto_nombre: "Frutilla Fresca 500g", categoria_perecedera: "frutas", vida_util_dias: 3, requiere_markdown: true },
  { id: "2", producto_nombre: "Costilla de Primera", categoria_perecedera: "carnes", vida_util_dias: 5, requiere_markdown: true },
  { id: "3", producto_nombre: "Yogur Dietético 200g", categoria_perecedera: "lácteos", vida_util_dias: 21, requiere_markdown: true }
]

const MOCK_MARKDOWNS: SupermerMarkdown[] = [
  { id: "1", producto_nombre: "Frutilla Fresca 500g", descuento_porcentaje: 30, precio_original: 15000, precio_markdown: 10500, fecha_inicio: "2026-05-27", activo: true },
  { id: "2", producto_nombre: "Yogur Dietético 200g", descuento_porcentaje: 50, precio_original: 4800, precio_markdown: 2400, fecha_inicio: "2026-05-26", activo: true }
]

const MOCK_SUGGESTIONS: SupermerSuggestion[] = [
  { id: "1", producto_nombre: "Tomate Perita (kg)", cantidad_stock_actual: 45, cantidad_pronosticada: 120, cantidad_sugerida: 80, lead_time_dias: 1, estado: "pendiente" },
  { id: "2", producto_nombre: "Leche Entera UAT 1L", cantidad_stock_actual: 120, cantidad_pronosticada: 350, cantidad_sugerida: 240, lead_time_dias: 3, estado: "aprobada" }
]

const MOCK_FORECASTS: SupermerForecast[] = [
  { id: "1", producto_nombre: "Tomate Perita (kg)", fecha_pronosticada: "2026-05-28", cantidad_pronosticada: 42.5, confianza: 94 },
  { id: "2", producto_nombre: "Lechuga Repollada", fecha_pronosticada: "2026-05-28", cantidad_pronosticada: 18.2, confianza: 88 },
  { id: "3", producto_nombre: "Pan Felipe (Bolsa 500g)", fecha_pronosticada: "2026-05-28", cantidad_pronosticada: 155, confianza: 97 }
]

const MOCK_BUTCHERY_TEMPLATES: ButcheryTemplate[] = [
  {
    id: "1",
    nombre: "Media Res Bovina Standard",
    especie: "bovino",
    peso_promedio_kg: 180,
    activa: true,
    cuts: [
      { id: "c1", producto_id: "p1", producto_nombre: "Tapa de Cuadril", rendimiento_porcentual: 2.5, precio_ponderado: 48000, es_subproducto: false },
      { id: "c2", producto_id: "p2", producto_nombre: "Carnaza de Primera", rendimiento_porcentual: 35, precio_ponderado: 38000, es_subproducto: false },
      { id: "c3", producto_id: "p3", producto_nombre: "Costilla de Primera", rendimiento_porcentual: 18, precio_ponderado: 29000, es_subproducto: false },
      { id: "c4", producto_id: "p4", producto_nombre: "Vacío", rendimiento_porcentual: 8, precio_ponderado: 34000, es_subproducto: false },
      { id: "c5", producto_id: "p5", producto_nombre: "Grasa y Hueso (Merma)", rendimiento_porcentual: 36.5, precio_ponderado: 1000, es_subproducto: true }
    ] as any
  },
  {
    id: "2",
    nombre: "Desposte Porcino Completo",
    especie: "porcino",
    peso_promedio_kg: 90,
    activa: true,
    cuts: [
      { id: "c6", producto_id: "p6", producto_nombre: "Bondiola de Cerdo", rendimiento_porcentual: 8, precio_ponderado: 32000, es_subproducto: false },
      { id: "c7", producto_id: "p7", producto_nombre: "Panceta con Cuero", rendimiento_porcentual: 15, precio_ponderado: 28000, es_subproducto: false },
      { id: "c8", producto_id: "p8", producto_nombre: "Costillar de Cerdo", rendimiento_porcentual: 20, precio_ponderado: 35000, es_subproducto: false },
      { id: "c9", producto_id: "p9", producto_nombre: "Pernil / Jamón", rendimiento_porcentual: 25, precio_ponderado: 22000, es_subproducto: false },
      { id: "c10", producto_id: "p10", producto_nombre: "Descarte / Cuero / Hueso", rendimiento_porcentual: 32, precio_ponderado: 500, es_subproducto: true }
    ] as any
  },
  {
    id: "3",
    nombre: "Troceado de Pollo Parrillero",
    especie: "pollo",
    peso_promedio_kg: 20,
    activa: true,
    cuts: [
      { id: "c11", producto_id: "p11", producto_nombre: "Pechuga de Pollo", rendimiento_porcentual: 35, precio_ponderado: 24000, es_subproducto: false },
      { id: "c12", producto_id: "p12", producto_nombre: "Muslo Entero", rendimiento_porcentual: 40, precio_ponderado: 15000, es_subproducto: false },
      { id: "c13", producto_id: "p13", producto_nombre: "Alitas de Pollo", rendimiento_porcentual: 12, precio_ponderado: 12000, es_subproducto: false },
      { id: "c14", producto_id: "p14", producto_nombre: "Menudencias y Carcasa", rendimiento_porcentual: 13, precio_ponderado: 2000, es_subproducto: true }
    ] as any
  }
]

const MOCK_YIELD_REPORT = [
  { fecha: "2026-05-27T08:00:00Z", template_nombre: "Media Res Bovina Standard", peso_entrada: 180, peso_obtenido: 178.2, rendimiento: 99, merma_kg: 1.8, merma_porcentaje: 1, costo_total: 4500000 },
  { fecha: "2026-05-26T10:15:00Z", template_nombre: "Desposte Porcino Completo", peso_entrada: 92, peso_obtenido: 89.5, rendimiento: 97.2, merma_kg: 2.5, merma_porcentaje: 2.8, costo_total: 1840000 },
  { fecha: "2026-05-25T07:30:00Z", template_nombre: "Media Res Bovina Standard", peso_entrada: 185, peso_obtenido: 182.1, rendimiento: 98.4, merma_kg: 2.9, merma_porcentaje: 1.6, costo_total: 4625000 },
  { fecha: "2026-05-24T14:00:00Z", template_nombre: "Troceado de Pollo Parrillero", peso_entrada: 20, peso_obtenido: 19.8, rendimiento: 99, merma_kg: 0.2, merma_porcentaje: 1, costo_total: 260000 }
]

const MOCK_BAKERY_PLANS: BakeryPlan[] = [
  {
    id: "1",
    nombre: "Producción Matutina Semanal",
    dia_semana: 7,
    items: [
      { receta_id: "1", receta_nombre: "Pan Felipe Tradicional", cantidad_objetivo: 120, prioridad: 1 },
      { receta_id: "2", receta_nombre: "Mignon Tradicional", cantidad_objetivo: 80, prioridad: 2 },
      { receta_id: "4", receta_nombre: "Medialunas de Manteca", cantidad_objetivo: 240, prioridad: 1 }
    ] as any
  }
]

const MOCK_PRODUCE_DASHBOARD: any = {
  tasa_aceptacion_global: 96.8,
  auditorias_calidad_hoy: 8,
  proveedores_evaluados: 4,
  alertas_frescura: 2
}

const MOCK_PRODUCE_BATCHES: ProduceReceiveBatch[] = [
  { id: "pb1", producto_nombre: "Tomate Perita", proveedor_nombre: "Abasto Central", cantidad_recibida: 200, cantidad_aceptada: 195, calidad: "excelente", precio_unitario: 8500, fecha_recepcion: "2026-05-27", fecha_vencimiento_estimada: "2026-06-03", lote_proveedor: "LOT-TOM-88", nota_calidad: "Muy buena firmeza y madurez" },
  { id: "pb2", producto_nombre: "Banana de Oro", proveedor_nombre: "Frutas del Paraguay S.A.", cantidad_recibida: 150, cantidad_aceptada: 150, calidad: "bueno", precio_unitario: 6000, fecha_recepcion: "2026-05-27", fecha_vencimiento_estimada: "2026-06-01", lote_proveedor: "LOT-BAN-12", nota_calidad: "Color amarillo óptimo para góndola" }
]

const MOCK_PRODUCE_AUDITS: ProduceFreshnessAudit[] = [
  { id: "pa1", producto_nombre: "Tomate Perita", calidad_actual: "bueno", firmeza: 4, color: 4, aspecto_general: 4, notas: "Comenzando a madurar más rápido", fecha_auditoria: "2026-05-27T07:45:00Z" } as any,
  { id: "pa2", producto_nombre: "Lechuga Repollada", calidad_actual: "regular", firmeza: 2, color: 3, aspecto_general: 2, notas: "Hojas externas marchitas, requiere limpieza", fecha_auditoria: "2026-05-27T07:50:00Z" } as any
]

const MOCK_PRODUCE_SCORECARDS: any[] = [
  { id: "s1", proveedor_nombre: "Abasto Central", calidad_promedio: "excelente", cantidad_total_recibida: 1500, cantidad_total_aceptada: 1480, tasa_aceptacion: 98.7 },
  { id: "s2", proveedor_nombre: "Frutas del Paraguay S.A.", calidad_promedio: "bueno", cantidad_total_recibida: 1200, cantidad_total_aceptada: 1150, tasa_aceptacion: 95.8 }
]

export default function SupermerPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<SupermerDashboard>(MOCK_DASHBOARD)
  const [recipes, setRecipes] = useState<SupermerRecipe[]>(MOCK_RECIPES)
  const [orders, setOrders] = useState<SupermerOrder[]>(MOCK_ORDERS)
  const [batches, setBatches] = useState<SupermerBatch[]>(MOCK_BATCHES)
  const [wasteLogs, setWasteLogs] = useState<SupermerWaste[]>(MOCK_WASTE)
  const [perishableConfigs, setPerishableConfigs] = useState<SupermerPerishableConfig[]>(MOCK_PERISHABLES)
  const [markdowns, setMarkdowns] = useState<SupermerMarkdown[]>(MOCK_MARKDOWNS)
  const [suggestions, setSuggestions] = useState<SupermerSuggestion[]>(MOCK_SUGGESTIONS)
  const [forecasts, setForecasts] = useState<SupermerForecast[]>(MOCK_FORECASTS)
  const [butcheryTemplates, setButcheryTemplates] = useState<ButcheryTemplate[]>(MOCK_BUTCHERY_TEMPLATES)
  const [desposteResult, setDesposteResult] = useState<DesposteResponse | null>(null)
  const [butcheryOrders, setButcheryOrders] = useState<SupermerOrder[]>(MOCK_ORDERS.filter(o => o.area === "carnicería"))
  const [yieldReport, setYieldReport] = useState<any[]>(MOCK_YIELD_REPORT)
  const [bakeryPlans, setBakeryPlans] = useState<BakeryPlan[]>(MOCK_BAKERY_PLANS)
  const [scaleResult, setScaleResult] = useState<ScaleRecipeResult | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecutePlanResult | null>(null)
  const [produceBatches, setProduceBatches] = useState<ProduceReceiveBatch[]>(MOCK_PRODUCE_BATCHES)
  const [produceAudits, setProduceAudits] = useState<ProduceFreshnessAudit[]>(MOCK_PRODUCE_AUDITS)
  const [produceScorecards, setProduceScorecards] = useState<ProduceSupplierScorecard[]>(MOCK_PRODUCE_SCORECARDS)
  const [produceDashboard, setProduceDashboard] = useState<ProduceDashboard>(MOCK_PRODUCE_DASHBOARD)
  const [markdownByBatchResult, setMarkdownByBatchResult] = useState<AutoApplyMarkdownResult | null>(null)
  const [enhancedForecast, setEnhancedForecast] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState<string | null>(null)
  const [enterpriseConfig, setEnterpriseConfig] = useState({ esl: false, freshness: false, coldChain: false, batchMarkdown: false })
  const toast = useToast()

  useEffect(() => {
    fetchAll()
  }, [tab])

  useEffect(() => {
    const handleUnlock = (e: Event) => {
      const customEvent = e as CustomEvent
      const key = customEvent.detail
      setEnterpriseConfig(prev => ({ ...prev, [key]: true }))
      toast.success("Módulo Enterprise Activado", "Se ha desbloqueado la característica en tiempo real.")
    }
    window.addEventListener("unlock-feature", handleUnlock)
    return () => window.removeEventListener("unlock-feature", handleUnlock)
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []
      if (tab === "dashboard") promises.push(api.supermer.dashboard().then(setDashboard))
      if (tab === "recipes") promises.push(api.supermer.recipes.list().then(setRecipes))
      if (tab === "orders") {
        promises.push(api.supermer.orders.list().then(setOrders))
        promises.push(api.supermer.batches.list().then(setBatches))
      }
      if (tab === "waste") promises.push(api.supermer.waste.list().then(setWasteLogs))
      if (tab === "perishables") {
        promises.push(api.supermer.perishableConfigs.list().then(setPerishableConfigs))
        promises.push(api.supermer.markdowns.list().then(setMarkdowns))
      }
      if (tab === "forecast") {
        promises.push(api.supermer.suggestions.list().then(setSuggestions))
        promises.push(api.supermer.forecasts.list().then(setForecasts))
      }
      if (tab === "butchery") {
        promises.push(api.supermer.butchery.templates.list().then(setButcheryTemplates))
        promises.push(api.supermer.butchery.orders().then(setButcheryOrders))
        promises.push(api.supermer.butchery.yieldReport().then(setYieldReport))
      }
      if (tab === "bakery") {
        promises.push(api.supermer.bakery.plans().then(setBakeryPlans))
      }
      if (tab === "produce") {
        promises.push(api.supermer.produce.dashboard().then(setProduceDashboard))
        promises.push(api.supermer.produce.receiveBatches.list().then(setProduceBatches))
        promises.push(api.supermer.produce.freshness.list().then(setProduceAudits))
        promises.push(api.supermer.produce.scorecards.list().then(setProduceScorecards))
      }
      await Promise.all(promises.map(p => p.catch(e => console.warn("Demo fetch warning:", e))))
    } catch (e: any) {
      console.error("Supermer fetch error:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteOrder = async (id: string, obtained: number, expiry?: string) => {
    try {
      await api.supermer.orders.complete(id, { producto_obtenido: obtained, fecha_vencimiento: expiry })
      toast.success("Orden completada", "Lote generado automáticamente")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleMarkdownAuto = async () => {
    try {
      const res = await api.supermer.markdowns.autoApply()
      toast.success("Markdowns automáticos", res.detail)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleGenerateForecast = async () => {
    try {
      const res = await api.supermer.forecasts.generate()
      toast.success("Forecast", res.detail)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleGenerateSuggestions = async () => {
    try {
      const res = await api.supermer.suggestions.generate()
      toast.success("Sugerencias", res.detail)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleApproveSuggestion = async (id: string) => {
    try {
      await api.supermer.suggestions.update(id, { estado: "aprobada" })
      toast.success("Sugerencia aprobada")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "recipes", l: "Recetas", i: Utensils },
    { k: "butchery", l: "Carnicería", i: Beef },
    { k: "bakery", l: "Panadería", i: Croissant },
    { k: "produce", l: "Verdulería", i: Apple },
    { k: "orders", l: "Producción", i: Layers },
    { k: "waste", l: "Mermas", i: Trash2 },
    { k: "perishables", l: "Perecederos", i: AlertTriangle },
    { k: "forecast", l: "Pronóstico", i: TrendingUp },
    { k: "rotiseria", l: "Rotisería", i: ChefHat },

    { k: "haccp", l: "HACCP", i: ShieldCheck },

    { k: "audits", l: "Auditorías", i: ClipboardList },

    { k: "equipment", l: "Equipos", i: Settings },

    { k: "dsd", l: "Recepción DSD", i: Truck },

    { k: "inventory", l: "Inventario", i: Layers },

    { k: "replenishment", l: "Reposición", i: TrendingUp },

    { k: "returns", l: "Devoluciones", i: RotateCcw },

  ]
  if (enterpriseConfig.esl) {
    tabs.push({ k: "esl", l: "Etiquetas ESL", i: Sparkles })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* WOW Effect Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-blue-600 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-blue-300 opacity-20 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
              <Sparkles className="w-4 h-4" />
              Versión: Supermercado
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
              Centro de Operaciones
            </h1>
            <p className="text-primary-50 text-lg mt-3 font-medium max-w-xl opacity-90">
              Gestión inteligente de producción, mermas, perecederos y pronósticos potenciados por InteliMarket.
            </p>
          </div>
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Rendimiento</p>
              <p className="text-white text-2xl font-bold">98.5%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
              tab === t.k 
                ? "bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-100" 
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:scale-[1.02]"
            }`}>
            {tab === t.k && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
            <t.i className={`w-3.5 h-3.5 relative z-10 transition-transform ${tab === t.k ? "scale-110" : ""}`} />
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && <DashboardTab data={dashboard} />}
          {tab === "recipes" && <RecipesTab data={recipes} search={search} setSearch={setSearch} loading={loading} fetchAll={fetchAll} />}
          {tab === "orders" && <OrdersTab orders={orders} batches={batches} search={search} setSearch={setSearch} onComplete={handleCompleteOrder} fetchAll={fetchAll} />}
          {tab === "waste" && <WasteTab data={wasteLogs} search={search} setSearch={setSearch} fetchAll={fetchAll} />}
          {tab === "perishables" && <PerishablesTab configs={perishableConfigs} markdowns={markdowns} onAutoMarkdown={handleMarkdownAuto} fetchAll={fetchAll} enterpriseConfig={enterpriseConfig} />}
          {tab === "forecast" && <ForecastTab suggestions={suggestions} forecasts={forecasts} search={search} setSearch={setSearch} onGenerateForecast={handleGenerateForecast} onGenerateSuggestions={handleGenerateSuggestions} onApproveSuggestion={handleApproveSuggestion} />}
          {tab === "bakery" && <BakeryTab />}
          {tab === "butchery" && <ButcheryTab templates={butcheryTemplates} orders={butcheryOrders} yieldReport={yieldReport} desposteResult={desposteResult} setDesposteResult={setDesposteResult} fetchAll={fetchAll} enterpriseConfig={enterpriseConfig} />}
          {tab === "produce" && <ProduceTab batches={produceBatches} audits={produceAudits} scorecards={produceScorecards} dashboard={produceDashboard} markdownResult={markdownByBatchResult} setMarkdownResult={setMarkdownByBatchResult} enhancedForecast={enhancedForecast} setEnhancedForecast={setEnhancedForecast} fetchAll={fetchAll} enterpriseConfig={enterpriseConfig} />}
          {tab === "rotiseria" && <RotiseriaTab />}
          {tab === "haccp" && <HaccpTab />}
          {tab === "audits" && <AuditsTab />}
          {tab === "equipment" && <EquipmentTab />}
          {tab === "dsd" && <DsdTab />}
          {tab === "inventory" && <InventoryTab />}
          {tab === "replenishment" && <ReplenishmentTab />}
          {tab === "returns" && <ReturnsTab />}
          {tab === "licensing" && <LicensingTab config={enterpriseConfig} setConfig={setEnterpriseConfig} />}
          {tab === "esl" && <ESLTab />}
        </>
      )}
    </div>
  )
}

function DashboardTab({ data }: { data: SupermerDashboard }) {
  const toast = useToast()
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

  const cards = [
    { label: "Órdenes activas", value: data.ordenes_activas ?? 0, icon: Layers, color: "text-blue-600" },
    { label: "Órdenes hoy", value: data.ordenes_hoy ?? 0, icon: ClipboardList, color: "text-green-600" },
    { label: "Producido hoy", value: `${data.total_producido_hoy ?? 0}`, icon: PackageOpen, color: "text-purple-600" },
    { label: "Merma diaria", value: `${data.merma_diaria_total ?? 0}`, sub: `${data.merma_diaria_porcentaje ?? 0}%`, icon: Trash2, color: "text-red-600" },
    { label: "En markdown", value: data.productos_en_markdown ?? 0, icon: Sparkles, color: "text-amber-600" },
    { label: "Por vencer (30d)", value: data.productos_por_vencer_30d ?? 0, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Alertas críticas", value: data.alertas_criticas ?? 0, icon: XCircle, color: "text-red-700" },
    { label: "Sugerencias pend.", value: data.sugerencias_pendientes ?? 0, icon: ShoppingCart, color: "text-indigo-600" },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-700">
        {cards.map((c, i) => (
          <div key={i} className="group relative bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1 overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 ${c.color}`} />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{c.label}</span>
              <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 shadow-inner group-hover:bg-opacity-80 transition-colors ${c.color}`}>
                <c.icon className="w-6 h-6" />
              </div>
            </div>
            <div className={`text-4xl font-extrabold tracking-tight relative z-10 ${c.color}`}>{c.value}</div>
            {c.sub && <div className="text-sm font-semibold text-gray-400 dark:text-gray-500 mt-2 relative z-10 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{c.sub} vs ayer</div>}
          </div>
        ))}
        {data.rendimiento_promedio != null && (
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 col-span-full md:col-span-2 shadow-lg border border-slate-700 overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-4 bg-primary/20 rounded-2xl backdrop-blur-md border border-primary/30">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">Rendimiento global de producción</span>
                <div className="text-3xl font-extrabold text-white flex items-end gap-2">
                  {Number(data.rendimiento_promedio).toFixed(1)}%
                  <span className="text-sm text-green-400 font-medium mb-1">+2.4% <TrendingUp className="w-3 h-3 inline" /></span>
                </div>
              </div>
            </div>
            {data.forecast_actualizacion && (
              <div className="text-xs text-slate-500 mt-4 relative z-10 font-medium flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> Inteligencia Artificial actualizada: {new Date(data.forecast_actualizacion).toLocaleString("es-PY")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Waste-to-Margin AI Rescue Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3" /> Asistente IA Activo
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
                        <AlertTriangle className="w-3 h-3" /> {r.motivo}
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
    </div>
  )
}

function RecipesTab({ data, search, setSearch, loading, fetchAll }: { data: SupermerRecipe[]; search: string; setSearch: (s: string) => void; loading: boolean; fetchAll: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  
  // Form State & Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formArea, setFormArea] = useState("panadería")
  const [formNombre, setFormNombre] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formFinalProdId, setFormFinalProdId] = useState("")
  const [formQty, setFormQty] = useState("1")
  const [formUnit, setFormUnit] = useState("UN")
  const [formYield, setFormYield] = useState("100")
  const [formItems, setFormItems] = useState<{ producto_id: string; cantidad: string; unidad_medida: string; es_opcional: boolean }[]>([])
  
  const toast = useToast()

  useEffect(() => {
    if (showModal) {
      api.products.list({ activo: true })
        .then(setProducts)
        .catch(err => {
          console.warn("Error loading products", err)
          setProducts([
            { id: "p_harina", sku: "INS-001", nombre: "Harina de Trigo 000 (kg)" },
            { id: "p_levadura", sku: "INS-002", nombre: "Levadura Seca (kg)" },
            { id: "p_grasa", sku: "INS-003", nombre: "Grasa Vacuna Refinada (kg)" },
            { id: "p_sal", sku: "INS-004", nombre: "Sal Entrefina (kg)" },
            { id: "p_pan_felipe", sku: "PROD-101", nombre: "Pan Felipe (Bolsa 500g)" },
            { id: "p_mignon", sku: "PROD-102", nombre: "Pan Mignon (kg)" },
            { id: "p_prepizza", sku: "PROD-103", nombre: "Prepizza de Tomate c/u" }
          ])
        })
    }
  }, [showModal])

  const filtered = data.filter(r => !search || r.nombre?.toLowerCase().includes(search.toLowerCase()) || r.area?.includes(search))

  const handleAddItem = () => {
    setFormItems([...formItems, { producto_id: "", cantidad: "1", unidad_medida: "UN", es_opcional: false }])
  }

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, key: string, value: any) => {
    setFormItems(formItems.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  const handleEditClick = (recipe: SupermerRecipe) => {
    setIsEditing(true)
    setEditingId(recipe.id)
    setFormArea(recipe.area || "panadería")
    setFormNombre(recipe.nombre || "")
    setFormDesc(recipe.descripcion || "")
    setFormFinalProdId(recipe.producto_terminado_id || "")
    setFormQty(recipe.cantidad_esperada?.toString() || "1")
    setFormUnit(recipe.unidad_medida || "UN")
    setFormYield(recipe.rendimiento_esperado?.toString() || "100")
    
    // Map items
    if (recipe.items) {
      setFormItems(recipe.items.map(it => ({
        producto_id: it.producto_id || "",
        cantidad: it.cantidad?.toString() || "1",
        unidad_medida: it.unidad_medida || "UN",
        es_opcional: !!it.es_opcional
      })))
    } else {
      setFormItems([])
    }
    
    setShowModal(true)
  }

  const handleApprove = async (id: string, currentDesc: string) => {
    try {
      const nowStr = new Date().toLocaleString("es-PY")
      const updatedAudit = `${currentDesc}\n[${nowStr} - APROBADO por Supervisor]: Receta validada y autorizada para producción.`
      await api.supermer.recipes.update(id, { activa: true, descripcion: updatedAudit })
      toast.success("Receta Aprobada", "La receta ha sido autorizada para producción activa.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo aprobar la receta.")
    }
  }

  const handleDeactivate = async (id: string, currentDesc: string) => {
    try {
      const nowStr = new Date().toLocaleString("es-PY")
      const updatedAudit = `${currentDesc}\n[${nowStr} - DESACTIVADO por Supervisor]: Receta retirada de producción.`
      await api.supermer.recipes.update(id, { activa: false, descripcion: updatedAudit })
      toast.success("Receta Desactivada", "La receta ya no estará disponible para nuevas órdenes de producción.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo desactivar la receta.")
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar permanentemente esta receta?")) return
    try {
      await api.supermer.recipes.delete(id)
      toast.success("Receta Eliminada", "Registro eliminado del sistema.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo eliminar la receta.")
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre) {
      toast.error("Error de Validación", "El nombre de la receta es obligatorio.")
      return
    }
    if (!formFinalProdId) {
      toast.error("Error de Validación", "Debes seleccionar un producto terminado.")
      return
    }
    if (formItems.length === 0) {
      toast.error("Error de Validación", "Debes agregar al menos un insumo o ingrediente a la receta.")
      return
    }
    if (formItems.some(i => !i.producto_id || Number(i.cantidad) <= 0)) {
      toast.error("Error de Validación", "Todos los insumos deben tener un producto seleccionado y una cantidad mayor a cero.")
      return
    }

    setSaving(true)
    const nowStr = new Date().toLocaleString("es-PY")
    
    try {
      if (isEditing && editingId) {
        // Edit flow
        const updatedAudit = `${formDesc}\n[${nowStr} - EDITADO]: Ajuste de ingredientes. Requiere re-aprobación técnica.`
        await api.supermer.recipes.update(editingId, {
          nombre: formNombre,
          descripcion: updatedAudit,
          cantidad_esperada: Number(formQty),
          rendimiento_esperado: Number(formYield),
          activa: false, // Force re-approval on edit!
          items: formItems.map(i => ({
            producto_id: i.producto_id,
            cantidad: Number(i.cantidad),
            unidad_medida: i.unidad_medida,
            es_opcional: i.es_opcional
          }))
        })
        toast.success("Receta Editada", "Los cambios han sido guardados. La receta requiere aprobación para ser usada.")
      } else {
        // Create flow
        const initialAudit = `${formDesc}\n[${nowStr} - CREADO]: Receta registrada. Pendiente de aprobación técnica.`
        await api.supermer.recipes.create({
          area: formArea,
          nombre: formNombre,
          descripcion: initialAudit,
          producto_terminado_id: formFinalProdId,
          cantidad_esperada: Number(formQty),
          unidad_medida: formUnit,
          rendimiento_esperado: Number(formYield),
          items: formItems.map(i => ({
            producto_id: i.producto_id,
            cantidad: Number(i.cantidad),
            unidad_medida: i.unidad_medida,
            es_opcional: i.es_opcional
          }))
        })
        toast.success("Receta Guardada", "La receta ha sido creada y enviada a flujo de aprobación.")
      }
      
      setShowModal(false)
      setIsEditing(false)
      setEditingId(null)
      
      // Reset State
      setFormNombre("")
      setFormDesc("")
      setFormFinalProdId("")
      setFormQty("1")
      setFormUnit("UN")
      setFormYield("100")
      setFormItems([])
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo guardar la receta.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar receta por nombre o área..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setIsEditing(false); setShowModal(true) }} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Nueva Receta
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Receta</th>
              <th className="p-4">Área</th>
              <th className="p-4">Producto Terminado</th>
              <th className="p-4 text-right">Rendimiento</th>
              <th className="p-4 text-center">Insumos</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{r.nombre}</div>
                  <div className="text-[10px] text-gray-400 max-w-xs truncate" title={r.descripcion || ""}>
                    {r.descripcion?.split("\n").filter(Boolean).pop() || "Sin historial"}
                  </div>
                </td>
                <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{r.area}</span></td>
                <td className="p-4 text-gray-600 dark:text-gray-300">{r.producto_terminado_nombre || "N/A"}</td>
                <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{Number(r.rendimiento_esperado ?? 0).toFixed(0)}%</td>
                <td className="p-4 text-center font-semibold text-gray-500">{r.items?.length ?? 0} ítems</td>
                <td className="p-4">
                  <div className="flex flex-col items-center justify-center gap-1">
                    {r.activa ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Activa</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendiente</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    {!r.activa ? (
                      <>
                        <button onClick={() => handleApprove(r.id, r.descripcion || "")} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-0.5 shadow-sm">
                          <Check className="w-3.5 h-3.5" /> Aprobar
                        </button>
                        <button onClick={() => handleEditClick(r)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2 py-1 rounded-lg transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditClick(r)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2.5 py-1 rounded-lg transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleDeactivate(r.id, r.descripcion || "")} className="text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/10 dark:text-red-400 font-bold px-2 py-1 rounded-lg transition-colors">
                          Desactivar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 font-medium">
                  <Utensils className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No se encontraron recetas configuradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }}>
          <div className="modal-content max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" />
                {isEditing ? "Editar Receta (Requiere Aprobación)" : "Crear Nueva Receta"}
              </h3>
              <button onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required font-bold">Área de Producción</label>
                  <select className="input-field mt-1" value={formArea} onChange={e => setFormArea(e.target.value)} disabled={isEditing}>
                    <option value="panadería">Panadería 🥐</option>
                    <option value="carnicería">Carnicería 🥩</option>
                    <option value="rotisería">Rotisería 🍗</option>
                    <option value="pre_pack">Pre-Pack 📦</option>
                    <option value="otros">Otros 🏷️</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required font-bold">Nombre de la Receta</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. Pan Mignon Casero de la Casa" value={formNombre} onChange={e => setFormNombre(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="input-label font-bold">Descripción / Notas de Aprobación</label>
                <textarea className="input-field mt-1 min-h-[80px]" placeholder="Detalles de elaboración o justificación del cambio técnico..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>

              <div className="p-4 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50 pb-2">Producto Terminado Generado</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="input-label label-required font-bold">Seleccionar Producto</label>
                    <select className="input-field mt-1" value={formFinalProdId} onChange={e => setFormFinalProdId(e.target.value)} required disabled={isEditing}>
                      <option value="">-- Seleccionar --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label label-required font-bold">Cantidad Producida</label>
                    <input className="input-field mt-1" type="number" min="0.001" step="any" value={formQty} onChange={e => setFormQty(e.target.value)} required />
                  </div>
                  <div>
                    <label className="input-label font-bold">Unidad / Rendimiento %</label>
                    <div className="flex gap-2 mt-1">
                      <input className="input-field w-20 text-center" type="text" value={formUnit} onChange={e => setFormUnit(e.target.value)} placeholder="UN" disabled={isEditing} />
                      <input className="input-field text-right" type="number" min="1" max="100" value={formYield} onChange={e => setFormYield(e.target.value)} placeholder="100" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Insumos y Materias Primas</h4>
                  <button type="button" onClick={handleAddItem} className="btn-outline py-1 px-3 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                  </button>
                </div>

                {formItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 bg-gray-50/50 dark:bg-slate-800/10 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    No has agregado ingredientes. Haz clic en "Agregar Insumo".
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-3.5 bg-gray-50/50 dark:bg-slate-800/20 rounded-xl border border-gray-200/40 dark:border-gray-700/40">
                        <div className="flex-1">
                          <select className="input-field w-full" value={item.producto_id} onChange={e => handleUpdateItem(idx, "producto_id", e.target.value)} required>
                            <option value="">-- Seleccionar Insumo --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full sm:w-28">
                          <input className="input-field w-full text-center" type="number" min="0.001" step="any" placeholder="Cant." value={item.cantidad} onChange={e => handleUpdateItem(idx, "cantidad", e.target.value)} required />
                        </div>
                        <div className="w-full sm:w-20">
                          <input className="input-field w-full text-center" type="text" placeholder="U.M." value={item.unidad_medida} onChange={e => handleUpdateItem(idx, "unidad_medida", e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs font-bold text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={item.es_opcional} onChange={e => handleUpdateItem(idx, "es_opcional", e.target.checked)} className="rounded text-primary focus:ring-primary w-4 h-4" />
                            Opcional
                          </label>
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors ml-auto">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }} className="btn-ghost py-2 px-5 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="btn-primary py-2 px-6 rounded-xl font-bold flex items-center gap-2" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Receta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function OrdersTab({ orders, batches, search, setSearch, onComplete, fetchAll }: { orders: SupermerOrder[]; batches: SupermerBatch[]; search: string; setSearch: (s: string) => void; onComplete: (id: string, obtained: number, expiry?: string) => void; fetchAll: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [recipes, setRecipes] = useState<SupermerRecipe[]>([])
  const [selectedOrder, setSelectedOrder] = useState<SupermerOrder | null>(null)
  
  // Complete Order Form State
  const [completeQty, setCompleteQty] = useState("")
  const [completeExpiry, setCompleteExpiry] = useState("")
  
  // Create Order Form State
  const [formRecipeId, setFormRecipeId] = useState("")
  const [formQty, setFormQty] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formArea, setFormArea] = useState("panadería")
  
  // Edit Order Form State
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [saving, setSaving] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState<SupermerOrder | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (showModal) {
      api.supermer.recipes.list({ activa: true })
        .then(setRecipes)
        .catch(err => console.warn("Error loading active recipes", err))
    }
  }, [showModal])

  // Automatically update area when recipe is selected
  useEffect(() => {
    if (formRecipeId) {
      const rec = recipes.find(r => r.id === formRecipeId)
      if (rec && rec.area) {
        setFormArea(rec.area)
      }
    }
  }, [formRecipeId, recipes])

  const filteredOrders = orders.filter(o => 
    !search || 
    o.receta_nombre?.toLowerCase().includes(search.toLowerCase()) || 
    o.area?.toLowerCase().includes(search.toLowerCase()) ||
    o.notas?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRecipeId || !formQty) {
      toast.error("Validación", "Debes seleccionar una receta y una cantidad objetivo.")
      return
    }

    const rec = recipes.find(r => r.id === formRecipeId)
    if (!rec) return

    setSaving(true)
    const nowStr = new Date().toLocaleString("es-PY")
    const auditNotes = `[${nowStr} - CREADO]: Orden planificada para ${formQty} ${rec.unidad_medida || "UN"}.\n${formNotes}`

    try {
      if (isEditing && editingId) {
        const currentOrder = orders.find(o => o.id === editingId)
        const oldQty = currentOrder?.cantidad_objetivo || 0
        const updatedAudit = `${currentOrder?.notas}\n[${nowStr} - EDITADA]: Cantidad modificada de ${oldQty} a ${formQty}.`
        await api.supermer.orders.update(editingId, {
          cantidad_objetivo: Number(formQty),
          notas: updatedAudit
        })
        toast.success("Orden Actualizada", "Los cambios han sido guardados correctamente.")
      } else {
        await api.supermer.orders.create({
          receta_id: formRecipeId,
          receta_nombre: rec.nombre,
          area: formArea,
          cantidad_objetivo: Number(formQty),
          estado: "planificada",
          notas: auditNotes
        })
        toast.success("Orden Planificada", "La orden de producción ha sido enviada al flujo de aprobación.")
      }
      setShowModal(false)
      setIsEditing(false)
      setEditingId(null)
      setFormRecipeId("")
      setFormQty("")
      setFormNotes("")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo guardar la orden.")
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = (order: SupermerOrder) => {
    setIsEditing(true)
    setEditingId(order.id)
    setFormRecipeId(order.receta_id || "")
    setFormQty(order.cantidad_objetivo?.toString() || "")
    setFormNotes("")
    setFormArea(order.area || "panadería")
    setShowModal(true)
  }

  const handleApproveAndStart = async (order: SupermerOrder) => {
    const nowStr = new Date().toLocaleString("es-PY")
    const updatedNotes = `${order.notas || ""}\n[${nowStr} - APROBADO por Supervisor]: Orden autorizada e iniciada en planta.`
    try {
      await api.supermer.orders.update(order.id, {
        estado: "en_progreso",
        notas: updatedNotes
      })
      toast.success("Orden Iniciada", "La producción está ahora en curso.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo iniciar la orden.")
    }
  }

  const handleCancelOrder = async (order: SupermerOrder) => {
    const motive = window.prompt("Ingrese el motivo de la cancelación de la orden:")
    if (motive === null) return // Canceled prompt
    if (!motive.trim()) {
      toast.error("Error", "Debes ingresar un motivo de cancelación.")
      return
    }

    const nowStr = new Date().toLocaleString("es-PY")
    const updatedNotes = `${order.notas || ""}\n[${nowStr} - CANCELADO por Supervisor]: Motivo: ${motive}`
    try {
      await api.supermer.orders.update(order.id, {
        estado: "cancelada",
        notas: updatedNotes
      })
      toast.success("Orden Cancelada", "La orden de producción ha sido cancelada.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo cancelar la orden.")
    }
  }

  const openCompleteModal = (order: SupermerOrder) => {
    setSelectedOrder(order)
    setCompleteQty(order.cantidad_objetivo?.toString() || "")
    const defaultExpiry = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0] // default 2 days
    setCompleteExpiry(defaultExpiry)
    setShowCompleteModal(true)
  }

  const submitComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder || !completeQty) return
    try {
      await onComplete(selectedOrder.id, Number(completeQty), completeExpiry || undefined)
      setShowCompleteModal(false)
      setSelectedOrder(null)
    } catch (err) {}
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar orden por receta, área o notas..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setIsEditing(false); setShowModal(true) }} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Planificar Producción
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Orden de Producción</th>
              <th className="p-4">Área</th>
              <th className="p-4 text-right">Cant. Objetivo</th>
              <th className="p-4 text-right">Rendimiento Real</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredOrders.map(o => {
              const latestLog = o.notas?.split("\n").filter(Boolean).pop() || "Sin logs de auditoría";
              return (
                <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {o.receta_nombre}
                      <button onClick={() => setShowAuditModal(o)} className="text-[10px] text-gray-400 hover:text-primary transition-colors flex items-center gap-0.5 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                        <ClipboardList className="w-3 h-3" /> Historial
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 max-w-xs truncate" title={o.notas || ""}>
                      {latestLog}
                    </div>
                  </td>
                  <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{o.area}</span></td>
                  <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">{Number(o.cantidad_objetivo ?? 0).toFixed(0)}</td>
                  <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                    {o.rendimiento_real != null ? `${Number(o.rendimiento_real).toFixed(1)}%` : "-"}
                  </td>
                  <td className="p-4 text-center">
                    {o.estado === "planificada" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Planificada
                      </span>
                    )}
                    {o.estado === "en_progreso" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> En Progreso
                      </span>
                    )}
                    {o.estado === "completada" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1">
                        <Check className="w-3 h-3" /> Completada
                      </span>
                    )}
                    {o.estado === "cancelada" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 items-center gap-1">
                        <X className="w-3 h-3" /> Cancelada
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {o.estado === "planificada" && (
                        <>
                          <button onClick={() => handleApproveAndStart(o)} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 rounded-lg transition-colors shadow-sm flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Iniciar
                          </button>
                          <button onClick={() => handleEditClick(o)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2 py-1 rounded-lg transition-colors">
                            Editar
                          </button>
                          <button onClick={() => handleCancelOrder(o)} className="text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/10 dark:text-red-400 font-bold px-2 py-1 rounded-lg transition-colors">
                            Cancelar
                          </button>
                        </>
                      )}
                      {o.estado === "en_progreso" && (
                        <button onClick={() => openCompleteModal(o)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-sm">
                          Completar Lote
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">
                  <Layers className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No se encontraron órdenes de producción
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW ORDER / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                {isEditing ? "Editar Cantidad de Orden" : "Planificar Nueva Orden de Producción"}
              </h3>
              <button onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div>
                <label className="input-label label-required font-bold">Seleccionar Receta Activa</label>
                <select className="input-field mt-1" value={formRecipeId} onChange={e => setFormRecipeId(e.target.value)} required disabled={isEditing}>
                  <option value="">-- Seleccionar Receta --</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre} ({r.area})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label font-bold">Área de Trabajo</label>
                  <input className="input-field mt-1 bg-gray-100 dark:bg-slate-800 cursor-not-allowed" type="text" value={formArea.toUpperCase()} disabled />
                </div>
                <div>
                  <label className="input-label label-required font-bold">Cantidad Objetivo</label>
                  <input className="input-field mt-1" type="number" min="1" placeholder="Ej. 120" value={formQty} onChange={e => setFormQty(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="input-label font-bold">Instrucciones o Notas de Producción</label>
                <textarea className="input-field mt-1 min-h-[80px]" placeholder="Instrucciones para el maestro pastelero o especificaciones de ingredientes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} disabled={isEditing} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => { setShowModal(false); setIsEditing(false); setEditingId(null); }} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? "Guardar Ajustes" : "Enviar a Planificación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETION MODAL */}
      {showCompleteModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => { setShowCompleteModal(false); setSelectedOrder(null); }}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Finalizar Producción y Crear Lote</h3>
              <button onClick={() => { setShowCompleteModal(false); setSelectedOrder(null); }} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={submitComplete} className="p-6 space-y-4">
              <div>
                <label className="input-label label-required font-bold">Cantidad Real Obtenida (Física)</label>
                <input className="input-field mt-1" type="number" step="any" min="0.01" value={completeQty} onChange={e => setCompleteQty(e.target.value)} required />
                <p className="text-[10px] text-gray-400 mt-1">Objetivo planificado: {selectedOrder.cantidad_objetivo}</p>
              </div>

              <div>
                <label className="input-label font-bold">Fecha de Vencimiento Estimada</label>
                <input className="input-field mt-1" type="date" value={completeExpiry} onChange={e => setCompleteExpiry(e.target.value)} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => { setShowCompleteModal(false); setSelectedOrder(null); }} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold">Registrar Entrada a Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {showAuditModal && (
        <div className="modal-overlay" onClick={() => setShowAuditModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Historial de Trazabilidad y Aprobación
              </h3>
              <button onClick={() => setShowAuditModal(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl">
                <p className="text-xs text-gray-400 uppercase font-bold">Receta</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{showAuditModal.receta_nombre}</p>
              </div>
              
              <div className="relative border-l-2 border-primary/20 dark:border-primary/40 pl-4 ml-2 space-y-4 py-2">
                {showAuditModal.notas?.split("\n").filter(Boolean).map((log, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900" />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{log}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WasteTab({ data, search, setSearch, fetchAll }: { data: SupermerWaste[]; search: string; setSearch: (s: string) => void; fetchAll: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [formProductId, setFormProductId] = useState("")
  const [formArea, setFormArea] = useState("verdulería")
  const [formType, setFormType] = useState("merma_natural")
  const [formQty, setFormQty] = useState("")
  const [formReason, setFormReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState<SupermerWaste | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (showModal) {
      api.products.list({ activo: true })
        .then(setProducts)
        .catch(err => console.warn("Error loading products", err))
    }
  }, [showModal])

  const parseWasteState = (motivo: string = "") => {
    if (motivo.startsWith("[PENDIENTE]")) return "PENDIENTE"
    if (motivo.startsWith("[APROBADA]")) return "APROBADA"
    if (motivo.startsWith("[RECHAZADA]")) return "RECHAZADA"
    return "APROBADA" // Default legacy behavior
  }

  const cleanMotivo = (motivo: string = "") => {
    return motivo.replace(/^\[(PENDIENTE|APROBADA|RECHAZADA)\]\s*/, "")
  }

  const filteredWaste = data.filter(w => 
    !search || 
    w.producto_nombre?.toLowerCase().includes(search.toLowerCase()) || 
    w.area?.toLowerCase().includes(search.toLowerCase()) ||
    w.motivo?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDeclareWaste = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formProductId || !formQty || !formReason) {
      toast.error("Validación", "Todos los campos son requeridos.")
      return
    }

    const prod = products.find(p => p.id === formProductId)
    if (!prod) return

    setSaving(true)
    const nowStr = new Date().toLocaleString("es-PY")
    const auditReason = `[PENDIENTE] ${formReason}\n[${nowStr} - DECLARADA]: Merma reportada por cantidad ${formQty} ${prod.unidad_medida || "kg"}. Pendiente de inspección.`

    try {
      await api.supermer.waste.create({
        producto_id: formProductId,
        producto_nombre: prod.nombre,
        area: formArea,
        tipo_merma: formType,
        cantidad: Number(formQty),
        costo_unitario: prod.costo_promedio || prod.precio_venta || 0,
        motivo: auditReason
      })
      toast.success("Merma Declarada", "La declaración ha sido registrada y enviada a revisión.")
      setShowModal(false)
      setFormProductId("")
      setFormQty("")
      setFormReason("")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo declarar la merma.")
    } finally {
      setSaving(false)
    }
  }

  const handleApproveWaste = async (waste: SupermerWaste) => {
    const nowStr = new Date().toLocaleString("es-PY")
    const cleanReason = cleanMotivo(waste.motivo || "")
    const updatedReason = `[APROBADA] ${cleanReason}\n[${nowStr} - APROBADA por Responsable de Inventario]: Ajuste físico confirmado en stock.`
    try {
      await api.supermer.waste.update(waste.id, {
        motivo: updatedReason
      })
      toast.success("Merma Aprobada", "El descarte ha sido confirmado y descontado.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo aprobar la merma.")
    }
  }

  const handleAdjustWaste = async (waste: SupermerWaste) => {
    const newQtyStr = window.prompt("Ingrese la cantidad corregida para la merma:", waste.cantidad?.toString())
    if (newQtyStr === null) return
    const newQty = Number(newQtyStr)
    if (isNaN(newQty) || newQty <= 0) {
      toast.error("Error", "Debes ingresar una cantidad válida mayor a cero.")
      return
    }

    const nowStr = new Date().toLocaleString("es-PY")
    const cleanReason = cleanMotivo(waste.motivo || "")
    const updatedReason = `[PENDIENTE] ${cleanReason}\n[${nowStr} - AJUSTADA]: Cantidad declarada corregida de ${waste.cantidad} a ${newQty}.`
    try {
      await api.supermer.waste.update(waste.id, {
        cantidad: newQty,
        motivo: updatedReason
      })
      toast.success("Cantidad Ajustada", "La merma ha sido actualizada y sigue en revisión.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo ajustar la cantidad.")
    }
  }

  const handleRejectWaste = async (waste: SupermerWaste) => {
    const motive = window.prompt("Ingrese el motivo del rechazo de la merma:")
    if (motive === null) return
    if (!motive.trim()) {
      toast.error("Error", "Debes ingresar un motivo de rechazo.")
      return
    }

    const nowStr = new Date().toLocaleString("es-PY")
    const cleanReason = cleanMotivo(waste.motivo || "")
    const updatedReason = `[RECHAZADA] ${cleanReason}\n[${nowStr} - RECHAZADA por Responsable]: Motivo: ${motive}`
    try {
      await api.supermer.waste.update(waste.id, {
        motivo: updatedReason
      })
      toast.success("Merma Rechazada", "La merma ha sido rechazada y no afectará los costos operativos.")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo rechazar la merma.")
    }
  }

  const typeColor: Record<string, string> = {
    merma_natural: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    produccion: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    vencimiento: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar merma por producto, área..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Declarar Merma
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Producto / Motivo</th>
              <th className="p-4">Área</th>
              <th className="p-4">Tipo</th>
              <th className="p-4 text-right">Cantidad</th>
              <th className="p-4 text-right">Costo Total</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredWaste.map(w => {
              const state = parseWasteState(w.motivo || "");
              const latestLog = w.motivo?.split("\n").filter(Boolean).pop() || "Sin logs de auditoría";
              return (
                <tr key={w.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {w.producto_nombre}
                      <button onClick={() => setShowAuditModal(w)} className="text-[10px] text-gray-400 hover:text-primary transition-colors flex items-center gap-0.5 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                        <ClipboardList className="w-3 h-3" /> Historial
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 max-w-xs truncate" title={w.motivo || ""}>
                      {cleanMotivo(latestLog)}
                    </div>
                  </td>
                  <td className="p-4 capitalize">{w.area}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColor[w.tipo_merma ?? ""] || "bg-gray-100"}`}>
                      {w.tipo_merma?.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">{Number(w.cantidad ?? 0).toFixed(2)}</td>
                  <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                    {w.costo_total ? formatPYG(w.costo_total) : "-"}
                  </td>
                  <td className="p-4 text-center">
                    {state === "PENDIENTE" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                    {state === "APROBADA" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1">
                        <Check className="w-3 h-3" /> Aprobada
                      </span>
                    )}
                    {state === "RECHAZADA" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 items-center gap-1">
                        <X className="w-3 h-3" /> Rechazada
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {state === "PENDIENTE" && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleApproveWaste(w)} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 rounded-lg shadow-sm transition-colors flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Aprobar
                        </button>
                        <button onClick={() => handleAdjustWaste(w)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2 py-1 rounded-lg transition-colors">
                          Ajustar
                        </button>
                        <button onClick={() => handleRejectWaste(w)} className="text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/10 dark:text-red-400 font-bold px-2 py-1 rounded-lg transition-colors">
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filteredWaste.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 font-medium">
                  <Trash2 className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No hay mermas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DECLARE WASTE MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                Declarar Descarte / Merma
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleDeclareWaste} className="p-6 space-y-4">
              <div>
                <label className="input-label label-required font-bold">Seleccionar Producto</label>
                <select className="input-field mt-1" value={formProductId} onChange={e => setFormProductId(e.target.value)} required>
                  <option value="">-- Seleccionar Producto --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label label-required font-bold">Área de Merma</label>
                  <select className="input-field mt-1" value={formArea} onChange={e => setFormArea(e.target.value)}>
                    <option value="verdulería">Verdulería 🥦</option>
                    <option value="carnicería">Carnicería 🥩</option>
                    <option value="panadería">Panadería 🥐</option>
                    <option value="rotisería">Rotisería 🍗</option>
                    <option value="lácteos">Lácteos 🥛</option>
                    <option value="almacén">Almacén 🥫</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required font-bold">Tipo de Merma</label>
                  <select className="input-field mt-1" value={formType} onChange={e => setFormType(e.target.value)}>
                    <option value="merma_natural">Merma Natural 🌱</option>
                    <option value="produccion">Pérdida en Proceso ⚙️</option>
                    <option value="vencimiento">Vencimiento 📅</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required font-bold">Cantidad</label>
                  <input className="input-field mt-1 text-right" type="number" step="any" min="0.001" placeholder="0.00" value={formQty} onChange={e => setFormQty(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="input-label label-required font-bold">Motivo / Justificación Técnica</label>
                <textarea className="input-field mt-1 min-h-[80px]" placeholder="Ej. Hojas marchitas por falla de humedad, fecha de caducidad superada, rotura de empaque..." value={formReason} onChange={e => setFormReason(e.target.value)} required />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Declarar Merma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {showAuditModal && (
        <div className="modal-overlay" onClick={() => setShowAuditModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Historial de Trazabilidad de Merma
              </h3>
              <button onClick={() => setShowAuditModal(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-xl">
                <p className="text-xs text-gray-400 uppercase font-bold">Producto</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{showAuditModal.producto_nombre}</p>
              </div>

              <div className="relative border-l-2 border-primary/20 dark:border-primary/40 pl-4 ml-2 space-y-4 py-2">
                {showAuditModal.motivo?.split("\n").filter(Boolean).map((log, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-slate-900" />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{cleanMotivo(log)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PerishablesTab({ configs, markdowns, onAutoMarkdown, fetchAll, enterpriseConfig }: { configs: SupermerPerishableConfig[]; markdowns: SupermerMarkdown[]; onAutoMarkdown: () => void; fetchAll: () => void; enterpriseConfig: { batchMarkdown: boolean } }) {
  const [simDays, setSimDays] = useState(3)
  const [simProduct, setSimProduct] = useState("Frutilla Fresca 500g")
  const [simOriginalPrice, setSimOriginalPrice] = useState(15000)

  if (!enterpriseConfig.batchMarkdown) {
    return (
      <UnlockPromo 
        title="Reglas de Markdown Escalonado por Lote"
        desc="Descuentos automáticos y dinámicos decrecientes a medida que se acerca la fecha de vencimiento (-30% a 3 días, -50% a 1 día). Recupera el costo operativo de la mercadería antes de enviarla a merma y maximiza el retorno de inventario."
        featureKey="batchMarkdown"
        competitors={{
          sap: "Requiere desarrollo ABAP a medida y consultoría externa de 4 semanas.",
          oracle: "Módulo complementario con licenciamiento avanzado corporativo complejo."
        }}
      />
    )
  }

  // Calculate simulated price
  const discount = simDays <= 1 ? 50 : simDays <= 3 ? 30 : 0
  const simPrice = simOriginalPrice * (1 - discount / 100)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Dynamic Expiration Simulator Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white border border-slate-700 shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-bl-full -mr-8 -mt-8 blur-xl" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Enterprise Activo
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Simulador de Markdown Escalonado</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Vea cómo actúan las reglas automatizadas de InteliMarket. Descuentos decrecientes en tiempo real para optimizar la salida de lotes antes de la fecha límite de descarte.
            </p>
            
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Producto de Prueba</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={simProduct} 
                  onChange={e => {
                    const val = e.target.value
                    setSimProduct(val)
                    if (val.includes("Frutilla")) setSimOriginalPrice(15000)
                    else if (val.includes("Costilla")) setSimOriginalPrice(48000)
                    else setSimOriginalPrice(8500)
                  }}
                >
                  <option value="Frutilla Fresca 500g">Frutilla Fresca 500g (Original: Gs 15.000)</option>
                  <option value="Costilla de Primera">Costilla de Primera (Original: Gs 48.000)</option>
                  <option value="Yogur Dietético 200g">Yogur Dietético 200g (Original: Gs 8.500)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Días restantes para vencer</label>
                  <span className="font-mono font-bold text-primary text-sm">{simDays} {simDays === 1 ? "día" : "días"}</span>
                </div>
                <input 
                  type="range" min="0" max="6" step="1" 
                  value={simDays} 
                  onChange={e => setSimDays(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold px-1 mt-1">
                  <span>6 días</span>
                  <span>3 días (-30%)</span>
                  <span>1 día (-50%)</span>
                  <span>Vencido</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 backdrop-blur-md rounded-2xl p-6 border border-slate-800 flex flex-col justify-between h-full min-h-[220px]">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estado de Alerta del Lote</span>
              <div className="flex items-center gap-2 mt-2">
                {simDays === 0 ? (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Retirar de Góndola (Merma)
                  </span>
                ) : discount > 0 ? (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <TrendingDown className="w-3.5 h-3.5" /> Descuento Activo de {discount}%
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Estado Óptimo (Precio Full)
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800/80 pt-6">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-slate-400">Precio Original:</span>
                <span className="text-sm font-mono text-slate-500 line-through">{formatPYG(simOriginalPrice)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-slate-300 font-bold">Precio Liquidación ESL:</span>
                <span className={`text-3xl font-extrabold font-mono ${simDays === 0 ? "text-red-500" : discount > 0 ? "text-amber-400" : "text-green-400"}`}>
                  {simDays === 0 ? "Gs 0 (Merma)" : formatPYG(simPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <button onClick={onAutoMarkdown} className="btn-primary flex items-center gap-2"><Sparkles className="w-4 h-4" />Aplicar markdowns automáticos</button>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3">Configuración de perecederos</h3>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3">Producto</th><th className="p-3">Categoría</th><th className="p-3">Vida útil (días)</th><th className="p-3">Markdown auto</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {configs.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="p-3 font-medium">{c.producto_nombre}</td>
                  <td className="p-3 capitalize">{c.categoria_perecedera}</td>
                  <td className="p-3">{c.vida_util_dias}</td>
                  <td className="p-3">{c.requiere_markdown ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                </tr>
              ))}
              {configs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Sin configuración</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3">Markdowns activos</h3>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3">Producto</th><th className="p-3">Dto %</th><th className="p-3">Precio original</th><th className="p-3">Precio markdown</th><th className="p-3">Desde</th><th className="p-3">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {markdowns.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="p-3 font-medium">{m.producto_nombre}</td>
                  <td className="p-3 font-bold text-red-600">-{Number(m.descuento_porcentaje ?? 0).toFixed(0)}%</td>
                  <td className="p-3">Gs {Number(m.precio_original ?? 0).toLocaleString("es-PY")}</td>
                  <td className="p-3 font-semibold">Gs {Number(m.precio_markdown ?? 0).toLocaleString("es-PY")}</td>
                  <td className="p-3 text-sm">{m.fecha_inicio ? new Date(m.fecha_inicio).toLocaleDateString("es-PY") : "-"}</td>
                  <td className="p-3">{m.activo ? <span className="text-green-600 text-xs font-semibold">Activo</span> : <span className="text-gray-400 text-xs">Inactivo</span>}</td>
                </tr>
              ))}
              {markdowns.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin markdowns activos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ForecastTab({ suggestions, forecasts, search, setSearch, onGenerateForecast, onGenerateSuggestions, onApproveSuggestion }: {
  suggestions: SupermerSuggestion[]; forecasts: SupermerForecast[]; search: string; setSearch: (s: string) => void;
  onGenerateForecast: () => void; onGenerateSuggestions: () => void; onApproveSuggestion: (id: string) => void
}) {
  const filtered = suggestions.filter(s => !search || s.producto_nombre?.toLowerCase().includes(search.toLowerCase()) || s.estado?.includes(search))
  const statusColor: Record<string, string> = { pendiente: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20", aprobada: "text-blue-600 bg-blue-50 dark:bg-blue-900/20", pedida: "text-green-600 bg-green-50 dark:bg-green-900/20", cancelada: "text-red-600 bg-red-50 dark:bg-red-900/20" }
  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <button onClick={onGenerateForecast} className="btn-primary flex items-center gap-2"><TrendingUp className="w-4 h-4" />Generar pronóstico</button>
        <button onClick={onGenerateSuggestions} className="btn-secondary flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Generar sugerencias</button>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3">Pronóstico de ventas (30 días)</h3>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3">Producto</th><th className="p-3">Fecha</th><th className="p-3">Cant. pronosticada</th><th className="p-3">Confianza</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {forecasts.slice(0, 50).map(f => (
                <tr key={f.id} className="table-row">
                  <td className="p-3 font-medium">{f.producto_nombre}</td>
                  <td className="p-3 text-sm">{f.fecha_pronosticada ? new Date(f.fecha_pronosticada).toLocaleDateString("es-PY") : "-"}</td>
                  <td className="p-3">{Number(f.cantidad_pronosticada ?? 0).toFixed(2)}</td>
                  <td className="p-3">{f.confianza ? `${Number(f.confianza).toFixed(0)}%` : "-"}</td>
                </tr>
              ))}
              {forecasts.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Sin pronósticos. Generá uno.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Sugerencias de compra</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-10" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3">Producto</th><th className="p-3">Stock actual</th><th className="p-3">Pronosticado</th><th className="p-3">Sugerido</th><th className="p-3">Lead time</th><th className="p-3">Estado</th><th className="p-3">Acción</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="p-3 font-medium">{s.producto_nombre}</td>
                  <td className="p-3">{Number(s.cantidad_stock_actual ?? 0).toFixed(2)}</td>
                  <td className="p-3">{s.cantidad_pronosticada ? Number(s.cantidad_pronosticada).toFixed(2) : "-"}</td>
                  <td className="p-3 font-bold text-primary">{Number(s.cantidad_sugerida ?? 0).toFixed(2)}</td>
                  <td className="p-3">{s.lead_time_dias ? `${s.lead_time_dias}d` : "-"}</td>
                  <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[s.estado ?? ""] || ""}`}>{s.estado}</span></td>
                  <td className="p-3">
                    {s.estado === "pendiente" && (
                      <button onClick={() => onApproveSuggestion(s.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">
                        Aprobar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin sugerencias</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BakeryTab() {
  const toast = useToast()
  const [plans, setPlans] = useState<BakeryPlan[]>(MOCK_BAKERY_PLANS)
  const [loading, setLoading] = useState(true)
  const [subtab, setSubtab] = useState<"plans" | "scale" | "execute" | "percentage" | "timers">("plans")
  const [showCreate, setShowCreate] = useState(false)
  const [newPlan, setNewPlan] = useState({ nombre: "", dia_semana: 7, items: [] as { receta_id: string; cantidad_objetivo: number; prioridad: number }[] })
  const [newItem, setNewItem] = useState({ receta_id: "", cantidad_objetivo: 1, prioridad: 0 })
  const [scaleResult, setScaleResult] = useState<ScaleRecipeResult | null>(null)
  const [scaleForm, setScaleForm] = useState({ receta_id: "", cantidad_deseada: 1 })
  const [executeForm, setExecuteForm] = useState({ plan_id: "", fecha_ejecucion: "" })
  const [executeResult, setExecuteResult] = useState<ExecutePlanResult | null>(null)
  const [recetas, setRecetas] = useState<{ id: string; nombre: string }[]>(MOCK_RECIPES.map(r => ({ id: r.id, nombre: r.nombre || "" })))

  // Advanced Bakery States
  const [flourKg, setFlourKg] = useState("10") // 10kg
  const [fermentTimer, setFermentTimer] = useState({ seconds: 2700, active: false }) // 45 min
  const [bakeTimer, setBakeTimer] = useState({ seconds: 1500, active: false }) // 25 min

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const [plansData, recetasData] = await Promise.all([
        api.supermer.bakery.plans(),
        api.supermer.recipes.list(),
      ])
      setPlans(plansData)
      setRecetas(recetasData.map((r: any) => ({ id: r.id, nombre: r.nombre || r.id })))
    } catch (e: any) {
      if (e.status !== 401 && e.response?.status !== 401) {
        toast.error("Error", e.message)
      }
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPlans() }, [])

  // Timer Tick Effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (fermentTimer.active && fermentTimer.seconds > 0) {
        setFermentTimer(t => ({ ...t, seconds: t.seconds - 1 }))
      }
      if (bakeTimer.active && bakeTimer.seconds > 0) {
        setBakeTimer(t => ({ ...t, seconds: t.seconds - 1 }))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [fermentTimer.active, bakeTimer.active])

  const handleCreatePlan = async () => {
    try {
      const created = await api.supermer.bakery.createPlan(newPlan)
      toast.success("Plan creado")
      setShowCreate(false)
      setNewPlan({ nombre: "", dia_semana: 7, items: [] })
      fetchPlans()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDeletePlan = async (id: string) => {
    try {
      await api.supermer.bakery.deletePlan(id)
      toast.success("Plan eliminado")
      fetchPlans()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleScale = async () => {
    try {
      const r = await api.supermer.bakery.scaleRecipe(scaleForm as any)
      setScaleResult(r)
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleExecute = async () => {
    try {
      const r = await api.supermer.bakery.executePlan(executeForm as any)
      setExecuteResult(r)
      toast.success("Plan ejecutado", `${r.ordenes_creadas ?? 0} órdenes creadas`)
      fetchPlans()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo", "Todos"]

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {[
          ["plans", "Planes"], 
          ["scale", "Escalar"], 
          ["execute", "Ejecutar"],
          ["percentage", "Porcentaje Panadero"],
          ["timers", "Control de Cocción"]
        ].map(([k, l]) => (
          <button key={k} onClick={() => setSubtab(k as any)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subtab === k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>{l}</button>
        ))}
      </div>

      {subtab === "plans" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Nuevo plan</button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-4">
              {plans.map(p => (
                <div key={p.id} className="card p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{p.nombre}</h3>
                      <p className="text-xs text-gray-500">{diasSemana[p.dia_semana ?? 7]} · {p.items?.length ?? 0} items</p>
                    </div>
                    <button onClick={() => handleDeletePlan(p.id!)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {p.items && p.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {p.items.map((it, i) => (
                        <div key={i} className="text-sm text-gray-600 flex justify-between">
                          <span>{it.receta_nombre || it.receta_id}</span>
                          <span className="font-medium">{it.cantidad_objetivo} uds</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {plans.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No hay planes diarios</p>}
            </div>
          )}
        </>
      )}

      {subtab === "scale" && (
        <div className="card p-6 max-w-xl space-y-4">
          <h3 className="font-semibold">Escalar receta</h3>
          <div>
            <label className="text-xs text-gray-500">Receta</label>
            <select className="input-field" value={scaleForm.receta_id} onChange={e => setScaleForm({...scaleForm, receta_id: e.target.value})}>
              <option value="">Seleccionar...</option>
              {recetas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Cantidad deseada</label>
            <input className="input-field" type="number" min="0.001" step="any" value={scaleForm.cantidad_deseada} onChange={e => setScaleForm({...scaleForm, cantidad_deseada: Number(e.target.value)})} />
          </div>
          <button onClick={handleScale} disabled={!scaleForm.receta_id || !scaleForm.cantidad_deseada} className="btn-primary disabled:opacity-50">Escalar</button>
          {scaleResult && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4 space-y-2">
              <p className="font-medium">{scaleResult.receta_nombre} → {scaleResult.producto_terminado}</p>
              <p className="text-sm text-gray-500">Factor: {scaleResult.factor_escala} ({scaleResult.cantidad_base} → {scaleResult.cantidad_deseada})</p>
              <div className="text-sm space-y-1">
                {scaleResult.insumos_totales?.map((ins: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{ins.producto_nombre}</span>
                    <span className="font-medium">{ins.cantidad_escalada} {ins.unidad}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subtab === "execute" && (
        <div className="card p-6 max-w-xl space-y-4">
          <h3 className="font-semibold">Ejecutar plan diario</h3>
          <div>
            <label className="text-xs text-gray-500">Plan</label>
            <select className="input-field" value={executeForm.plan_id} onChange={e => setExecuteForm({...executeForm, plan_id: e.target.value})}>
              <option value="">Seleccionar...</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.nombre} ({diasSemana[p.dia_semana ?? 7]})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Fecha (opcional)</label>
            <input className="input-field" type="date" value={executeForm.fecha_ejecucion} onChange={e => setExecuteForm({...executeForm, fecha_ejecucion: e.target.value})} />
          </div>
          <button onClick={handleExecute} disabled={!executeForm.plan_id} className="btn-primary disabled:opacity-50">Ejecutar plan</button>
          {executeResult && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mt-4">
              <p className="font-medium text-green-700 dark:text-green-300">{executeResult.ordenes_creadas} órdenes creadas</p>
              <p className="text-sm text-gray-500">Plan: {executeResult.plan_nombre} · Fecha: {executeResult.fecha}</p>
              <div className="text-xs space-y-1 mt-2">
                {executeResult.ordenes?.map((o: any) => (
                  <div key={o.id} className="flex justify-between">
                    <span>{o.receta_nombre || o.receta_id}</span>
                    <span className="font-medium">{o.cantidad_objetivo} uds · {o.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subtab === "percentage" && (
        <div className="card p-6 max-w-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Calculadora de Porcentaje Panadero</h3>
            <p className="text-xs text-gray-500 mt-1">Escalado inteligente de masas en base a la harina de trigo (100%).</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label label-required">Harina Base (Trigo) - Kilogramos</label>
              <input type="number" className="input-field text-xl font-mono text-center py-2" value={flourKg} onChange={e => setFlourKg(e.target.value)} />
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center text-center font-mono">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Peso Total de la Masa</span>
              <p className="text-xl font-extrabold text-green-400 mt-1">{(Number(flourKg) * 1.718).toFixed(2)} kg</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { nombre: "Harina de Trigo (Base)", pct: 100, unidad: "kg", calculated: Number(flourKg) },
              { nombre: "Agua Fria (Masa Hidratada)", pct: 60, unidad: "kg", calculated: Number(flourKg) * 0.6 },
              { nombre: "Levadura Fresca / Masa Madre", pct: 5, unidad: "kg", calculated: Number(flourKg) * 0.05 },
              { nombre: "Sal Fina de Mesa", pct: 1.8, unidad: "kg", calculated: Number(flourKg) * 0.018 },
              { nombre: "Grasa / Margarina Especial", pct: 5, unidad: "kg", calculated: Number(flourKg) * 0.05 }
            ].map((ins, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs">
                <div>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{ins.nombre}</span>
                  <span className="font-mono text-[10px] text-gray-400 block">Proporción: {ins.pct}%</span>
                </div>
                <div className="text-right font-mono font-bold text-sm text-gray-900 dark:text-white">
                  {ins.calculated.toFixed(3)} {ins.unidad}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subtab === "timers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Fermentation Timer */}
          <div className="card p-6 space-y-4 border border-blue-500/20 bg-blue-500/5">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Cámara de Fermentación</h4>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">32°C · 85% Hum.</span>
            </div>
            <div className="text-center font-mono py-4">
              <span className="text-5xl font-extrabold text-blue-300">{formatTime(fermentTimer.seconds)}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFermentTimer(t => ({ ...t, active: !t.active }))}
                className="btn-primary py-2 text-xs flex-1"
              >
                {fermentTimer.active ? "Pausar" : "Iniciar Control"}
              </button>
              <button 
                onClick={() => setFermentTimer({ seconds: 2700, active: false })}
                className="btn-outline py-2 text-xs flex-1"
              >
                Reiniciar (45m)
              </button>
            </div>
          </div>

          {/* Oven Timer */}
          <div className="card p-6 space-y-4 border border-amber-500/20 bg-amber-500/5">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Horno Rotativo (Bake)</h4>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">200°C · Vapor: 3s</span>
            </div>
            <div className="text-center font-mono py-4">
              <span className="text-5xl font-extrabold text-amber-300">{formatTime(bakeTimer.seconds)}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setBakeTimer(t => ({ ...t, active: !t.active }))}
                className="btn-primary py-2 text-xs flex-1"
              >
                {bakeTimer.active ? "Pausar" : "Iniciar Horneado"}
              </button>
              <button 
                onClick={() => setBakeTimer({ seconds: 1500, active: false })}
                className="btn-outline py-2 text-xs flex-1"
              >
                Reiniciar (25m)
              </button>
            </div>
          </div>

        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="font-semibold text-lg">Nuevo plan diario</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500">Nombre</label>
                <input className="input-field" value={newPlan.nombre} onChange={e => setNewPlan({...newPlan, nombre: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Día</label>
                <select className="input-field" value={newPlan.dia_semana} onChange={e => setNewPlan({...newPlan, dia_semana: Number(e.target.value)})}>
                  {diasSemana.map((d,i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Items</label>
                {newPlan.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 mt-2 text-sm">
                    <span className="flex-1">{recetas.find(r => r.id === it.receta_id)?.nombre || it.receta_id}</span>
                    <span className="w-16 text-right">{it.cantidad_objetivo}</span>
                    <button onClick={() => setNewPlan({...newPlan, items: newPlan.items.filter((_,j) => j !== i)})} className="text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2 items-end mt-2">
                  <div className="flex-1">
                    <select className="input-field text-sm" value={newItem.receta_id} onChange={e => setNewItem({...newItem, receta_id: e.target.value})}>
                      <option value="">Receta...</option>
                      {recetas.filter(r => !newPlan.items.some(it => it.receta_id === r.id)).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <input className="input-field text-sm" type="number" min="0.001" step="any" placeholder="Cant." value={newItem.cantidad_objetivo || ""} onChange={e => setNewItem({...newItem, cantidad_objetivo: Number(e.target.value)})} />
                  </div>
                  <button onClick={() => { if (newItem.receta_id && newItem.cantidad_objetivo > 0) { setNewPlan({...newPlan, items: [...newPlan.items, {...newItem}] }); setNewItem({ receta_id: "", cantidad_objetivo: 1, prioridad: 0 }) } }} className="btn-primary text-sm px-3 py-2">+</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreatePlan} disabled={!newPlan.nombre || newPlan.items.length === 0} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ButcheryTab({ templates, orders, yieldReport, desposteResult, setDesposteResult, fetchAll, enterpriseConfig }: {
  templates: ButcheryTemplate[]; orders: SupermerOrder[]; yieldReport: any[];
  desposteResult: DesposteResponse | null; setDesposteResult: (r: DesposteResponse | null) => void; fetchAll: () => void;
  enterpriseConfig: { coldChain: boolean }
}) {
  const toast = useToast()
  const [subtab, setSubtab] = useState<"templates" | "desposte" | "blueprint" | "history" | "yield" | "coldChain">("templates")
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [showDesposte, setShowDesposte] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string>("lomo")
  const [newTemplate, setNewTemplate] = useState({ nombre: "", especie: "bovino", peso_promedio_kg: 0, cuts: [] as any[] })
  const [newCut, setNewCut] = useState({ producto_id: "", rendimiento_porcentual: 0, precio_ponderado: 50, es_subproducto: false })
  const [desposteForm, setDesposteForm] = useState({ template_id: "", peso_entrada_kg: 0, costo_total_gs: 0, fecha_vencimiento: "" })

  // Real-time IoT Cold-Chain & pH logs state
  const [resLogs, setResLogs] = useState([
    { id: "RES-2026-9801", peso: 184.5, ph: 5.52, temp: 3.1, estado: "Aprobado (Terneza Asegurada)", haccp: true, ts: "Hace 10 min" },
    { id: "RES-2026-9802", peso: 192.0, ph: 5.75, temp: 2.8, estado: "Aprobado (Terneza Asegurada)", haccp: true, ts: "Hace 45 min" },
    { id: "RES-2026-9803", peso: 178.2, ph: 6.25, temp: 5.4, estado: "Rechazado (Dureza / HACCP Violado)", haccp: false, ts: "Hace 2 horas" }
  ])

  // Simulator Inputs
  const [simResId, setSimResId] = useState("RES-2026-9804")
  const [simWeight, setSimWeight] = useState(185)
  const [simPh, setSimPh] = useState(5.6)
  const [simTemp, setSimTemp] = useState(3.2)

  const handleSimulateRes = () => {
    if (!simResId || !simWeight || !simPh || !simTemp) {
      toast.error("Datos incompletos", "Por favor complete todos los datos de la res.")
      return
    }

    const isPhOk = simPh >= 5.4 && simPh <= 5.8
    const isTempOk = simTemp <= 4.0
    const isHaccp = isPhOk && isTempOk

    let status = "Aprobado (Terneza Asegurada)"
    if (!isPhOk && !isTempOk) {
      status = "Rechazado (Dureza / HACCP Violado)"
    } else if (!isPhOk) {
      status = "Rechazado (Riesgo DFD / Dureza)"
    } else if (!isTempOk) {
      status = "Rechazado (Peligro Sanitario HACCP)"
    }

    const newLog = {
      id: simResId,
      peso: Number(simWeight),
      ph: Number(simPh),
      temp: Number(simTemp),
      estado: status,
      haccp: isHaccp,
      ts: "Justo ahora"
    }

    setResLogs([newLog, ...resLogs])
    if (isHaccp) {
      toast.success("Res Recibida Exitosamente", "La res cumple con el rango ideal de pH y temperatura.")
    } else {
      toast.error("Alerta Crítica de Calidad/Sanidad", `${status}. Registrado en reportes de auditoría.`)
    }

    // Auto increment serial
    const serial = parseInt(simResId.split("-")[2]) || 9804
    setSimResId(`RES-2026-${serial + 1}`)
  }

  const handleCreateTemplate = async () => {
    try {
      await api.supermer.butchery.templates.create(newTemplate)
      toast.success("Plantilla creada")
      setShowCreateTemplate(false)
      setNewTemplate({ nombre: "", especie: "bovino", peso_promedio_kg: 0, cuts: [] })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDesposte = async () => {
    try {
      const result = await api.supermer.butchery.desposte(desposteForm as any)
      setDesposteResult(result)
      toast.success("Desposte completado", `${result.cortes?.length ?? 0} cortes generados`)
      setShowDesposte(false)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const addCutToTemplate = () => {
    if (!newCut.producto_id || !newCut.rendimiento_porcentual) return
    setNewTemplate({ ...newTemplate, cuts: [...newTemplate.cuts, { ...newCut }] })
    setNewCut({ producto_id: "", rendimiento_porcentual: 0, precio_ponderado: 50, es_subproducto: false })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {[
          { k: "templates" as const, l: "Plantillas", i: ClipboardList },
          { k: "desposte" as const, l: "Desposte", i: Beef },
          { k: "blueprint" as const, l: "Mapa de Cortes", i: Beef },
          { k: "history" as const, l: "Historial", i: Layers },
          { k: "yield" as const, l: "Rendimiento", i: BarChart3 },
          { k: "coldChain" as const, l: "Cadena de Frío & pH", i: Thermometer }
        ].map(t => (
          <button key={t.k} onClick={() => setSubtab(t.k as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 whitespace-nowrap ${subtab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white scale-100" : "text-gray-500 hover:text-gray-700 hover:scale-[1.01]"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {subtab === "coldChain" && (
        !enterpriseConfig.coldChain ? (
          <UnlockPromo 
            title="Control de Cadena de Frío, pH y HACCP"
            desc="Monitorea el pH en la recepción de medias reses (rango ideal 5.4 - 5.8) y su temperatura interna para cumplir con las exigencias sanitarias internacionales HACCP, asegurando la máxima terneza comercial."
            featureKey="coldChain"
            competitors={{
              sap: "Requiere software satélite LIMS de laboratorio externo, no integrado en el ERP central.",
              oracle: "Demanda licencias IoT Fleet complejas y costosos sensores RFID propietarios."
            }}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Real-time Telemetry Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: "Reses Recibidas Hoy", value: resLogs.length, icon: Database, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                { label: "Rango pH Seguro (HACCP)", value: "5.4 - 5.8", icon: Gauge, color: "text-green-500 bg-green-500/10 border-green-500/20" },
                { label: "Temperatura Límite", value: "≤ 4.0 °C", icon: Thermometer, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
                { label: "Porcentaje de Aprobación", value: `${((resLogs.filter(l => l.haccp).length / resLogs.length) * 100).toFixed(0)}%`, icon: ShieldCheck, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
              ].map((w, i) => (
                <div key={i} className={`card p-5 border flex flex-col justify-between ${w.color}`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-85 text-gray-500 dark:text-gray-400">{w.label}</span>
                    <w.icon className="w-5 h-5 opacity-90" />
                  </div>
                  <div className="text-3xl font-black tracking-tight">{w.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Carcass Receiver Simulator Form */}
              <div className="card p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary"><Thermometer className="w-5 h-5" /></div>
                  <h3 className="text-lg font-bold">Simular Recepción de Res</h3>
                </div>
                <p className="text-xs text-gray-400 mb-4">Simule la telemetría enviada por los sensores de pH y termómetros infrarrojos Bluetooth en zona de descarga.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Carcasa / Res ID</label>
                    <input type="text" className="input-field font-mono text-sm" value={simResId} onChange={e => setSimResId(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Peso (kg)</label>
                      <input type="number" className="input-field text-sm" value={simWeight} onChange={e => setSimWeight(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">pH (5.4 - 5.8)</label>
                      <input type="number" step="0.01" className="input-field text-sm" value={simPh} onChange={e => setSimPh(Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Temperatura Interna (°C)</label>
                    <input type="number" step="0.1" className="input-field text-sm" value={simTemp} onChange={e => setSimTemp(Number(e.target.value))} />
                  </div>
                  
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-[11px] text-gray-500 space-y-1">
                    <p className="font-semibold flex items-center gap-1"><InfoIcon className="w-3.5 h-3.5" /> Directrices Sanitarias:</p>
                    <p>• pH &gt; 5.8 indica corte DFD (Oscura, Firme y Seca), perdiendo terneza.</p>
                    <p>• Temp &gt; 4.0 °C representa peligro microbiológico inmediato.</p>
                  </div>

                  <button onClick={handleSimulateRes} className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Registrar Res y Validar HACCP
                  </button>
                </div>
              </div>

              {/* Logs and Telemetry Feed */}
              <div className="lg:col-span-2 card p-6 border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Bitácora de Monitoreo HACCP</h3>
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Feed en Vivo</span>
                  </div>
                  
                  <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                    {resLogs.map((log, i) => (
                      <div key={i} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        log.haccp 
                          ? "bg-green-500/5 border-green-500/20 text-gray-900 dark:text-white" 
                          : "bg-red-500/5 border-red-500/20 text-gray-900 dark:text-white"
                      }`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{log.id}</span>
                            <span className="text-[10px] text-gray-400 font-medium">({log.peso} kg)</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className={`px-2 py-0.5 rounded ${log.ph >= 5.4 && log.ph <= 5.8 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                              pH: {log.ph.toFixed(2)}
                            </span>
                            <span className={`px-2 py-0.5 rounded ${log.temp <= 4.0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                              Temp: {log.temp.toFixed(1)} °C
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 font-normal">{log.ts}</span>
                          </div>
                        </div>

                        <div>
                          {log.haccp ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                              <ShieldCheck className="w-3.5 h-3.5" /> HACCP OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5" /> RECHAZADO
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4 flex justify-between items-center text-xs text-gray-400">
                  <span>Sensores de Planta Activos: 4</span>
                  <span>Sincronización POS / Trazabilidad: 100%</span>
                </div>
              </div>

            </div>

          </div>
        )
      )}

      {subtab === "templates" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Plantillas de desposte</h3>
            <button onClick={() => setShowCreateTemplate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva plantilla</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Nombre</th><th className="p-3">Especie</th><th className="p-3">Peso prom.</th><th className="p-3">Cortes</th><th className="p-3">Activa</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {templates.map(t => (
                  <tr key={t.id} className="table-row">
                    <td className="p-3 font-medium">{t.nombre}</td>
                    <td className="p-3 capitalize">{t.especie}</td>
                    <td className="p-3">{Number(t.peso_promedio_kg ?? 0).toFixed(1)} kg</td>
                    <td className="p-3">
                      <span className="text-xs text-gray-500">{t.cuts?.length ?? 0} cortes</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.cuts?.slice(0, 5).map(c => (
                          <span key={c.id} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{c.producto_nombre} ({c.rendimiento_porcentual}%)</span>
                        ))}
                        {(t.cuts?.length ?? 0) > 5 && <span className="text-xs text-gray-400">+{t.cuts!.length - 5} más</span>}
                      </div>
                    </td>
                    <td className="p-3">{t.activa ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">Sin plantillas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === "desposte" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Ejecutar desposte</h3>
              <button 
                onClick={() => setShowWizard(true)}
                className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-bold hover:bg-primary/30 transition-all flex items-center gap-1"
              >
                <span>🍖 Calculadora Industrial</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-field">Plantilla</label>
                <select className="input-field" value={desposteForm.template_id} onChange={e => setDesposteForm({ ...desposteForm, template_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {templates.filter(t => t.activa).map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.especie})</option>)}
                </select>
              </div>
              <div><label className="label-field">Peso entrada (kg)</label><input className="input-field" type="number" step="0.1" value={desposteForm.peso_entrada_kg || ""} onChange={e => setDesposteForm({ ...desposteForm, peso_entrada_kg: Number(e.target.value) })} /></div>
              <div><label className="label-field">Costo total (Gs)</label><input className="input-field" type="number" value={desposteForm.costo_total_gs || ""} onChange={e => setDesposteForm({ ...desposteForm, costo_total_gs: Number(e.target.value) })} /></div>
              <div><label className="label-field">Fecha vencimiento</label><input className="input-field" type="date" value={desposteForm.fecha_vencimiento} onChange={e => setDesposteForm({ ...desposteForm, fecha_vencimiento: e.target.value })} /></div>
              <button onClick={handleDesposte} disabled={!desposteForm.template_id || !desposteForm.peso_entrada_kg || !desposteForm.costo_total_gs}
                className="btn-primary w-full disabled:opacity-50">Ejecutar desposte</button>
            </div>
          </div>

          {desposteResult && (
            <div className="card p-6">
              <h3 className="text-lg font-bold mb-4 text-green-600">Resultado del desposte</h3>
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-gray-500">Template:</span> <span className="font-semibold">{desposteResult.template_nombre}</span></div>
                <div><span className="text-gray-500">Peso entrada:</span> <span className="font-semibold">{desposteResult.peso_entrada_kg?.toFixed(1)} kg</span></div>
                <div><span className="text-gray-500">Costo total:</span> <span className="font-semibold">Gs {desposteResult.costo_total_gs?.toLocaleString("es-PY")}</span></div>
                <div><span className="text-gray-500">Peso obtenido:</span> <span className="font-semibold">{desposteResult.peso_total_obtenido?.toFixed(2)} kg</span></div>
                <div><span className="text-gray-500">Merma:</span> <span className="font-semibold text-red-600">{desposteResult.merma_kg?.toFixed(2)} kg ({desposteResult.merma_porcentaje?.toFixed(1)}%)</span></div>
              </div>
              <h4 className="font-semibold mb-2">Cortes generados</h4>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="p-1">Corte</th><th className="p-1">Rend. %</th><th className="p-1">Peso</th><th className="p-1">Costo unit.</th></tr></thead>
                <tbody>
                  {desposteResult.cortes?.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="p-1">{c.producto_nombre}</td>
                      <td className="p-1">{c.rendimiento_esperado?.toFixed(1)}%</td>
                      <td className="p-1">{c.peso_obtenido_kg?.toFixed(2)} kg</td>
                      <td className="p-1">Gs {c.costo_unitario_gs?.toLocaleString("es-PY")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subtab === "blueprint" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual anatomical chart */}
          <div className="lg:col-span-2 card p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mapa de Cortes Anatómicos (Beef Blueprint)</h3>
              <p className="text-xs text-gray-500 mt-1">Haz clic en una sección de la res para auditar qué cortes comerciales se obtienen de ella y sus especificaciones técnicas de rendimiento.</p>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { key: "lomo", label: "🥩 Grupa / Lomo (Categoría Premium)", desc: "Cortes tiernos de cocción rápida (asado, sartén).", color: "border-amber-500 bg-amber-500/10 text-amber-400" },
                { key: "costillar", label: "🍖 Flanco / Costillar (Categoría Media)", desc: "Cortes tradicionales de parrilla con hueso.", color: "border-sky-500 bg-sky-500/10 text-sky-400" },
                { key: "delantero", label: "🍲 Paleta / Cuarto Delantero (Categoría Comercial)", desc: "Cortes magros ideales para guisos o molida.", color: "border-indigo-500 bg-indigo-500/10 text-indigo-400" },
                { key: "mermas", label: "🗑️ Grasas, Shins & Mermas (Subproductos)", desc: "Hueso blanco, grasa industrial y mermas de cuchillo.", color: "border-red-500 bg-red-500/10 text-red-400" }
              ].map(sec => (
                <button 
                  key={sec.key}
                  onClick={() => setSelectedSection(sec.key)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center ${
                    selectedSection === sec.key ? sec.color : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700"
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm block">{sec.label}</span>
                    <span className="text-xs text-gray-400 mt-0.5 block">{sec.desc}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Cuts detail catalog card */}
          <div className="lg:col-span-1">
            <div className="card p-6 space-y-6 border border-gray-200 dark:border-gray-800">
              <h3 className="text-md font-bold text-gray-900 dark:text-white uppercase tracking-wider">Cortes Obtenidos</h3>
              
              <div className="space-y-3">
                {selectedSection === "lomo" && [
                  { nombre: "Tapa de Cuadril (Picaña)", yield: "5.0%", precio: 55000 },
                  { nombre: "Lomo de Ternera", yield: "8.0%", precio: 62000 },
                  { nombre: "Peceto", yield: "6.0%", precio: 48000 }
                ].map((c, i) => (
                  <div key={i} className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">Rendimiento: {c.yield}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-500">{formatPYG(c.precio)}/kg</span>
                  </div>
                ))}

                {selectedSection === "costillar" && [
                  { nombre: "Costilla Alta", yield: "15.0%", precio: 34000 },
                  { nombre: "Vacío de Primera", yield: "12.0%", precio: 42000 }
                ].map((c, i) => (
                  <div key={i} className="p-3 bg-sky-500/5 border border-sky-500/10 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">Rendimiento: {c.yield}</p>
                    </div>
                    <span className="font-mono font-bold text-sky-500">{formatPYG(c.precio)}/kg</span>
                  </div>
                ))}

                {selectedSection === "delantero" && [
                  { nombre: "Bola de Lomo", yield: "18.0%", precio: 38000 },
                  { nombre: "Carnaza Negra", yield: "20.0%", precio: 32000 }
                ].map((c, i) => (
                  <div key={i} className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">Rendimiento: {c.yield}</p>
                    </div>
                    <span className="font-mono font-bold text-indigo-500">{formatPYG(c.precio)}/kg</span>
                  </div>
                ))}

                {selectedSection === "mermas" && [
                  { nombre: "Grasa Industrial", yield: "8.0%", precio: 2000 },
                  { nombre: "Hueso Blanco", yield: "17.0%", precio: 500 }
                ].map((c, i) => (
                  <div key={i} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">Rendimiento: {c.yield}</p>
                    </div>
                    <span className="font-mono font-bold text-red-400">{formatPYG(c.precio)}/kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {subtab === "history" && (
        <div>
          <h3 className="text-lg font-bold mb-4">Historial de despostes</h3>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Fecha</th><th className="p-3">Notas</th><th className="p-3">Estado</th><th className="p-3">Objetivo</th><th className="p-3">Obtenido</th><th className="p-3">Rendimiento</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {orders.map(o => (
                  <tr key={o.id} className="table-row">
                    <td className="p-3 text-sm">{o.fecha_fin ? new Date(o.fecha_fin).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="p-3 text-sm text-gray-500">{o.notas || "-"}</td>
                    <td className="p-3"><span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600">{o.estado}</span></td>
                    <td className="p-3">{Number(o.cantidad_objetivo ?? 0).toFixed(1)} kg</td>
                    <td className="p-3">{o.producto_obtenido ? `${Number(o.producto_obtenido).toFixed(2)} kg` : "-"}</td>
                    <td className="p-3">{o.rendimiento_real ? `${Number(o.rendimiento_real).toFixed(1)}%` : "-"}</td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin despostes</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === "yield" && (
        <div>
          <h3 className="text-lg font-bold mb-4">Reporte de rendimiento</h3>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Fecha</th><th className="p-3">Template</th><th className="p-3">Peso entrada</th><th className="p-3">Peso obtenido</th><th className="p-3">Rendimiento</th><th className="p-3">Merma</th><th className="p-3">Costo total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {yieldReport.map((r, i) => (
                  <tr key={i} className="table-row">
                    <td className="p-3 text-sm">{r.fecha ? new Date(r.fecha).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="p-3 font-medium">{r.template_nombre}</td>
                    <td className="p-3">{r.peso_entrada?.toFixed(1)} kg</td>
                    <td className="p-3">{r.peso_obtenido?.toFixed(2)} kg</td>
                    <td className="p-3 font-semibold">{r.rendimiento?.toFixed(1)}%</td>
                    <td className="p-3 text-red-600">{r.merma_kg?.toFixed(2)} kg ({r.merma_porcentaje?.toFixed(1)}%)</td>
                    <td className="p-3">Gs {r.costo_total?.toLocaleString("es-PY")}</td>
                  </tr>
                ))}
                {yieldReport.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin datos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateTemplate && (
        <div className="modal-overlay" onClick={() => setShowCreateTemplate(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700"><h3 className="text-lg font-bold">Nueva plantilla de desposte</h3></div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="label-field">Nombre</label><input className="input-field" value={newTemplate.nombre} onChange={e => setNewTemplate({ ...newTemplate, nombre: e.target.value })} /></div>
              <div><label className="label-field">Especie</label>
                <select className="input-field" value={newTemplate.especie} onChange={e => setNewTemplate({ ...newTemplate, especie: e.target.value })}>
                  <option value="bovino">Bovino</option><option value="porcino">Porcino</option><option value="pollo">Pollo</option><option value="ovino">Ovino</option>
                </select>
              </div>
              <div><label className="label-field">Peso promedio (kg)</label><input className="input-field" type="number" step="0.1" value={newTemplate.peso_promedio_kg || ""} onChange={e => setNewTemplate({ ...newTemplate, peso_promedio_kg: Number(e.target.value) })} /></div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Cortes</h4>
                {newTemplate.cuts.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm mb-1 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="flex-1">{c.producto_id?.slice(0, 8)}...</span>
                    <span>{c.rendimiento_porcentual}%</span>
                    <span className="text-gray-400">pond: {c.precio_ponderado}%</span>
                    <button onClick={() => setNewTemplate({ ...newTemplate, cuts: newTemplate.cuts.filter((_: any, j: number) => j !== i) })} className="text-red-500"><XCircle className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2 items-end mt-2">
                  <div className="flex-1"><label className="text-xs text-gray-500">Producto ID</label><input className="input-field text-sm" value={newCut.producto_id} onChange={e => setNewCut({ ...newCut, producto_id: e.target.value })} /></div>
                  <div className="w-20"><label className="text-xs text-gray-500">Rend. %</label><input className="input-field text-sm" type="number" value={newCut.rendimiento_porcentual || ""} onChange={e => setNewCut({ ...newCut, rendimiento_porcentual: Number(e.target.value) })} /></div>
                  <button onClick={addCutToTemplate} className="btn-primary text-sm px-3 py-2">+</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreateTemplate(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateTemplate} disabled={!newTemplate.nombre || !newTemplate.peso_promedio_kg || newTemplate.cuts.length === 0} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
      
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <DesposteWizard onClose={() => setShowWizard(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ProduceTab({ batches, audits, scorecards, dashboard, markdownResult, setMarkdownResult, enhancedForecast, setEnhancedForecast, fetchAll, enterpriseConfig }: {
  batches: ProduceReceiveBatch[]; audits: ProduceFreshnessAudit[]; scorecards: ProduceSupplierScorecard[]; dashboard: ProduceDashboard;
  markdownResult: AutoApplyMarkdownResult | null; setMarkdownResult: (r: AutoApplyMarkdownResult | null) => void;
  enhancedForecast: any; setEnhancedForecast: (r: any) => void; fetchAll: () => void;
  enterpriseConfig: { freshness: boolean; batchMarkdown: boolean }
}) {
  const toast = useToast()
  const [subtab, setSubtab] = useState<"dashboard" | "reception" | "audits" | "scorecards" | "markdown" | "forecast">("dashboard")
  const [showReception, setShowReception] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [newBatch, setNewBatch] = useState<any>({ producto_id: "", proveedor_id: "", cantidad_recibida: 0, cantidad_aceptada: 0, calidad: "estandar", precio_unitario: 0, fecha_recepcion: "", fecha_vencimiento_estimada: "", lote_proveedor: "", nota_calidad: "" })
  const [newAudit, setNewAudit] = useState<any>({ producto_id: "", batch_id: "", calidad_actual: "bueno", firmeza: 3, color: 3, aspecto_general: 3, notas: "" })
  const [mdConfig, setMdConfig] = useState({ dias_verde: 1, dias_amarillo: 5, descuento_verde: 20, descuento_amarillo: 50 })
  const [fcFilter, setFcFilter] = useState({ producto_ids: "", lookback_dias: 90, incluir_estacionalidad: true })

  const handleCreateBatch = async () => {
    try {
      await api.supermer.produce.receiveBatches.create(newBatch)
      toast.success("Recepción registrada")
      setShowReception(false)
      setNewBatch({ producto_id: "", proveedor_id: "", cantidad_recibida: 0, cantidad_aceptada: 0, calidad: "estandar", precio_unitario: 0, fecha_recepcion: "", fecha_vencimiento_estimada: "", lote_proveedor: "", nota_calidad: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateAudit = async () => {
    try {
      await api.supermer.produce.freshness.create(newAudit)
      toast.success("Auditoría registrada")
      setShowAudit(false)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleMarkdownByBatch = async () => {
    try {
      const res = await api.supermer.produce.markdownByBatch(mdConfig)
      setMarkdownResult(res)
      toast.success("Markdown por lote", `${res.markdowns_creados ?? 0} creados`)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleGenerateScorecards = async () => {
    try {
      const res = await api.supermer.produce.scorecards.generate()
      toast.success("Scorecards", res.detail)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleEnhancedForecast = async () => {
    try {
      const ids = fcFilter.producto_ids ? fcFilter.producto_ids.split(",").map((s: string) => s.trim()) : undefined
      const res = await api.supermer.produce.enhancedForecast({ producto_ids: ids, lookback_dias: fcFilter.lookback_dias, incluir_estacionalidad: fcFilter.incluir_estacionalidad })
      setEnhancedForecast(res)
      toast.success("Forecast generado")
    } catch (e: any) { toast.error("Error", e.message) }
  }

  // Intercept subtabs that require enterprise modules
  const renderSubtabContent = () => {
    if ((subtab === "audits" || subtab === "scorecards") && !enterpriseConfig.freshness) {
      return (
        <UnlockPromo 
          title="Auditoría de Frescura & Scorecards (Verdulería)"
          desc="Evalúa científicamente la firmeza, color y aspecto de frutas y vegetales en recepción o góndola. Genera automáticamente penalizaciones a proveedores que entregan mercadería con baja vida útil o alta merma proyectada."
          featureKey="freshness"
          competitors={{
            sap: "Monitoreo básico sin auditoría de firmeza/color nativa en portal de compras.",
            oracle: "Requiere integraciones complejas con sistemas de control de calidad externos."
          }}
        />
      )
    }

    if (subtab === "markdown" && !enterpriseConfig.batchMarkdown) {
      return (
        <UnlockPromo 
          title="Markdown Escalonado por Lote"
          desc="Activa descuentos automáticos decrecientes a medida que se acerca la fecha de vencimiento (ej. -30% a 3 días, -50% a 1 día), recuperando el costo antes de tirar mercadería."
          featureKey="batchMarkdown"
          competitors={{
            sap: "Requiere procesos manuales o desarrollos Z de pricing sumamente complejos.",
            oracle: "Demanda licenciamiento complementario Retail Price Optimization corporativo."
          }}
        />
      )
    }

    // Default renders
    return null
  }

  const enterpriseIntercept = renderSubtabContent()

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {[
          { k: "dashboard" as const, l: "Dashboard", i: BarChart3 },
          { k: "reception" as const, l: "Recepciones", i: PackageOpen },
          { k: "audits" as const, l: "Auditorías", i: Eye },
          { k: "scorecards" as const, l: "Scorecards", i: Sparkles },
          { k: "markdown" as const, l: "Markdown x lote", i: AlertTriangle },
          { k: "forecast" as const, l: "Forecast", i: TrendingUp },
        ].map(t => (
          <button key={t.k} onClick={() => setSubtab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subtab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {enterpriseIntercept || (
        <>

      {subtab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Recibido hoy", value: dashboard.total_recibido_hoy ?? 0, icon: PackageOpen, color: "text-green-600" },
            { label: "Lotes activos", value: dashboard.lotes_activos ?? 0, icon: Layers, color: "text-blue-600" },
            { label: "Por vencer", value: dashboard.lotes_por_vencer ?? 0, icon: AlertTriangle, color: "text-amber-600" },
            { label: "Auditorías pend.", value: dashboard.auditorias_pendientes ?? 0, icon: Eye, color: "text-purple-600" },
            { label: "Scorecards", value: dashboard.scorecards_generados ?? 0, icon: Sparkles, color: "text-indigo-600" },
            { label: "Proveedores", value: dashboard.proveedores_activos ?? 0, icon: ShoppingCart, color: "text-teal-600" },
            { label: "Calidad promedio", value: dashboard.calidad_promedio_general ?? "-", icon: CheckCircle, color: "text-green-600" },
          ].map((c, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 font-medium">{c.label}</span>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {subtab === "reception" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Recepciones con calidad</h3>
            <button onClick={() => setShowReception(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva recepción</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Producto</th><th className="p-3">Proveedor</th><th className="p-3">Recibido</th><th className="p-3">Aceptado</th><th className="p-3">Calidad</th><th className="p-3">Precio</th><th className="p-3">Fecha</th><th className="p-3">Lote prov.</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {batches.map(b => (
                  <tr key={b.id} className="table-row">
                    <td className="p-3 font-medium">{b.producto_nombre}</td>
                    <td className="p-3">{b.proveedor_nombre || "-"}</td>
                    <td className="p-3">{Number(b.cantidad_recibida ?? 0).toFixed(2)}</td>
                    <td className="p-3">{b.cantidad_aceptada ? Number(b.cantidad_aceptada).toFixed(2) : "-"}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        b.calidad === "premium" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                        b.calidad === "estandar" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" :
                        b.calidad === "descuento" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                        "bg-red-50 dark:bg-red-900/20 text-red-600"
                      }`}>{b.calidad}</span>
                    </td>
                    <td className="p-3">{b.precio_unitario ? `Gs ${Number(b.precio_unitario).toLocaleString("es-PY")}` : "-"}</td>
                    <td className="p-3 text-sm">{b.fecha_recepcion ? new Date(b.fecha_recepcion).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="p-3 text-xs text-gray-500">{b.lote_proveedor || "-"}</td>
                  </tr>
                ))}
                {batches.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-500">Sin recepciones</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === "audits" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Auditorías de frescura</h3>
            <button onClick={() => setShowAudit(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva auditoría</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Producto</th><th className="p-3">Calidad</th><th className="p-3">Firmeza</th><th className="p-3">Color</th><th className="p-3">Aspecto</th><th className="p-3">Fecha</th><th className="p-3">Markdown</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {audits.map(a => (
                  <tr key={a.id} className="table-row">
                    <td className="p-3 font-medium">{a.producto_nombre}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        a.calidad_actual === "bueno" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                        a.calidad_actual === "regular" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                        "bg-red-50 dark:bg-red-900/20 text-red-600"
                      }`}>{a.calidad_actual}</span>
                    </td>
                    <td className="p-3">{a.firmeza ?? "-"}</td>
                    <td className="p-3">{a.color ?? "-"}</td>
                    <td className="p-3">{a.aspecto_general ?? "-"}</td>
                    <td className="p-3 text-sm">{a.audited_at ? new Date(a.audited_at).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="p-3">{a.triggered_markdown ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                  </tr>
                ))}
                {audits.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin auditorías</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === "scorecards" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Scorecards de proveedores</h3>
            <button onClick={handleGenerateScorecards} className="btn-primary flex items-center gap-2"><Sparkles className="w-4 h-4" />Generar scorecards</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Proveedor</th><th className="p-3">Producto</th><th className="p-3">Calidad</th><th className="p-3">Merma %</th><th className="p-3">Rechazos</th><th className="p-3">Puntaje</th><th className="p-3">Recom.</th><th className="p-3">Período</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {scorecards.map(s => (
                  <tr key={s.id} className="table-row">
                    <td className="p-3 font-medium">{s.proveedor_nombre}</td>
                    <td className="p-3">{s.producto_nombre}</td>
                    <td className="p-3 capitalize">{s.calidad_promedio}</td>
                    <td className="p-3">{Number(s.merma_porcentaje ?? 0).toFixed(1)}%</td>
                    <td className="p-3">{s.rechazos ?? 0}</td>
                    <td className="p-3 font-bold">{s.puntaje_general != null ? Number(s.puntaje_general).toFixed(1) : "-"}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        s.recomendacion === "preferido" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                        s.recomendacion === "condicional" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                        "bg-red-50 dark:bg-red-900/20 text-red-600"
                      }`}>{s.recomendacion}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {s.periodo_inicio && s.periodo_fin ? `${new Date(s.periodo_inicio).toLocaleDateString("es-PY")} - ${new Date(s.periodo_fin).toLocaleDateString("es-PY")}` : "-"}
                    </td>
                  </tr>
                ))}
                {scorecards.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-500">Sin scorecards</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === "markdown" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">Markdown automático por lote</h3>
            <p className="text-sm text-gray-500 mb-4">Aplica descuentos escalonados según días restantes para vencimiento.</p>
            <div className="space-y-4">
              <div><label className="label-field">Días para verde</label><input className="input-field" type="number" value={mdConfig.dias_verde} onChange={e => setMdConfig({ ...mdConfig, dias_verde: Number(e.target.value) })} /></div>
              <div><label className="label-field">Días para amarillo</label><input className="input-field" type="number" value={mdConfig.dias_amarillo} onChange={e => setMdConfig({ ...mdConfig, dias_amarillo: Number(e.target.value) })} /></div>
              <div><label className="label-field">Descuento verde (%)</label><input className="input-field" type="number" value={mdConfig.descuento_verde} onChange={e => setMdConfig({ ...mdConfig, descuento_verde: Number(e.target.value) })} /></div>
              <div><label className="label-field">Descuento amarillo (%)</label><input className="input-field" type="number" value={mdConfig.descuento_amarillo} onChange={e => setMdConfig({ ...mdConfig, descuento_amarillo: Number(e.target.value) })} /></div>
              <button onClick={handleMarkdownByBatch} className="btn-primary w-full">Aplicar markdown</button>
            </div>
          </div>
          {markdownResult && (
            <div className="card p-6">
              <h3 className="text-lg font-bold mb-4 text-green-600">Resultado</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-500">Procesados:</span><span className="font-semibold">{markdownResult.procesados ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Markdowns creados:</span><span className="font-semibold text-green-600">{markdownResult.markdowns_creados ?? 0}</span></div>
                {markdownResult.errores && markdownResult.errores.length > 0 && (
                  <div>
                    <span className="text-red-500 text-sm">Errores:</span>
                    <ul className="text-xs text-red-500 list-disc pl-4 mt-1">
                      {markdownResult.errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subtab === "forecast" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">Forecast mejorado (estacional + calidad)</h3>
            <p className="text-sm text-gray-500 mb-4">Considera estacionalidad, venta misma semana año anterior, calidad de recepción, lluvia y temperatura.</p>
            <div className="space-y-4">
              <div><label className="label-field">Producto IDs (separados por coma, opcional)</label><input className="input-field" value={fcFilter.producto_ids} onChange={e => setFcFilter({ ...fcFilter, producto_ids: e.target.value })} placeholder="uuid1, uuid2..." /></div>
              <div><label className="label-field">Días lookback</label><input className="input-field" type="number" value={fcFilter.lookback_dias} onChange={e => setFcFilter({ ...fcFilter, lookback_dias: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={fcFilter.incluir_estacionalidad} onChange={e => setFcFilter({ ...fcFilter, incluir_estacionalidad: e.target.checked })} className="rounded" />
                <label className="text-sm">Incluir estacionalidad</label>
              </div>
              <button onClick={handleEnhancedForecast} className="btn-primary w-full">Generar forecast</button>
            </div>
          </div>
          {enhancedForecast && (
            <div className="card p-6">
              <h3 className="text-lg font-bold mb-4">Resultado</h3>
              <pre className="text-xs max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded">{JSON.stringify(enhancedForecast, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {showReception && (
        <div className="modal-overlay" onClick={() => setShowReception(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700"><h3 className="text-lg font-bold">Nueva recepción</h3></div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="label-field">Producto ID</label><input className="input-field" value={newBatch.producto_id} onChange={e => setNewBatch({ ...newBatch, producto_id: e.target.value })} /></div>
              <div><label className="label-field">Proveedor ID</label><input className="input-field" value={newBatch.proveedor_id} onChange={e => setNewBatch({ ...newBatch, proveedor_id: e.target.value })} /></div>
              <div><label className="label-field">Cantidad recibida</label><input className="input-field" type="number" step="0.001" value={newBatch.cantidad_recibida || ""} onChange={e => setNewBatch({ ...newBatch, cantidad_recibida: Number(e.target.value) })} /></div>
              <div><label className="label-field">Cantidad aceptada</label><input className="input-field" type="number" step="0.001" value={newBatch.cantidad_aceptada || ""} onChange={e => setNewBatch({ ...newBatch, cantidad_aceptada: Number(e.target.value) })} /></div>
              <div><label className="label-field">Calidad</label>
                <select className="input-field" value={newBatch.calidad} onChange={e => setNewBatch({ ...newBatch, calidad: e.target.value })}>
                  <option value="premium">Premium</option><option value="estandar">Estándar</option><option value="descuento">Descuento</option><option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div><label className="label-field">Precio unitario</label><input className="input-field" type="number" value={newBatch.precio_unitario || ""} onChange={e => setNewBatch({ ...newBatch, precio_unitario: Number(e.target.value) })} /></div>
              <div><label className="label-field">Fecha recepción</label><input className="input-field" type="date" value={newBatch.fecha_recepcion} onChange={e => setNewBatch({ ...newBatch, fecha_recepcion: e.target.value })} /></div>
              <div><label className="label-field">Fecha vencimiento estimada</label><input className="input-field" type="date" value={newBatch.fecha_vencimiento_estimada} onChange={e => setNewBatch({ ...newBatch, fecha_vencimiento_estimada: e.target.value })} /></div>
              <div><label className="label-field">Lote proveedor</label><input className="input-field" value={newBatch.lote_proveedor} onChange={e => setNewBatch({ ...newBatch, lote_proveedor: e.target.value })} /></div>
              <div><label className="label-field">Nota calidad</label><textarea className="input-field" value={newBatch.nota_calidad} onChange={e => setNewBatch({ ...newBatch, nota_calidad: e.target.value })} rows={3} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowReception(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateBatch} disabled={!newBatch.producto_id || !newBatch.cantidad_recibida} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showAudit && (
        <div className="modal-overlay" onClick={() => setShowAudit(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700"><h3 className="text-lg font-bold">Nueva auditoría de frescura</h3></div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="label-field">Producto ID</label><input className="input-field" value={newAudit.producto_id} onChange={e => setNewAudit({ ...newAudit, producto_id: e.target.value })} /></div>
              <div><label className="label-field">Batch ID (opcional)</label><input className="input-field" value={newAudit.batch_id} onChange={e => setNewAudit({ ...newAudit, batch_id: e.target.value })} /></div>
              <div><label className="label-field">Calidad actual</label>
                <select className="input-field" value={newAudit.calidad_actual} onChange={e => setNewAudit({ ...newAudit, calidad_actual: e.target.value })}>
                  <option value="bueno">Bueno</option><option value="regular">Regular</option><option value="malo">Malo</option>
                </select>
              </div>
              <div><label className="label-field">Firmeza (1-5)</label><input className="input-field" type="number" min="1" max="5" value={newAudit.firmeza} onChange={e => setNewAudit({ ...newAudit, firmeza: Number(e.target.value) })} /></div>
              <div><label className="label-field">Color (1-5)</label><input className="input-field" type="number" min="1" max="5" value={newAudit.color} onChange={e => setNewAudit({ ...newAudit, color: Number(e.target.value) })} /></div>
              <div><label className="label-field">Aspecto general (1-5)</label><input className="input-field" type="number" min="1" max="5" value={newAudit.aspecto_general} onChange={e => setNewAudit({ ...newAudit, aspecto_general: Number(e.target.value) })} /></div>
              <div><label className="label-field">Notas</label><textarea className="input-field" value={newAudit.notas} onChange={e => setNewAudit({ ...newAudit, notas: e.target.value })} rows={3} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAudit(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateAudit} disabled={!newAudit.producto_id} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

// ── ENTERPRISE UNLOCK PROMO COMPONENT ─────────────────────────────────
function UnlockPromo({ title, desc, featureKey, competitors }: {
  title: string
  desc: string
  featureKey: string
  competitors: { sap: string; oracle: string }
}) {
  const handleUnlock = () => {
    const event = new CustomEvent("unlock-feature", { detail: featureKey })
    window.dispatchEvent(event)
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 text-white border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-500">
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-bl-full -mr-16 -mt-16 blur-3xl opacity-60"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-tr-full -ml-16 -mb-16 blur-2xl opacity-40"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Opcional Enterprise Tier-1
            </span>
            <h2 className="text-3xl font-black tracking-tight">{title}</h2>
            <p className="text-slate-400 text-base leading-relaxed max-w-2xl">{desc}</p>
          </div>
          
          <button 
            onClick={handleUnlock}
            className="flex-shrink-0 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] border border-white/10 flex items-center gap-2 group"
          >
            <span>Activar Módulo Opcional</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Feature Comparison Matrix */}
        <div className="border-t border-slate-800 pt-8 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Matriz de Comparación Competitiva</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Intelimarket Card */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-primary/20 hover:border-primary/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-extrabold text-white">InteliMarket</span>
                  <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full uppercase">Líder</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-1.5">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Totalmente integrado en tiempo real sin interfaces lentas.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Algoritmos de aprendizaje adaptativo localizados.</span>
                  </li>
                </ul>
              </div>
              <div className="text-[10px] text-green-400 font-bold mt-4">Listo para Producción Instantánea</div>
            </div>

            {/* SAP Card */}
            <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between opacity-80">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-slate-400">SAP S/4HANA</span>
                  <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase">Complejo</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {competitors.sap} Requiere licencias ERP adicionales y pesada parametrización ABAP.
                </p>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-4">Costo Estimado: Muy Elevado</div>
            </div>

            {/* Oracle Card */}
            <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between opacity-80">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-slate-400">Oracle Retail</span>
                  <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase">Consultoría</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {competitors.oracle} Demanda software externo middleware y costoso soporte.
                </p>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-4">Costo Estimado: Muy Elevado</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── LICENSING CONFIGURATOR TAB ────────────────────────────────────────
function LicensingTab({ config, setConfig }: {
  config: { esl: boolean; freshness: boolean; coldChain: boolean; batchMarkdown: boolean }
  setConfig: React.Dispatch<React.SetStateAction<{ esl: boolean; freshness: boolean; coldChain: boolean; batchMarkdown: boolean }>>
}) {
  const toast = useToast()
  
  const toggleFeature = (key: keyof typeof config) => {
    setConfig(prev => {
      const next = { ...prev, [key]: !prev[key] }
      toast.success(
        next[key] ? "Módulo Enterprise Activado" : "Módulo Desactivado",
        `Se ha modificado el estado del componente opcional.`
      )
      return next
    })
  }

  const features = [
    {
      k: "freshness" as const,
      l: "Auditoría de Frescura & Scorecards (Verdulería)",
      desc: "Monitoreo científico de calidad y firmeza en vegetales con penalización automática a proveedores.",
      icon: ShieldCheck,
      color: "from-green-500 to-emerald-600 bg-green-500/10 border-green-500/20"
    },
    {
      k: "coldChain" as const,
      l: "Control de Cadena de Frío, pH y HACCP (Carnicería)",
      desc: "Sensores IoT en tiempo real para pH (5.4 - 5.8) y temperatura core para terneza y sanidad.",
      icon: Thermometer,
      color: "from-blue-500 to-indigo-600 bg-blue-500/10 border-blue-500/20"
    },
    {
      k: "esl" as const,
      l: "Etiquetas Electrónicas (ESL - Tinta Electrónica)",
      desc: "Sincronización total de pantallas de tinta electrónica en góndolas con la base del POS.",
      icon: Tag,
      color: "from-purple-500 to-pink-600 bg-purple-500/10 border-purple-500/20"
    },
    {
      k: "batchMarkdown" as const,
      l: "Reglas de Markdown Escalonado por Lote",
      desc: "Descuentos dinámicos automáticos decrecientes a medida que se acerca el vencimiento del lote.",
      icon: TrendingDown,
      color: "from-amber-500 to-red-600 bg-amber-500/10 border-amber-500/20"
    }
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Consola de Módulos Tier-1 Opcionales</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-xl">
          Active o desactive de manera dinámica e independiente las características premium exclusivas de InteliMarket. Diseñado para batir a SAP y Oracle en retail de alimentos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map(f => {
          const active = config[f.k]
          return (
            <div key={f.k} className={`card p-6 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
              active ? "border-primary dark:border-primary bg-primary/5" : "border-gray-200 dark:border-slate-800"
            }`}>
              <div className="flex gap-4">
                <div className={`p-3.5 rounded-2xl border flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${
                  active ? "from-primary to-blue-600 text-white border-primary/20" : "from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 text-gray-500 dark:text-gray-400 border-gray-200/50 dark:border-gray-700/50"
                }`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{f.l}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 dark:border-slate-800/80 pt-4 flex justify-between items-center">
                <span className="text-xs text-gray-400">Estado del Módulo</span>
                
                <button 
                  onClick={() => toggleFeature(f.k)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    active ? "bg-primary" : "bg-gray-200 dark:bg-slate-700"
                  }`}
                >
                  <span 
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ELECTRONIC SHELF LABEL MONITOR (ESL) TAB ─────────────────────────
function ESLTab() {
  const toast = useToast()
  const [selectedTag, setSelectedTag] = useState<any | null>(null)
  const [priceForm, setPriceForm] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState("")

  const [tags, setTags] = useState([
    { id: "ESL-A1-TOMA", producto: "Tomate Perita (kg)", precio_gondola: 8500, precio_pos: 8500, bateria: 96, rf: -45, sync: true, area: "Verdulería", gondola: "Góndola A1" },
    { id: "ESL-A4-FRUT", producto: "Frutilla Fresca 500g", precio_gondola: 10500, precio_pos: 10500, bateria: 92, rf: -50, sync: true, area: "Verdulería", gondola: "Góndola A4" },
    { id: "ESL-B3-COST", producto: "Costilla de Primera (kg)", precio_gondola: 48000, precio_pos: 48000, bateria: 99, rf: -41, sync: true, area: "Carnicería", gondola: "Góndola B3" },
    { id: "ESL-P1-PANF", producto: "Pan Felipe Bolsa 500g", precio_gondola: 3500, precio_pos: 3500, bateria: 48, rf: -68, sync: true, area: "Panadería", gondola: "Góndola P1" },
    { id: "ESL-L1-YOGD", producto: "Yogur Dietético 200g", precio_gondola: 8500, precio_pos: 8500, bateria: 87, rf: -53, sync: true, area: "Lácteos", gondola: "Góndola L1" }
  ])

  const handleSyncPrice = () => {
    if (!selectedTag || !priceForm) return
    setSyncing(true)
    
    setTimeout(() => {
      setTags(tags.map(t => {
        if (t.id === selectedTag.id) {
          return {
            ...t,
            precio_gondola: Number(priceForm),
            precio_pos: Number(priceForm),
            sync: true
          }
        }
        return t
      }))
      
      setSyncing(false)
      setSelectedTag(null)
      toast.success("Etiqueta Sincronizada", "El precio en la góndola de tinta electrónica coincide al 100% con el POS.")
    }, 1500)
  }

  const handleDesyncTest = (tagId: string) => {
    setTags(tags.map(t => {
      if (t.id === tagId) {
        return {
          ...t,
          precio_gondola: t.precio_gondola * 1.15, // Simulate a Gondola Price discrepancy
          sync: false
        }
      }
      return t
    }))
    toast.error("Alerta de Desincronización", "Se ha detectado una discrepancia de precio entre Góndola y POS.")
  }

  const filtered = tags.filter(t => 
    t.producto.toLowerCase().includes(search.toLowerCase()) || 
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.area.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Wireless RF Gateway Telemetry Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white border border-slate-700 shadow-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-bl-full -mr-8 -mt-8 blur-xl" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold tracking-wider uppercase mb-3">
              <Wifi className="w-3.5 h-3.5" /> Gateway de Radiofrecuencia ESL
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Antena Principal: Conectada</h3>
            <p className="text-slate-400 text-sm mt-1">
              Frecuencia: 2.4GHz Zigbee High-Penetration · Displays Vinculados: {tags.length} · Tasa de Sincronización: {((tags.filter(t => t.sync).length / tags.length) * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center font-mono">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Última Auditoría de Góndola</span>
            <p className="text-base font-extrabold text-purple-400 mt-1">Sincronización 100% Ok</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar etiqueta ESL por producto, ID o góndola..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Displays Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 uppercase">
                  <th className="p-3">Góndola / ID</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Batería</th>
                  <th className="p-3">Señal RF</th>
                  <th className="p-3">Góndola vs POS</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {filtered.map(t => (
                  <tr key={t.id} className="table-row text-xs">
                    <td className="p-3 font-mono">
                      <span className="font-bold block text-gray-800 dark:text-white">{t.gondola}</span>
                      <span className="text-[10px] text-gray-400 block">{t.id}</span>
                    </td>
                    <td className="p-3 font-semibold text-gray-900 dark:text-white">{t.producto}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Battery className={`w-4 h-4 ${t.bateria < 50 ? "text-red-500 animate-pulse" : "text-green-500"}`} />
                        <span className="font-bold">{t.bateria}%</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-medium">{t.rf} dBm</td>
                    <td className="p-3">
                      {t.sync ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-500 border border-green-500/20 font-bold">
                          <Check className="w-3.5 h-3.5" /> {formatPYG(t.precio_gondola)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20 font-bold animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" /> Discrepancia: {formatPYG(t.precio_gondola)} vs {formatPYG(t.precio_pos)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedTag(t); setPriceForm(t.precio_pos.toString()) }}
                        className="text-xs bg-primary/10 hover:bg-primary text-primary hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold"
                      >
                        Ajustar
                      </button>
                      <button 
                        onClick={() => handleDesyncTest(t.id)}
                        className="text-xs bg-slate-100 dark:bg-slate-800 text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg transition-all"
                        title="Simular error de precio en góndola"
                      >
                        Sim. Error
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sync panel */}
        <div className="lg:col-span-1">
          {selectedTag ? (
            <div className="card p-6 border border-primary/30 bg-primary/5 space-y-4 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-start">
                <h3 className="font-extrabold text-base">Sincronizador ESL Inteligente</h3>
                <button onClick={() => setSelectedTag(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Etiqueta:</span> <span className="font-mono font-bold">{selectedTag.id}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Producto:</span> <span className="font-bold">{selectedTag.producto}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Góndola:</span> <span className="font-bold">{selectedTag.gondola}</span></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Nuevo Precio POS & Góndola</label>
                <input 
                  type="number" className="input-field text-lg font-mono font-bold" 
                  value={priceForm} onChange={e => setPriceForm(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleSyncPrice} 
                disabled={syncing}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-extrabold shadow-lg"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sincronizando RF...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Sincronizar ESL al 100%</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="card p-6 border border-gray-100 dark:border-slate-800 text-center py-12 flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-purple-500/10 rounded-full text-purple-400"><Tag className="w-8 h-8" /></div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Seleccione una Etiqueta</h3>
              <p className="text-xs text-gray-500 max-w-[200px]">Seleccione un display de tinta electrónica de la grilla para ajustar su precio o auditar su conectividad en tiempo real.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
