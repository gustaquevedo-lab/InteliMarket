import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { ChefHat, Thermometer, Tag, PackageOpen, Sparkles, Plus, Search, Loader2, X, Check, AlertTriangle, Trash2, ClipboardList, CheckCircle, Clock, Gauge, Printer } from "lucide-react"
import { formatPYG, formatDate, formatDateTime, formatTime } from "../../utils/format"

type SubTab = "recipes" | "plans" | "tempLogs" | "labels" | "markdown"

const MOCK_RECIPES = [
  { id: "r1", nombre: "Pollo Asado Entero", descripcion: "Pollo entero sazonado con sal, pimienta y especias", producto_terminado_nombre: "Pollo Asado Entero", cantidad_esperada: 20, unidad_medida: "UN", rendimiento_esperado: 95, activa: true, items: [{ producto_nombre: "Pollo Fresco Entero", cantidad: 1 }, { producto_nombre: "Sal Fina (g)", cantidad: 10 }, { producto_nombre: "Pimienta Negra (g)", cantidad: 5 }, { producto_nombre: "Aceite Vegetal (ml)", cantidad: 30 }] },
  { id: "r2", nombre: "Milanesa de Carne", descripcion: "Milanesa de carne vacuna empanizada", producto_terminado_nombre: "Milanesa de Carne c/u", cantidad_esperada: 50, unidad_medida: "UN", rendimiento_esperado: 92, activa: true, items: [{ producto_nombre: "Carne de Cuadril (kg)", cantidad: 30 }, { producto_nombre: "Pan Rallado (kg)", cantidad: 5 }, { producto_nombre: "Huevo (UN)", cantidad: 20 }] },
  { id: "r3", nombre: "Empanada de Carne", descripcion: "Empanada criolla de carne cortada a cuchillo", producto_terminado_nombre: "Empanada de Carne c/u", cantidad_esperada: 100, unidad_medida: "UN", rendimiento_esperado: 98, activa: false, items: [{ producto_nombre: "Carne Picada (kg)", cantidad: 15 }, { producto_nombre: "Cebolla (kg)", cantidad: 5 }, { producto_nombre: "Harina (kg)", cantidad: 10 }, { producto_nombre: "Huevo (UN)", cantidad: 12 }] },
  { id: "r4", nombre: "Tortilla de Papa", descripcion: "Tortilla española de papa y cebolla", producto_terminado_nombre: "Tortilla de Papa c/u", cantidad_esperada: 30, unidad_medida: "UN", rendimiento_esperado: 90, activa: true, items: [{ producto_nombre: "Papa Blanca (kg)", cantidad: 8 }, { producto_nombre: "Huevo (UN)", cantidad: 40 }, { producto_nombre: "Cebolla (kg)", cantidad: 2 }, { producto_nombre: "Aceite (ml)", cantidad: 500 }] },
  { id: "r5", nombre: "Salsa Boloñesa Casera", descripcion: "Salsa boloñesa base para pastas", producto_terminado_nombre: "Salsa Boloñesa (litro)", cantidad_esperada: 15, unidad_medida: "L", rendimiento_esperado: 96, activa: true, items: [{ producto_nombre: "Carne Picada (kg)", cantidad: 5 }, { producto_nombre: "Tomate Triturado (kg)", cantidad: 10 }, { producto_nombre: "Cebolla (kg)", cantidad: 3 }, { producto_nombre: "Ajo (kg)", cantidad: 0.5 }] },
]

const MOCK_PLANS = [
  { id: "p1", receta_nombre: "Pollo Asado Entero", cantidad_objetivo: 20, estado: "en_progreso", fecha_inicio: new Date().toISOString(), notas: "Producción matutina" },
  { id: "p2", receta_nombre: "Milanesa de Carne", cantidad_objetivo: 30, estado: "completada", fecha_inicio: new Date(Date.now() - 86400000).toISOString(), fecha_fin: new Date().toISOString(), notas: "Pedido especial" },
  { id: "p3", receta_nombre: "Tortilla de Papa", cantidad_objetivo: 15, estado: "pendiente", notas: "Para el mediodía" },
]

const MOCK_TEMP_LOGS: Record<string, any[]> = {
  p1: [
    { id: "t1", tipo: "inicio", temperatura: 4.2, hora: new Date(Date.now() - 7200000).toISOString(), observacion: "Materia prima en recepción" },
    { id: "t2", tipo: "coccion", temperatura: 75.8, hora: new Date(Date.now() - 3600000).toISOString(), observacion: "Pollo en horno, punto crítico alcanzado" },
    { id: "t3", tipo: "enfriado", temperatura: 8.5, hora: new Date().toISOString(), observacion: "Enfriado en cámara" },
  ],
  p2: [
    { id: "t4", tipo: "inicio", temperatura: 5.1, hora: new Date(Date.now() - 86400000).toISOString(), observacion: "Carne temperada" },
    { id: "t5", tipo: "coccion", temperatura: 72.3, hora: new Date(Date.now() - 82800000).toISOString(), observacion: "Fritura profunda 180°C" },
    { id: "t6", tipo: "enfriado", temperatura: 6.8, hora: new Date(Date.now() - 79200000).toISOString(), observacion: "En góndola refrigerada" },
  ],
}

const MOCK_LABELS: Record<string, any[]> = {
  p1: [
    { id: "l1", producto_nombre: "Pollo Asado Entero", lote: "PA-20260527-A", peso_kg: 1.8, precio_unitario: 45000, fecha_vencimiento: "2026-05-28", generado_en: new Date().toISOString() },
    { id: "l2", producto_nombre: "Pollo Asado Entero", lote: "PA-20260527-B", peso_kg: 2.1, precio_unitario: 45000, fecha_vencimiento: "2026-05-28", generado_en: new Date().toISOString() },
  ],
  p2: [
    { id: "l3", producto_nombre: "Milanesa de Carne", lote: "MIL-20260526-A", peso_kg: 0.25, precio_unitario: 18000, fecha_vencimiento: "2026-05-29", generado_en: new Date(Date.now() - 86400000).toISOString() },
  ],
}

const MOCK_MARKDOWNS = [
  { id: "m1", producto_nombre: "Pollo Asado Entero", descuento_porcentaje: 30, precio_original: 45000, precio_markdown: 31500, fecha_inicio: "2026-05-27", motivo: "Fin de día — excedente de producción" },
  { id: "m2", producto_nombre: "Milanesa de Carne", descuento_porcentaje: 40, precio_original: 18000, precio_markdown: 10800, fecha_inicio: "2026-05-26", motivo: "Vencimiento próximo" },
]

export default function RotiseriaTab() {
  const [subTab, setSubTab] = useState<SubTab>("recipes")
  const [loading, setLoading] = useState(true)
  const [recipes, setRecipes] = useState<any[]>(MOCK_RECIPES)
  const [plans, setPlans] = useState<any[]>(MOCK_PLANS)
  const [tempLogs, setTempLogs] = useState<Record<string, any[]>>(MOCK_TEMP_LOGS)
  const [labels, setLabels] = useState<Record<string, any[]>>(MOCK_LABELS)
  const [markdowns, setMarkdowns] = useState<any[]>(MOCK_MARKDOWNS)
  const [search, setSearch] = useState("")
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showTempModal, setShowTempModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    fetchAll()
  }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []
      if (subTab === "recipes") promises.push(api.rotiseria.recipes.list().then(setRecipes))
      if (subTab === "plans") promises.push(api.rotiseria.plans.list().then(setPlans))
      if (subTab === "markdown") promises.push(api.rotiseria.autoMarkdown().then(setMarkdowns))
      await Promise.all(promises.map(p => p.catch(e => console.warn("Rotiseria fetch warning:", e))))
    } catch (e: any) {
      console.error("Rotiseria fetch error:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadTempLogs = async (planId: string) => {
    try {
      const data = await api.rotiseria.plans.tempLogs.list(planId)
      setTempLogs(prev => ({ ...prev, [planId]: data }))
    } catch {
      // use mock
    }
  }

  const loadLabels = async (planId: string) => {
    try {
      const data = await api.rotiseria.plans.labels.list(planId)
      setLabels(prev => ({ ...prev, [planId]: data }))
    } catch {
      // use mock
    }
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    if (subTab === "tempLogs") loadTempLogs(planId)
    if (subTab === "labels") loadLabels(planId)
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "recipes", l: "Recetas", i: ChefHat },
    { k: "plans", l: "Planes", i: ClipboardList },
    { k: "tempLogs", l: "Temperaturas", i: Thermometer },
    { k: "labels", l: "Etiquetas", i: Tag },
    { k: "markdown", l: "Markdown", i: Sparkles },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
              subTab === t.k
                ? "bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-100"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:scale-[1.02]"
            }`}>
            {subTab === t.k && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
            <t.i className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {subTab === "recipes" && (
            <RecetasSubTab
              data={recipes}
              search={search}
              setSearch={setSearch}
              showModal={showRecipeModal}
              setShowModal={setShowRecipeModal}
              saving={saving}
              setSaving={setSaving}
              fetchAll={fetchAll}
            />
          )}
          {subTab === "plans" && (
            <PlanesSubTab
              data={plans}
              search={search}
              setSearch={setSearch}
              showModal={showPlanModal}
              setShowModal={setShowPlanModal}
              saving={saving}
              setSaving={setSaving}
              fetchAll={fetchAll}
            />
          )}
          {subTab === "tempLogs" && (
            <TempLogsSubTab
              plans={plans}
              selectedPlanId={selectedPlanId}
              onSelectPlan={handleSelectPlan}
              tempLogs={tempLogs}
              showModal={showTempModal}
              setShowModal={setShowTempModal}
              fetchAll={fetchAll}
            />
          )}
          {subTab === "labels" && (
            <LabelsSubTab
              plans={plans}
              selectedPlanId={selectedPlanId}
              onSelectPlan={handleSelectPlan}
              labels={labels}
            />
          )}
          {subTab === "markdown" && (
            <MarkdownSubTab
              data={markdowns}
              search={search}
              setSearch={setSearch}
              fetchAll={fetchAll}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Recetas SubTab ──────────────────────────────────────────────
function RecetasSubTab({ data, search, setSearch, showModal, setShowModal, saving, setSaving, fetchAll }: any) {
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formNombre, setFormNombre] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formQty, setFormQty] = useState("1")
  const [formYield, setFormYield] = useState("100")
  const [formItems, setFormItems] = useState<{ nombre: string; cantidad: string }[]>([])

  const filtered = data.filter((r: any) => !search || r.nombre?.toLowerCase().includes(search.toLowerCase()))

  const resetForm = () => {
    setIsEditing(false)
    setEditingId(null)
    setFormNombre("")
    setFormDesc("")
    setFormQty("1")
    setFormYield("100")
    setFormItems([])
  }

  const handleEditClick = (recipe: any) => {
    setIsEditing(true)
    setEditingId(recipe.id)
    setFormNombre(recipe.nombre || "")
    setFormDesc(recipe.descripcion || "")
    setFormQty(recipe.cantidad_esperada?.toString() || "1")
    setFormYield(recipe.rendimiento_esperado?.toString() || "100")
    if (recipe.items) {
      setFormItems(recipe.items.map((it: any) => ({ nombre: it.producto_nombre || "", cantidad: it.cantidad?.toString() || "1" })))
    }
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta receta permanentemente?")) return
    try {
      await api.rotiseria.recipes.delete(id)
      toast.success("Receta eliminada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre) { toast.error("Validación", "El nombre es obligatorio"); return }
    setSaving(true)
    try {
      const body = {
        nombre: formNombre,
        descripcion: formDesc,
        cantidad_esperada: Number(formQty),
        rendimiento_esperado: Number(formYield),
        items: formItems.filter(i => i.nombre).map(i => ({ producto_nombre: i.nombre, cantidad: Number(i.cantidad) || 1 })),
      }
      if (isEditing && editingId) {
        await api.rotiseria.recipes.update(editingId, body)
        toast.success("Receta actualizada")
      } else {
        await api.rotiseria.recipes.create(body)
        toast.success("Receta creada")
      }
      setShowModal(false)
      resetForm()
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar receta..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nueva Receta
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Receta</th>
              <th className="p-4 text-right">Cant.</th>
              <th className="p-4 text-right">Rendimiento</th>
              <th className="p-4 text-center">Insumos</th>
              <th className="p-4 text-center">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900 dark:text-white">{r.nombre}</div>
                  <div className="text-[10px] text-gray-400 max-w-xs truncate">{r.descripcion || "—"}</div>
                </td>
                <td className="p-4 text-right font-mono font-semibold">{r.cantidad_esperada ?? "—"} {r.unidad_medida || "UN"}</td>
                <td className="p-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{Number(r.rendimiento_esperado ?? 0).toFixed(0)}%</td>
                <td className="p-4 text-center font-semibold text-gray-500">{r.items?.length ?? 0} ítems</td>
                <td className="p-4 text-center">
                  {r.activa ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-1 w-fit mx-auto"><Check className="w-3 h-3" /> Activa</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-1 w-fit mx-auto"><AlertTriangle className="w-3 h-3" /> Inactiva</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEditClick(r)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold px-2.5 py-1 rounded-lg transition-colors">Editar</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500 font-medium"><ChefHat className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />No se encontraron recetas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="modal-content max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-primary" />
                {isEditing ? "Editar Receta" : "Nueva Receta de Rotisería"}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required font-bold">Nombre</label>
                  <input className="input-field mt-1" type="text" placeholder="Ej. Pollo Asado Entero" value={formNombre} onChange={e => setFormNombre(e.target.value)} required />
                </div>
                <div>
                  <label className="input-label font-bold">Cantidad esperada</label>
                  <input className="input-field mt-1" type="number" min="1" value={formQty} onChange={e => setFormQty(e.target.value)} />
                </div>
                <div>
                  <label className="input-label font-bold">Rendimiento esperado (%)</label>
                  <input className="input-field mt-1" type="number" min="1" max="100" value={formYield} onChange={e => setFormYield(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="input-label font-bold">Descripción</label>
                <textarea className="input-field mt-1" rows={2} placeholder="Notas opcionales" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label font-bold">Insumos / Ingredientes</label>
                  <button type="button" onClick={() => setFormItems([...formItems, { nombre: "", cantidad: "1" }])} className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input-field flex-1" placeholder="Nombre del insumo" value={item.nombre} onChange={e => setFormItems(formItems.map((it, j) => j === i ? { ...it, nombre: e.target.value } : it))} />
                      <input className="input-field w-24" type="number" min="0.1" step="0.1" value={item.cantidad} onChange={e => setFormItems(formItems.map((it, j) => j === i ? { ...it, cantidad: e.target.value } : it))} />
                      <button type="button" onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Planes SubTab ───────────────────────────────────────────────
function PlanesSubTab({ data, search, setSearch, showModal, setShowModal, saving, setSaving, fetchAll }: any) {
  const toast = useToast()
  const [formRecetaNombre, setFormRecetaNombre] = useState("")
  const [formCantidad, setFormCantidad] = useState("1")
  const [formNotas, setFormNotas] = useState("")

  const filtered = data.filter((p: any) => !search || p.receta_nombre?.toLowerCase().includes(search.toLowerCase()))

  const handleComplete = async (id: string) => {
    const obtained = prompt("Cantidad obtenida:")
    if (!obtained || isNaN(Number(obtained))) return
    try {
      await api.rotiseria.plans.complete(id, { cantidad_obtenida: Number(obtained) })
      toast.success("Plan completado")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRecetaNombre) { toast.error("Validación", "Nombre de receta requerido"); return }
    setSaving(true)
    try {
      await api.rotiseria.plans.create({ receta_nombre: formRecetaNombre, cantidad_objetivo: Number(formCantidad), notas: formNotas })
      toast.success("Plan creado")
      setShowModal(false)
      setFormRecetaNombre(""); setFormCantidad("1"); setFormNotas("")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar plan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Nuevo Plan
        </button>
      </div>

      <div className="grid gap-4">
        {filtered.map((p: any) => (
          <div key={p.id} className="card p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${p.estado === "completada" ? "bg-green-100 dark:bg-green-950/30 text-green-600" : p.estado === "en_progreso" ? "bg-blue-100 dark:bg-blue-950/30 text-blue-600" : "bg-gray-100 dark:bg-slate-700 text-gray-500"}`}>
                  {p.estado === "completada" ? <CheckCircle className="w-5 h-5" /> : p.estado === "en_progreso" ? <Clock className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{p.receta_nombre}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Objetivo: {p.cantidad_objetivo} — {p.notas || "Sin notas"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  p.estado === "completada" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                  p.estado === "en_progreso" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
                  "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                }`}>{p.estado === "en_progreso" ? "En Progreso" : p.estado === "completada" ? "Completada" : "Pendiente"}</span>
                <div className="text-[10px] text-gray-400 font-medium">{formatDate(p.fecha_inicio)}</div>
                {p.estado !== "completada" && (
                  <button onClick={() => handleComplete(p.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"><Check className="w-3 h-3" /> Completar</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 font-medium bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />No hay planes de producción
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />Nuevo Plan</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="input-label font-bold">Receta / Producto</label>
                <input className="input-field mt-1" placeholder="Ej. Pollo Asado Entero" value={formRecetaNombre} onChange={e => setFormRecetaNombre(e.target.value)} required />
              </div>
              <div>
                <label className="input-label font-bold">Cantidad objetivo</label>
                <input className="input-field mt-1" type="number" min="1" value={formCantidad} onChange={e => setFormCantidad(e.target.value)} required />
              </div>
              <div>
                <label className="input-label font-bold">Notas</label>
                <input className="input-field mt-1" placeholder="Opcional" value={formNotas} onChange={e => setFormNotas(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? "Guardando..." : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TempLogs SubTab ─────────────────────────────────────────────
function TempLogsSubTab({ plans, selectedPlanId, onSelectPlan, tempLogs, showModal, setShowModal, fetchAll }: any) {
  const toast = useToast()
  const [formTipo, setFormTipo] = useState("inicio")
  const [formTemp, setFormTemp] = useState("")
  const [formObs, setFormObs] = useState("")

  const logs = selectedPlanId ? tempLogs[selectedPlanId] || [] : []

  const handleAddTemp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanId || !formTemp) return
    try {
      await api.rotiseria.plans.tempLogs.create(selectedPlanId, { tipo: formTipo, temperatura: Number(formTemp), observacion: formObs })
      toast.success("Registro de temperatura añadido")
      setShowModal(false)
      setFormTipo("inicio"); setFormTemp(""); setFormObs("")
      if (selectedPlanId) {
        const data = await api.rotiseria.plans.tempLogs.list(selectedPlanId)
        tempLogs[selectedPlanId] = data
      }
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 bg-gray-50 dark:bg-slate-800/30 rounded-xl p-1.5 border border-gray-200/50 dark:border-gray-700/50 w-full overflow-x-auto">
        <button onClick={() => onSelectPlan(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${!selectedPlanId ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}>
          Todos los registros
        </button>
        {plans.map((p: any) => (
          <button key={p.id} onClick={() => onSelectPlan(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${selectedPlanId === p.id ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}>
            {p.receta_nombre}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 font-medium bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <Thermometer className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            {selectedPlanId ? "Sin registros de temperatura para este plan" : "Seleccioná un plan para ver sus registros"}
          </div>
        ) : (
          logs.map((l: any) => (
            <div key={l.id} className="card p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-xl flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${l.tipo === "coccion" ? "bg-red-100 dark:bg-red-950/30 text-red-600" : l.tipo === "enfriado" ? "bg-blue-100 dark:bg-blue-950/30 text-blue-600" : "bg-gray-100 dark:bg-slate-700 text-gray-600"}`}>
                <Thermometer className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${l.tipo === "coccion" ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400" : l.tipo === "enfriado" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400" : "bg-gray-50 text-gray-600 dark:bg-slate-700 dark:text-gray-300"}`}>{l.tipo}</span>
                  <span className="font-mono font-bold text-lg">{l.temperatura}°C</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{l.observacion || "—"}</p>
                <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(l.hora)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedPlanId && (
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 w-fit">
          <Plus className="w-4 h-4" /> Agregar Registro
        </button>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2"><Thermometer className="w-5 h-5 text-primary" />Nuevo Registro de Temperatura</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddTemp} className="p-6 space-y-4">
              <div>
                <label className="input-label font-bold">Tipo</label>
                <select className="input-field mt-1" value={formTipo} onChange={e => setFormTipo(e.target.value)}>
                  <option value="inicio">Inicio (Recepción)</option>
                  <option value="coccion">Cocción</option>
                  <option value="enfriado">Enfriado</option>
                  <option value="almacenamiento">Almacenamiento</option>
                </select>
              </div>
              <div>
                <label className="input-label font-bold">Temperatura (°C)</label>
                <input className="input-field mt-1" type="number" step="0.1" placeholder="Ej. 75.5" value={formTemp} onChange={e => setFormTemp(e.target.value)} required />
              </div>
              <div>
                <label className="input-label font-bold">Observación</label>
                <input className="input-field mt-1" placeholder="Opcional" value={formObs} onChange={e => setFormObs(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2"><Check className="w-4 h-4" />Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Labels SubTab ────────────────────────────────────────────────
function LabelsSubTab({ plans, selectedPlanId, onSelectPlan, labels }: any) {
  const currentLabels = selectedPlanId ? labels[selectedPlanId] || [] : []

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 bg-gray-50 dark:bg-slate-800/30 rounded-xl p-1.5 border border-gray-200/50 dark:border-gray-700/50 w-full overflow-x-auto">
        <button onClick={() => onSelectPlan(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${!selectedPlanId ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}>
          Todas las etiquetas
        </button>
        {plans.map((p: any) => (
          <button key={p.id} onClick={() => onSelectPlan(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${selectedPlanId === p.id ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}>
            {p.receta_nombre}
          </button>
        ))}
      </div>

      {currentLabels.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-medium bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <Tag className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
          {selectedPlanId ? "Sin etiquetas generadas para este plan" : "Seleccioná un plan para ver sus etiquetas"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentLabels.map((l: any) => (
            <div key={l.id} className="card p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Tag className="w-4 h-4" /></div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{l.producto_nombre}</h4>
                  <p className="text-[10px] text-gray-400 font-mono">{l.lote}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between"><span>Peso:</span><span className="font-semibold font-mono">{l.peso_kg} kg</span></div>
                <div className="flex justify-between"><span>Precio:</span><span className="font-semibold font-mono">{formatPYG(l.precio_unitario)}</span></div>
                <div className="flex justify-between"><span>Vencimiento:</span><span className="font-semibold">{formatDate(l.fecha_vencimiento)}</span></div>
                <div className="flex justify-between"><span>Generado:</span><span className="font-semibold">{formatTime(l.generado_en)}</span></div>
              </div>
              <button className="mt-3 w-full text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"><Printer className="w-3 h-3" /> Reimprimir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Markdown SubTab ──────────────────────────────────────────────
function MarkdownSubTab({ data, search, setSearch, fetchAll }: any) {
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const filtered = data.filter((m: any) => !search || m.producto_nombre?.toLowerCase().includes(search.toLowerCase()))

  const handleAutoMarkdown = async () => {
    setRunning(true)
    try {
      const res = await api.rotiseria.autoMarkdown({ fin_de_dia: true })
      let msg = "Markdowns generados"
      if (Array.isArray(res)) msg = `${res.length} markdowns generados`
      toast.success("Markdown automático", msg)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setRunning(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={handleAutoMarkdown} disabled={running} className="btn-primary flex items-center gap-1.5 justify-center py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Markdown Automático (Fin de Día)
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200/50 dark:border-gray-700/50 shadow-lg rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4">Producto</th>
              <th className="p-4 text-right">Precio Original</th>
              <th className="p-4 text-center">Dto.</th>
              <th className="p-4 text-right">Precio Markdown</th>
              <th className="p-4">Motivo</th>
              <th className="p-4">Inicio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((m: any) => (
              <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="p-4 font-bold text-gray-900 dark:text-white">{m.producto_nombre}</td>
                <td className="p-4 text-right font-mono font-semibold">{formatPYG(m.precio_original)}</td>
                <td className="p-4 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">-{m.descuento_porcentaje}%</span></td>
                <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400">{formatPYG(m.precio_markdown)}</td>
                <td className="p-4 text-gray-600 dark:text-gray-300 text-sm">{m.motivo || "—"}</td>
                <td className="p-4 text-gray-500 text-sm">{formatDate(m.fecha_inicio)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500 font-medium"><Sparkles className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />No hay markdowns activos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"><Gauge className="w-6 h-6" /></div>
          <div>
            <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">Markdown Automático de Fin de Día</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Al activar esta función, el sistema analizará los productos de rotisería con fecha de vencimiento próxima y aplicará descuentos progresivos para minimizar mermas. Los productos con más del 50% de su vida útil transcurrida recibirán un descuento sugerido del 30-50%.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
