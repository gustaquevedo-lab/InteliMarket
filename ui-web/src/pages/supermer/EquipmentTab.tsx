import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { Search, Plus, Loader2, Wrench, Calendar, AlertCircle, ClipboardCheck, Settings, Gauge, Check, X, Trash2, AlertTriangle, BarChart3, Clock, Play, ChevronRight, FileText, Thermometer, Power, Box, Zap } from "lucide-react"

type EqTab = "equipos" | "mtto" | "ordenes" | "alertas" | "dashboard"

const CATEGORIAS = ["refrigeración", "hornos", "cámaras", "balanzas", "cajas", "transporte", "generadores", "otros"]

const MOCK_EQUIPOS: any[] = [
  { id: "eq1", nombre: "Cámara Fría 1 (Carnes)", categoria: "refrigeración", modelo: "CF-3000", numero_serie: "CF-2024-001", ubicacion: "Sector Carnicería", fecha_instalacion: "2023-03-15", activo: true, costo_adquisicion: 45000000, vida_util_anos: 15 },
  { id: "eq2", nombre: "Horno Rotativo 8 Bandejas", categoria: "hornos", modelo: "HR-800", numero_serie: "HR-2023-042", ubicacion: "Panadería", fecha_instalacion: "2022-11-01", activo: true, costo_adquisicion: 28000000, vida_util_anos: 10 },
  { id: "eq3", nombre: "Balanza Digital Toledo", categoria: "balanzas", modelo: "BD-5000", numero_serie: "BD-2024-015", ubicacion: "Verdulería", fecha_instalacion: "2024-01-10", activo: true, costo_adquisicion: 3500000, vida_util_anos: 5 },
  { id: "eq4", nombre: "Cámara de Maduración", categoria: "cámaras", modelo: "CM-500", numero_serie: "CM-2023-008", ubicacion: "Carnicería", fecha_instalacion: "2023-06-20", activo: false, costo_adquisicion: 18000000, vida_util_anos: 12 },
  { id: "eq5", nombre: "Generador Eléctrico 150kVA", categoria: "generadores", modelo: "GE-150", numero_serie: "GE-2022-033", ubicacion: "Patio Servicios", fecha_instalacion: "2022-02-28", activo: true, costo_adquisicion: 65000000, vida_util_anos: 20 },
]

const MOCK_SCHEDULES: any[] = [
  { id: "s1", equipo_id: "eq1", equipo_nombre: "Cámara Fría 1 (Carnes)", tarea: "Limpieza de condensadores", frecuencia: "mensual", proximo_vencimiento: new Date(Date.now() + 7 * 86400000).toISOString(), responsable: "Técnico Mantenimiento", notas: "Usar cepillo de cerdas suaves" },
  { id: "s2", equipo_id: "eq1", equipo_nombre: "Cámara Fría 1 (Carnes)", tarea: "Revisión de puertas y burletes", frecuencia: "trimestral", proximo_vencimiento: new Date(Date.now() + 45 * 86400000).toISOString(), responsable: "Técnico Mantenimiento" },
  { id: "s3", equipo_id: "eq2", equipo_nombre: "Horno Rotativo 8 Bandejas", tarea: "Calibración de temperatura", frecuencia: "semanal", proximo_vencimiento: new Date(Date.now() + 3 * 86400000).toISOString(), responsable: "Panadero Jefe", notas: "Verificar termocupla" },
  { id: "s4", equipo_id: "eq5", equipo_nombre: "Generador Eléctrico 150kVA", tarea: "Cambio de aceite + filtros", frecuencia: "semestral", proximo_vencimiento: new Date(Date.now() + 120 * 86400000).toISOString(), responsable: "Técnico Externo" },
  { id: "s5", equipo_id: "eq2", equipo_nombre: "Horno Rotativo 8 Bandejas", tarea: "Lubricación de rodamientos", frecuencia: "mensual", proximo_vencimiento: new Date(Date.now() + 21 * 86400000).toISOString(), responsable: "Panadero Jefe" },
]

const MOCK_WORK_ORDERS: any[] = [
  { id: "wo1", equipo_id: "eq1", equipo_nombre: "Cámara Fría 1 (Carnes)", tarea: "Fuga de refrigerante", prioridad: "alta", estado: "en_progreso", descripcion: "Pérdida de gas refrigerante en válvula de expansión. Temperatura sube a 8°C.", responsable_asignado: "Carlos Ferreira", fecha_inicio: new Date(Date.now() - 86400000).toISOString(), costo_estimado: 1500000 },
  { id: "wo2", equipo_id: "eq3", equipo_nombre: "Balanza Digital Toledo", tarea: "Descalibración de sensor", prioridad: "media", estado: "pendiente", descripcion: "Balanza muestra variación de ±50g en pesajes repetidos.", responsable_asignado: "Técnico Externo", costo_estimado: 450000 },
  { id: "wo3", equipo_id: "eq4", equipo_nombre: "Cámara de Maduración", tarea: "Reactivación de equipo", prioridad: "baja", estado: "completada", descripcion: "Revisión general y puesta en marcha tras reparación.", responsable_asignado: "Técnico Mantenimiento", fecha_inicio: new Date(Date.now() - 7 * 86400000).toISOString(), fecha_fin: new Date(Date.now() - 5 * 86400000).toISOString(), costo_real: 800000, notas_cierre: "Equipo operativo. Monitorear 48 horas." },
  { id: "wo4", equipo_id: "eq5", equipo_nombre: "Generador Eléctrico 150kVA", tarea: "Prueba de carga mensual", prioridad: "baja", estado: "pendiente", descripcion: "Prueba de funcionamiento con carga del 70% durante 30 min.", responsable_asignado: "Técnico Mantenimiento", costo_estimado: 0 },
  { id: "wo5", equipo_id: "eq2", equipo_nombre: "Horno Rotativo 8 Bandejas", tarea: "Resistencia quemada", prioridad: "crítica", estado: "pendiente", descripcion: "Resistencia superior no calienta. Producción de panadería limitada al 50%.", responsable_asignado: "Técnico Externo Urgente", costo_estimado: 2200000 },
]

const MOCK_ALERTS: any[] = [
  { id: "a1", equipo_id: "eq1", equipo_nombre: "Cámara Fría 1 (Carnes)", tipo: "temperatura", mensaje: "Temperatura superó los 8°C por más de 30 minutos", severidad: "crítica", resuelta: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "a2", equipo_id: "eq5", equipo_nombre: "Generador Eléctrico 150kVA", tipo: "mantenimiento", mensaje: "Cambio de aceite programado para los próximos 7 días", severidad: "media", resuelta: false, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "a3", equipo_id: "eq3", equipo_nombre: "Balanza Digital Toledo", tipo: "falla", mensaje: "Sensor de peso reporta lecturas inconsistentes", severidad: "alta", resuelta: false, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "a4", equipo_id: "eq2", equipo_nombre: "Horno Rotativo 8 Bandejas", tipo: "falla", mensaje: "Resistencia superior quemada - producción limitada", severidad: "crítica", resuelta: false, created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
]

const MOCK_DASHBOARD: any = {
  total_equipos: 18,
  equipos_activos: 15,
  equipos_inactivos: 3,
  mtto_pendientes_hoy: 4,
  ordenes_pendientes: 6,
  ordenes_en_progreso: 2,
  ordenes_completadas_mes: 24,
  alertas_activas: 7,
  alertas_criticas: 2,
  costo_mtto_mensual: 4200000,
  uptime_promedio: 96.8,
  equipos_por_categoria: [
    { categoria: "refrigeración", cantidad: 5 },
    { categoria: "hornos", cantidad: 2 },
    { categoria: "cámaras", cantidad: 3 },
    { categoria: "balanzas", cantidad: 4 },
    { categoria: "cajas", cantidad: 2 },
    { categoria: "transporte", cantidad: 1 },
    { categoria: "generadores", cantidad: 1 },
  ],
}

export default function EquipmentTab() {
  const [tab, setTab] = useState<EqTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const [equipos, setEquipos] = useState<any[]>(MOCK_EQUIPOS)
  const [schedules, setSchedules] = useState<any[]>(MOCK_SCHEDULES)
  const [workOrders, setWorkOrders] = useState<any[]>(MOCK_WORK_ORDERS)
  const [alerts, setAlerts] = useState<any[]>(MOCK_ALERTS)
  const [dashboard, setDashboard] = useState<any>(MOCK_DASHBOARD)

  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("")

  useEffect(() => {
    fetchData()
  }, [tab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []
      if (tab === "equipos") promises.push(api.equipment.list({ categoria: catFilter || undefined }).then(setEquipos).catch(() => {}))
      if (tab === "mtto") promises.push(api.equipment.schedules.list().then(setSchedules).catch(() => {}))
      if (tab === "ordenes") promises.push(api.equipment.workOrders.list().then(setWorkOrders).catch(() => {}))
      if (tab === "alertas") promises.push(api.equipment.alerts.list().then(setAlerts).catch(() => {}))
      if (tab === "dashboard") promises.push(api.equipment.dashboard().then(setDashboard).catch(() => {}))
      await Promise.all(promises.map(p => p.catch(() => {})))
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs: { k: EqTab; l: string; i: any }[] = [
    { k: "equipos", l: "Equipos", i: Wrench },
    { k: "mtto", l: "Mtto. Programado", i: Calendar },
    { k: "ordenes", l: "Órdenes", i: ClipboardCheck },
    { k: "alertas", l: "Alertas", i: AlertCircle },
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
  ]

  const labelSeveridad = (s: string) => {
    const m: Record<string, string> = { crítica: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400", alta: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400", media: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", baja: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" }
    return m[s] || m.media
  }

  const labelPrioridad = (p: string) => {
    const m: Record<string, string> = { crítica: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400", alta: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400", media: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", baja: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" }
    return m[p] || m.media
  }

  const labelEstado = (e: string) => {
    const m: Record<string, string> = { completada: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400", en_progreso: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", pendiente: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" }
    return m[e] || m.pendiente
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-700 to-gray-900 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-cyan-300 opacity-20 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
              <Wrench className="w-4 h-4" />
              Mantenimiento de Equipos
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
              Equipamiento
            </h1>
            <p className="text-blue-100 text-lg mt-3 font-medium max-w-xl opacity-90">
              Gestión integral de activos, mantenimiento preventivo, órdenes de trabajo y monitoreo de alertas.
            </p>
          </div>
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Gauge className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Uptime</p>
              <p className="text-white text-2xl font-bold">{dashboard.uptime_promedio ?? "—"}%</p>
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
          {tab === "equipos" && <EquiposTab equipos={equipos} setEquipos={setEquipos} search={search} setSearch={setSearch} catFilter={catFilter} setCatFilter={setCatFilter} fetchData={fetchData} />}
          {tab === "mtto" && <MttoTab schedules={schedules} setSchedules={setSchedules} search={search} setSearch={setSearch} fetchData={fetchData} />}
          {tab === "ordenes" && <OrdenesTab workOrders={workOrders} setWorkOrders={setWorkOrders} search={search} setSearch={setSearch} fetchData={fetchData} />}
          {tab === "alertas" && <AlertasTab alerts={alerts} setAlerts={setAlerts} fetchData={fetchData} />}
          {tab === "dashboard" && <DashboardTab data={dashboard} />}
        </>
      )}
    </div>
  )
}

function EquiposTab({ equipos, setEquipos, search, setSearch, catFilter, setCatFilter, fetchData }: {
  equipos: any[]; setEquipos: (d: any[]) => void; search: string; setSearch: (s: string) => void
  catFilter: string; setCatFilter: (s: string) => void; fetchData: () => void
}) {
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ nombre: "", categoria: "refrigeración", modelo: "", numero_serie: "", ubicacion: "", fecha_instalacion: "", costo_adquisicion: "", vida_util_anos: "10", activo: true })

  const filtered = equipos.filter(e => {
    const m = (!search || e.nombre?.toLowerCase().includes(search.toLowerCase()) || e.modelo?.toLowerCase().includes(search.toLowerCase()) || e.ubicacion?.toLowerCase().includes(search.toLowerCase()))
    const c = !catFilter || e.categoria === catFilter
    return m && c
  })

  const openCreate = () => { setEditing(null); setForm({ nombre: "", categoria: "refrigeración", modelo: "", numero_serie: "", ubicacion: "", fecha_instalacion: "", costo_adquisicion: "", vida_util_anos: "10", activo: true }); setShowModal(true) }

  const openEdit = (eq: any) => {
    setEditing(eq)
    setForm({
      nombre: eq.nombre || "",
      categoria: eq.categoria || "refrigeración",
      modelo: eq.modelo || "",
      numero_serie: eq.numero_serie || "",
      ubicacion: eq.ubicacion || "",
      fecha_instalacion: eq.fecha_instalacion || "",
      costo_adquisicion: eq.costo_adquisicion?.toString() || "",
      vida_util_anos: eq.vida_util_anos?.toString() || "10",
      activo: eq.activo !== false,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre) { toast.error("Validación", "El nombre del equipo es obligatorio"); return }
    try {
      const payload = {
        nombre: form.nombre, categoria: form.categoria, modelo: form.modelo, numero_serie: form.numero_serie,
        ubicacion: form.ubicacion, fecha_instalacion: form.fecha_instalacion || null,
        costo_adquisicion: Number(form.costo_adquisicion) || 0, vida_util_anos: Number(form.vida_util_anos) || 10, activo: form.activo,
      }
      if (editing) {
        await api.equipment.update(editing.id, payload)
        toast.success("Equipo actualizado")
      } else {
        await api.equipment.create(payload)
        toast.success("Equipo creado")
      }
      setShowModal(false)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este equipo?")) return
    try {
      await api.equipment.delete(id)
      toast.success("Equipo eliminado")
      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-10" placeholder="Buscar equipo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field w-44" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          Nuevo Equipo
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Equipo</th>
              <th className="p-4">Categoría</th>
              <th className="p-4">Modelo / Serie</th>
              <th className="p-4">Ubicación</th>
              <th className="p-4 text-right">Costo Adq.</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(eq => (
              <tr key={eq.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{eq.nombre}</div>
                  <div className="text-[10px] text-gray-400">{eq.fecha_instalacion ? `Inst: ${new Date(eq.fecha_instalacion).toLocaleDateString("es-PY")}` : "Sin instalar"}</div>
                </td>
                <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{eq.categoria}</span></td>
                <td className="p-4 text-gray-600 dark:text-gray-300 text-sm">{eq.modelo}<br /><span className="text-[10px] text-gray-400">{eq.numero_serie}</span></td>
                <td className="p-4 text-gray-600 dark:text-gray-300 text-sm">{eq.ubicacion || "—"}</td>
                <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{eq.costo_adquisicion ? formatPYG(eq.costo_adquisicion) : "—"}</td>
                <td className="p-4 text-center">
                  {eq.activo ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-1 justify-center"><Power className="w-3 h-3" /> Activo</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-1 justify-center"><X className="w-3 h-3" /> Inactivo</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(eq)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2.5 py-1.5 rounded-lg transition-colors">Editar</button>
                    <button onClick={() => handleDelete(eq.id)} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 font-medium">
                  <Wrench className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No se encontraron equipos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                {editing ? "Editar Equipo" : "Nuevo Equipo"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="input-label label-required font-bold">Nombre del Equipo</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. Cámara Fría 2 (Lácteos)" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div>
                  <label className="input-label font-bold">Categoría</label>
                  <select className="input-field mt-1" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label font-bold">Modelo</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. CF-4000" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div>
                  <label className="input-label font-bold">N° de Serie</label>
                  <input className="input-field mt-1" type="text" value={form.numero_serie} onChange={e => setForm({ ...form, numero_serie: e.target.value })} />
                </div>
                <div>
                  <label className="input-label font-bold">Ubicación</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. Sector Lácteos" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} />
                </div>
                <div>
                  <label className="input-label font-bold">Fecha de Instalación</label>
                  <input className="input-field mt-1" type="date" value={form.fecha_instalacion} onChange={e => setForm({ ...form, fecha_instalacion: e.target.value })} />
                </div>
                <div>
                  <label className="input-label font-bold">Costo de Adquisición (₲)</label>
                  <input className="input-field mt-1" type="number" min="0" value={form.costo_adquisicion} onChange={e => setForm({ ...form, costo_adquisicion: e.target.value })} />
                </div>
                <div>
                  <label className="input-label font-bold">Vida Útil (años)</label>
                  <input className="input-field mt-1" type="number" min="1" value={form.vida_util_anos} onChange={e => setForm({ ...form, vida_util_anos: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
                    <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Equipo activo</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="btn-primary flex items-center gap-1.5 px-6 py-2.5 rounded-xl shadow-md">
                  <Check className="w-4 h-4" /> {editing ? "Guardar Cambios" : "Crear Equipo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function MttoTab({ schedules, setSchedules, search, setSearch, fetchData }: {
  schedules: any[]; setSchedules: (d: any[]) => void; search: string; setSearch: (s: string) => void; fetchData: () => void
}) {
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ equipo_id: "", tarea: "", frecuencia: "mensual", responsable: "", notas: "" })

  const freqLabel: Record<string, string> = { semanal: "Semanal", quincenal: "Quincenal", mensual: "Mensual", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" }

  const openCreate = () => { setEditing(null); setForm({ equipo_id: "", tarea: "", frecuencia: "mensual", responsable: "", notas: "" }); setShowModal(true) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tarea) { toast.error("Validación", "La tarea es obligatoria"); return }
    try {
      const payload = { equipo_id: form.equipo_id || undefined, tarea: form.tarea, frecuencia: form.frecuencia, responsable: form.responsable, notas: form.notas }
      if (editing) { await api.equipment.schedules.update(editing.id, payload); toast.success("Programación actualizada") }
      else { await api.equipment.schedules.create(payload); toast.success("Programación creada") }
      setShowModal(false)
      fetchData()
    } catch (err: any) { toast.error("Error", err.message) }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta programación?")) return
    try { await api.equipment.schedules.delete(id); toast.success("Eliminada"); fetchData() }
    catch (err: any) { toast.error("Error", err.message) }
  }

  const filtered = schedules.filter(s => !search || s.tarea?.toLowerCase().includes(search.toLowerCase()) || s.equipo_nombre?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar tarea o equipo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Programación
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(s => {
          const daysLeft = Math.ceil((new Date(s.proximo_vencimiento).getTime() - Date.now()) / 86400000)
          return (
            <div key={s.id} className="card p-5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{s.tarea}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.equipo_nombre || "Sin equipo"}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${daysLeft <= 3 ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : daysLeft <= 7 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"}`}>
                  {daysLeft <= 0 ? "Vencido" : `${daysLeft} días`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 font-semibold text-gray-600 dark:text-gray-300">{freqLabel[s.frecuencia] || s.frecuencia}</span>
                {s.responsable && <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1"><Wrench className="w-3 h-3" />{s.responsable}</span>}
              </div>
              {s.notas && <p className="text-xs text-gray-400 mt-2 italic">{s.notas}</p>}
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => { setEditing(s); setForm({ equipo_id: s.equipo_id || "", tarea: s.tarea, frecuencia: s.frecuencia, responsable: s.responsable || "", notas: s.notas || "" }); setShowModal(true) }} className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Editar</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">
            <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            No hay tareas programadas
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {editing ? "Editar Programación" : "Nueva Programación"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              <div>
                <label className="input-label font-bold">Tarea</label>
                <input className="input-field mt-1" type="text" placeholder="Ej. Limpieza de condensadores" value={form.tarea} onChange={e => setForm({ ...form, tarea: e.target.value })} required />
              </div>
              <div>
                <label className="input-label font-bold">Frecuencia</label>
                <select className="input-field mt-1" value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value })}>
                  {Object.entries(freqLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label font-bold">Responsable</label>
                <input className="input-field mt-1" type="text" placeholder="Ej. Técnico Mantenimiento" value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} />
              </div>
              <div>
                <label className="input-label font-bold">Notas</label>
                <textarea className="input-field mt-1" rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="btn-primary flex items-center gap-1.5 px-6 py-2.5 rounded-xl shadow-md">
                  <Check className="w-4 h-4" /> {editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function OrdenesTab({ workOrders, setWorkOrders, search, setSearch, fetchData }: {
  workOrders: any[]; setWorkOrders: (d: any[]) => void; search: string; setSearch: (s: string) => void; fetchData: () => void
}) {
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ equipo_id: "", tarea: "", prioridad: "media", descripcion: "", responsable_asignado: "", costo_estimado: "" })
  const [completing, setCompleting] = useState<string | null>(null)
  const [completeForm, setCompleteForm] = useState({ costo_real: "", notas_cierre: "" })

  const openCreate = () => { setEditing(null); setForm({ equipo_id: "", tarea: "", prioridad: "media", descripcion: "", responsable_asignado: "", costo_estimado: "" }); setShowModal(true) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tarea) { toast.error("Validación", "La tarea es obligatoria"); return }
    try {
      const payload = { equipo_id: form.equipo_id || undefined, tarea: form.tarea, prioridad: form.prioridad, descripcion: form.descripcion, responsable_asignado: form.responsable_asignado, costo_estimado: Number(form.costo_estimado) || 0 }
      if (editing) { await api.equipment.workOrders.update(editing.id, payload); toast.success("Orden actualizada") }
      else { await api.equipment.workOrders.create(payload); toast.success("Orden creada") }
      setShowModal(false)
      fetchData()
    } catch (err: any) { toast.error("Error", err.message) }
  }

  const handleStart = async (id: string) => {
    try { await api.equipment.workOrders.start(id); toast.success("Orden iniciada"); fetchData() }
    catch (err: any) { toast.error("Error", err.message) }
  }

  const handleComplete = async (id: string) => {
    try {
      await api.equipment.workOrders.complete(id, { costo_real: Number(completeForm.costo_real) || 0, notas_cierre: completeForm.notas_cierre })
      toast.success("Orden completada")
      setCompleting(null)
      fetchData()
    } catch (err: any) { toast.error("Error", err.message) }
  }

  const filtered = workOrders.filter(o => !search || o.tarea?.toLowerCase().includes(search.toLowerCase()) || o.equipo_nombre?.toLowerCase().includes(search.toLowerCase()) || o.responsable_asignado?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar orden..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Orden
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Tarea</th>
              <th className="p-4">Equipo</th>
              <th className="p-4">Prioridad</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Responsable</th>
              <th className="p-4 text-right">Costo Est.</th>
              <th className="p-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(wo => (
              <tr key={wo.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{wo.tarea}</div>
                  {wo.descripcion && <div className="text-[10px] text-gray-400 max-w-[200px] truncate" title={wo.descripcion}>{wo.descripcion}</div>}
                </td>
                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{wo.equipo_nombre || "—"}</td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${labelPrioridad(wo.prioridad)}`}>{wo.prioridad}</span></td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${labelEstado(wo.estado)}`}>{wo.estado === "en_progreso" ? "En Progreso" : wo.estado === "completada" ? "Completada" : "Pendiente"}</span></td>
                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{wo.responsable_asignado || "—"}</td>
                <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{wo.costo_estimado ? formatPYG(wo.costo_estimado) : "—"}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    {wo.estado === "pendiente" && (
                      <>
                        <button onClick={() => handleStart(wo.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"><Play className="w-3 h-3" /> Iniciar</button>
                        <button onClick={() => { setEditing(wo); setForm({ equipo_id: wo.equipo_id || "", tarea: wo.tarea, prioridad: wo.prioridad, descripcion: wo.descripcion || "", responsable_asignado: wo.responsable_asignado || "", costo_estimado: wo.costo_estimado?.toString() || "" }); setShowModal(true) }} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2 py-1.5 rounded-lg transition-colors">Editar</button>
                      </>
                    )}
                    {wo.estado === "en_progreso" && (
                      <button onClick={() => { setCompleting(wo.id); setCompleteForm({ costo_real: wo.costo_estimado?.toString() || "", notas_cierre: "" }) }} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"><Check className="w-3 h-3" /> Completar</button>
                    )}
                    {wo.estado === "completada" && (
                      <div className="text-xs text-gray-400 font-medium flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{wo.costo_real ? formatPYG(wo.costo_real) : "Hecho"}</div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500 font-medium">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No hay órdenes de trabajo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                {editing ? "Editar Orden" : "Nueva Orden de Trabajo"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              <div>
                <label className="input-label label-required font-bold">Tarea</label>
                <input className="input-field mt-1" type="text" placeholder="Ej. Reparación de compresor" value={form.tarea} onChange={e => setForm({ ...form, tarea: e.target.value })} required />
              </div>
              <div>
                <label className="input-label font-bold">Prioridad</label>
                <select className="input-field mt-1" value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="crítica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="input-label font-bold">Descripción</label>
                <textarea className="input-field mt-1" rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="input-label font-bold">Responsable Asignado</label>
                <input className="input-field mt-1" type="text" value={form.responsable_asignado} onChange={e => setForm({ ...form, responsable_asignado: e.target.value })} />
              </div>
              <div>
                <label className="input-label font-bold">Costo Estimado (₲)</label>
                <input className="input-field mt-1" type="number" min="0" value={form.costo_estimado} onChange={e => setForm({ ...form, costo_estimado: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="btn-primary flex items-center gap-1.5 px-6 py-2.5 rounded-xl shadow-md">
                  <Check className="w-4 h-4" /> {editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {completing && (
        <div className="modal-overlay" onClick={() => setCompleting(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Completar Orden
              </h3>
              <button onClick={() => setCompleting(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleComplete(completing) }} className="p-6 space-y-4">
              <div>
                <label className="input-label font-bold">Costo Real (₲)</label>
                <input className="input-field mt-1" type="number" min="0" value={completeForm.costo_real} onChange={e => setCompleteForm({ ...completeForm, costo_real: e.target.value })} />
              </div>
              <div>
                <label className="input-label font-bold">Notas de Cierre</label>
                <textarea className="input-field mt-1" rows={3} value={completeForm.notas_cierre} onChange={e => setCompleteForm({ ...completeForm, notas_cierre: e.target.value })} placeholder="Ej. Reparación exitosa, equipo operativo" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setCompleting(null)} className="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 px-6 py-2.5 rounded-xl shadow-md font-bold">
                  <Check className="w-4 h-4" /> Completar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertasTab({ alerts, setAlerts, fetchData }: {
  alerts: any[]; setAlerts: (d: any[]) => void; fetchData: () => void
}) {
  const toast = useToast()
  const [filterResolved, setFilterResolved] = useState(false)

  const handleResolve = async (id: string) => {
    try {
      await api.equipment.alerts.resolve(id)
      toast.success("Alerta resuelta")
      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const handleCheckAlerts = async () => {
    try {
      const res = await api.equipment.checkAlerts()
      toast.success("Verificación completada", `${res.length} alertas generadas`)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const filtered = alerts.filter(a => !filterResolved || !a.resuelta)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={filterResolved} onChange={e => setFilterResolved(e.target.checked)} />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Solo activas</span>
          </label>
          <span className="text-xs text-gray-400 font-medium">{alerts.filter(a => !a.resuelta).length} activas</span>
        </div>
        <button onClick={handleCheckAlerts} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Zap className="w-4 h-4" /> Verificar Alertas
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map(a => (
          <div key={a.id} className={`card p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${
            a.resuelta ? "border-gray-100 dark:border-gray-700 opacity-60" : a.severidad === "crítica" ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10" : "border-gray-200/50 dark:border-gray-700/50"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-xl flex-shrink-0 ${
                  a.severidad === "crítica" ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" :
                  a.severidad === "alta" ? "bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400" :
                  "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 dark:text-white">{a.equipo_nombre}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${labelSeveridad(a.severidad)}`}>{a.severidad}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{new Date(a.created_at).toLocaleString("es-PY")}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{a.mensaje}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 uppercase">{a.tipo}</span>
                    {a.resuelta && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">Resuelta</span>}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                {!a.resuelta && (
                  <button onClick={() => handleResolve(a.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                    <Check className="w-3.5 h-3.5" /> Resolver
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 font-medium">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            No hay alertas
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardTab({ data }: { data: any }) {
  const cards = [
    { label: "Total Equipos", value: data.total_equipos ?? 0, icon: Box, color: "text-blue-600" },
    { label: "Activos", value: data.equipos_activos ?? 0, icon: Power, color: "text-green-600" },
    { label: "Inactivos", value: data.equipos_inactivos ?? 0, icon: X, color: "text-gray-500" },
    { label: "Mtto. Pendientes Hoy", value: data.mtto_pendientes_hoy ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Órdenes Pendientes", value: data.ordenes_pendientes ?? 0, icon: ClipboardCheck, color: "text-orange-600" },
    { label: "Órdenes en Progreso", value: data.ordenes_en_progreso ?? 0, icon: Play, color: "text-blue-600" },
    { label: "Completadas (Mes)", value: data.ordenes_completadas_mes ?? 0, icon: Check, color: "text-green-600" },
    { label: "Alertas Activas", value: data.alertas_activas ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Alertas Críticas", value: data.alertas_criticas ?? 0, icon: AlertCircle, color: "text-red-700" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="group relative bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1 overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 ${c.color}`} />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{c.label}</span>
              <div className={`p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-700/50 shadow-inner ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
            <div className={`text-3xl font-extrabold tracking-tight relative z-10 ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            Equipos por Categoría
          </h3>
          <div className="space-y-3">
            {(data.equipos_por_categoria ?? []).map((cat: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 w-28 capitalize truncate">{cat.categoria}</span>
                <div className="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (cat.cantidad / Math.max(...(data.equipos_por_categoria ?? []).map((c: any) => c.cantidad))) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold text-gray-600 dark:text-gray-400 w-8 text-right">{cat.cantidad}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-primary" />
            Indicadores Clave
          </h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Uptime Promedio</span>
                  <p className="text-[10px] text-gray-400">Disponibilidad general de equipos</p>
                </div>
              </div>
              <span className="text-2xl font-extrabold text-green-600 dark:text-green-400">{Number(data.uptime_promedio ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Costo Mtto. Mensual</span>
                  <p className="text-[10px] text-gray-400">Gasto en mantenimiento correctivo + preventivo</p>
                </div>
              </div>
              <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">{data.costo_mtto_mensual ? formatPYG(data.costo_mtto_mensual) : "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
