import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { ShieldCheck, Thermometer, AlertTriangle, CheckCircle, FileText, Plus, X, Search, Loader2, ChevronRight, Check, Trash2, Clock, Gauge, BarChart3, Activity, AlertCircle } from "lucide-react"

type Tab = "planes" | "pcc" | "monitoreo" | "acciones" | "reporte"

export default function HaccpTab() {
  const [tab, setTab] = useState<Tab>("planes")
  const [loading, setLoading] = useState(true)
  const [planes, setPlanes] = useState<any[]>([])
  const [pccs, setPccs] = useState<any[]>([])
  const [monitoreos, setMonitoreos] = useState<any[]>([])
  const [acciones, setAcciones] = useState<any[]>([])
  const [reporte, setReporte] = useState<any>(null)
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [selectedPccId, setSelectedPccId] = useState("")
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showPccModal, setShowPccModal] = useState(false)
  const [showMonitoreoModal, setShowMonitoreoModal] = useState(false)
  const [showAccionModal, setShowAccionModal] = useState(false)
  const [planForm, setPlanForm] = useState({ nombre: "", area: "panadería", descripcion: "" })
  const [pccForm, setPccForm] = useState({ plan_id: "", codigo: "", nombre: "", descripcion: "", limite_inferior: 0, limite_superior: 100, unidad: "°C", frecuencia_monitoreo: "", responsable: "" })
  const [monitoreoForm, setMonitoreoForm] = useState({ pcc_id: "", valor: 0, observaciones: "", registrado_por: "" })
  const [accionForm, setAccionForm] = useState({ pcc_id: "", descripcion: "", responsable: "", prioridad: "media", notas: "" })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    fetchAll()
  }, [tab, selectedPlanId, selectedPccId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      if (tab === "planes") {
        try { setPlanes(await api.haccp.plans.list()) } catch { toast.error("Error", "No se pudieron cargar los planes HACCP") }
      }
      if (tab === "pcc") {
        if (planes.length === 0) { try { setPlanes(await api.haccp.plans.list()) } catch { /* handled below */ } }
        if (selectedPlanId) {
          try { setPccs(await api.haccp.criticalPoints.list(selectedPlanId)) } catch { toast.error("Error", "No se pudieron cargar los PCC") }
        } else {
          setPccs([])
        }
      }
      if (tab === "monitoreo") {
        if (pccs.length === 0 && selectedPlanId) { try { setPccs(await api.haccp.criticalPoints.list(selectedPlanId)) } catch { /* handled below */ } }
        if (selectedPccId) {
          try { setMonitoreos(await api.haccp.monitoringLogs.list(selectedPccId)) } catch { toast.error("Error", "No se pudo cargar el monitoreo") }
        } else {
          setMonitoreos([])
        }
      }
      if (tab === "acciones") {
        try { setAcciones(await api.haccp.correctiveActions.list()) } catch { toast.error("Error", "No se pudieron cargar las acciones correctivas") }
      }
      if (tab === "reporte") {
        try { setReporte(await api.haccp.complianceReport()) } catch { toast.error("Error", "No se pudo cargar el reporte"); setReporte(null) }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.nombre) {
      toast.error("Validación", "El nombre es obligatorio.")
      return
    }
    setSaving(true)
    try {
      await api.haccp.plans.create(planForm)
      toast.success("Plan HACCP creado")
      setShowPlanModal(false)
      setPlanForm({ nombre: "", area: "panadería", descripcion: "" })
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePlan = async (plan: any) => {
    try {
      await api.haccp.plans.update(plan.id, { activo: !plan.activo })
      toast.success(plan.activo ? "Plan desactivado" : "Plan activado")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const handleCreatePcc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pccForm.plan_id || !pccForm.nombre) {
      toast.error("Validación", "Plan y nombre del PCC son obligatorios.")
      return
    }
    setSaving(true)
    try {
      await api.haccp.criticalPoints.create(pccForm.plan_id, pccForm)
      toast.success("PCC creado")
      setShowPccModal(false)
      setPccForm({ plan_id: "", codigo: "", nombre: "", descripcion: "", limite_inferior: 0, limite_superior: 100, unidad: "°C", frecuencia_monitoreo: "", responsable: "" })
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePcc = async (id: string) => {
    if (!window.confirm("¿Eliminar este PCC permanentemente?")) return
    try {
      await api.haccp.criticalPoints.delete(id)
      toast.success("PCC eliminado")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const handleCreateMonitoreo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!monitoreoForm.pcc_id || monitoreoForm.valor === undefined) {
      toast.error("Validación", "PCC y valor son obligatorios.")
      return
    }
    setSaving(true)
    try {
      await api.haccp.monitoringLogs.create(monitoreoForm.pcc_id, monitoreoForm)
      toast.success("Registro de monitoreo guardado")
      setShowMonitoreoModal(false)
      setMonitoreoForm({ pcc_id: "", valor: 0, observaciones: "", registrado_por: "" })
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accionForm.descripcion || !accionForm.responsable) {
      toast.error("Validación", "Descripción y responsable son obligatorios.")
      return
    }
    setSaving(true)
    try {
      await api.haccp.correctiveActions.create(accionForm)
      toast.success("Acción correctiva registrada")
      setShowAccionModal(false)
      setAccionForm({ pcc_id: "", descripcion: "", responsable: "", prioridad: "media", notas: "" })
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResolveAccion = async (id: string) => {
    try {
      await api.haccp.correctiveActions.resolve(id)
      toast.success("Acción resuelta")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "planes", l: "Planes HACCP", i: ShieldCheck },
    { k: "pcc", l: "PCC", i: Thermometer },
    { k: "monitoreo", l: "Monitoreo", i: Activity },
    { k: "acciones", l: "Acciones Correctivas", i: AlertTriangle },
    { k: "reporte", l: "Reporte", i: FileText }
  ]

  const prioridadColor: Record<string, string> = {
    crítica: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    alta: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    media: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
    baja: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
  }

  const estadoAccionColor: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    en_curso: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    resuelta: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
              tab === t.k
                ? "bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-100"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:scale-[1.02]"
            }`}>
            {tab === t.k && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
            <t.i className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "planes" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowPlanModal(true)} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
                  <Plus className="w-4 h-4" />Nuevo Plan HACCP
                </button>
              </div>
              <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="p-4">Plan HACCP</th>
                      <th className="p-4">Área</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {planes.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-gray-900 dark:text-white">{p.nombre}</div>
                          <div className="text-[10px] text-gray-400 max-w-xs truncate">{p.descripcion}</div>
                        </td>
                        <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{p.area}</span></td>
                        <td className="p-4">
                          {p.activo ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400 items-center gap-1">
                              <X className="w-3 h-3" /> Inactivo
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleTogglePlan(p)} className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${p.activo ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/10 dark:text-red-400" : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/10 dark:text-green-400"}`}>
                            {p.activo ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {planes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500 font-medium">
                          <ShieldCheck className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                          No hay planes HACCP registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {showPlanModal && (
                <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
                  <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" /> Nuevo Plan HACCP
                      </h3>
                      <button onClick={() => setShowPlanModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <form onSubmit={handleCreatePlan} className="p-6 space-y-4">
                      <div>
                        <label className="input-label label-required font-bold">Área</label>
                        <select className="input-field mt-1" value={planForm.area} onChange={e => setPlanForm({ ...planForm, area: e.target.value })}>
                          <option value="panadería">Panadería</option>
                          <option value="carnicería">Carnicería</option>
                          <option value="lácteos">Lácteos</option>
                          <option value="verdulería">Verdulería</option>
                          <option value="rotisería">Rotisería</option>
                        </select>
                      </div>
                      <div>
                        <label className="input-label label-required font-bold">Nombre del Plan</label>
                        <input className="input-field mt-1" placeholder="Ej. Plan HACCP Panadería" value={planForm.nombre} onChange={e => setPlanForm({ ...planForm, nombre: e.target.value })} required />
                      </div>
                      <div>
                        <label className="input-label font-bold">Descripción</label>
                        <textarea className="input-field mt-1 min-h-[80px]" placeholder="Alcance y objetivos del plan..." value={planForm.descripcion} onChange={e => setPlanForm({ ...planForm, descripcion: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={() => setShowPlanModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                        <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "pcc" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-3">
                <select className="input-field max-w-xs" value={selectedPlanId} onChange={e => { setSelectedPlanId(e.target.value); }}>
                  <option value="">Selecciona un plan HACCP...</option>
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <button onClick={() => setShowPccModal(true)} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
                  <Plus className="w-4 h-4" />Nuevo PCC
                </button>
              </div>
              <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="p-4">Punto Crítico</th>
                      <th className="p-4">Límite Crítico</th>
                      <th className="p-4">Frecuencia</th>
                      <th className="p-4">Responsable</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {pccs.map(pcc => {
                      const plan = planes.find(p => p.id === pcc.plan_id)
                      return (
                        <tr key={pcc.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-gray-900 dark:text-white">{pcc.nombre}</div>
                            <div className="text-[10px] text-gray-400 max-w-xs truncate">{pcc.descripcion} {plan ? `· ${plan.nombre}` : ""}</div>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{pcc.limite_critico}</span>
                          </td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{pcc.frecuencia_monitoreo}</td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{pcc.responsable}</td>
                          <td className="p-4 text-right">
                            <button onClick={() => handleDeletePcc(pcc.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {pccs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">
                          <Thermometer className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                          No hay puntos críticos de control registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {showPccModal && (
                <div className="modal-overlay" onClick={() => setShowPccModal(false)}>
                  <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-primary" /> Nuevo PCC
                      </h3>
                      <button onClick={() => setShowPccModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <form onSubmit={handleCreatePcc} className="p-6 space-y-4">
                      <div>
                        <label className="input-label label-required font-bold">Plan HACCP</label>
                        <select className="input-field mt-1" value={pccForm.plan_id} onChange={e => setPccForm({ ...pccForm, plan_id: e.target.value })} required>
                          <option value="">Seleccionar plan...</option>
                          {planes.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label font-bold">Código</label>
                          <input className="input-field mt-1 font-mono text-sm" placeholder="Ej. PCC-06" value={pccForm.codigo} onChange={e => setPccForm({ ...pccForm, codigo: e.target.value })} />
                        </div>
                        <div>
                          <label className="input-label font-bold">Unidad</label>
                          <select className="input-field mt-1" value={pccForm.unidad} onChange={e => setPccForm({ ...pccForm, unidad: e.target.value })}>
                            <option value="°C">°C</option>
                            <option value="pH">pH</option>
                            <option value="%">%</option>
                            <option value="horas">Horas</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="input-label label-required font-bold">Nombre del PCC</label>
                        <input className="input-field mt-1" placeholder="Ej. Temperatura de Cámara" value={pccForm.nombre} onChange={e => setPccForm({ ...pccForm, nombre: e.target.value })} required />
                      </div>
                      <div>
                        <label className="input-label font-bold">Descripción</label>
                        <textarea className="input-field mt-1 min-h-[60px]" placeholder="Descripción del punto crítico..." value={pccForm.descripcion} onChange={e => setPccForm({ ...pccForm, descripcion: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label label-required font-bold">Límite Inferior</label>
                          <input className="input-field mt-1" type="number" step="any" value={pccForm.limite_inferior} onChange={e => setPccForm({ ...pccForm, limite_inferior: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="input-label label-required font-bold">Límite Superior</label>
                          <input className="input-field mt-1" type="number" step="any" value={pccForm.limite_superior} onChange={e => setPccForm({ ...pccForm, limite_superior: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div>
                        <label className="input-label font-bold">Frecuencia de Monitoreo</label>
                        <input className="input-field mt-1" placeholder="Ej. Cada hora, Cada lote" value={pccForm.frecuencia_monitoreo} onChange={e => setPccForm({ ...pccForm, frecuencia_monitoreo: e.target.value })} />
                      </div>
                      <div>
                        <label className="input-label font-bold">Responsable</label>
                        <input className="input-field mt-1" placeholder="Ej. Control de Calidad" value={pccForm.responsable} onChange={e => setPccForm({ ...pccForm, responsable: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={() => setShowPccModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                        <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "monitoreo" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-3">
                <select className="input-field max-w-xs" value={selectedPccId} onChange={e => setSelectedPccId(e.target.value)}>
                  <option value="">Selecciona un PCC...</option>
                  {pccs.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <button onClick={() => setShowMonitoreoModal(true)} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
                  <Plus className="w-4 h-4" />Nuevo Registro
                </button>
              </div>
              <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="p-4">PCC</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4">Conforme</th>
                      <th className="p-4">Observaciones</th>
                      <th className="p-4">Registrado por</th>
                      <th className="p-4">Fecha/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {monitoreos.map(m => {
                      const pcc = pccs.find(p => p.id === m.pcc_id)
                      return (
                        <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                          <td className="p-4">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">{pcc?.nombre || m.pcc_id}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-lg text-gray-900 dark:text-white">{m.valor}<span className="text-sm text-gray-400 ml-0.5">{m.unidad}</span></span>
                          </td>
                          <td className="p-4">
                            {m.conforme ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Conforme
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 items-center gap-1 animate-pulse">
                                <AlertCircle className="w-3 h-3" /> No Conforme
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{m.observaciones}</td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{m.registrado_por}</td>
                          <td className="p-4 text-sm text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleString("es-PY") : "-"}</td>
                        </tr>
                      )
                    })}
                    {monitoreos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">
                          <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                          No hay registros de monitoreo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {showMonitoreoModal && (
                <div className="modal-overlay" onClick={() => setShowMonitoreoModal(false)}>
                  <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" /> Nuevo Registro de Monitoreo
                      </h3>
                      <button onClick={() => setShowMonitoreoModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateMonitoreo} className="p-6 space-y-4">
                      <div>
                        <label className="input-label label-required font-bold">Punto Crítico (PCC)</label>
                        <select className="input-field mt-1" value={monitoreoForm.pcc_id} onChange={e => setMonitoreoForm({ ...monitoreoForm, pcc_id: e.target.value })} required>
                          <option value="">Seleccionar PCC...</option>
                          {pccs.map(pcc => <option key={pcc.id} value={pcc.id}>{pcc.codigo} - {pcc.nombre}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label label-required font-bold">Valor Medido</label>
                          <input className="input-field mt-1" type="number" step="any" placeholder="Ej. 92" value={monitoreoForm.valor || ""} onChange={e => setMonitoreoForm({ ...monitoreoForm, valor: Number(e.target.value) })} required />
                        </div>
                        <div>
                          <label className="input-label font-bold">Registrado por</label>
                          <input className="input-field mt-1" placeholder="Nombre del operador" value={monitoreoForm.registrado_por} onChange={e => setMonitoreoForm({ ...monitoreoForm, registrado_por: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="input-label font-bold">Observaciones</label>
                        <textarea className="input-field mt-1 min-h-[60px]" placeholder="Detalles de la medición..." value={monitoreoForm.observaciones} onChange={e => setMonitoreoForm({ ...monitoreoForm, observaciones: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={() => setShowMonitoreoModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                        <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "acciones" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowAccionModal(true)} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
                  <Plus className="w-4 h-4" />Nueva Acción Correctiva
                </button>
              </div>
              <div className="grid gap-4">
                {acciones.map(a => (
                  <div key={a.id} className={`card p-5 border rounded-2xl transition-all ${
                    a.estado === "resuelta" ? "border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-950/10" :
                    a.estado === "en_curso" ? "border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10" :
                    "border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10"
                  }`}>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioridadColor[a.prioridad] || ""}`}>
                            {a.prioridad?.toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoAccionColor[a.estado] || ""}`}>
                            {a.estado === "pendiente" ? "Pendiente" : a.estado === "en_curso" ? "En Curso" : "Resuelta"}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{a.descripcion}</h4>
                        <p className="text-xs text-gray-500 mt-1">{a.notas}</p>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.creada_en ? new Date(a.creada_en).toLocaleString("es-PY") : "-"}</span>
                          <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Responsable: {a.responsable}</span>
                          {a.resuelta_en && <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3 h-3" /> Resuelta: {new Date(a.resuelta_en).toLocaleString("es-PY")}</span>}
                        </div>
                      </div>
                      {a.estado !== "resuelta" && (
                        <button onClick={() => handleResolveAccion(a.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1 self-start">
                          <Check className="w-3.5 h-3.5" /> Resolver
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {acciones.length === 0 && (
                  <div className="text-center py-12 text-gray-500 font-medium">
                    <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                    No hay acciones correctivas registradas
                  </div>
                )}
              </div>
              {showAccionModal && (
                <div className="modal-overlay" onClick={() => setShowAccionModal(false)}>
                  <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-primary" /> Nueva Acción Correctiva
                      </h3>
                      <button onClick={() => setShowAccionModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateAccion} className="p-6 space-y-4">
                      <div>
                        <label className="input-label font-bold">PCC Asociado (opcional)</label>
                        <select className="input-field mt-1" value={accionForm.pcc_id} onChange={e => setAccionForm({ ...accionForm, pcc_id: e.target.value })}>
                          <option value="">Seleccionar PCC...</option>
                          {pccs.map(pcc => <option key={pcc.id} value={pcc.id}>{pcc.codigo} - {pcc.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="input-label label-required font-bold">Descripción</label>
                        <textarea className="input-field mt-1 min-h-[80px]" placeholder="Describa la acción correctiva necesaria..." value={accionForm.descripcion} onChange={e => setAccionForm({ ...accionForm, descripcion: e.target.value })} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label label-required font-bold">Responsable</label>
                          <input className="input-field mt-1" placeholder="Ej. Mantenimiento" value={accionForm.responsable} onChange={e => setAccionForm({ ...accionForm, responsable: e.target.value })} required />
                        </div>
                        <div>
                          <label className="input-label font-bold">Prioridad</label>
                          <select className="input-field mt-1" value={accionForm.prioridad} onChange={e => setAccionForm({ ...accionForm, prioridad: e.target.value })}>
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                            <option value="crítica">Crítica</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="input-label font-bold">Notas adicionales</label>
                        <textarea className="input-field mt-1 min-h-[60px]" placeholder="Detalles, causa raíz, plan de acción..." value={accionForm.notas} onChange={e => setAccionForm({ ...accionForm, notas: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={() => setShowAccionModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                        <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "reporte" && (
            <div className="space-y-6">
              <div className="card p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-6 h-6 text-primary" /> Reporte de Cumplimiento HACCP
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Período: {reporte.periodo}</p>
                  </div>
                  <span className={`text-3xl font-extrabold font-mono ${reporte.conformidad_global >= 80 ? "text-green-500" : reporte.conformidad_global >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {reporte.conformidad_global}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 mb-6 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${
                    reporte.conformidad_global >= 80 ? "bg-green-500" : reporte.conformidad_global >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`} style={{ width: `${reporte.conformidad_global}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Planes HACCP", value: `${reporte.planes_activos}/${reporte.total_planes}`, sub: "activos", icon: ShieldCheck, color: "text-blue-600" },
                    { label: "PCC Conformes", value: `${reporte.pcc_conformes}/${reporte.total_pcc}`, sub: "conformes", icon: Gauge, color: "text-green-600" },
                    { label: "Monitoreos Conformes", value: `${reporte.monitoreos_conformes}/${reporte.total_monitoreos}`, sub: "conformes", icon: Activity, color: "text-emerald-600" },
                    { label: "Acciones Resueltas", value: `${reporte.acciones_resueltas}/${reporte.total_acciones}`, sub: "resueltas", icon: CheckCircle, color: "text-purple-600" }
                  ].map((c, i) => (
                    <div key={i} className="group relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1 overflow-hidden">
                      <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 ${c.color}`} />
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{c.label}</span>
                        <div className={`p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 shadow-inner ${c.color}`}>
                          <c.icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className={`text-3xl font-extrabold tracking-tight relative z-10 ${c.color}`}>{c.value}</div>
                      <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-1 relative z-10">{c.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Planes HACCP
                  </h4>
                  <div className="space-y-3">
                    {planes.filter(p => p.activo).map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{p.nombre}</span>
                      </div>
                    ))}
                    {planes.filter(p => !p.activo).map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-400">{p.nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> No Conformidades
                  </h4>
                  <div className="space-y-3">
                    {monitoreos.filter(m => !m.conforme).map(m => {
                      const pcc = pccs.find(p => p.id === m.pcc_id)
                      return (
                        <div key={m.id} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{pcc?.nombre || m.pcc_id}</span>
                            <span className="text-xs text-gray-500 block">{m.valor}{m.unidad} - {m.observaciones}</span>
                          </div>
                        </div>
                      )
                    })}
                    {monitoreos.filter(m => !m.conforme).length === 0 && (
                      <p className="text-sm text-gray-400">No hay no conformidades registradas</p>
                    )}
                  </div>
                </div>

                <div className="card p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Resumen de Acciones
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Pendientes</span>
                      <span className="font-bold text-amber-500">{reporte.acciones_pendientes}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">En Curso</span>
                      <span className="font-bold text-blue-500">{reporte.acciones_en_curso}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Resueltas</span>
                      <span className="font-bold text-green-500">{reporte.acciones_resueltas}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-gray-900 dark:text-white">Total</span>
                        <span className="text-gray-900 dark:text-white">{reporte.total_acciones}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
