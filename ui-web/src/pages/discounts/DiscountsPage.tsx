import { useState, useEffect } from "react"
import { Tag, Plus, Search, Edit, ToggleLeft, ToggleRight, Loader2, X } from "lucide-react"
import { api, type Discount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { formatDate } from "../../utils/format"

type DiscountForm = {
  nombre: string
  descripcion: string
  tipo: string
  valor: number | null
  aplica_a: string
  producto_ids: string
  categoria_ids: string
  monto_minimo: number | null
  cantidad_minima: number | null
  valido_desde: string
  valido_hasta: string
}

const emptyForm: DiscountForm = {
  nombre: "", descripcion: "", tipo: "porcentaje", valor: null,
  aplica_a: "total", producto_ids: "", categoria_ids: "",
  monto_minimo: null, cantidad_minima: null,
  valido_desde: "", valido_hasta: "",
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DiscountForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.discounts.list()
      setDiscounts(data)
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver descuentos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = discounts.filter(d =>
    !search || (d.nombre || "").toLowerCase().includes(search.toLowerCase())
  )

  const total = discounts.length
  const activos = discounts.filter(d => d.activo).length
  const inactivos = total - activos

  const handleSubmit = async () => {
    if (!form.nombre || !form.tipo) {
      toast.error("Error", "Nombre y tipo son obligatorios")
      return
    }
    if (form.tipo === "porcentaje" && (form.valor == null || form.valor <= 0 || form.valor > 100)) {
      toast.error("Error", "El porcentaje debe ser entre 1 y 100")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        tipo: form.tipo,
        valor: form.valor ?? undefined,
        aplica_a: form.aplica_a,
        producto_ids: form.producto_ids ? form.producto_ids.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        categoria_ids: form.categoria_ids ? form.categoria_ids.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        monto_minimo: form.monto_minimo ?? undefined,
        cantidad_minima: form.cantidad_minima ?? undefined,
        valido_desde: form.valido_desde || undefined,
        valido_hasta: form.valido_hasta || undefined,
      }
      if (editingId) {
        await api.discounts.update(editingId, payload)
        toast.success("Actualizado", "Descuento actualizado correctamente")
      } else {
        await api.discounts.create(payload)
        toast.success("Creado", "Descuento creado correctamente")
      }
      setShowModal(false)
      setEditingId(null)
      setForm(emptyForm)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar el descuento")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (d: Discount) => {
    setEditingId(d.id)
    setForm({
      nombre: d.nombre || "",
      descripcion: d.descripcion || "",
      tipo: d.tipo || "",
      valor: d.valor ?? null,
      aplica_a: d.aplica_a || "",
      producto_ids: (d.producto_ids || []).join(", "),
      categoria_ids: (d.categoria_ids || []).join(", "),
      monto_minimo: d.monto_minimo ?? null,
      cantidad_minima: d.cantidad_minima ?? null,
      valido_desde: (d as any).valido_desde?.slice(0, 10) || "",
      valido_hasta: (d as any).valido_hasta?.slice(0, 10) || "",
    })
    setShowModal(true)
  }

  const handleToggleActive = async (d: Discount) => {
    const ok = await confirm({
      title: d.activo ? "Desactivar descuento" : "Activar descuento",
      message: `¿${d.activo ? "Desactivar" : "Activar"} "${d.nombre}"?`,
      confirmText: d.activo ? "Desactivar" : "Activar",
      variant: d.activo ? "warning" : "info",
    })
    if (!ok) return
    try {
      await api.discounts.update(d.id, { activo: !d.activo })
      toast.success(d.activo ? "Desactivado" : "Activado", `"${d.nombre}" ${d.activo ? "desactivado" : "activado"} correctamente`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cambiar el estado")
    }
  }

  const tipoMap: Record<string, string> = {
    porcentaje: "badge-info",
    monto: "badge-warning",
  }

  const aplicaLabels: Record<string, string> = {
    producto: "Producto",
    categoria: "Categoría",
    total: "Total",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            Descuentos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total} descuentos registrados</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo descuento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Tag className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span></div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{total}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activos</span></div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-green-500">{activos}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ToggleLeft className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inactivos</span></div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-red-500">{inactivos}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Nombre</th>
              <th className="table-cell">Tipo</th>
              <th className="table-cell text-right">Valor</th>
              <th className="table-cell">Aplica a</th>
              <th className="table-cell">Vigencia</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay descuentos</td></tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="table-row">
                  <td className="table-td">
                    <p className="text-sm font-medium">{d.nombre || "—"}</p>
                    {d.descripcion && <p className="text-xs text-gray-400">{d.descripcion}</p>}
                  </td>
                  <td className="table-td">
                    <StatusBadge status={d.tipo || "-"} map={tipoMap} />
                  </td>
                  <td className="table-td text-right font-mono font-bold">
                    {d.tipo === "porcentaje" ? `${d.valor}%` : `₲ ${(d.valor || 0).toLocaleString("es-PY")}`}
                  </td>
                  <td className="table-td text-sm capitalize">{d.aplica_a ? aplicaLabels[d.aplica_a] || d.aplica_a : "-"}</td>
                  <td className="table-td text-sm text-gray-500">
                    {(d as any).valido_desde ? (
                      <span>{formatDate((d as any).valido_desde)} — {formatDate((d as any).valido_hasta)}</span>
                    ) : (
                      <span className="text-gray-400">Sin vencimiento</span>
                    )}
                  </td>
                  <td className="table-td">
                    <StatusBadge status={d.activo ? "activo" : "inactivo"} map={{ activo: "badge-success", inactivo: "badge-danger" }} />
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost" title="Editar" onClick={() => handleEdit(d)}><Edit className="w-4 h-4" /></button>
                      <button className="btn-ghost" title={d.activo ? "Desactivar" : "Activar"} onClick={() => handleToggleActive(d)}>
                        {d.activo ? <ToggleLeft className="w-4 h-4 text-amber-500" /> : <ToggleRight className="w-4 h-4 text-green-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? "Editar descuento" : "Nuevo descuento"}</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="input-label label-required">Nombre</label>
                <input className="input-field" placeholder="Ej: 10% Off Electro" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Descripción</label>
                <input className="input-field" placeholder="Descripción del descuento" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Tipo</label>
                  <select className="input-field" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="porcentaje">Porcentaje</option>
                    <option value="monto">Monto fijo</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Valor</label>
                  <input className="input-field" type="number" min={0} step={form.tipo === "porcentaje" ? "1" : "100"} placeholder={form.tipo === "porcentaje" ? "10" : "50000"} value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <label className="input-label label-required">Aplica a</label>
                <select className="input-field" value={form.aplica_a} onChange={(e) => setForm({ ...form, aplica_a: e.target.value })}>
                  <option value="total">Total de la venta</option>
                  <option value="producto">Productos específicos</option>
                  <option value="categoria">Categorías</option>
                </select>
              </div>
              {form.aplica_a === "producto" && (
                <div>
                  <label className="input-label">IDs de productos (separados por coma)</label>
                  <input className="input-field" placeholder="uuid-1, uuid-2, uuid-3" value={form.producto_ids} onChange={(e) => setForm({ ...form, producto_ids: e.target.value })} />
                </div>
              )}
              {form.aplica_a === "categoria" && (
                <div>
                  <label className="input-label">IDs de categorías (separados por coma)</label>
                  <input className="input-field" placeholder="uuid-1, uuid-2" value={form.categoria_ids} onChange={(e) => setForm({ ...form, categoria_ids: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Monto mínimo</label>
                  <input className="input-field" type="number" min={0} placeholder="100000" value={form.monto_minimo ?? ""} onChange={(e) => setForm({ ...form, monto_minimo: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
                <div>
                  <label className="input-label">Cantidad mínima</label>
                  <input className="input-field" type="number" min={0} placeholder="2" value={form.cantidad_minima ?? ""} onChange={(e) => setForm({ ...form, cantidad_minima: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Válido desde</label>
                  <input className="input-field" type="date" value={form.valido_desde} onChange={(e) => setForm({ ...form, valido_desde: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Válido hasta</label>
                  <input className="input-field" type="date" value={form.valido_hasta} onChange={(e) => setForm({ ...form, valido_hasta: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
