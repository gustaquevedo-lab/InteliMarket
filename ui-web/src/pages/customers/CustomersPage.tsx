import { useState, useEffect } from "react"
import { Search, Plus, Users, Edit, Loader2, Upload, Download, X } from "lucide-react"
import { api, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    razon_social: "", ruc: "", ci: "", tipo_persona: "juridica",
    telefono: "", email: "", credito_limite: 0, condicion_iva: "exento",
    direccion: "",
  })
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ total_rows: number; success: number; errors: number; details: Array<{ row: number; status: string; message: string }> } | null>(null)
  const [importing, setImporting] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.customers.list({ search: search || undefined })
      setCustomers(data)
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver datos reales")
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = customers.filter(c =>
    !search ||
    (c.razon_social || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc && c.ruc.includes(search)) ||
    (c.ci && c.ci.includes(search))
  )

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    const formData = new FormData()
    formData.append("file", importFile)
    try {
      const result = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/v1/imports/customers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: formData,
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.detail || "Error en importación")
      setImportResult(data)
      toast.success("Importación completada", `${data.success} de ${data.total_rows} clientes importados`)
      if (data.success > 0) fetchData()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo importar")
    } finally {
      setImporting(false)
    }
  }

  const emptyForm = { razon_social: "", ruc: "", ci: "", tipo_persona: "juridica", telefono: "", email: "", credito_limite: 0, condicion_iva: "exento", direccion: "" }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({
      razon_social: c.razon_social || "", ruc: c.ruc || "", ci: c.ci || "",
      tipo_persona: c.tipo_persona || "juridica", telefono: c.telefono || "", email: c.email || "",
      credito_limite: c.credito_limite || 0, condicion_iva: (c as any).condicion_iva || "exento",
      direccion: c.direccion || "",
    })
    setShowForm(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, ruc: form.ruc || undefined, ci: form.ci || undefined }
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, payload)
        toast.success("Cliente actualizado", form.razon_social)
      } else {
        await api.customers.create(payload)
        toast.success("Cliente creado", form.razon_social)
      }
      setShowForm(false)
      setEditingCustomer(null)
      setForm(emptyForm)
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar cliente"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (customer: Customer) => {
    const ok = await confirm({
      title: "Eliminar cliente",
      message: `¿Estás seguro de eliminar "${customer.razon_social}"?`,
      confirmText: "Eliminar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.customers.delete(customer.id)
      toast.success("Cliente eliminado")
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar"
      toast.error("Error", msg)
    }
  }

  const creditUsed = (c: Customer) => (c.credito_limite || 0) > 0 ? ((c.credito_usado || 0) / (c.credito_limite || 1)) * 100 : 0

  const totalCredito = customers.reduce((sum, c) => sum + (c.credito_limite || 0), 0)
  const totalUsado = customers.reduce((sum, c) => sum + (c.credito_usado || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{customers.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-outline">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button onClick={() => { setEditingCustomer(null); setForm(emptyForm); setShowForm(true) }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por nombre, RUC o CI..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={fetchData} className="btn-outline">Actualizar</button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Users className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{customers.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><span className="w-5 h-5 flex items-center justify-center text-lg font-bold text-green-500">₲</span><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crédito otorgado</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">₲ {(totalCredito / 1000000).toFixed(1)}M</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><span className="w-5 h-5 flex items-center justify-center text-lg font-bold text-amber-500">₲</span><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crédito usado</span></div>
          <p className="text-2xl font-bold text-amber-500">₲ {(totalUsado / 1000000).toFixed(1)}M</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell">RUC / CI</th>
              <th className="table-cell">Contacto</th>
              <th className="table-cell">Límite crédito</th>
              <th className="table-cell">Usado</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron clientes</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-td">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{c.razon_social || "—"}</p>
                      <p className="text-xs text-gray-400">{(c.tipo_persona || "juridica") === "juridica" ? "Persona jurídica" : "Persona física"}</p>
                    </div>
                  </td>
                  <td className="table-td font-mono text-xs">{c.ruc || c.ci || "—"}</td>
                  <td className="table-td">
                    {c.telefono && <p className="text-sm">{c.telefono}</p>}
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="table-td font-mono text-sm">₲ {(c.credito_limite || 0).toLocaleString()}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${creditUsed(c) > 90 ? "bg-red-500" : creditUsed(c) > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(creditUsed(c), 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono">₲ {(c.credito_usado || 0).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="table-td"><StatusBadge status={c.activo ? "activo" : "cancelado"} /></td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost" title="Editar" onClick={(e) => { e.stopPropagation(); openEdit(c) }}><Edit className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400 hover:text-red-500" title="Eliminar" onClick={(e) => { e.stopPropagation(); handleDelete(c) }}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingCustomer(null) }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{editingCustomer ? "Editar cliente" : "Nuevo cliente"}</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="input-label label-required">Razón social</label>
                  <input className="input-field" value={form.razon_social} onChange={(e) => setForm({...form, razon_social: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">RUC</label>
                    <input className="input-field" value={form.ruc} onChange={(e) => setForm({...form, ruc: e.target.value})} placeholder="80012345-6" />
                  </div>
                  <div>
                    <label className="input-label">CI</label>
                    <input className="input-field" value={form.ci} onChange={(e) => setForm({...form, ci: e.target.value})} placeholder="1234567" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Tipo de persona</label>
                  <select className="input-field" value={form.tipo_persona} onChange={(e) => setForm({...form, tipo_persona: e.target.value})}>
                    <option value="juridica">Persona jurídica</option>
                    <option value="fisica">Persona física</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Teléfono</label>
                    <input className="input-field" value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} />
                  </div>
                  <div>
                    <label className="input-label">Límite crédito</label>
                    <input type="number" className="input-field" value={form.credito_limite} onChange={(e) => setForm({...form, credito_limite: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => { setShowForm(false); setEditingCustomer(null) }}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCustomer ? "Guardar cambios" : "Crear cliente")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Importar clientes</h3>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Subí un archivo CSV con las columnas: razon_social, ruc, ci, tipo_persona, direccion, ciudad, telefono, email, credito_limite</p>
              <a href={`${import.meta.env.VITE_API_URL || "/api"}/v1/imports/template/customers`} className="text-sm text-primary hover:underline flex items-center gap-1" download>
                <Download className="w-3 h-3" /> Descargar plantilla
              </a>
              <div>
                <label className="input-label">Archivo CSV</label>
                <input type="file" accept=".csv" className="input-field" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </div>
              {importFile && (
                <p className="text-sm text-gray-500">Archivo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
              {importResult && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 text-sm">
                    <span className="text-green-500 font-bold">{importResult.success} éxitos</span>
                    <span className="text-red-500 font-bold">{importResult.errors} errores</span>
                  </div>
                  {importResult.details.filter(d => d.status !== "success").slice(0, 5).map(d => (
                    <div key={d.row} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                      Fila {d.row}: {d.message}
                    </div>
                  ))}
                  {importResult.errors > 5 && <p className="text-xs text-gray-400">... y {importResult.errors - 5} errores más</p>}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>Cerrar</button>
                <button className="btn-primary flex-1" onClick={handleImport} disabled={!importFile || importing}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
