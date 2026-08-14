import { useState, useEffect } from "react"
import { api, type Expense, type ExpenseCategory, type ExpenseSummary } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, DollarSign, CreditCard, Building2, CheckCircle2, XCircle, Wallet, TrendingUp, BarChart3, Trash2, Eye, Receipt as ReceiptIcon, Filter, Clock, Check, AlertCircle } from "lucide-react"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "dashboard" | "list" | "categories"

const ESTADO_MAP: Record<string, string> = {
  pendiente: "badge-warning",
  aprobado: "badge-success",
  rechazado: "badge-danger",
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [filterEstado, setFilterEstado] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  
  const [form, setForm] = useState<any>({
    monto: "",
    descripcion: "",
    category_id: "",
    proveedor: "",
    tipo_pago: "efectivo",
    fecha_gasto: new Date().toISOString().split("T")[0]
  })
  const [catForm, setCatForm] = useState({ nombre: "", descripcion: "", presupuesto_mensual: "" })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sumData, expData, catData] = await Promise.all([
        api.expenses.summary(),
        api.expenses.list({ estado: filterEstado || undefined, category_id: filterCategory || undefined }),
        api.expenses.categories.list(),
      ])
      setSummary(sumData)
      setExpenses(expData)
      setCategories(catData)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar los gastos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [filterEstado, filterCategory])

  const handleCreateExpense = async () => {
    if (!form.monto || !form.descripcion || !form.category_id) {
      toast.error("Atención", "Completá la categoría, descripción y monto del gasto")
      return
    }
    setSubmitting(true)
    try {
      await api.expenses.create({ ...form, monto: Number(form.monto) })
      toast.success("Gasto Registrado", "El comprobante de gasto operativo fue ingresado")
      setShowForm(false)
      setForm({ monto: "", descripcion: "", category_id: "", proveedor: "", tipo_pago: "efectivo", fecha_gasto: new Date().toISOString().split("T")[0] })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!catForm.nombre) {
      toast.error("Atención", "Ingresá el nombre de la categoría")
      return
    }
    setSubmitting(true)
    try {
      await api.expenses.categories.create({
        ...catForm,
        presupuesto_mensual: catForm.presupuesto_mensual ? Number(catForm.presupuesto_mensual) : undefined
      })
      toast.success("Categoría Creada", "Nueva categoría operativa habilitada")
      setShowCategoryForm(false)
      setCatForm({ nombre: "", descripcion: "", presupuesto_mensual: "" })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await api.expenses.update(id, { estado: "aprobado" })
      toast.success("Aprobado", "Gasto autorizado correctamente")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este comprobante de gasto?")) return
    try {
      await api.expenses.delete(id)
      toast.success("Eliminado", "Gasto retirado del sistema")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const filteredExpenses = expenses.filter(e => {
    const term = search.toLowerCase()
    const catName = categories.find(c => c.id === e.category_id)?.nombre || e.category_name || ""
    return !search ||
      (e.descripcion || "").toLowerCase().includes(term) ||
      (e.proveedor || "").toLowerCase().includes(term) ||
      catName.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ReceiptIcon className="w-6 h-6 text-primary" />
            Gastos Operativos & Caja Chica
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control de fondo fijo, gastos de distribución, mantenimiento y servicios</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryForm(true)} className="btn-secondary flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>+ Nueva Categoría</span>
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>+ Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { k: "dashboard" as Tab, l: "Dashboard Finanzas", i: BarChart3 },
          { k: "list" as Tab, l: "Listado de Gastos", i: ReceiptIcon },
          { k: "categories" as Tab, l: "Categorías Operativas", i: Wallet },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {tab === "dashboard" && summary && (
            <div className="space-y-6">
              {/* Unified Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between transition-all hover:shadow-md">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Gastos Hoy</span>
                    <DollarSign className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{formatPYG(summary.total_dia)}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Egresos registrados hoy</span>
                </div>

                <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Gastos Semana (7 días)</span>
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(summary.total_semana)}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Acumulado semanal</span>
                </div>

                <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Gastos Mes (Agosto)</span>
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatPYG(summary.total_mes)}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Total ejecutado del mes</span>
                </div>

                <div className="card p-4 border-l-4 border-l-purple-500 flex flex-col justify-between transition-all hover:shadow-md">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Pendientes Aprobación</span>
                    <Clock className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{summary.pendientes_aprobacion}</p>
                  <span className="text-[10px] text-purple-500/80 mt-1 block font-semibold">Exigen revisión de gerencia</span>
                </div>
              </div>

              {/* Expense breakdown by category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="font-bold uppercase tracking-wider text-xs text-gray-500 mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" /> Distribución de Gastos por Categoría
                  </h3>
                  <div className="space-y-4">
                    {summary.por_categoria.map((c: any, i: number) => {
                      const pct = summary.total_mes > 0 ? Math.round((c.total / summary.total_mes) * 100) : 0
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-gray-900 dark:text-white font-bold">{c.category_id || "General"}</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(c.total)} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="font-bold uppercase tracking-wider text-xs text-gray-500 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-500" /> Control por Medio de Pago
                  </h3>
                  <div className="space-y-3">
                    {[
                      { tipo: "Efectivo de Caja Chica", count: expenses.filter(e => e.tipo_pago === "efectivo").length, total: expenses.filter(e => e.tipo_pago === "efectivo").reduce((a, b) => a + (b.monto || 0), 0) },
                      { tipo: "Transferencia Bancaria SPI", count: expenses.filter(e => e.tipo_pago === "transferencia").length, total: expenses.filter(e => e.tipo_pago === "transferencia").reduce((a, b) => a + (b.monto || 0), 0) },
                      { tipo: "Tarjeta Corporativa", count: expenses.filter(e => e.tipo_pago === "tarjeta").length, total: expenses.filter(e => e.tipo_pago === "tarjeta").reduce((a, b) => a + (b.monto || 0), 0) },
                    ].map((p, i) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{p.tipo}</p>
                          <p className="text-gray-400">{p.count} comprobantes registrados</p>
                        </div>
                        <span className="font-mono font-bold text-primary">{formatPYG(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List Tab */}
          {tab === "list" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10 text-xs font-medium" placeholder="Buscar por concepto, proveedor o categoría..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="input-field w-44 text-xs font-medium" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select className="input-field w-36 text-xs font-medium" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="aprobado">Aprobados</option>
                  <option value="rechazado">Rechazados</option>
                </select>
                <button onClick={fetchAll} className="btn-primary text-xs">Actualizar</button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Fecha</th>
                      <th className="table-cell">Categoría</th>
                      <th className="table-cell">Descripción / Concepto</th>
                      <th className="table-cell">Proveedor</th>
                      <th className="table-cell">Medio Pago</th>
                      <th className="table-cell text-right">Monto (₲)</th>
                      <th className="table-cell text-center">Estado</th>
                      <th className="table-cell text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron comprobantes de gastos</td></tr>
                    ) : filteredExpenses.map(e => {
                      const catName = categories.find(c => c.id === e.category_id)?.nombre || e.category_name || "General"
                      return (
                        <tr key={e.id} className="table-row">
                          <td className="table-td text-gray-500">{formatDate(e.fecha_gasto)}</td>
                          <td className="table-td font-bold text-gray-900 dark:text-white">{catName}</td>
                          <td className="table-td font-medium text-gray-700 dark:text-gray-300">{e.descripcion}</td>
                          <td className="table-td text-gray-500">{e.proveedor || "—"}</td>
                          <td className="table-td uppercase font-bold text-gray-500">{e.tipo_pago || "efectivo"}</td>
                          <td className="table-td text-right font-mono font-bold text-red-600 dark:text-red-400">{formatPYG(e.monto)}</td>
                          <td className="table-td text-center">
                            <StatusBadge status={e.estado || "-"} map={ESTADO_MAP} />
                          </td>
                          <td className="table-td text-center">
                            <div className="flex items-center justify-center gap-1">
                              {e.estado === "pendiente" && (
                                <button onClick={() => handleApprove(e.id)} className="btn-ghost text-green-600 p-1.5" title="Aprobar gasto">
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => handleDelete(e.id)} className="btn-ghost text-red-500 p-1.5" title="Eliminar gasto">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {tab === "categories" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Centros de Costos y Categorías Operativas</h3>
                <button onClick={() => setShowCategoryForm(true)} className="btn-primary text-xs flex items-center gap-2">
                  <Plus className="w-4 h-4" />+ Crear Categoría
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {categories.map(c => (
                  <div key={c.id} className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{c.nombre}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Activo</span>
                    </div>
                    <p className="text-xs text-gray-500">{c.descripcion || "Sin descripción"}</p>
                    {c.presupuesto_mensual ? (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Presupuesto Mensual</span>
                        <p className="font-mono font-bold text-primary text-sm">{formatPYG(c.presupuesto_mensual)}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Expense Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Comprobante de Gasto</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Categoría de Gasto</label>
                <select className="input-field font-medium text-sm" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">-- Seleccionar categoría --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Concepto / Descripción</label>
                <input className="input-field font-medium" placeholder="Ej. Combustible camión de reparto #02" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Proveedor / Destinatario</label>
                  <input className="input-field font-medium" placeholder="Ej. PETROPAR" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Medio de Pago</label>
                  <select className="input-field font-medium" value={form.tipo_pago} onChange={(e) => setForm({ ...form, tipo_pago: e.target.value })}>
                    <option value="efectivo">Efectivo de Caja Chica</option>
                    <option value="transferencia">Transferencia SPI</option>
                    <option value="tarjeta">Tarjeta Corporativa</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Monto (₲)</label>
                  <input className="input-field font-mono text-base text-red-600 font-bold" type="number" placeholder="250000" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Fecha de Gasto</label>
                  <input className="input-field" type="date" value={form.fecha_gasto} onChange={(e) => setForm({ ...form, fecha_gasto: e.target.value })} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateExpense} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Gasto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryForm && (
        <div className="modal-overlay" onClick={() => setShowCategoryForm(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Categoría Operativa</h3>
              <button onClick={() => setShowCategoryForm(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Nombre Categoría</label>
                <input className="input-field font-medium text-sm" placeholder="Ej. Gastos de Mantenimiento & Repuestos" value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })} />
              </div>
              <div>
                <label className="input-label uppercase tracking-wider font-bold">Descripción</label>
                <textarea className="input-field font-medium" rows={2} placeholder="Descripción de los insumos o rubro" value={catForm.descripcion} onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="input-label uppercase tracking-wider font-bold">Presupuesto Mensual Asignado (₲)</label>
                <input className="input-field font-mono font-bold" type="number" placeholder="10000000" value={catForm.presupuesto_mensual} onChange={(e) => setCatForm({ ...catForm, presupuesto_mensual: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowCategoryForm(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateCategory} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Categoría"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
