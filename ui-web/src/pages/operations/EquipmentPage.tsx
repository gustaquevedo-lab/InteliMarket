import { useState, useEffect, useCallback } from "react"
import {
  Wrench, AlertTriangle, CheckCircle2, Plus, RefreshCw, Loader2,
  Thermometer, Zap, Clock, Calendar, Settings, Info, ShieldAlert,
  ChevronDown, ClipboardList, Activity
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatDate } from "../../utils/format"

const CATEGORIAS = ["Refrigeración", "Producción", "Cocción", "Lavado & Limpieza", "Pesaje", "Elevación & Transporte", "HVAC", "Eléctrico"]
const AREAS = ["Carnicería", "Verdulería", "Panadería", "Rotisería", "Cámara Frigorífica", "Salón", "Almacén", "Farmacia"]

export default function EquipmentPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"equipos" | "ordenes" | "alertas" | "dashboard">("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos
  const [dashboard, setDashboard] = useState<any>(null)
  const [equipos, setEquipos] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  // Formulario de nuevo equipo
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: "", categoria: "Refrigeración", marca: "", modelo: "",
    area: "Carnicería", numero_serie: "", codigo_inventario: "",
    fecha_instalacion: "", prioridad: "media",
    temp_min_operacion: "", temp_max_operacion: "",
    proveedor_mantenimiento: "", notas: ""
  })

  // Formulario de orden de trabajo
  const [showWOForm, setShowWOForm] = useState(false)
  const [savingWO, setSavingWO] = useState(false)
  const [woForm, setWoForm] = useState({
    equipo_id: "", tipo: "preventivo", descripcion: "",
    prioridad: "media", fecha_programada: ""
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, eqs, wos, alts] = await Promise.allSettled([
        api.equipment.dashboard(),
        api.equipment.list(),
        api.equipment.workOrders.list(),
        api.equipment.alerts.list(),
      ])
      if (dash.status === "fulfilled") setDashboard(dash.value)
      if (eqs.status === "fulfilled" && Array.isArray(eqs.value)) setEquipos(eqs.value)
      if (wos.status === "fulfilled" && Array.isArray(wos.value)) setWorkOrders(wos.value)
      if (alts.status === "fulfilled" && Array.isArray(alts.value)) setAlertas(alts.value)
    } catch (e: any) {
      toast.error("Error al cargar equipos", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveEquipo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.equipment.create({ ...form, activo: true, alerta_habilitada: true })
      toast.success("Equipo registrado", `${form.nombre} agregado al inventario de mantenimiento.`)
      setShowForm(false)
      setForm({ nombre: "", categoria: "Refrigeración", marca: "", modelo: "", area: "Carnicería", numero_serie: "", codigo_inventario: "", fecha_instalacion: "", prioridad: "media", temp_min_operacion: "", temp_max_operacion: "", proveedor_mantenimiento: "", notas: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!woForm.equipo_id) { toast.error("Seleccioná un equipo", ""); return }
    setSavingWO(true)
    try {
      await api.equipment.workOrders.create(woForm)
      toast.success("Orden creada", "La orden de trabajo fue registrada correctamente.")
      setShowWOForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al crear orden", err.message)
    } finally {
      setSavingWO(false)
    }
  }

  const handleCheckAlerts = async () => {
    try {
      const r = await api.equipment.checkAlerts()
      toast.success("Verificación completa", `Se generaron ${Array.isArray(r) ? r.length : 0} alertas de mantenimiento predictivo.`)
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.equipment.alerts.resolve(alertId)
      toast.success("Alerta resuelta", "")
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const dash = dashboard || {}
  const priorColor = (p: string) =>
    p === "critica" ? "text-red-600 bg-red-50 dark:bg-red-950/40" :
    p === "alta" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40" :
    "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
              Mantenimiento & Equipos
            </h1>
            {(dash.alertas_activas || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 uppercase animate-pulse">
                {dash.alertas_activas} alerta{(dash.alertas_activas || 0) > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Gestión predictiva de equipos, cámaras frigoríficas, hornos, freidoras y maquinaria del salón. Registro de órdenes de trabajo, historial técnico y trazabilidad de mantenimiento preventivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCheckAlerts} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>Verificar Alertas IA</span>
          </button>
          <button onClick={() => setShowWOForm(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Nueva Orden</span>
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Equipo</span>
          </button>
        </div>
      </div>

      {/* BANNER EXPLICATIVO */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-start gap-3 text-xs text-gray-700 dark:text-gray-300">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-gray-900 dark:text-white mb-0.5">
            Mantenimiento Predictivo & Correctivo de Equipos de Salón
          </p>
          <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
            Registrá cada equipo (cámaras, hornos, balanzas, freidoras) con su ficha técnica completa. El sistema genera alertas automáticas de mantenimiento preventivo según los intervalos configurados, lleva el historial de órdenes de trabajo y calcula el costo de mantenimiento mensual por área.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Equipos Registrados", val: dash.total_equipos ?? equipos.length, color: "text-blue-600", icon: Wrench },
          { label: "Activos en Operación", val: dash.equipos_activos ?? 0, color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Mant. Pendientes", val: dash.mantenimientos_pendientes ?? 0, color: "text-amber-600", icon: Calendar },
          { label: "Órdenes Abiertas", val: dash.ordenes_abiertas ?? workOrders.filter((w: any) => w.estado !== "completada").length, color: "text-purple-600", icon: ClipboardList },
          { label: "Alertas Activas", val: dash.alertas_activas ?? alertas.length, color: "text-red-600", icon: AlertTriangle },
          { label: "Costo Mant. Mes", val: `Gs. ${Number(dash.costo_mantenimiento_mes || 0).toLocaleString()}`, color: "text-gray-700 dark:text-gray-200", icon: Activity },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "equipos", label: `Equipos (${equipos.length})` },
            { id: "ordenes", label: `Órdenes de Trabajo (${workOrders.length})` },
            { id: "alertas", label: `Alertas (${alertas.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Equipos por Categoría</h3>
            {loading ? <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Cargando...</div> :
              (dash.por_categoria || []).length > 0 ? (
                <div className="space-y-2">
                  {(dash.por_categoria || []).map((c: any) => (
                    <div key={c.categoria} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-xs">
                      <span className="font-bold text-gray-800 dark:text-gray-200">{c.categoria}</span>
                      <span className="font-mono font-black text-gray-900 dark:text-white">{c.total} equipos</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-xs">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Sin equipos registrados aún.</p>
                  <p className="mt-1">Usá "Registrar Equipo" para comenzar.</p>
                </div>
              )}
          </div>
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Próximos Mantenimientos</h3>
            {(dash.proximos_mantenimientos || []).length > 0 ? (
              <div className="space-y-2">
                {(dash.proximos_mantenimientos || []).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-xs border border-amber-200 dark:border-amber-900/40">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{m.nombre}</p>
                      <p className="text-gray-500">{m.area} · {m.marca}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{m.fecha_proximo_mantenimiento}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-emerald-600 font-bold">Sin mantenimientos urgentes pendientes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: EQUIPOS */}
      {tab === "equipos" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-gray-400"><Loader2 className="w-5 h-5 animate-spin" />Cargando equipos...</div>
          ) : equipos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin equipos registrados</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá las cámaras frigoríficas, hornos, freidoras y maquinaria del salón para habilitar el mantenimiento predictivo.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Registrar Primer Equipo
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Equipo</th>
                  <th className="p-3.5 text-left">Área</th>
                  <th className="p-3.5 text-left">Categoría</th>
                  <th className="p-3.5 text-left">Último Mant.</th>
                  <th className="p-3.5 text-left">Próximo Mant.</th>
                  <th className="p-3.5 text-center">Prioridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {equipos.map((eq: any) => (
                  <tr key={eq.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">{eq.nombre}</p>
                      <p className="text-[10px] text-gray-400">{eq.marca} {eq.modelo} · S/N: {eq.numero_serie || "—"}</p>
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300 font-medium">{eq.area}</td>
                    <td className="p-3.5 text-gray-500">{eq.categoria}</td>
                    <td className="p-3.5 font-mono text-gray-500">{eq.fecha_ultimo_mantenimiento || "—"}</td>
                    <td className="p-3.5 font-mono font-bold text-amber-600">{eq.fecha_proximo_mantenimiento || "—"}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${priorColor(eq.prioridad || "media")}`}>
                        {eq.prioridad || "media"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB: ORDENES */}
      {tab === "ordenes" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {workOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin órdenes de trabajo</p>
              <p className="mt-1">Creá una orden de trabajo preventiva o correctiva para cualquier equipo.</p>
              <button onClick={() => setShowWOForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nueva Orden
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Descripción</th>
                  <th className="p-3.5 text-left">Tipo</th>
                  <th className="p-3.5 text-left">Estado</th>
                  <th className="p-3.5 text-left">Programada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {workOrders.map((wo: any) => (
                  <tr key={wo.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white">{wo.descripcion || "—"}</td>
                    <td className="p-3.5 text-gray-500 capitalize">{wo.tipo}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${wo.estado === "completada" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>{wo.estado}</span>
                    </td>
                    <td className="p-3.5 font-mono text-gray-500">{wo.fecha_programada ? formatDate(wo.fecha_programada) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB: ALERTAS */}
      {tab === "alertas" && (
        <div className="space-y-3">
          {alertas.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-600">Sin alertas activas</p>
              <p className="mt-1">Todos los equipos operan dentro de sus parámetros normales.</p>
            </div>
          ) : alertas.map((a: any) => (
            <div key={a.id} className="card p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-red-800 dark:text-red-300">{a.tipo_alerta || a.tipo}</p>
                  <p className="text-red-700 dark:text-red-400">{a.descripcion || a.mensaje}</p>
                </div>
              </div>
              <button onClick={() => handleResolveAlert(a.id)} className="btn-secondary text-[10px] px-3 py-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 whitespace-nowrap">
                Marcar Resuelta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVO EQUIPO */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Registrar Nuevo Equipo</h2>
            <form onSubmit={handleSaveEquipo} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label-sm">Nombre del Equipo *</label><input className="input text-xs" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Cámara Frigorífica N°1" /></div>
                <div><label className="label-sm">Categoría</label>
                  <select className="input text-xs" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label-sm">Área</label>
                  <select className="input text-xs" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div><label className="label-sm">Marca</label><input className="input text-xs" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Ej: Friogas" /></div>
                <div><label className="label-sm">Modelo</label><input className="input text-xs" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ej: FG-2400XL" /></div>
                <div><label className="label-sm">N° de Serie</label><input className="input text-xs" value={form.numero_serie} onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} /></div>
                <div><label className="label-sm">Código Inventario</label><input className="input text-xs" value={form.codigo_inventario} onChange={e => setForm(f => ({ ...f, codigo_inventario: e.target.value }))} placeholder="EQ-001" /></div>
                <div><label className="label-sm">Fecha Instalación</label><input type="date" className="input text-xs" value={form.fecha_instalacion} onChange={e => setForm(f => ({ ...f, fecha_instalacion: e.target.value }))} /></div>
                <div><label className="label-sm">Prioridad</label>
                  <select className="input text-xs" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                    <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                  </select>
                </div>
                <div><label className="label-sm">Temp. Mín. (°C)</label><input type="number" className="input text-xs" value={form.temp_min_operacion} onChange={e => setForm(f => ({ ...f, temp_min_operacion: e.target.value }))} /></div>
                <div><label className="label-sm">Temp. Máx. (°C)</label><input type="number" className="input text-xs" value={form.temp_max_operacion} onChange={e => setForm(f => ({ ...f, temp_max_operacion: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label-sm">Proveedor de Mantenimiento</label><input className="input text-xs" value={form.proveedor_mantenimiento} onChange={e => setForm(f => ({ ...f, proveedor_mantenimiento: e.target.value }))} placeholder="Ej: Servicio Técnico Oficial" /></div>
                <div className="col-span-2"><label className="label-sm">Notas</label><textarea className="input text-xs h-16" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ORDEN */}
      {showWOForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nueva Orden de Trabajo</h2>
            <form onSubmit={handleSaveWO} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Equipo *</label>
                <select className="input text-xs" value={woForm.equipo_id} onChange={e => setWoForm(f => ({ ...f, equipo_id: e.target.value }))}>
                  <option value="">Seleccioná un equipo...</option>
                  {equipos.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.area}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">Tipo</label>
                  <select className="input text-xs" value={woForm.tipo} onChange={e => setWoForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="preventivo">Preventivo</option><option value="correctivo">Correctivo</option><option value="predictivo">Predictivo</option>
                  </select>
                </div>
                <div><label className="label-sm">Prioridad</label>
                  <select className="input text-xs" value={woForm.prioridad} onChange={e => setWoForm(f => ({ ...f, prioridad: e.target.value }))}>
                    <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div><label className="label-sm">Fecha Programada</label><input type="date" className="input text-xs" value={woForm.fecha_programada} onChange={e => setWoForm(f => ({ ...f, fecha_programada: e.target.value }))} /></div>
              <div><label className="label-sm">Descripción del Trabajo *</label><textarea required className="input text-xs h-16" value={woForm.descripcion} onChange={e => setWoForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Limpieza de filtros y verificación de temperatura en cámara N°1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowWOForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingWO} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingWO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                  Crear Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
