import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  ChefHat, Plus, Loader2, CheckCircle2,
  DollarSign, Calculator, Layers, Clock, Flame, UtensilsCrossed,
  RefreshCw, Info, Calendar, AlertCircle, Package, ArrowRight,
  TrendingUp, Sparkles, Scale
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "dashboard" | "recetas" | "planes" | "rotiseria" | "calculadora"

export default function PanaderiaRotiseriaPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [bakeryRecipes, setBakeryRecipes] = useState<any[]>([])
  const [bakeryPlanes, setBakeryPlanes] = useState<any[]>([])
  const [rotiseriaRecipes, setRotiseriaRecipes] = useState<any[]>([])
  const [rotiseriaPlanes, setRotiseriaPlanes] = useState<any[]>([])
  const [rotiseriaDash, setRotiseriaDash] = useState<any>(null)

  // Formularios
  const [showRecetaForm, setShowRecetaForm] = useState(false)
  const [savingReceta, setSavingReceta] = useState(false)
  const [recetaArea, setRecetaArea] = useState<"bakery" | "rotiseria">("bakery")
  const [recetaForm, setRecetaForm] = useState({ nombre: "", rendimiento_piezas: "", costo_estimado: "", tiempo_preparacion_min: "", descripcion: "", activa: true })

  const [showPlanForm, setShowPlanForm] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm, setPlanForm] = useState({ nombre: "", area: "panaderia", tipo_coccion: "horno", temperatura_objetivo: "", tiempo_coccion_min: "", descripcion: "" })

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
      const [bkRec, bkPl, rtRec, rtPl, rtDash] = await Promise.allSettled([
        api.supermer.recipes.list({ area: "panaderia" }),
        api.supermer.bakery.plans(),
        api.rotiseria.recipes.list(),
        api.rotiseria.plans.list(),
        api.rotiseria.dashboard(),
      ])
      if (bkRec.status === "fulfilled" && Array.isArray(bkRec.value)) setBakeryRecipes(bkRec.value)
      if (bkPl.status === "fulfilled" && Array.isArray(bkPl.value)) setBakeryPlanes(bkPl.value)
      if (rtRec.status === "fulfilled" && Array.isArray(rtRec.value)) setRotiseriaRecipes(rtRec.value)
      if (rtPl.status === "fulfilled" && Array.isArray(rtPl.value)) setRotiseriaPlanes(rtPl.value)
      if (rtDash.status === "fulfilled") setRotiseriaDash(rtDash.value)
    } catch (e: any) {
      toast.error("Error al cargar panadería", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveReceta = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingReceta(true)
    try {
      if (recetaArea === "bakery") {
        await api.supermer.recipes.create({ ...recetaForm, area: "panaderia", rendimiento_piezas: parseInt(recetaForm.rendimiento_piezas), costo_estimado: parseFloat(recetaForm.costo_estimado || "0") })
      } else {
        await api.rotiseria.recipes.create({ ...recetaForm, activa: true })
      }
      toast.success("Receta registrada", `La receta "${recetaForm.nombre}" fue guardada.`)
      setShowRecetaForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar receta", err.message)
    } finally {
      setSavingReceta(false)
    }
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlan(true)
    try {
      await api.rotiseria.plans.create({ ...planForm, temperatura_objetivo: parseFloat(planForm.temperatura_objetivo || "0"), tiempo_coccion_min: parseInt(planForm.tiempo_coccion_min || "0"), fecha: new Date().toISOString().split("T")[0] })
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
                    OPERACIONES DE SALÓN · PRODUCCIÓN PROPIA & ROTISERÍA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {bakeryRecipes.length + rotiseriaRecipes.length} Fórmulas de Elaboración
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Panadería & Rotisería Artesanal
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Recetas con costeo de insumos, porcentaje panadero, órdenes de cocción con monitoreo térmico HACCP y rotación
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                🥐 {bakeryPlanes.length} planes de horneado
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
              onClick={() => setShowRecetaForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Receta
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
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Planes Horneado</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {bakeryPlanes.length}
            </p>
            <p className="text-[11px] text-slate-400">Horneadas semanales</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cocción Hoy</span>
              <Flame className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {rotiseriaPlanes.filter((p: any) => p.fecha === new Date().toISOString().split("T")[0]).length}
            </p>
            <p className="text-[11px] text-slate-400">Hornadas del día</p>
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
          { id: "recetas", label: `Recetas Panadería`, count: bakeryRecipes.length, icon: Layers },
          { id: "planes", label: `Planes de Horneado`, count: bakeryPlanes.length, icon: Calendar },
          { id: "rotiseria", label: `Cocción & Rotisería`, count: rotiseriaPlanes.length, icon: Flame },
          { id: "calculadora", label: "Calculadora Panadero", icon: Calculator },
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
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Recetas Panadería Destacadas</h3>
            {bakeryRecipes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin recetas. Agregá las fórmulas de tus panes con su costeo por insumo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bakeryRecipes.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">{r.nombre}</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatPYG(r.costo_unitario || 0)} / u</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Control Diario de Rotisería</h3>
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

      {/* ══════════════════════ TAB 2: RECETAS PANADERÍA ══════════════════════ */}
      {tab === "recetas" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {bakeryRecipes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin recetas de panadería</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá tus fórmulas de panes, facturas y masas con cálculo automático de costo por insumo.</p>
              <button onClick={() => { setRecetaArea("bakery"); setShowRecetaForm(true) }} className="px-4 py-2 mt-4 rounded-2xl bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Primera Receta
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Receta</th>
                    <th className="p-4 text-right">Rendimiento</th>
                    <th className="p-4 text-right">Costo Unit.</th>
                    <th className="p-4 text-right">Precio Venta</th>
                    <th className="p-4 text-center">Margen Bruto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {bakeryRecipes.map((r: any) => {
                    const margen = r.precio_venta && r.costo_unitario ? ((r.precio_venta - r.costo_unitario) / r.precio_venta * 100).toFixed(1) : null
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900 dark:text-white">{r.nombre}</p>
                          <p className="text-[10px] text-slate-400">{r.descripcion?.slice(0, 60)}</p>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{r.rendimiento_piezas || "—"} pzas</td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatPYG(r.costo_unitario || 0)}</td>
                        <td className="p-4 text-right font-mono text-emerald-600 font-black">{r.precio_venta ? formatPYG(r.precio_venta) : "—"}</td>
                        <td className="p-4 text-center">
                          {margen ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${parseFloat(margen) >= 30 ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-600 bg-amber-500/10 border border-amber-500/20"}`}>
                              {margen}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: PLANES DE HORNEADO ══════════════════════ */}
      {tab === "planes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {bakeryPlanes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin planes de horneado</p>
              <p className="mt-1 max-w-xs mx-auto">Programá la producción semanal de panificados con cantidades objetivo por día.</p>
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
                      <td className="p-4 text-center text-slate-500 font-medium">{["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][p.dia_semana] || p.dia_semana}</td>
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
      )}

      {/* ══════════════════════ TAB 4: ROTISERÍA ══════════════════════ */}
      {tab === "rotiseria" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-xs text-slate-700 dark:text-slate-300 uppercase">Planes de Cocción Rotisería</h3>
              <button onClick={() => setShowPlanForm(true)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-sm flex items-center gap-1.5">
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

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-xs text-slate-700 dark:text-slate-300 uppercase">Recetas de Rotisería</h3>
            </div>
            {rotiseriaRecipes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin recetas de rotisería. Agregá los preparados típicos (pollo al espiedo, milanesas, tartas).</p>
                <button onClick={() => { setRecetaArea("rotiseria"); setShowRecetaForm(true) }} className="px-4 py-2 mt-3 rounded-2xl bg-orange-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Agregar Receta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {rotiseriaRecipes.map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <p className="font-extrabold text-slate-900 dark:text-white">{r.nombre}</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${r.activa ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-400 bg-slate-100"}`}>{r.activa ? "Activa" : "Inactiva"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 5: CALCULADORA PANADERO ══════════════════════ */}
      {tab === "calculadora" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-500" /> Calculadora de Porcentaje Panadero
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Fórmula universal donde la Harina representa el 100% de la base.</p>
            </div>
            <div className="space-y-4 text-xs">
              {[
                { label: "Harina (Base 100%)", val: harinaKg, setter: setHarinaKg, unit: "kg", isPct: false, min: 1, max: 500 },
                { label: "Hidratación (Agua)", val: hidratPct, setter: setHidratPct, unit: "%", isPct: true, min: 50, max: 85 },
                { label: "Sal", val: salPct, setter: setSalPct, unit: "%", isPct: true, min: 1, max: 3 },
                { label: "Levadura Fresca", val: levPct, setter: setLevPct, unit: "%", isPct: true, min: 0.5, max: 5 },
                { label: "Grasa / Manteca", val: grasaPct, setter: setGrasaPct, unit: "%", isPct: true, min: 0, max: 20 },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-extrabold">{item.val.toFixed(1)} {item.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step={item.isPct ? 0.5 : 5}
                    value={item.val}
                    onChange={e => item.setter(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-amber-600 dark:text-amber-300 uppercase">Resultado de Masa & Proporciones</h3>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Harina", val: harinaKg, pct: 100 },
                { label: "Agua", val: calc.agua, pct: hidratPct },
                { label: "Sal", val: calc.sal, pct: salPct },
                { label: "Levadura", val: calc.lev, pct: levPct },
                { label: "Grasa", val: calc.grasa, pct: grasaPct },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-500/20">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                  <div className="text-right">
                    <span className="font-black font-mono text-amber-600 dark:text-amber-400">{item.val.toFixed(3)} kg</span>
                    <span className="ml-2 text-[10px] text-slate-400">({item.pct}%)</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
                <span className="font-extrabold uppercase text-xs">Peso Total de Masa</span>
                <span className="font-black font-mono text-xl">{calc.masa.toFixed(3)} kg</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA RECETA ── */}
      {showRecetaForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-amber-600" /> Nueva Receta ({recetaArea === "bakery" ? "Panadería" : "Rotisería"})
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRecetaArea("bakery")}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${recetaArea === "bakery" ? "bg-amber-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
              >
                Panadería
              </button>
              <button
                type="button"
                onClick={() => setRecetaArea("rotiseria")}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${recetaArea === "rotiseria" ? "bg-orange-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
              >
                Rotisería
              </button>
            </div>
            <form onSubmit={handleSaveReceta} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nombre de la Receta *</label>
                <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={recetaForm.nombre} onChange={e => setRecetaForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Pan de Leche 100g" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Rendimiento (Piezas)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={recetaForm.rendimiento_piezas} onChange={e => setRecetaForm(f => ({ ...f, rendimiento_piezas: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tiempo Prep. (min)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={recetaForm.tiempo_preparacion_min} onChange={e => setRecetaForm(f => ({ ...f, tiempo_preparacion_min: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción / Fórmulas</label>
                <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-14" value={recetaForm.descripcion} onChange={e => setRecetaForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowRecetaForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingReceta} className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition">
                  {savingReceta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar Receta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL PLAN COCCIÓN ── */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Plan de Cocción Rotisería
            </h2>
            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción del Lote *</label>
                <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={planForm.descripcion} onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Pollos al espiedo 12u - Turno mañana" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo de Cocción</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={planForm.tipo_coccion} onChange={e => setPlanForm(f => ({ ...f, tipo_coccion: e.target.value }))}>
                    <option value="horno">Horno</option>
                    <option value="espiedo">Espiedo</option>
                    <option value="freidora">Freidora</option>
                    <option value="plancha">Plancha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Temp. Objetivo (°C)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={planForm.temperatura_objetivo} onChange={e => setPlanForm(f => ({ ...f, temperatura_objetivo: e.target.value }))} placeholder="72" />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Tiempo Estimado (min)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={planForm.tiempo_coccion_min} onChange={e => setPlanForm(f => ({ ...f, tiempo_coccion_min: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowPlanForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingPlan} className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition">
                  {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}Crear Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
