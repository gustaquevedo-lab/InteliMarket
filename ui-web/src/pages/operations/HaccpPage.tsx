import React, { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck, Plus, AlertTriangle, CheckCircle2, Loader2,
  Info, FileText, Thermometer, Clock, AlertCircle, RefreshCw,
  Layers, Check, ShieldAlert, ArrowRight
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
  }, [toast])

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
  const conformidadColor = conformidadPct >= 90 ? "text-emerald-400" : conformidadPct >= 70 ? "text-amber-400" : "text-rose-400"

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/90 text-white p-7 border border-cyan-500/20 shadow-2xl shadow-cyan-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 border border-cyan-400/30 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                    CALIDAD & SEGURIDAD ALIMENTARIA · AUDITORÍAS SENAVE / INTN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Conformidad: {conformidadPct.toFixed(1)}%
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Inocuidad & Control HACCP
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Puntos Críticos de Control (PCC), registro térmico en cámaras y rotisería, y libro digital de acciones correctivas
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                🛡️ {planes.length} planes HACCP activos
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🌡️ {dash.monitoreos_hoy ?? 0} mediciones registradas hoy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={() => setShowPlanForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 transition shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Plan HACCP
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Planes Activos</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {dash.planes_activos ?? planes.length}
            </p>
            <p className="text-[11px] text-slate-400">Por sección del súper</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Puntos Críticos</span>
              <Thermometer className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {dash.puntos_criticos ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">PCCs bajo monitoreo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mediciones Hoy</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dash.monitoreos_hoy ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">Controles de turno</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Conformidad</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight ${conformidadColor}`}>
              {conformidadPct.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400">Cumplimiento global</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Desviaciones</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {dash.alertas_activas ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">Fuera de límite</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acciones Pend.</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dash.acciones_pendientes ?? acciones.filter((a: any) => !a.resuelta).length}
            </p>
            <p className="text-[11px] text-slate-400">Por resolver</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Reporte de Conformidad", icon: ShieldCheck },
          { id: "planes", label: `Planes HACCP`, count: planes.length, icon: Layers },
          { id: "monitoreos", label: "Registrar Medición", icon: Thermometer },
          { id: "acciones", label: `Acciones Correctivas`, count: acciones.length, icon: AlertTriangle },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: REPORTES DE CONFORMIDAD ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Estado de Conformidad por Sección</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin text-cyan-500" />Cargando...</div>
            ) : complianceReport?.por_area?.length > 0 ? (
              <div className="space-y-2.5">
                {complianceReport.por_area.map((a: any) => (
                  <div key={a.area} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">{a.area}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, a.conformidad_pct || 0)}%` }} />
                      </div>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{(a.conformidad_pct || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Creá planes HACCP para ver el reporte de conformidad.</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Últimas Desviaciones Críticas</h3>
            {(complianceReport?.desviaciones || []).length > 0 ? (
              <div className="space-y-2">
                {complianceReport.desviaciones.map((d: any, i: number) => (
                  <div key={i} className="p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-xs">
                    <p className="font-extrabold text-rose-600 dark:text-rose-400">{d.punto_critico}</p>
                    <p className="text-slate-400 font-mono mt-0.5">Valor medido: {d.valor} | Límite seguro: {d.limite_critico}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-emerald-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="font-bold">Sin desviaciones críticas recientes.</p>
                <p className="text-slate-400 mt-1">Todos los puntos de control están en rangos óptimos.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: PLANES HACCP ══════════════════════ */}
      {tab === "planes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {planes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin planes HACCP creados</p>
              <p className="mt-1 max-w-xs mx-auto">Creá un plan por área (Carnicería, Panadería, etc.) y definí los puntos críticos de control.</p>
              <button onClick={() => setShowPlanForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-cyan-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Crear Primer Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {planes.map((plan: any) => (
                <div key={plan.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <div className="text-xs space-y-1">
                    <p className="font-extrabold text-slate-900 dark:text-white text-sm">{plan.nombre}</p>
                    <p className="text-slate-400 font-medium">{plan.area} · Versión {plan.version || 1}</p>
                    {plan.descripcion && <p className="text-slate-500 text-[11px] max-w-md">{plan.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${plan.activo ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-400 bg-slate-100"}`}>
                      {plan.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button onClick={() => loadCriticos(plan.id)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition">
                      Registrar Monitoreo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: REGISTRAR MONITOREO ══════════════════════ */}
      {tab === "monitoreos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm max-w-xl">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase mb-1 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-cyan-500" /> Registrar Medición de Control
          </h3>
          <p className="text-[11px] text-slate-400 mb-4">Seleccioná el plan, luego el punto crítico y registrá el valor medido.</p>
          {planes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">Primero creá un Plan HACCP desde la pestaña anterior.</div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Plan HACCP *</label>
                <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={selectedPlanId} onChange={e => { setSelectedPlanId(e.target.value); loadCriticos(e.target.value) }}>
                  <option value="">Seleccioná un plan...</option>
                  {planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} — {p.area}</option>)}
                </select>
              </div>
              {criticos.length > 0 && (
                <>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Punto Crítico de Control (PCC) *</label>
                    <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={selectedCpId} onChange={e => setSelectedCpId(e.target.value)}>
                      <option value="">Seleccioná un PCC...</option>
                      {criticos.map((cp: any) => <option key={cp.id} value={cp.id}>{cp.nombre} (Límite: {cp.limite_critico_min}–{cp.limite_critico_max} {cp.unidad})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Valor Medido</label>
                    <input type="number" step="0.1" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={monitorForm.valor_medido} onChange={e => setMonitorForm(f => ({ ...f, valor_medido: e.target.value }))} placeholder="Ej: 4.5" />
                  </div>
                  <div className="flex items-center gap-2.5 pt-1">
                    <input type="checkbox" id="correcto" checked={monitorForm.valor_correcto} onChange={e => setMonitorForm(f => ({ ...f, valor_correcto: e.target.checked }))} className="w-4 h-4 rounded accent-cyan-500" />
                    <label htmlFor="correcto" className="font-bold text-slate-700 dark:text-slate-300">Valor dentro de límites críticos seguros</label>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Observaciones</label>
                    <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-16" value={monitorForm.observaciones} onChange={e => setMonitorForm(f => ({ ...f, observaciones: e.target.value }))} />
                  </div>
                  <button onClick={handleSaveMonitoreo} disabled={savingMonitoreo} className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition">
                    {savingMonitoreo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Guardar Monitoreo
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: ACCIONES CORRECTIVAS ══════════════════════ */}
      {tab === "acciones" && (
        <div className="space-y-3">
          {acciones.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-500">Sin acciones correctivas pendientes</p>
              <p className="mt-1">Todos los puntos críticos están dentro de los límites aceptables.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acciones.map((ac: any) => (
                <div key={ac.id} className={`p-5 rounded-3xl border flex items-center justify-between gap-4 text-xs shadow-sm ${ac.resuelta ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-amber-500/10 border-amber-500/30"}`}>
                  <div className="space-y-1">
                    <p className={`font-extrabold text-sm ${ac.resuelta ? "text-slate-700 dark:text-slate-300" : "text-amber-600 dark:text-amber-300"}`}>{ac.descripcion}</p>
                    <p className="text-slate-400 text-[11px]">{ac.responsable || "Sin asignar"} · Límite: {ac.fecha_limite || "Inmediato"}</p>
                  </div>
                  {!ac.resuelta ? (
                    <button onClick={() => handleResolveAccion(ac.id)} className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition whitespace-nowrap">
                      Marcar Resuelta
                    </button>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 uppercase">Resuelta ✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NUEVO PLAN ── */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-500" /> Nuevo Plan HACCP
            </h2>
            <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nombre del Plan *</label>
                <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={planForm.nombre} onChange={e => setPlanForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Plan HACCP Carnicería 2026" />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Área / Sección</label>
                <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={planForm.area} onChange={e => setPlanForm(f => ({ ...f, area: e.target.value }))}>
                  {AREAS_HACCP.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción</label>
                <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-16" value={planForm.descripcion} onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowPlanForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingPlan} className="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition">
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
