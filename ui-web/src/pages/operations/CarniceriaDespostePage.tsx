import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Scale, Beef, TrendingUp, AlertTriangle, Plus, Loader2,
  DollarSign, CheckCircle2, RefreshCw, Info, Package, ChevronRight, ClipboardList
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "wizard" | "templates" | "ordenes" | "rendimientos"

const ESPECIES = ["Vacuno Novillo", "Vacuno Vaquilla", "Porcino", "Ovino", "Pollos (Unidad)"]

export default function CarniceriaDespostePage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("wizard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [templates, setTemplates] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [yieldReport, setYieldReport] = useState<any[]>([])

  // Wizard desposte
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [pesoEntradaKg, setPesoEntradaKg] = useState<number>(250)
  const [costoTotalGs, setCostoTotalGs] = useState<number>(0)
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("")
  const [notas, setNotas] = useState<string>("")
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  // Formulario nuevo template
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "", descripcion: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tmpl, ords, yield_] = await Promise.allSettled([
        api.supermer.butchery.templates.list(),
        api.supermer.butchery.orders(),
        api.supermer.butchery.yieldReport(),
      ])
      if (tmpl.status === "fulfilled" && Array.isArray(tmpl.value)) setTemplates(tmpl.value)
      if (ords.status === "fulfilled" && Array.isArray(ords.value)) setOrders(ords.value)
      if (yield_.status === "fulfilled" && Array.isArray(yield_.value)) setYieldReport(yield_.value)
    } catch (e: any) {
      toast.error("Error al cargar datos de carnicería", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const costoKg = costoTotalGs && pesoEntradaKg ? costoTotalGs / pesoEntradaKg : 0

  const cortesMapa = useMemo(() => {
    if (!selectedTemplate?.cuts) return []
    return selectedTemplate.cuts.map((c: any) => ({
      ...c,
      kg_estimado: (pesoEntradaKg * (c.rendimiento_porcentual || 0)) / 100,
      costo_asignado: costoKg * (c.rendimiento_porcentual || 0) / 100 * pesoEntradaKg,
    }))
  }, [selectedTemplate, pesoEntradaKg, costoKg])

  const pesoTotalCortes = cortesMapa.reduce((acc: number, c: any) => acc + c.kg_estimado, 0)
  const rendimientoTotal = pesoEntradaKg > 0 ? (pesoTotalCortes / pesoEntradaKg) * 100 : 0

  const handleEjecutarDesposte = async () => {
    if (!selectedTemplate) { toast.error("Seleccioná un template", ""); return }
    if (!pesoEntradaKg || pesoEntradaKg <= 0) { toast.error("Peso de entrada inválido", ""); return }
    if (!costoTotalGs || costoTotalGs <= 0) { toast.error("Ingresá el costo total", ""); return }
    setEjecutando(true)
    try {
      const res = await api.supermer.butchery.desposte({
        template_id: selectedTemplate.id,
        peso_entrada_kg: pesoEntradaKg,
        costo_total_gs: costoTotalGs,
        fecha_vencimiento: fechaVencimiento || undefined,
        notas,
      })
      setResultado(res)
      toast.success("✅ Desposte Ejecutado", `Se generaron ${res.cortes?.length || 0} cortes registrados en stock.`)
      loadData()
    } catch (err: any) {
      toast.error("Error al ejecutar desposte", err.message)
    } finally {
      setEjecutando(false)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTemplate(true)
    try {
      await api.supermer.butchery.templates.create({ ...templateForm, peso_promedio_kg: parseFloat(templateForm.peso_promedio_kg || "0"), activa: true, cuts: [] })
      toast.success("Template creado", `Abrí el template "${templateForm.nombre}" para agregar los cortes con sus rendimientos.`)
      setShowTemplateForm(false)
      setTemplateForm({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "", descripcion: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al crear template", err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">Carnicería & Desposte</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Ejecución de desposte por media res o canal completa: wizard de cortes con rendimiento porcentual por especie, costeo por corte, registro automático en stock y reporte de rendimiento histórico por proveedor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplateForm(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span>Nuevo Template</span>
          </button>
          <button onClick={loadData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /><span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* BANNER */}
      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-red-900 dark:text-red-300 mb-0.5">Sistema de Desposte por Template de Rendimiento</p>
          <p className="text-red-800 dark:text-red-400 leading-relaxed">
            Seleccioná el template de corte para la especie comprada (vacuno novillo, porcino, etc.). El sistema calcula automáticamente los kilos de cada corte en base al rendimiento porcentual configurado y el peso de entrada, registrando los lotes directamente en el inventario de carnicería.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Templates de Corte", val: templates.length, color: "text-red-600" },
          { label: "Despostes Realizados", val: orders.length, color: "text-amber-600" },
          { label: "Kg Procesados (hist.)", val: `${orders.reduce((acc: number, o: any) => acc + (o.cantidad_objetivo || 0), 0).toFixed(0)} kg`, color: "text-blue-600" },
          { label: "Rendimiento Prom.", val: yieldReport.length > 0 ? `${(yieldReport.reduce((a: number, r: any) => a + (r.rendimiento_pct || 0), 0) / yieldReport.length).toFixed(1)}%` : "—", color: "text-emerald-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight mb-1">{kpi.label}</p>
            <p className={`text-xl font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "wizard", label: "Wizard de Desposte" },
            { id: "templates", label: `Templates (${templates.length})` },
            { id: "ordenes", label: `Historial (${orders.length})` },
            { id: "rendimientos", label: "Rendimiento por Corte" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-red-600 text-red-600 dark:text-red-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* WIZARD */}
      {tab === "wizard" && !resultado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo: Configuración */}
          <div className="space-y-4">
            <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">1. Seleccionar Template</h3>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Cargando templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Sin templates configurados.</p>
                  <button onClick={() => setShowTemplateForm(true)} className="btn-primary text-xs px-4 py-2 mt-3 inline-flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Crear Primer Template
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t: any) => (
                    <button key={t.id} onClick={() => setSelectedTemplate(t)}
                      className={`w-full p-3 rounded-xl text-xs text-left transition-all border ${selectedTemplate?.id === t.id ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-gray-200 dark:border-slate-700 hover:border-gray-300"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-gray-900 dark:text-white">{t.nombre}</p>
                          <p className="text-gray-400 text-[10px]">{t.especie} · Peso promedio: {t.peso_promedio_kg || "—"} kg · {t.cuts?.length || 0} cortes</p>
                        </div>
                        {selectedTemplate?.id === t.id && <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">2. Ingresar Datos del Lote</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="label-sm">Peso de Entrada (kg) *</label>
                  <input type="number" step="0.1" className="input text-xs" value={pesoEntradaKg} onChange={e => setPesoEntradaKg(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="label-sm">Costo Total (Gs.) *</label>
                  <input type="number" className="input text-xs" value={costoTotalGs} onChange={e => setCostoTotalGs(parseFloat(e.target.value) || 0)} placeholder="Ej: 5625000" />
                  {costoTotalGs > 0 && pesoEntradaKg > 0 && <p className="mt-1 text-gray-400">= {formatPYG(costoKg)}/kg entrada</p>}
                </div>
                <div>
                  <label className="label-sm">Fecha de Vencimiento Estimada</label>
                  <input type="date" className="input text-xs" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} />
                </div>
                <div>
                  <label className="label-sm">Notas / Número de Tropa</label>
                  <input className="input text-xs" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: TRP-8492 / Frigorífico Concepción" />
                </div>
                <button onClick={handleEjecutarDesposte} disabled={ejecutando || !selectedTemplate || !costoTotalGs}
                  className="btn-primary w-full text-xs py-3 flex items-center justify-center gap-2 mt-2">
                  {ejecutando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Beef className="w-4 h-4" />}
                  {ejecutando ? "Ejecutando desposte..." : "Ejecutar Desposte"}
                </button>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Preview de Cortes */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">3. Preview de Cortes</h3>
            {!selectedTemplate ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <Beef className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Seleccioná un template para ver la simulación de cortes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cortesMapa.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p>El template no tiene cortes configurados aún.</p>
                    <p className="mt-1 text-amber-600 font-bold">Editá el template para agregar los cortes con su rendimiento %.</p>
                  </div>
                ) : (
                  <>
                    {cortesMapa.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{c.producto_nombre || "Corte " + (i + 1)}</p>
                          <p className="text-gray-400">{c.rendimiento_porcentual}% rendimiento</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black font-mono text-gray-900 dark:text-white">{c.kg_estimado.toFixed(2)} kg</p>
                          {c.costo_asignado > 0 && <p className="text-[10px] text-gray-400">{formatPYG(c.costo_asignado)}</p>}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-red-600 text-white rounded-xl mt-3">
                      <span className="font-extrabold text-[11px] uppercase">Total Cortes</span>
                      <div className="text-right">
                        <span className="font-black font-mono">{pesoTotalCortes.toFixed(2)} kg</span>
                        <span className="ml-2 text-red-200 text-[10px]">({rendimientoTotal.toFixed(1)}% rend.)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULTADO DEL DESPOSTE */}
      {tab === "wizard" && resultado && (
        <div className="card p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-900/40 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div>
              <h3 className="font-extrabold text-base text-emerald-900 dark:text-emerald-300 uppercase">Desposte Ejecutado Exitosamente</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Los cortes fueron registrados en el inventario de carnicería con sus respectivos lotes.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
              <p className="font-bold text-gray-500 uppercase text-[10px]">Orden ID</p>
              <p className="font-mono text-gray-900 dark:text-white font-black mt-1">{resultado.order_id?.slice(0, 8) || "—"}...</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
              <p className="font-bold text-gray-500 uppercase text-[10px]">Peso Entrada</p>
              <p className="font-mono text-gray-900 dark:text-white font-black mt-1">{resultado.peso_entrada_kg || pesoEntradaKg} kg</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
              <p className="font-bold text-gray-500 uppercase text-[10px]">Lotes Generados</p>
              <p className="font-mono text-emerald-600 font-black mt-1">{resultado.cortes?.length || resultado.lotes_generados || "—"}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
              <p className="font-bold text-gray-500 uppercase text-[10px]">Rendimiento</p>
              <p className="font-mono text-emerald-600 font-black mt-1">{resultado.rendimiento_real ? `${parseFloat(resultado.rendimiento_real).toFixed(1)}%` : "—"}</p>
            </div>
          </div>
          <button onClick={() => setResultado(null)} className="btn-primary text-xs px-4 py-2 mt-4 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />Nuevo Desposte
          </button>
        </div>
      )}

      {/* TAB TEMPLATES */}
      {tab === "templates" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {templates.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin templates configurados</p>
              <p className="mt-1 max-w-xs mx-auto">Creá un template por especie (vacuno, porcino) con los porcentajes de rendimiento de cada corte (lomo, costilla, asado, etc.).</p>
              <button onClick={() => setShowTemplateForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Crear Primer Template
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {templates.map((t: any) => (
                <div key={t.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white">{t.nombre}</p>
                      <p className="text-gray-400">{t.especie} · Peso prom: {t.peso_promedio_kg || "—"} kg</p>
                      <p className="text-gray-400 mt-0.5">{t.cuts?.length || 0} cortes configurados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${t.activa ? "text-emerald-600 bg-emerald-50" : "text-gray-400 bg-gray-100"}`}>{t.activa ? "Activo" : "Inactivo"}</span>
                    </div>
                  </div>
                  {t.cuts?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.cuts.map((c: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full text-[10px] font-bold">
                          {c.producto_nombre || "Corte"} {c.rendimiento_porcentual}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB ORDENES */}
      {tab === "ordenes" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin despostes registrados</p>
              <p className="mt-1">Ejecutá el primer desposte desde el Wizard para iniciar el historial.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Orden</th>
                  <th className="p-3.5 text-right">Kg Entrada</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Rend. Real</th>
                  <th className="p-3.5 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {orders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white font-mono">{o.id?.slice(0, 8)}...</p>
                      <p className="text-[10px] text-gray-400">{o.notas || "—"}</p>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold">{o.cantidad_objetivo?.toFixed(1)} kg</td>
                    <td className="p-3.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${o.estado === "completada" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>{o.estado}</span></td>
                    <td className="p-3.5 text-right font-mono text-emerald-600 font-bold">{o.rendimiento_real ? `${parseFloat(o.rendimiento_real).toFixed(1)}%` : "—"}</td>
                    <td className="p-3.5 text-gray-500">{o.fecha_fin ? formatDate(o.fecha_fin) : o.fecha_inicio ? formatDate(o.fecha_inicio) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB RENDIMIENTOS */}
      {tab === "rendimientos" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {yieldReport.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin datos de rendimiento</p>
              <p className="mt-1">El reporte de rendimiento por corte se genera automáticamente con los despostes completados.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Corte / Producto</th>
                  <th className="p-3.5 text-right">Kg Producidos</th>
                  <th className="p-3.5 text-right">Rendimiento</th>
                  <th className="p-3.5 text-right">Costo/kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {yieldReport.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">{r.producto_nombre || r.producto_id || "—"}</td>
                    <td className="p-3.5 text-right font-mono">{parseFloat(r.kg_producidos || r.total_obtenido || 0).toFixed(2)} kg</td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-600">{r.rendimiento_pct ? `${parseFloat(r.rendimiento_pct).toFixed(1)}%` : "—"}</td>
                    <td className="p-3.5 text-right font-mono">{r.costo_unitario ? formatPYG(r.costo_unitario) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODAL NUEVO TEMPLATE */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nuevo Template de Desposte</h2>
            <p className="text-[11px] text-gray-500">Creá el template con la especie y el rendimiento base. Luego editá el template para agregar cada corte con su % de rendimiento.</p>
            <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
              <div><label className="label-sm">Nombre *</label><input required className="input text-xs" value={templateForm.nombre} onChange={e => setTemplateForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Vacuno Novillo Estándar" /></div>
              <div><label className="label-sm">Especie</label>
                <select className="input text-xs" value={templateForm.especie} onChange={e => setTemplateForm(f => ({ ...f, especie: e.target.value }))}>
                  {ESPECIES.map(esp => <option key={esp}>{esp}</option>)}
                </select>
              </div>
              <div><label className="label-sm">Peso Promedio (kg)</label><input type="number" step="0.5" className="input text-xs" value={templateForm.peso_promedio_kg} onChange={e => setTemplateForm(f => ({ ...f, peso_promedio_kg: e.target.value }))} placeholder="Ej: 250" /></div>
              <div><label className="label-sm">Descripción</label><textarea className="input text-xs h-14" value={templateForm.descripcion} onChange={e => setTemplateForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTemplateForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingTemplate} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Crear Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
