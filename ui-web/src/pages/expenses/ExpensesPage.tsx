import { useState, useEffect } from "react"
import { api, type Expense, type ExpenseCategory, type ExpenseSummary } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, DollarSign, CreditCard, Building2, CheckCircle, XCircle, Wallet, TrendingUp, BarChart3, Trash2, Eye, Receipt as ReceiptIcon, Filter } from "lucide-react"

type Tab = "dashboard" | "list" | "categories"

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [filterEstado, setFilterEstado] = useState("")
  const [form, setForm] = useState<any>({ monto: "", descripcion: "", category_id: "", proveedor: "", tipo_pago: "efectivo", fecha_gasto: new Date().toISOString().split("T")[0] })
  const [catForm, setCatForm] = useState({ nombre: "", descripcion: "", presupuesto_mensual: "" })
  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      if (tab === "dashboard") { const s = await api.expenses.summary(); setSummary(s) }
      if (tab === "list") {
        const [e, c] = await Promise.all([
          api.expenses.list({ estado: filterEstado || undefined }),
          api.expenses.categories.list(),
        ])
        setExpenses(e); setCategories(c)
      }
      if (tab === "categories") { const c = await api.expenses.categories.list(); setCategories(c) }
    } catch (e: any) { toast.error("Error", e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab, filterEstado])

  const handleCreateExpense = async () => {
    try {
      await api.expenses.create({ ...form, monto: Number(form.monto) })
      toast.success("Gasto registrado")
      setShowForm(false)
      setForm({ monto: "", descripcion: "", category_id: "", proveedor: "", tipo_pago: "efectivo", fecha_gasto: new Date().toISOString().split("T")[0] })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateCategory = async () => {
    try {
      await api.expenses.categories.create({ ...catForm, presupuesto_mensual: catForm.presupuesto_mensual ? Number(catForm.presupuesto_mensual) : undefined })
      toast.success("Categoría creada")
      setShowCategoryForm(false)
      setCatForm({ nombre: "", descripcion: "", presupuesto_mensual: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleApprove = async (id: string) => {
    try { await api.expenses.update(id, { estado: "aprobado" }); toast.success("Aprobado"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return
    try { await api.expenses.delete(id); toast.success("Eliminado"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja Chica</h1><p className="text-sm text-gray-500">Gastos menores, fletes, limpieza, reposición</p></div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo gasto</button>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { k: "dashboard" as Tab, l: "Dashboard", i: BarChart3 },
          { k: "list" as Tab, l: "Gastos", i: ReceiptIcon },
          { k: "categories" as Tab, l: "Categorías", i: Wallet },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && summary && (
            <div>
              {/* KPI Cards - Unified Financial Style */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Gastos Hoy", value: formatPYG(summary.total_dia), icon: DollarSign, color: "border-l-red-500 text-red-600", sub: "Gasto diario acumulado" },
                  { label: "Gastos Semana", value: formatPYG(summary.total_semana), icon: TrendingUp, color: "border-l-amber-500 text-amber-600", sub: "Gasto semanal acumulado" },
                  { label: "Gastos Mes", value: formatPYG(summary.total_mes), icon: BarChart3, color: "border-l-blue-500 text-blue-600", sub: "Gasto mensual acumulado" },
                  { label: "Pendientes Aprobación", value: summary.pendientes_aprobacion, icon: Clock, color: "border-l-purple-500 text-purple-600", sub: "Requieren autorización" },
                ].map((c, i) => (
                  <div key={i} className={`card p-4 border-l-4 ${c.color.split(" ")[0]} flex flex-col justify-between transition-all hover:shadow-md`}>
                    <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      <span>{c.label}</span>
                      <c.icon className={`w-4 h-4 ${c.color.split(" ")[1]}`} />
                    </div>
                    <p className={`text-xl font-bold font-mono ${c.color.split(" ")[1]}`}>{c.value}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">{c.sub}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4" /> Por categoría</h3>
                  <div className="space-y-2">
                    {summary.por_categoria.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-500">{c.category_id?.slice(0, 8) || "Sin categoría"}</span>
                        <span className="font-semibold">Gs {Number(c.total).toLocaleString("es-PY")}</span>
                      </div>
                    ))}
                    {summary.por_categoria.length === 0 && <p className="text-sm text-gray-400">Sin gastos este mes</p>}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Por sucursal</h3>
                  <div className="space-y-2">
                    {summary.por_sucursal.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-500">{s.branch_id?.slice(0, 8) || "General"}</span>
                        <span className="font-semibold">Gs {Number(s.total).toLocaleString("es-PY")}</span>
                      </div>
                    ))}
                    {summary.por_sucursal.length === 0 && <p className="text-sm text-gray-400">Sin datos por sucursal</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "list" && (
            <div>
              <div className="flex gap-3 items-center mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Buscar gasto..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input-field w-40" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option><option value="pendiente">Pendientes</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option>
                </select>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Descripción</th><th className="p-3">Monto</th><th className="p-3">Categoría</th><th className="p-3">Pago</th><th className="p-3">Proveedor</th><th className="p-3">Fecha</th><th className="p-3">Estado</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {expenses.filter(e => !search || e.descripcion.toLowerCase().includes(search.toLowerCase())).map(e => (
                      <tr key={e.id} className="table-row">
                        <td className="p-3 font-medium">{e.descripcion}</td>
                        <td className="p-3 font-semibold">Gs {Number(e.monto).toLocaleString("es-PY")}</td>
                        <td className="p-3 text-sm text-gray-500">{e.category_id?.slice(0, 8) || "-"}</td>
                        <td className="p-3 capitalize text-sm">{e.tipo_pago || "efectivo"}</td>
                        <td className="p-3 text-sm">{e.proveedor || "-"}</td>
                        <td className="p-3 text-sm">{e.fecha_gasto ? new Date(e.fecha_gasto).toLocaleDateString("es-PY") : "-"}</td>
                        <td className="p-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            e.estado === "aprobado" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                            e.estado === "rechazado" ? "bg-red-50 dark:bg-red-900/20 text-red-600" :
                            "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                          }`}>{e.estado}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {e.estado === "pendiente" && <button onClick={() => handleApprove(e.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><CheckCircle className="w-4 h-4 text-green-500" /></button>}
                            <button onClick={() => handleDelete(e.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-500">Sin gastos registrados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Categorías de gasto</h3>
                <button onClick={() => setShowCategoryForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva categoría</button>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Nombre</th><th className="p-3">Descripción</th><th className="p-3">Presupuesto mensual</th><th className="p-3">Activo</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {categories.map(c => (
                      <tr key={c.id} className="table-row">
                        <td className="p-3 font-medium">{c.nombre}</td>
                        <td className="p-3 text-sm text-gray-500">{c.descripcion || "-"}</td>
                        <td className="p-3">{c.presupuesto_mensual ? `Gs ${Number(c.presupuesto_mensual).toLocaleString("es-PY")}` : "-"}</td>
                        <td className="p-3">{c.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                      </tr>
                    ))}
                    {categories.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Sin categorías</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nuevo gasto</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Descripción</label><input className="input-field" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
              <div><label className="label-field">Monto (Gs)</label><input className="input-field" type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></div>
              <div><label className="label-field">Categoría</label><select className="input-field" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
              <div><label className="label-field">Tipo pago</label><select className="input-field" value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value })}>
                <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
              </select></div>
              <div><label className="label-field">Proveedor (opcional)</label><input className="input-field" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></div>
              <div><label className="label-field">Fecha</label><input className="input-field" type="date" value={form.fecha_gasto} onChange={e => setForm({ ...form, fecha_gasto: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateExpense} disabled={!form.descripcion || !form.monto} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="modal-overlay" onClick={() => setShowCategoryForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nueva categoría</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={catForm.nombre} onChange={e => setCatForm({ ...catForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Descripción</label><input className="input-field" value={catForm.descripcion} onChange={e => setCatForm({ ...catForm, descripcion: e.target.value })} /></div>
              <div><label className="label-field">Presupuesto mensual</label><input className="input-field" type="number" value={catForm.presupuesto_mensual} onChange={e => setCatForm({ ...catForm, presupuesto_mensual: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCategoryForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateCategory} disabled={!catForm.nombre} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
