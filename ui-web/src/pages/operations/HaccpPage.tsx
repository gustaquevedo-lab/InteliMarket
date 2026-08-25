import { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck, Plus, AlertTriangle, CheckCircle2, Loader2,
  Info, FileText, Thermometer, Clock, AlertCircle, RefreshCw
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

const AREAS_HACCP = ["Carnicería", "Verdulería", "Panadería", "Rotisería", "Cámara Frigorífica", "Recepción de Mercadería", "Almacén Seco"]

export default function HaccpPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"dashboard" | "planes" | "monitoreos" | "acciones">("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos
  const [dashboard, setDashboard] = useState<any>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [acciones, setAcciones] = useState<any[]>([])
  const [complianceReport, setComplianceReport] = useState<any>(null)

  // Formulario plan
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [planForm, setPlanForm] = useState({ nombre: "", area: "Carnicería", descripcion: "" })

  // Formulario monitoreo
  const [showMonitoreoForm, setShowMonitoreoForm] = useState(false)
  const [savingMonitoreo, setSavingMonitoreo] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [selectedCpId, setSelectedCpId] = useState("")
  const [criticos, setCriticos] = useState<any[]>([])
  const [monitorForm, setMonitorForm] = useState({ valor_medido: "", valor_correcto: true, observaciones: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, pls, acs, rpt] = await Promise.allSettled([
        api.haccp.dashboard(),
        api.haccp.plans.list(),
        api.haccp.correctiveActions.list(),
        api.haccp.complianceReport(),
      ])
      if (dash.status === "fulfilled") setDashboard(dash.value)
      if (pls.status === "fulfilled" && Array.isArray(pls.value)) setPlanes(pls.value)
      if (acs.status === "fulfilled" && Array.isArray(acs.value)) setAcciones(acs.value)
      if (rpt.status === "fulfilled") setComplianceReport(rpt.value)
    } catch (e: any) {
      toast.error("Error al cargar HACCP", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlan(true)
    try {
      await api.haccp.plans.create({ ...planForm, activo: true })
      toast.success("Plan HACCP creado", `Plan "${planForm.nombre}" registrado correctamente.`)
      setShowPlanForm(false)
      setPlanForm({ nombre: "", area: "Carnicería", descripcion: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar", err.message)
    } finally {
      setSavingPlan(false)
    }
  }

  const loadCriticos = async (planId: string) => {
    setSelectedPlanId(planId)
    try {
      const cps = await api.haccp.criticalPoints.list(planId)
      setCriticos(Array.isArray(cps) ? cps : [])
      setShowMonitoreoForm(true)
    } catch { setCriticos([]) }
  }

  const handleSaveMonitoreo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCpId) { toast.error("Seleccioná un punto crítico", ""); return }
    setSavingMonitoreo(true)
    try {
      await api.haccp.monitoringLogs.create(selectedCpId, {
        valor_medido: parseFloat(monitorForm.valor_medido),
        valor_correcto: monitorForm.valor_correcto,
        observaciones: monitorForm.observaciones,
      })
      toast.success("Monitoreo registrado", "Control de punto crítico guardado.")
      setShowMonitoreoForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSavingMonitoreo(false)
    }
  }

  const handleResolveAccion = async (accionId: string) => {
    try {
      await api.haccp.correctiveActions.resolve(accionId)
      toast.success("Acción correctiva resuelta", "")
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const dash = dashboard || {}
  const conformidadPct = parseFloat(dash.conformidad_pct || 0)
  const conformidadColor = conformidadPct >= 90 ? "text-emerald-600" : conformidadPct >= 70 ? "text-amber-600" : "text-red-600"

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">Inocuidad & HACCP</h1>
            {(dash.alertas_activas || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 uppercase animate-pulse">
                {dash.alertas_activas} desviación{(dash.alertas_activas || 0) > 1 ? "es" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Sistema HACCP (Hazard Analysis and Critical Control Points): Gestión de planes de inocuidad, control de puntos críticos de temperatura, pH y aw, registros de monitoreo y acciones correctivas con trazabilidad completa para auditorías del INTN y SENAVE.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /><span>Actualizar</span></button>
          <button onClick={() => setShowPlanForm(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /><span>Nuevo Plan HACCP</span></button>
        </div>
      </div>

      {/* BANNER */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-900 dark:text-emerald-300 mb-0.5">HACCP — Control de Puntos Críticos para Seguridad Alimentaria</p>
          <p className="text-emerald-800 dark:text-emerald-400 leading-relaxed">
            Creá un plan HACCP por área del supermercado, definí los puntos críticos de control (temperatura de cámara, cocción mínima, enfriamiento rápido) con sus límites críticos. Los operarios registran mediciones en tiempo real, y el sistema genera alertas automáticas cuando se supera un límite.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Planes Activos", val: dash.planes_activos ?? planes.length, color: "text-blue-600" },
          { label: "Puntos Críticos", val: dash.puntos_criticos ?? 0, color: "text-purple-600" },
          { label: "Monitoreos Hoy", val: dash.monitoreos_hoy ?? 0, color: "text-emerald-600" },
          { label: "Conformidad", val: `${conformidadPct.toFixed(1)}%`, color: conformidadColor },
          { label: "Alertas Activas", val: dash.alertas_activas ?? 0, color: "text-red-600" },
          { label: "Acciones Pendientes", val: dash.acciones_pendientes ?? acciones.filter((a: any) => !a.resuelta).length, color: "text-amber-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight mb-1">{kpi.label}</p>
            <p className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Reporte de Conformidad" },
            { id: "planes", label: `Planes HACCP (${planes.length})` },
            { id: "monitoreos", label: "Registrar Monitoreo" },
            { id: "acciones", label: `Acciones Correctivas (${acciones.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-emerald-600 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Estado de Conformidad por Área</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Cargando...</div>
            ) : complianceReport?.por_area?.length > 0 ? (
              <div className="space-y-2">
                {complianceReport.por_area.map((a: any) => (
                  <div key={a.area} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-xs">
                    <span className="font-bold">{a.area}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, a.conformidad_pct || 0)}%` }} />
                      </div>
                      <span className="font-mono font-bold">{(a.conformidad_pct || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Creá planes HACCP para ver el reporte de conformidad.</p>
              </div>
            )}
          </div>
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Últimas Desviaciones Críticas</h3>
            {(complianceReport?.desviaciones || []).length > 0 ? (
              <div className="space-y-2">
                {complianceReport.desviaciones.map((d: any, i: number) => (
                  <div key={i} className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/40 text-xs">
                    <p className="font-extrabold text-red-700 dark:text-red-400">{d.punto_critico}</p>
                    <p className="text-red-600 dark:text-red-300">Valor: {d.valor} | Límite: {d.limite_critico}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-emerald-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="font-bold">Sin desviaciones críticas recientes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB PLANES */}
      {tab === "planes" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {planes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin planes HACCP creados</p>
              <p className="mt-1 max-w-xs mx-auto">Creá un plan por área (Carnicería, Panadería, etc.) y definí los puntos críticos de control.</p>
              <button onClick={() => setShowPlanForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Crear Primer Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {planes.map((plan: any) => (
                <div key={plan.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                  <div className="text-xs">
                    <p className="font-extrabold text-gray-900 dark:text-white">{plan.nombre}</p>
                    <p className="text-gray-500">{plan.area} · v{plan.version || 1}</p>
                    <p className="text-gray-400 mt-0.5 max-w-sm">{plan.descripcion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${plan.activo ? "text-emerald-600 bg-emerald-50" : "text-gray-500 bg-gray-100"}`}>
                      {plan.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button onClick={() => loadCriticos(plan.id)} className="btn-secondary text-[10px] px-3 py-1.5">Registrar Monitoreo</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB REGISTRAR MONITOREO */}
      {tab === "monitoreos" && (
        <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs max-w-lg">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-red-600" />Registrar Medición de Control
          </h3>
          <p className="text-[11px] text-gray-500 mb-4">Seleccioná el plan, luego el punto crítico y registrá el valor medido con la fecha y hora actual.</p>
          {planes.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">Primero creá un Plan HACCP desde la pestaña anterior.</div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Plan HACCP</label>
                <select className="input text-xs" value={selectedPlanId} onChange={e => { setSelectedPlanId(e.target.value); loadCriticos(e.target.value) }}>
                  <option value="">Seleccioná un plan...</option>
                  {planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} — {p.area}</option>)}
                </select>
              </div>
              {criticos.length > 0 && (
                <>
                  <div>
                    <label className="label-sm">Punto Crítico de Control</label>
                    <select className="input text-xs" value={selectedCpId} onChange={e => setSelectedCpId(e.target.value)}>
                      <option value="">Seleccioná un PCC...</option>
                      {criticos.map((cp: any) => <option key={cp.id} value={cp.id}>{cp.nombre} (Límite: {cp.limite_critico_min}–{cp.limite_critico_max} {cp.unidad})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-sm">Valor Medido</label>
                    <input type="number" step="0.1" className="input text-xs" value={monitorForm.valor_medido} onChange={e => setMonitorForm(f => ({ ...f, valor_medido: e.target.value }))} placeholder="Ej: 4.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="correcto" checked={monitorForm.valor_correcto} onChange={e => setMonitorForm(f => ({ ...f, valor_correcto: e.target.checked }))} />
                    <label htmlFor="correcto" className="font-bold text-gray-700 dark:text-gray-300">Valor dentro de límites críticos</label>
                  </div>
                  <div>
                    <label className="label-sm">Observaciones</label>
                    <textarea className="input text-xs h-14" value={monitorForm.observaciones} onChange={e => setMonitorForm(f => ({ ...f, observaciones: e.target.value }))} />
                  </div>
                  <button onClick={handleSaveMonitoreo} disabled={savingMonitoreo} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 w-full justify-center">
                    {savingMonitoreo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Guardar Monitoreo
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB ACCIONES CORRECTIVAS */}
      {tab === "acciones" && (
        <div className="space-y-3">
          {acciones.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-600">Sin acciones correctivas pendientes</p>
              <p className="mt-1">Todos los puntos críticos están dentro de los límites aceptables.</p>
            </div>
          ) : acciones.map((ac: any) => (
            <div key={ac.id} className={`card p-4 border rounded-2xl flex items-center justify-between gap-4 ${ac.resuelta ? "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40"}`}>
              <div className="text-xs">
                <p className={`font-extrabold ${ac.resuelta ? "text-gray-600" : "text-amber-800 dark:text-amber-300"}`}>{ac.descripcion}</p>
                <p className={`mt-0.5 ${ac.resuelta ? "text-gray-400" : "text-amber-600"}`}>{ac.responsable || "—"} · {ac.fecha_limite || "Sin fecha límite"}</p>
              </div>
              {!ac.resuelta && (
                <button onClick={() => handleResolveAccion(ac.id)} className="btn-secondary text-[10px] px-3 py-1.5 text-emerald-700 border-emerald-300 whitespace-nowrap">
                  Marcar Resuelta
                </button>
              )}
              {ac.resuelta && <span className="text-[10px] font-black text-emerald-600 uppercase">Resuelta ✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVO PLAN */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nuevo Plan HACCP</h2>
            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div><label className="label-sm">Nombre del Plan *</label><input required className="input text-xs" value={planForm.nombre} onChange={e => setPlanForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Plan HACCP Carnicería 2026" /></div>
              <div><label className="label-sm">Área</label>
                <select className="input text-xs" value={planForm.area} onChange={e => setPlanForm(f => ({ ...f, area: e.target.value }))}>
                  {AREAS_HACCP.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div><label className="label-sm">Descripción</label><textarea className="input text-xs h-16" value={planForm.descripcion} onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPlanForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingPlan} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Crear Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
