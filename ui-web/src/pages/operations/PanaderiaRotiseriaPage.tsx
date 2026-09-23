import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  ChefHat, Plus, Loader2, CheckCircle2,
  DollarSign, Calculator, Layers, Clock, Flame, UtensilsCrossed,
  RefreshCw, Info, Calendar, AlertCircle, AlertTriangle, Package, ArrowRight,
  TrendingUp, Sparkles, Scale, Search, Edit, Trash2, Warehouse as WarehouseIcon,
  Check, Filter, ShieldCheck
} from "lucide-react"
import { api, type SupermerRecipe, type SupermerOrder } from "../../api"
import { useToast } from "../../context/ToastContext"
import WasteControlPanel from "../../components/operations/WasteControlPanel"
import RecipeBuilderModal from "../../components/operations/RecipeBuilderModal"
import ProduceBatchModal from "../../components/operations/ProduceBatchModal"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "dashboard" | "recetas" | "planes" | "rotiseria" | "calculadora" | "mermas"

const AREA_FILTERS = [
  { id: "todas", label: "Todas las Fórmulas", icon: "📋" },
  { id: "panaderia", label: "Panadería & Confitería", icon: "🥖" },
  { id: "rotiseria", label: "Rotisería & Cocina", icon: "🍗" },
  { id: "carniceria", label: "Carnicería & Desposte", icon: "🥩" },
  { id: "verduleria", label: "Verdulería Pre-pack", icon: "🥗" },
  { id: "pre_pack", label: "Fraccionamiento", icon: "📦" },
  { id: "otros", label: "Otros", icon: "⚙️" },
]

export default function PanaderiaRotiseriaPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [allRecipes, setAllRecipes] = useState<SupermerRecipe[]>([])
  const [productionOrders, setProductionOrders] = useState<SupermerOrder[]>([])
  const [bakeryPlanes, setBakeryPlanes] = useState<any[]>([])
  const [rotiseriaPlanes, setRotiseriaPlanes] = useState<any[]>([])
  const [rotiseriaDash, setRotiseriaDash] = useState<any>(null)

  // Filtros de recetas
  const [selectedAreaFilter, setSelectedAreaFilter] = useState("todas")
  const [recipeSearch, setRecipeSearch] = useState("")

  // Modales industriales BOM & Producción
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false)
  const [builderInitialArea, setBuilderInitialArea] = useState<string>("panaderia")
  const [recipeToEdit, setRecipeToEdit] = useState<SupermerRecipe | null>(null)

  const [showProduceModal, setShowProduceModal] = useState(false)
  const [recipeToProduce, setRecipeToProduce] = useState<SupermerRecipe | null>(null)

  // Formulario Plan de Cocción Rotisería
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm, setPlanForm] = useState({
    nombre: "",
    area: "panaderia",
    tipo_coccion: "horno",
    temperatura_objetivo: "",
    tiempo_coccion_min: "",
    descripcion: ""
  })

  // Calculadora de % panadero
  const [harinaKg, setHarinaKg] = useState(25)
  const [hidratPct, setHidratPct] = useState(60)
  const [salPct, setSalPct] = useState(2)
  const [levPct, setLevPct] = useState(1.5)
  const [grasaPct, setGrasaPct] = useState(3)

  const calc = useMemo(() => {
    const agua = (harinaKg * hidratPct) / 100
    const sal = (harinaKg * salPct) / 100
    const lev = (harinaKg * levPct) / 100
    const grasa = (harinaKg * grasaPct) / 100
    const masa = harinaKg + agua + sal + lev + grasa
    return { agua, sal, lev, grasa, masa }
  }, [harinaKg, hidratPct, salPct, levPct, grasaPct])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [recipesRes, ordersRes, bkPl, rtPl, rtDash] = await Promise.allSettled([
        api.supermer.recipes.list(),
        api.supermer.orders.list(),
        api.supermer.bakery.plans(),
        api.rotiseria.plans.list(),
        api.rotiseria.dashboard(),
      ])

      if (recipesRes.status === "fulfilled" && Array.isArray(recipesRes.value)) {
        setAllRecipes(recipesRes.value)
      }
      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
        setProductionOrders(ordersRes.value)
      }
      if (bkPl.status === "fulfilled" && Array.isArray(bkPl.value)) {
        setBakeryPlanes(bkPl.value)
      }
      if (rtPl.status === "fulfilled" && Array.isArray(rtPl.value)) {
        setRotiseriaPlanes(rtPl.value)
      }
      if (rtDash.status === "fulfilled") {
        setRotiseriaDash(rtDash.value)
      }
    } catch (e: any) {
      toast.error("Error al cargar producción", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  // Filtrado de recetas
  const filteredRecipes = useMemo(() => {
    return allRecipes.filter(r => {
      const matchesArea = selectedAreaFilter === "todas" || r.area === selectedAreaFilter
      const q = recipeSearch.toLowerCase().trim()
      const matchesSearch = !q ||
        r.nombre?.toLowerCase().includes(q) ||
        r.producto_terminado_nombre?.toLowerCase().includes(q) ||
        r.producto_terminado_sku?.toLowerCase().includes(q)
      return matchesArea && matchesSearch
    })
  }, [allRecipes, selectedAreaFilter, recipeSearch])

  const handleDeleteRecipe = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la fórmula "${name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.supermer.recipes.delete(id)
      toast.success("Receta eliminada", `La fórmula "${name}" fue eliminada.`)
      loadData()
    } catch (err: any) {
      toast.error("Error al eliminar", err.message)
    }
  }

  const handleOpenNewRecipe = (areaName = "panaderia") => {
    setRecipeToEdit(null)
    setBuilderInitialArea(areaName)
    setShowRecipeBuilder(true)
  }

  const handleOpenEditRecipe = (recipe: SupermerRecipe) => {
    setRecipeToEdit(recipe)
    setBuilderInitialArea(recipe.area || "panaderia")
    setShowRecipeBuilder(true)
  }

  const handleOpenProduce = (recipe: SupermerRecipe) => {
    setRecipeToProduce(recipe)
    setShowProduceModal(true)
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlan(true)
    try {
      await api.rotiseria.plans.create({
        ...planForm,
        temperatura_objetivo: parseFloat(planForm.temperatura_objetivo || "0"),
        tiempo_coccion_min: parseInt(planForm.tiempo_coccion_min || "0"),
        fecha: new Date().toISOString().split("T")[0]
      })
      toast.success("Plan de rotisería creado", "")
      setShowPlanForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al crear plan", err.message)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleAutoMarkdown = async () => {
    try {
      await api.rotiseria.autoMarkdown()
      toast.success("Markdowns aplicados", "Descuentos automáticos generados para productos de rotisería próximos a vencer.")
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const rtDash = rotiseriaDash || {}

  const bakeryRecipes = allRecipes.filter(r => r.area === "panaderia")
  const rotiseriaRecipes = allRecipes.filter(r => r.area === "rotiseria")
  const completedOrders = productionOrders.filter(o => o.estado === "completada")

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-7 border border-amber-500/20 shadow-2xl shadow-amber-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 border border-amber-400/30 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <ChefHat className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    OPERACIONES DE SALÓN · PRODUCCIÓN PROPIA MULTI-SECTOR
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {allRecipes.length} Fórmulas de Elaboración (BOM)
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Producción Propia, Panadería & Rotisería
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Fichas técnicas industriales, explosión de materias primas, control de depósitos y descarga automática de stock
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⚡ {completedOrders.length} hornadas/lotes completados
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🍗 {formatPYG(rtDash.ventas_hoy_gs || 0)} ventas rotisería hoy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleAutoMarkdown}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Markdown Rotisería
            </button>

            <button
              onClick={() => setShowPlanForm(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Plan Cocción
            </button>

            <button
              onClick={() => handleOpenNewRecipe("panaderia")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Ficha Técnica (BOM)
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recetas Panadería</span>
              <ChefHat className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-300">
              {bakeryRecipes.length}
            </p>
            <p className="text-[11px] text-slate-400">Fórmulas activas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recetas Rotisería</span>
              <UtensilsCrossed className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-orange-400">
              {rotiseriaRecipes.length}
            </p>
            <p className="text-[11px] text-slate-400">Preparados calientes</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lotes Producidos</span>
              <Flame className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {completedOrders.length}
            </p>
            <p className="text-[11px] text-slate-400">Hornadas registradas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Planes Horneado</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {bakeryPlanes.length}
            </p>
            <p className="text-[11px] text-slate-400">Programación semanal</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ventas Rotisería</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(rtDash.ventas_hoy_gs || 0)}
            </p>
            <p className="text-[11px] text-slate-400">Facturación del día</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Merma Rotisería</span>
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {(rtDash.merma_pct || 0).toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400">Pérdida en mostrador</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Resumen de Producción", icon: ChefHat },
          { id: "recetas", label: "Fórmulas & Recetas (BOM)", count: allRecipes.length, icon: Layers },
          { id: "planes", label: "Producción & Hornadas", count: completedOrders.length, icon: Flame },
          { id: "rotiseria", label: "Cocción Rotisería", count: rotiseriaPlanes.length, icon: UtensilsCrossed },
          { id: "calculadora", label: "Calculadora Panadero", icon: Calculator },
          { id: "mermas", label: "Mermas y Pérdidas", icon: AlertTriangle },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DASHBOARD RESUMEN ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-500" /> Fórmulas de Producción Activas
              </h3>
              <button
                onClick={() => setTab("recetas")}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
              >
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {allRecipes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin recetas registradas. Creá tu primera ficha técnica para iniciar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allRecipes.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white block">{r.nombre}</span>
                      <span className="text-[10px] text-slate-400">
                        {r.items?.length || 0} materias primas · Rinde {r.cantidad_esperada} {r.unidad_medida}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">
                        Costo: {formatPYG(r.costo_unitario_estimado || 0)}
                      </span>
                      {r.producto_terminado_precio_venta && (
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">
                          PVP: {formatPYG(r.producto_terminado_precio_venta)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-orange-500" /> Control Diario de Rotisería
            </h3>
            {Object.keys(rtDash).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Flame className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin datos de rotisería aún. Creá planes de cocción para activar el módulo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Planes de Cocción Hoy", val: rtDash.planes_hoy ?? 0 },
                  { label: "Kg Producidos", val: `${(rtDash.kg_producidos_hoy || 0).toFixed(1)} kg` },
                  { label: "Conformidad Temperatura HACCP", val: `${(rtDash.conformidad_temp_pct || 0).toFixed(1)}%` },
                  { label: "Etiquetas de Balanza Generadas", val: rtDash.etiquetas_generadas ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3.5 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-mono font-black text-orange-600 dark:text-orange-400">{item.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: FÓRMULAS & RECETAS (BOM INDUSTRIAL) ══════════════════════ */}
      {tab === "recetas" && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS POR SECTOR Y BÚSQUEDA */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {AREA_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedAreaFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    selectedAreaFilter === f.id
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar receta o producto..."
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => handleOpenNewRecipe(selectedAreaFilter !== "todas" ? selectedAreaFilter : "panaderia")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Ficha
              </button>
            </div>
          </div>

          {/* TABLA INDUSTRIAL DE RECETAS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            {filteredRecipes.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs space-y-3">
                <ChefHat className="w-12 h-12 mx-auto opacity-30 text-amber-500" />
                <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                  No se encontraron fichas técnicas
                </p>
                <p className="max-w-md mx-auto text-slate-400 text-xs">
                  Creá una receta vinculando materias primas (harina, levadura, etc.) a un producto terminado con rendimiento y depósitos de stock.
                </p>
                <button
                  onClick={() => handleOpenNewRecipe(selectedAreaFilter !== "todas" ? selectedAreaFilter : "panaderia")}
                  className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs inline-flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Crear Primera Receta
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[900px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Fórmula & Producto Terminado</th>
                      <th className="p-4 text-center">Sector</th>
                      <th className="p-4 text-right">Rendimiento Base</th>
                      <th className="p-4 text-center">Insumos</th>
                      <th className="p-4 text-right">Costo Total Batch</th>
                      <th className="p-4 text-right">Costo Unit. (PPP)</th>
                      <th className="p-4 text-right">Precio Venta (PVP)</th>
                      <th className="p-4 text-center">Margen Bruto</th>
                      <th className="p-4 text-left">Depósitos</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredRecipes.map((r) => {
                      const margenPct = Number(r.margen_estimado_pct || 0)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="p-4">
                            <p className="font-extrabold text-slate-900 dark:text-white text-sm">{r.nombre}</p>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                              Terminado: {r.producto_terminado_nombre || "—"}
                            </p>
                            {r.producto_terminado_sku && (
                              <p className="text-[10px] font-mono text-slate-400">SKU: {r.producto_terminado_sku}</p>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {r.area}
                            </span>
                          </td>

                          <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {r.cantidad_esperada} {r.unidad_medida}
                          </td>

                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Package className="w-3 h-3" /> {r.items?.length || 0}
                            </span>
                          </td>

                          <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatPYG(r.costo_total_estimado || 0)}
                          </td>

                          <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                            {formatPYG(r.costo_unitario_estimado || 0)}
                          </td>

                          <td className="p-4 text-right font-mono text-emerald-600 font-black">
                            {r.producto_terminado_precio_venta ? formatPYG(r.producto_terminado_precio_venta) : "—"}
                          </td>

                          <td className="p-4 text-center">
                            {r.producto_terminado_precio_venta ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${
                                margenPct >= 35
                                  ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20"
                                  : margenPct >= 15
                                  ? "text-amber-600 bg-amber-500/10 border border-amber-500/20"
                                  : "text-rose-600 bg-rose-500/10 border border-rose-500/20"
                              }`}>
                                {margenPct.toFixed(1)}%
                              </span>
                            ) : "—"}
                          </td>

                          <td className="p-4 text-slate-500 dark:text-slate-400 text-[10px]">
                            {r.deposito_origen_nombre && (
                              <p className="truncate max-w-[130px]" title={r.deposito_origen_nombre}>
                                <strong>Insumos:</strong> {r.deposito_origen_nombre}
                              </p>
                            )}
                            {r.deposito_destino_nombre && (
                              <p className="truncate max-w-[130px]" title={r.deposito_destino_nombre}>
                                <strong>Salón:</strong> {r.deposito_destino_nombre}
                              </p>
                            )}
                            {!r.deposito_origen_nombre && !r.deposito_destino_nombre && <p className="text-slate-400">—</p>}
                          </td>

                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenProduce(r)}
                                title="Hornear / Elaborar Lote (Descarga de stock)"
                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition"
                              >
                                <Flame className="w-3.5 h-3.5" /> Hornear
                              </button>

                              <button
                                onClick={() => handleOpenEditRecipe(r)}
                                title="Editar Ficha Técnica"
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteRecipe(r.id, r.nombre || "receta")}
                                title="Eliminar Receta"
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 3: ÓRDENES & HORNADAS DE PRODUCCIÓN ══════════════════════ */}
      {tab === "planes" && (
        <div className="space-y-6">
          {/* Historial de Órdenes Ejecutadas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" /> Historial de Hornadas & Producción Ejecutada
                </h3>
                <p className="text-[10px] text-slate-400">
                  Lotes elaborados con descuento automático de materias primas e ingreso a salón
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                {completedOrders.length} Lotes procesados
              </span>
            </div>

            {completedOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                <Flame className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
                <p className="font-bold text-slate-700 dark:text-slate-300">Aún no se registraron órdenes de producción</p>
                <p>Ingresá a la pestaña "Fórmulas & Recetas" y presioná "Hornear" en cualquier receta para generar un lote.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Lote / Fecha</th>
                      <th className="p-4">Receta / Producto Elaborado</th>
                      <th className="p-4 text-right">Cantidad Obtenida</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-left">Depósitos (Origen ➔ Destino)</th>
                      <th className="p-4 text-left">Responsable / Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {completedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-4">
                          <p className="font-mono font-black text-amber-600 dark:text-amber-400">
                            {o.lote_codigo || `LOT-${o.id.slice(0, 8)}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {o.fecha_fin ? formatDate(o.fecha_fin) : o.created_at ? formatDate(o.created_at) : "—"}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="font-extrabold text-slate-900 dark:text-white">
                            {o.receta_nombre || "Orden Directa"}
                          </p>
                          {o.producto_terminado_nombre && (
                            <p className="text-[10px] text-slate-400">{o.producto_terminado_nombre}</p>
                          )}
                        </td>

                        <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                          {o.producto_obtenido || o.cantidad_objetivo} UN
                        </td>

                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Completada
                          </span>
                        </td>

                        <td className="p-4 text-[10px] text-slate-600 dark:text-slate-300">
                          <p className="font-mono">
                            <strong>{o.deposito_origen_nombre || "Insumos"}</strong> ➔ <strong>{o.deposito_destino_nombre || "Salón"}</strong>
                          </p>
                        </td>

                        <td className="p-4 text-[11px] text-slate-500">
                          <p className="font-medium text-slate-700 dark:text-slate-300">{o.responsable_nombre || "Panadero"}</p>
                          {o.notas && <p className="text-[10px] text-slate-400 truncate max-w-xs">{o.notas}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Planes Semanales */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" /> Programación Semanal de Horneado
              </h3>
            </div>
            {bakeryPlanes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin planes semanales configurados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Plan de Producción</th>
                      <th className="p-4 text-center">Día Programado</th>
                      <th className="p-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {bakeryPlanes.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-extrabold text-slate-900 dark:text-white">{p.nombre}</td>
                        <td className="p-4 text-center text-slate-500 font-medium">
                          {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][p.dia_semana] || p.dia_semana}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${p.activo ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-400 bg-slate-100"}`}>
                            {p.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 4: ROTISERÍA ══════════════════════ */}
      {tab === "rotiseria" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-xs text-slate-700 dark:text-slate-300 uppercase">Planes de Cocción Rotisería</h3>
              <button
                onClick={() => setShowPlanForm(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />Nuevo Plan
              </button>
            </div>
            {rotiseriaPlanes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Flame className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin planes de cocción</p>
                <p className="mt-1">Registrá cada hornada de pollo, cerdo o preparados con temperatura y tiempo HACCP.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Descripción</th>
                      <th className="p-4 text-center">Temp. Objetivo</th>
                      <th className="p-4 text-center">Tiempo</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {rotiseriaPlanes.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{p.descripcion || p.nombre || "—"}</td>
                        <td className="p-4 text-center font-mono font-bold text-amber-500">{p.temperatura_objetivo ? `${p.temperatura_objetivo}°C` : "—"}</td>
                        <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-300">{p.tiempo_coccion_min ? `${p.tiempo_coccion_min} min` : "—"}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            p.estado === "completado" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" :
                            p.estado === "en_proceso" ? "text-blue-600 bg-blue-500/10 border border-blue-500/20" :
                            "text-amber-600 bg-amber-500/10 border border-amber-500/20"
                          }`}>
                            {p.estado || "planificado"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-mono">{p.fecha ? formatDate(p.fecha) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 5: CALCULADORA PANADERO ══════════════════════ */}
      {tab === "calculadora" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-500" /> Calculadora de Porcentaje Panadero
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Escalá cualquier fórmula en base a la harina base (100%) para obtener peso final de masa y rendimientos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Harina Base (kg) - 100%</label>
                <input
                  type="number"
                  value={harinaKg}
                  onChange={e => setHarinaKg(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-black text-lg text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hidratación (%)</label>
                  <input
                    type="number"
                    value={hidratPct}
                    onChange={e => setHidratPct(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sal (%)</label>
                  <input
                    type="number"
                    value={salPct}
                    onChange={e => setSalPct(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Levadura (%)</label>
                  <input
                    type="number"
                    value={levPct}
                    onChange={e => setLevPct(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Grasa / Manteca (%)</label>
                  <input
                    type="number"
                    value={grasaPct}
                    onChange={e => setGrasaPct(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-950 to-amber-950 text-white p-5 rounded-3xl border border-amber-500/20 space-y-4">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                Masa Final Resultante
              </span>
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Harina Base:</span>
                  <span className="font-mono font-bold">{harinaKg.toFixed(2)} kg</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Agua:</span>
                  <span className="font-mono font-bold text-blue-300">{calc.agua.toFixed(2)} L (kg)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Sal:</span>
                  <span className="font-mono font-bold">{calc.sal.toFixed(3)} kg</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Levadura:</span>
                  <span className="font-mono font-bold">{calc.lev.toFixed(3)} kg</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Grasa:</span>
                  <span className="font-mono font-bold">{calc.grasa.toFixed(2)} kg</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs text-slate-400 block font-bold">Peso Total Pastón:</span>
                  <p className="text-2xl font-black font-mono text-amber-300">{calc.masa.toFixed(2)} kg</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-bold">Piezas 100g:</span>
                  <p className="text-2xl font-black font-mono text-white">{Math.floor((calc.masa * 1000) / 100)} u</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 6: MERMAS ══════════════════════ */}
      {tab === "mermas" && (
        <WasteControlPanel areas={[
          { value: "panaderia", label: "Panadería" },
          { value: "rotiseria", label: "Rotisería" },
          { value: "carniceria", label: "Carnicería" },
        ]} />
      )}

      {/* ── MODAL CONSTRUCTOR DE RECETAS INDUSTRIAL (BOM) ── */}
      <RecipeBuilderModal
        isOpen={showRecipeBuilder}
        onClose={() => {
          setShowRecipeBuilder(false)
          setRecipeToEdit(null)
        }}
        onSuccess={loadData}
        initialArea={builderInitialArea}
        recipeToEdit={recipeToEdit}
      />

      {/* ── MODAL PRODUCCIÓN DIRECTA / HORNADA CON EXPLOSIÓN DE INSUMOS ── */}
      <ProduceBatchModal
        isOpen={showProduceModal}
        onClose={() => {
          setShowProduceModal(false)
          setRecipeToProduce(null)
        }}
        onSuccess={loadData}
        recipe={recipeToProduce}
      />

      {/* ── MODAL PLAN COCCIÓN ROTISERÍA ── */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Plan de Cocción Rotisería
            </h2>
            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción del Lote *</label>
                <input
                  required
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                  value={planForm.descripcion}
                  onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Pollos al espiedo 12u - Turno mañana"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo de Cocción</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={planForm.tipo_coccion}
                    onChange={e => setPlanForm(f => ({ ...f, tipo_coccion: e.target.value }))}
                  >
                    <option value="horno">Horno</option>
                    <option value="espiedo">Espiedo</option>
                    <option value="freidora">Freidora</option>
                    <option value="plancha">Plancha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Temp. Objetivo (°C)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none"
                    value={planForm.temperatura_objetivo}
                    onChange={e => setPlanForm(f => ({ ...f, temperatura_objetivo: e.target.value }))}
                    placeholder="72"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Tiempo Estimado (min)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none"
                    value={planForm.tiempo_coccion_min}
                    onChange={e => setPlanForm(f => ({ ...f, tiempo_coccion_min: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlanForm(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition"
                >
                  {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                  Crear Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
