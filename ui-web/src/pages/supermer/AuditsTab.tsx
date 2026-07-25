import { useState, useEffect } from "react"
import { Search, Plus, Loader2, ClipboardList, CheckSquare, Scale, BarChart3, Trash2, AlertTriangle, Check, X, Sparkles, Eye, EyeOff, Gauge, TrendingUp, ShieldCheck, XCircle } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type STab = "plantillas" | "ejecuciones" | "dashboard"

interface AuditItem {
  id?: string
  pregunta: string
  categoria: string
  peso: number
  es_critico: boolean
}

interface AuditTemplate {
  id: string
  nombre: string
  area: string
  descripcion?: string
  items?: AuditItem[]
  activa: boolean
  created_at?: string
}

interface AuditExecution {
  id: string
  template_id: string
  template_nombre: string
  area: string
  estado: string
  score?: number
  pass?: boolean
  respuestas?: any[]
  ejecutado_por?: string
  created_at?: string
  completed_at?: string
  notas?: string
}

interface AuditDashboard {
  ejecuciones_hoy: number
  ejecuciones_semana: number
  tasa_aprobacion: number
  total_ejecuciones: number
  por_area: { area: string; total: number; aprobadas: number }[]
  alertas_pendientes: number
}

const AREAS = ["panadería", "carnicería", "rotisería", "verdulería", "lácteos", "almacén", "limpieza", "cámara"]

const CATEGORIAS = ["higiene", "temperatura", "calidad", "seguridad", "documentación", "equipamiento"]

const MOCK_TEMPLATES: AuditTemplate[] = [
  {
    id: "at1", nombre: "Higiene y Limpieza General", area: "panadería",
    descripcion: "Auditoría diaria de higiene en área de panadería",
    activa: true, created_at: new Date().toISOString(),
    items: [
      { id: "ai1", pregunta: "Mesada de trabajo limpia y desinfectada", categoria: "higiene", peso: 20, es_critico: true },
      { id: "ai2", pregunta: "Utensilios lavados y almacenados correctamente", categoria: "higiene", peso: 15, es_critico: false },
      { id: "ai3", pregunta: "Piso libre de residuos de harina/masa", categoria: "higiene", peso: 10, es_critico: false },
      { id: "ai4", pregunta: "Horno con temperatura correcta (180-220°C)", categoria: "temperatura", peso: 25, es_critico: true },
      { id: "ai5", pregunta: "Registro de temperatura visible y actualizado", categoria: "documentación", peso: 10, es_critico: false },
    ]
  },
  {
    id: "at2", nombre: "Control de Cámaras Frigoríficas", area: "carnicería",
    descripcion: "Verificación de temperatura y estado de cámaras de frío",
    activa: true, created_at: new Date().toISOString(),
    items: [
      { id: "ai6", pregunta: "Temperatura cámara entre 0°C y 4°C", categoria: "temperatura", peso: 30, es_critico: true },
      { id: "ai7", pregunta: "Puerta de cámara cierra herméticamente", categoria: "seguridad", peso: 15, es_critico: true },
      { id: "ai8", pregunta: "Alarma de temperatura operativa", categoria: "equipamiento", peso: 20, es_critico: false },
      { id: "ai9", pregunta: "Productos separados por tipo (ave, cerdo, vacuno)", categoria: "calidad", peso: 15, es_critico: false },
      { id: "ai10", pregunta: "Registro de temperaturas cada 4 horas", categoria: "documentación", peso: 10, es_critico: false },
    ]
  },
  {
    id: "at3", nombre: "Calidad de Verdulería", area: "verdulería",
    descripcion: "Auditoría de frescura y calidad de productos frescos",
    activa: false, created_at: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { id: "ai11", pregunta: "Productos sin signos de deshidratación", categoria: "calidad", peso: 25, es_critico: false },
      { id: "ai12", pregunta: "Góndola refrigerada a temperatura óptima", categoria: "temperatura", peso: 20, es_critico: true },
      { id: "ai13", pregunta: "Rotación FIFO aplicada correctamente", categoria: "calidad", peso: 20, es_critico: false },
    ]
  }
]

const MOCK_EXECUTIONS: AuditExecution[] = [
  {
    id: "ae1", template_id: "at1", template_nombre: "Higiene y Limpieza General", area: "panadería",
    estado: "completada", score: 92, pass: true, ejecutado_por: "Carlos Benítez",
    created_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    notas: "Todo en orden, pequeño derrame de harina corregido in-situ"
  },
  {
    id: "ae2", template_id: "at2", template_nombre: "Control de Cámaras Frigoríficas", area: "carnicería",
    estado: "completada", score: 75, pass: true, ejecutado_por: "María González",
    created_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    notas: "Alarma de temperatura no respondió en prueba, se generó orden de mantenimiento"
  },
  {
    id: "ae3", template_id: "at3", template_nombre: "Calidad de Verdulería", area: "verdulería",
    estado: "en_progreso", ejecutado_por: "Luis Acosta",
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
]

const MOCK_DASHBOARD: AuditDashboard = {
  ejecuciones_hoy: 3,
  ejecuciones_semana: 14,
  tasa_aprobacion: 85.7,
  total_ejecuciones: 48,
  por_area: [
    { area: "panadería", total: 12, aprobadas: 11 },
    { area: "carnicería", total: 10, aprobadas: 8 },
    { area: "verdulería", total: 8, aprobadas: 6 },
    { area: "rotisería", total: 6, aprobadas: 5 },
    { area: "lácteos", total: 7, aprobadas: 7 },
    { area: "almacén", total: 5, aprobadas: 4 },
  ],
  alertas_pendientes: 2
}

export default function AuditsTab() {
  const [tab, setTab] = useState<STab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<AuditTemplate[]>(MOCK_TEMPLATES)
  const [executions, setExecutions] = useState<AuditExecution[]>(MOCK_EXECUTIONS)
  const [dashboard, setDashboard] = useState<AuditDashboard>(MOCK_DASHBOARD)
  const [search, setSearch] = useState("")
  const toast = useToast()

  useEffect(() => {
    fetchData()
  }, [tab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []
      if (tab === "plantillas") promises.push(api.audits.templates.list().then(setTemplates))
      if (tab === "ejecuciones") promises.push(api.audits.executions.list().then(setExecutions))
      if (tab === "dashboard") promises.push(api.audits.dashboard().then(setDashboard))
      await Promise.all(promises.map(p => p.catch(e => console.warn("Demo fetch warning:", e))))
    } catch (e: any) {
      console.error("Audits fetch error:", e)
    } finally {
      setLoading(false)
    }
  }

  const tabs: { k: STab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "plantillas", l: "Plantillas", i: ClipboardList },
    { k: "ejecuciones", l: "Ejecuciones", i: CheckSquare },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
          {tab === "plantillas" && <PlantillasTab data={templates} search={search} setSearch={setSearch} fetchAll={fetchData} />}
          {tab === "ejecuciones" && <EjecucionesTab data={executions} templates={templates} search={search} setSearch={setSearch} fetchAll={fetchData} toast={toast} />}
          {tab === "dashboard" && <DashboardTab data={dashboard} />}
        </>
      )}
    </div>
  )
}

function PlantillasTab({ data, search, setSearch, fetchAll }: { data: AuditTemplate[]; search: string; setSearch: (s: string) => void; fetchAll: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formNombre, setFormNombre] = useState("")
  const [formArea, setFormArea] = useState("panadería")
  const [formDesc, setFormDesc] = useState("")
  const [formActiva, setFormActiva] = useState(true)
  const [formItems, setFormItems] = useState<AuditItem[]>([])
  const toast = useToast()

  const filtered = data.filter(t => !search || t.nombre?.toLowerCase().includes(search.toLowerCase()) || t.area?.includes(search))

  const handleAddItem = () => {
    setFormItems([...formItems, { pregunta: "", categoria: "higiene", peso: 10, es_critico: false }])
  }

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx))
  }

  const handleUpdateItem = (idx: number, key: string, value: any) => {
    setFormItems(formItems.map((item, i) => i === idx ? { ...item, [key]: value } : item))
  }

  const openCreate = () => {
    setIsEditing(false)
    setEditingId(null)
    setFormNombre("")
    setFormArea("panadería")
    setFormDesc("")
    setFormActiva(true)
    setFormItems([])
    setShowModal(true)
  }

  const openEdit = (t: AuditTemplate) => {
    setIsEditing(true)
    setEditingId(t.id)
    setFormNombre(t.nombre)
    setFormArea(t.area)
    setFormDesc(t.descripcion || "")
    setFormActiva(t.activa)
    setFormItems(t.items?.map(i => ({ ...i })) || [])
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre) { toast.error("Validación", "El nombre de la plantilla es obligatorio."); return }
    if (formItems.length === 0) { toast.error("Validación", "Debe agregar al menos un ítem de auditoría."); return }
    if (formItems.some(i => !i.pregunta)) { toast.error("Validación", "Todos los ítems deben tener una pregunta."); return }

    setSaving(true)
    try {
      if (isEditing && editingId) {
        await api.audits.templates.update(editingId, {
          nombre: formNombre, area: formArea, descripcion: formDesc, activa: formActiva,
          items: formItems.map(i => ({
            pregunta: i.pregunta, categoria: i.categoria, peso: i.peso, es_critico: i.es_critico
          }))
        })
        toast.success("Plantilla Actualizada", "La plantilla de auditoría ha sido modificada.")
      } else {
        await api.audits.templates.create({
          nombre: formNombre, area: formArea, descripcion: formDesc, activa: formActiva,
          items: formItems.map(i => ({
            pregunta: i.pregunta, categoria: i.categoria, peso: i.peso, es_critico: i.es_critico
          }))
        })
        toast.success("Plantilla Creada", "Nueva plantilla de auditoría registrada.")
      }
      setShowModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo guardar la plantilla.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (t: AuditTemplate) => {
    try {
      await api.audits.templates.update(t.id, { activa: !t.activa })
      toast.success(t.activa ? "Plantilla Desactivada" : "Plantilla Activada")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar permanentemente esta plantilla?")) return
    try {
      await api.audits.templates.delete(id)
      toast.success("Plantilla Eliminada")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message)
    }
  }

  const totalWeight = formItems.reduce((s, i) => s + (i.peso || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar plantilla por nombre o área..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Plantilla
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Plantilla</th>
              <th className="p-4">Área</th>
              <th className="p-4 text-center">Ítems</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{t.nombre}</div>
                  <div className="text-[10px] text-gray-400 max-w-xs truncate">{t.descripcion || "Sin descripción"}</div>
                </td>
                <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{t.area}</span></td>
                <td className="p-4 text-center font-semibold text-gray-500">{t.items?.length ?? 0}</td>
                <td className="p-4 text-center">
                  {t.activa ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1"><Check className="w-3 h-3" /> Activa</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400 items-center gap-1"><X className="w-3 h-3" /> Inactiva</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(t)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2.5 py-1 rounded-lg transition-colors">Editar</button>
                    <button onClick={() => handleToggleActive(t)} className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors ${t.activa ? "bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/10 dark:text-amber-400" : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/10 dark:text-green-400"}`}>
                      {t.activa ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500 font-medium">
                  <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No se encontraron plantillas de auditoría
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                {isEditing ? "Editar Plantilla" : "Nueva Plantilla de Auditoría"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="input-label label-required font-bold">Nombre</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. Higiene Diaria" value={formNombre} onChange={e => setFormNombre(e.target.value)} required />
                </div>
                <div>
                  <label className="input-label label-required font-bold">Área</label>
                  <select className="input-field mt-1" value={formArea} onChange={e => setFormArea(e.target.value)}>
                    {AREAS.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={formActiva} onChange={e => setFormActiva(e.target.checked)} className="rounded text-primary focus:ring-primary w-5 h-5" />
                    Plantilla activa
                  </label>
                </div>
              </div>
              <div>
                <label className="input-label font-bold">Descripción</label>
                <textarea className="input-field mt-1 min-h-[60px]" placeholder="Propósito y alcance de la auditoría..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Items del Checklist {totalWeight > 0 && <span className="text-primary ml-2">(Peso total: {totalWeight}%)</span>}
                  </h4>
                  <button type="button" onClick={handleAddItem} className="btn-outline py-1 px-3 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>
                {formItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 bg-gray-50/50 dark:bg-slate-800/10 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    No hay ítems. Haz clic en "Agregar Ítem".
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-3.5 bg-gray-50/50 dark:bg-slate-800/20 rounded-xl border border-gray-200/40 dark:border-gray-700/40">
                        <div className="flex-1 min-w-0">
                          <input className="input-field w-full" type="text" placeholder="Pregunta de auditoría..." value={item.pregunta} onChange={e => handleUpdateItem(idx, "pregunta", e.target.value)} required />
                        </div>
                        <div className="w-full sm:w-36">
                          <select className="input-field w-full" value={item.categoria} onChange={e => handleUpdateItem(idx, "categoria", e.target.value)}>
                            {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                          </select>
                        </div>
                        <div className="w-full sm:w-20">
                          <input className="input-field w-full text-center" type="number" min="1" max="100" placeholder="Peso" value={item.peso} onChange={e => handleUpdateItem(idx, "peso", Number(e.target.value))} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs font-bold text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={item.es_critico} onChange={e => handleUpdateItem(idx, "es_critico", e.target.checked)} className="rounded text-red-500 focus:ring-red-500 w-4 h-4" />
                            Crítico
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
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost py-2 px-5 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="btn-primary py-2 px-6 rounded-xl font-bold flex items-center gap-2" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Plantilla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EjecucionesTab({ data, templates, search, setSearch, fetchAll, toast }: { data: AuditExecution[]; templates: AuditTemplate[]; search: string; setSearch: (s: string) => void; fetchAll: () => void; toast: any }) {
  const [showStartModal, setShowStartModal] = useState(false)
  const [showAnswerModal, setShowAnswerModal] = useState<AuditExecution | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [ejecutor, setEjecutor] = useState("")
  const [notas, setNotas] = useState("")
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)

  const filtered = data.filter(e => !search || e.template_nombre?.toLowerCase().includes(search.toLowerCase()) || e.area?.includes(search) || e.ejecutado_por?.toLowerCase().includes(search.toLowerCase()))

  const activeTemplates = templates.filter(t => t.activa)

  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplateId || !ejecutor) { toast.error("Validación", "Debe seleccionar una plantilla y un ejecutor."); return }
    setStarting(true)
    try {
      await api.audits.executions.start({
        template_id: selectedTemplateId,
        ejecutado_por: ejecutor,
        notas: notas || undefined
      })
      toast.success("Auditoría Iniciada", "La ejecución de auditoría ha sido registrada.")
      setShowStartModal(false)
      setSelectedTemplateId("")
      setEjecutor("")
      setNotas("")
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo iniciar la auditoría.")
    } finally {
      setStarting(false)
    }
  }

  const openAnswerModal = (exec: AuditExecution) => {
    const template = templates.find(t => t.id === exec.template_id)
    const initAnswers: Record<string, boolean> = {}
    if (template?.items) {
      template.items.forEach(item => {
        initAnswers[item.id || item.pregunta] = false
      })
    }
    setAnswers(initAnswers)
    setShowAnswerModal(exec)
  }

  const handleSubmitAnswers = async () => {
    if (!showAnswerModal) return
    setSaving(true)
    try {
      const answerList = Object.entries(answers).map(([pregunta, valor]) => ({ pregunta, cumplido: valor }))
      await api.audits.executions.submitAnswers(showAnswerModal.id, answerList)
      await api.audits.executions.complete(showAnswerModal.id)
      toast.success("Auditoría Completada", "Las respuestas han sido registradas y la auditoría finalizada.")
      setShowAnswerModal(null)
      fetchAll()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudieron guardar las respuestas.")
    } finally {
      setSaving(false)
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const executingTemplate = showAnswerModal ? templates.find(t => t.id === showAnswerModal.template_id) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar ejecución por plantilla, área o ejecutor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowStartModal(true)} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Auditoría
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Auditoría</th>
              <th className="p-4">Área</th>
              <th className="p-4">Ejecutor</th>
              <th className="p-4 text-center">Score</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{e.template_nombre}</div>
                  <div className="text-[10px] text-gray-400 max-w-xs truncate">{e.notas || ""}</div>
                </td>
                <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">{e.area}</span></td>
                <td className="p-4 text-gray-600 dark:text-gray-300 text-sm">{e.ejecutado_por || "-"}</td>
                <td className="p-4 text-center font-mono font-bold">
                  {e.score != null ? (
                    <span className={e.score >= 80 ? "text-green-600" : e.score >= 60 ? "text-amber-600" : "text-red-600"}>{e.score}%</span>
                  ) : "-"}
                </td>
                <td className="p-4 text-center">
                  {e.estado === "completada" ? (
                    e.pass ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 items-center gap-1"><Check className="w-3 h-3" /> Aprobada</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 items-center gap-1"><XCircle className="w-3 h-3" /> Reprobada</span>
                    )
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> En Progreso</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {e.estado === "en_progreso" && (
                    <button onClick={() => openAnswerModal(e)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-sm flex items-center gap-1 ml-auto">
                      <CheckSquare className="w-3.5 h-3.5" /> Responder
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">
                  <CheckSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
                  No se encontraron ejecuciones de auditoría
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> Iniciar Nueva Auditoría
              </h3>
              <button onClick={() => setShowStartModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleStartAudit} className="p-6 space-y-4">
              <div>
                <label className="input-label label-required font-bold">Plantilla</label>
                {activeTemplates.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2 mt-1">
                    <AlertTriangle className="w-4 h-4" /> No hay plantillas activas disponibles
                  </div>
                ) : (
                  <select className="input-field mt-1" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} required>
                    <option value="">-- Seleccionar --</option>
                    {activeTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre} ({t.area}) — {t.items?.length ?? 0} ítems</option>
                    ))}
                  </select>
                )}
                {selectedTemplate && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-800/40 rounded-lg text-xs text-gray-500">
                    <span className="font-bold">{selectedTemplate.items?.length ?? 0} ítems</span>
                    {selectedTemplate.items && (
                      <span> — críticos: {selectedTemplate.items.filter(i => i.es_critico).length}</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="input-label label-required font-bold">Ejecutor</label>
                <input className="input-field mt-1" type="text" placeholder="Nombre del auditor" value={ejecutor} onChange={e => setEjecutor(e.target.value)} required />
              </div>
              <div>
                <label className="input-label font-bold">Notas / Alcance</label>
                <textarea className="input-field mt-1 min-h-[60px]" placeholder="Observaciones previas a la auditoría..." value={notas} onChange={e => setNotas(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowStartModal(false)} className="btn-ghost px-4 py-2 rounded-xl">Cancelar</button>
                <button type="submit" className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={starting || activeTemplates.length === 0}>
                  {starting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Iniciar Auditoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnswerModal && executingTemplate && (
        <div className="modal-overlay" onClick={() => setShowAnswerModal(null)}>
          <div className="modal-content max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" /> {executingTemplate.nombre}
              </h3>
              <button onClick={() => setShowAnswerModal(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              <p className="text-sm text-gray-500 dark:text-gray-400">{executingTemplate.descripcion}</p>
              <div className="space-y-3">
                {executingTemplate.items?.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-200/40 dark:border-gray-700/40">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 dark:text-slate-500">#{idx + 1}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.es_critico ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"}`}>
                          {item.categoria}{item.es_critico ? " ⚠" : ""}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-auto">Peso: {item.peso}%</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">{item.pregunta}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button type="button" onClick={() => setAnswers(prev => ({ ...prev, [item.id || item.pregunta]: true }))}
                        className={`p-3 rounded-xl border-2 transition-all ${answers[item.id || item.pregunta] ? "bg-green-50 border-green-500 text-green-600 dark:bg-green-950/20 dark:border-green-500 shadow-sm" : "border-gray-200 dark:border-gray-600 text-gray-400 hover:border-green-300"}`}>
                        <Check className="w-5 h-5" />
                      </button>
                      <button type="button" onClick={() => setAnswers(prev => ({ ...prev, [item.id || item.pregunta]: false }))}
                        className={`p-3 rounded-xl border-2 transition-all ${!answers[item.id || item.pregunta] ? "bg-red-50 border-red-500 text-red-600 dark:bg-red-950/20 dark:border-red-500 shadow-sm" : "border-gray-200 dark:border-gray-600 text-gray-400 hover:border-red-300"}`}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <span className="text-sm text-gray-500">
                Respondidos: {Object.values(answers).filter(Boolean).length} / {Object.keys(answers).length}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setShowAnswerModal(null)} className="btn-ghost px-4 py-2 rounded-xl font-bold">Cancelar</button>
                <button onClick={handleSubmitAnswers} className="btn-primary px-5 py-2 rounded-xl font-bold flex items-center gap-1.5" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Finalizar y Calificar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardTab({ data }: { data: AuditDashboard }) {
  const totalAprobadas = data.por_area.reduce((s, a) => s + a.aprobadas, 0)
  const totalGlobal = data.por_area.reduce((s, a) => s + a.total, 0)

  const cards = [
    { label: "Ejecuciones Hoy", value: data.ejecuciones_hoy, icon: CheckSquare, color: "text-blue-600" },
    { label: "Esta Semana", value: data.ejecuciones_semana, icon: BarChart3, color: "text-purple-600" },
    { label: "Tasa de Aprobación", value: `${data.tasa_aprobacion}%`, icon: ShieldCheck, color: "text-green-600" },
    { label: "Alertas Pendientes", value: data.alertas_pendientes, icon: AlertTriangle, color: "text-red-600" },
    { label: "Total Ejecutadas", value: data.total_ejecuciones, icon: ClipboardList, color: "text-amber-600" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in slide-in-from-bottom-4 duration-700">
        {cards.map((c, i) => (
          <div key={i} className="group relative bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1 overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 ${c.color}`} />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{c.label}</span>
              <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 shadow-inner group-hover:bg-opacity-80 transition-colors ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
            <div className={`text-3xl font-extrabold tracking-tight relative z-10 ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Gauge className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Resultados por Área</h3>
        </div>
        <div className="space-y-4">
          {data.por_area.map((a, i) => {
            const pct = a.total > 0 ? Math.round((a.aprobadas / a.total) * 100) : 0
            return (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-full sm:w-32 text-sm font-bold text-gray-700 dark:text-gray-300 capitalize">{a.area}</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-mono">
                  <span className="text-green-600 font-bold">{a.aprobadas}/{a.total}</span>
                  <span className={`font-extrabold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Resumen de Calidad</h3>
          </div>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-6xl font-extrabold text-green-600 dark:text-green-400">{data.tasa_aprobacion}%</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">Tasa de aprobación global</p>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totalAprobadas}</div>
                  <div className="text-gray-400 text-xs font-medium">Aprobadas</div>
                </div>
                <div className="text-gray-300 dark:text-gray-600 text-2xl">/</div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{totalGlobal}</div>
                  <div className="text-gray-400 text-xs font-medium">Totales</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Alertas y Recomendaciones</h3>
          </div>
          <div className="space-y-3">
            {data.alertas_pendientes > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Alertas críticas sin resolver</p>
                  <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">{data.alertas_pendientes} alerta(s) de auditoría requieren acción inmediata</p>
                </div>
              </div>
            )}
            {data.por_area.some(a => a.total > 0 && (a.aprobadas / a.total) < 0.7) && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Áreas con bajo rendimiento</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">Hay áreas con tasa de aprobación inferior al 70% — revisar planes de acción</p>
                </div>
              </div>
            )}
            {data.tasa_aprobacion >= 85 && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800/30 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">Buen desempeño general</p>
                  <p className="text-xs text-green-600 dark:text-green-400/80 mt-1">La tasa de aprobación global supera el 85% — mantener el estándar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
