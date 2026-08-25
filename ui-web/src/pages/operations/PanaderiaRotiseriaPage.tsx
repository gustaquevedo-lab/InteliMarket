import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ChefHat, Plus, Loader2, CheckCircle2,
  DollarSign, Calculator, Layers, Clock, Flame, UtensilsCrossed,
  RefreshCw, Info, Calendar, AlertCircle, Package
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
  }, [])

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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">Panadería & Rotisería</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Gestión integrada de producción artesanal: recetas con costeo por insumo, planes de horneado diario con porcentaje panadero, órdenes de cocción de rotisería con control de temperatura interna (HACCP) y markdown automático de productos de elaboración propia.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleAutoMarkdown} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-amber-700 border-amber-300">
            <DollarSign className="w-3.5 h-3.5" /><span>Markdown Rotisería</span>
          </button>
          <button onClick={() => setShowPlanForm(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /><span>Plan Cocción</span>
          </button>
          <button onClick={() => setShowRecetaForm(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span>Nueva Receta</span>
          </button>
        </div>
      </div>

      {/* BANNER */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-amber-900 dark:text-amber-300 mb-0.5">Producción Artesanal con Trazabilidad Completa</p>
          <p className="text-amber-800 dark:text-amber-400 leading-relaxed">
            Las recetas de panadería incluyen el cálculo automático de ingredientes usando porcentaje panadero (base = harina = 100%). Para rotisería, cada plan de cocción lleva registro de temperatura interna con alertas HACCP si no se alcanzan los mínimos de seguridad (72°C para aves, 65°C para cerdo).
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Recetas Panadería", val: bakeryRecipes.length, color: "text-amber-600" },
          { label: "Recetas Rotisería", val: rotiseriaRecipes.length, color: "text-orange-600" },
          { label: "Planes de Horneado", val: bakeryPlanes.length, color: "text-blue-600" },
          { label: "Planes Rotisería Hoy", val: rotiseriaPlanes.filter((p: any) => p.fecha === new Date().toISOString().split("T")[0]).length, color: "text-purple-600" },
          { label: "Ventas Rotisería", val: formatPYG(rtDash.ventas_hoy_gs || 0), color: "text-emerald-600" },
          { label: "Merma Rotisería", val: `${(rtDash.merma_pct || 0).toFixed(1)}%`, color: "text-red-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight mb-1">{kpi.label}</p>
            <p className={`text-base font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Resumen" },
            { id: "recetas", label: `Recetas Panadería (${bakeryRecipes.length})` },
            { id: "planes", label: `Planes Horneado (${bakeryPlanes.length})` },
            { id: "rotiseria", label: `Rotisería (${rotiseriaPlanes.length})` },
            { id: "calculadora", label: "Calculadora Panadero" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-amber-600 text-amber-600 dark:text-amber-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Recetas Panadería Registradas</h3>
            {bakeryRecipes.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin recetas. Agregá las fórmulas de tus panes con su costeo por insumo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bakeryRecipes.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-xs">
                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.nombre}</span>
                    <span className="font-mono font-bold text-amber-700">{formatPYG(r.costo_unitario || 0)} / u</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Dashboard Rotisería</h3>
            {Object.keys(rtDash).length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <Flame className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin datos de rotisería aún. Creá planes de cocción para activar el módulo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Planes de Cocción Hoy", val: rtDash.planes_hoy ?? 0 },
                  { label: "Kg Producidos", val: `${(rtDash.kg_producidos_hoy || 0).toFixed(1)} kg` },
                  { label: "Conformidad Temperatura", val: `${(rtDash.conformidad_temp_pct || 0).toFixed(1)}%` },
                  { label: "Etiquetas Generadas", val: rtDash.etiquetas_generadas ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl text-xs">
                    <span className="font-bold text-gray-700 dark:text-gray-300">{item.label}</span>
                    <span className="font-mono font-black text-orange-700 dark:text-orange-400">{item.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB RECETAS PANADERÍA */}
      {tab === "recetas" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {bakeryRecipes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin recetas de panadería</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá tus fórmulas de panes, facturas, medialunas y masas. El sistema calcula el costo por pieza según los insumos del depósito.</p>
              <button onClick={() => { setRecetaArea("bakery"); setShowRecetaForm(true) }} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Primera Receta
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Receta</th>
                  <th className="p-3.5 text-right">Rendimiento</th>
                  <th className="p-3.5 text-right">Costo Unit.</th>
                  <th className="p-3.5 text-right">Precio Venta</th>
                  <th className="p-3.5 text-center">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {bakeryRecipes.map((r: any) => {
                  const margen = r.precio_venta && r.costo_unitario ? ((r.precio_venta - r.costo_unitario) / r.precio_venta * 100).toFixed(1) : null
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5"><p className="font-extrabold text-gray-900 dark:text-white">{r.nombre}</p><p className="text-[10px] text-gray-400">{r.descripcion?.slice(0, 60)}</p></td>
                      <td className="p-3.5 text-right font-mono">{r.rendimiento_piezas || "—"} pzas</td>
                      <td className="p-3.5 text-right font-mono">{formatPYG(r.costo_unitario || 0)}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-600 font-bold">{r.precio_venta ? formatPYG(r.precio_venta) : "—"}</td>
                      <td className="p-3.5 text-center">{margen ? <span className={`font-bold font-mono ${parseFloat(margen) >= 30 ? "text-emerald-600" : "text-amber-600"}`}>{margen}%</span> : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB PLANES HORNEADO */}
      {tab === "planes" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {bakeryPlanes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin planes de horneado</p>
              <p className="mt-1 max-w-xs mx-auto">Los planes de horneado permiten programar la producción por día de la semana con cantidades objetivo por receta.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[500px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Plan</th>
                  <th className="p-3.5 text-center">Día</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {bakeryPlanes.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">{p.nombre}</td>
                    <td className="p-3.5 text-center text-gray-500">{["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][p.dia_semana] || p.dia_semana}</td>
                    <td className="p-3.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${p.activo ? "text-emerald-600 bg-emerald-50" : "text-gray-400 bg-gray-100"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB ROTISERÍA */}
      {tab === "rotiseria" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase">Planes de Cocción</h3>
              <button onClick={() => setShowPlanForm(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nuevo Plan
              </button>
            </div>
            {rotiseriaPlanes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                <Flame className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin planes de cocción</p>
                <p className="mt-1">Registrá cada hornada de pollo, cerdo o preparados con temperatura, tiempo y registro de control.</p>
              </div>
            ) : (
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Descripción</th>
                    <th className="p-3.5 text-center">Temp. Obj.</th>
                    <th className="p-3.5 text-center">Tiempo</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {rotiseriaPlanes.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">{p.descripcion || p.nombre || "—"}</td>
                      <td className="p-3.5 text-center font-mono">{p.temperatura_objetivo ? `${p.temperatura_objetivo}°C` : "—"}</td>
                      <td className="p-3.5 text-center font-mono">{p.tiempo_coccion_min ? `${p.tiempo_coccion_min} min` : "—"}</td>
                      <td className="p-3.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${p.estado === "completado" ? "text-emerald-600 bg-emerald-50" : p.estado === "en_proceso" ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50"}`}>{p.estado || "planificado"}</span></td>
                      <td className="p-3.5 text-gray-500">{p.fecha ? formatDate(p.fecha) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase">Recetas de Rotisería</h3>
            </div>
            {rotiseriaRecipes.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin recetas de rotisería. Agregá los preparados típicos (pollo, milanesa, empanadas).</p>
                <button onClick={() => { setRecetaArea("rotiseria"); setShowRecetaForm(true) }} className="btn-primary text-xs px-4 py-2 mt-3 inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Agregar Receta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {rotiseriaRecipes.map((r: any) => (
                  <div key={r.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <p className="font-bold text-gray-800 dark:text-gray-200">{r.nombre}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.activa ? "text-emerald-600 bg-emerald-50" : "text-gray-400 bg-gray-100"}`}>{r.activa ? "Activa" : "Inactiva"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CALCULADORA PANADERO */}
      {tab === "calculadora" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-1 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />Calculadora de Porcentaje Panadero
            </h3>
            <p className="text-[11px] text-gray-500 mb-4">Basado en harina = 100%. Todos los ingredientes se expresan como porcentaje de la harina.</p>
            <div className="space-y-3 text-xs">
              {[
                { label: "Harina (base)", val: harinaKg, setter: setHarinaKg, unit: "kg", isPct: false, min: 1, max: 500 },
                { label: "Hidratación (agua)", val: hidratPct, setter: setHidratPct, unit: "%", isPct: true, min: 50, max: 85 },
                { label: "Sal", val: salPct, setter: setSalPct, unit: "%", isPct: true, min: 1, max: 3 },
                { label: "Levadura", val: levPct, setter: setLevPct, unit: "%", isPct: true, min: 0.5, max: 5 },
                { label: "Grasa / Manteca", val: grasaPct, setter: setGrasaPct, unit: "%", isPct: true, min: 0, max: 20 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <label className="w-36 font-bold text-gray-700 dark:text-gray-300 shrink-0">{item.label}</label>
                  <input type="range" min={item.min} max={item.max} step={item.isPct ? 0.5 : 5}
                    value={item.val} onChange={e => item.setter(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500" />
                  <span className="w-16 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                    {item.val.toFixed(1)} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 uppercase mb-4">Resultado: Masa Total</h3>
            <div className="space-y-3 text-xs">
              {[
                { label: "Harina", val: harinaKg, pct: 100 },
                { label: "Agua", val: calc.agua, pct: hidratPct },
                { label: "Sal", val: calc.sal, pct: salPct },
                { label: "Levadura", val: calc.lev, pct: levPct },
                { label: "Grasa", val: calc.grasa, pct: grasaPct },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{item.label}</span>
                  <div className="text-right">
                    <span className="font-black font-mono text-amber-700 dark:text-amber-400">{item.val.toFixed(3)} kg</span>
                    <span className="ml-2 text-[10px] text-gray-400">({item.pct}%)</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-amber-600 text-white rounded-xl">
                <span className="font-extrabold uppercase text-[11px]">Masa Total</span>
                <span className="font-black font-mono text-xl">{calc.masa.toFixed(3)} kg</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA RECETA */}
      {showRecetaForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nueva Receta de {recetaArea === "bakery" ? "Panadería" : "Rotisería"}</h2>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setRecetaArea("bakery")} className={`px-3 py-1.5 rounded-lg font-bold transition ${recetaArea === "bakery" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"}`}>Panadería</button>
              <button onClick={() => setRecetaArea("rotiseria")} className={`px-3 py-1.5 rounded-lg font-bold transition ${recetaArea === "rotiseria" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"}`}>Rotisería</button>
            </div>
            <form onSubmit={handleSaveReceta} className="space-y-3 text-xs">
              <div><label className="label-sm">Nombre *</label><input required className="input text-xs" value={recetaForm.nombre} onChange={e => setRecetaForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Pan de Leche 100g" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">Rendimiento (pzas)</label><input type="number" className="input text-xs" value={recetaForm.rendimiento_piezas} onChange={e => setRecetaForm(f => ({ ...f, rendimiento_piezas: e.target.value }))} /></div>
                <div><label className="label-sm">Tiempo Prep. (min)</label><input type="number" className="input text-xs" value={recetaForm.tiempo_preparacion_min} onChange={e => setRecetaForm(f => ({ ...f, tiempo_preparacion_min: e.target.value }))} /></div>
              </div>
              <div><label className="label-sm">Descripción</label><textarea className="input text-xs h-14" value={recetaForm.descripcion} onChange={e => setRecetaForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecetaForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingReceta} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingReceta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLAN COCCIÓN */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nuevo Plan de Cocción Rotisería</h2>
            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div><label className="label-sm">Descripción *</label><input required className="input text-xs" value={planForm.descripcion} onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Pollos al espiedo 12u - Turno mañana" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">Tipo de Cocción</label>
                  <select className="input text-xs" value={planForm.tipo_coccion} onChange={e => setPlanForm(f => ({ ...f, tipo_coccion: e.target.value }))}>
                    <option value="horno">Horno</option><option value="espiedo">Espiedo</option><option value="freidora">Freidora</option><option value="plancha">Plancha</option>
                  </select>
                </div>
                <div><label className="label-sm">Temp. Objetivo (°C)</label><input type="number" className="input text-xs" value={planForm.temperatura_objetivo} onChange={e => setPlanForm(f => ({ ...f, temperatura_objetivo: e.target.value }))} placeholder="72" /></div>
                <div><label className="label-sm">Tiempo (min)</label><input type="number" className="input text-xs" value={planForm.tiempo_coccion_min} onChange={e => setPlanForm(f => ({ ...f, tiempo_coccion_min: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPlanForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingPlan} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
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
