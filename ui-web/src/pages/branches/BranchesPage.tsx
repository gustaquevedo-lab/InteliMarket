import { useState, useEffect } from "react"
import { Building2, Plus, Edit, Trash2, Search, Loader2, X, Check, MapPin, Phone, Mail, Hash, DollarSign, ArrowLeftRight, LayoutDashboard, Package, TrendingUp, Truck, Eye } from "lucide-react"
import { api, type Branch, type BranchPrice, type BranchTransfer, type ConsolidatedDashboard } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"

type Tab = "sucursales" | "precios" | "transferencias" | "dashboard"

const ESTADOS_TRANSFER = [
  { value: "", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_transito", label: "En tránsito" },
  { value: "recibido", label: "Recibido" },
  { value: "cancelado", label: "Cancelado" },
]

export default function BranchesPage() {
  const [tab, setTab] = useState<Tab>("sucursales")
  const toast = useToast()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Sucursales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de sucursales, precios y transferencias</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab("sucursales")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "sucursales" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Building2 className="w-4 h-4 inline mr-1.5" />Sucursales
        </button>
        <button onClick={() => setTab("precios")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "precios" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <DollarSign className="w-4 h-4 inline mr-1.5" />Precios
        </button>
        <button onClick={() => setTab("transferencias")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "transferencias" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <ArrowLeftRight className="w-4 h-4 inline mr-1.5" />Transferencias
        </button>
        <button onClick={() => setTab("dashboard")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "dashboard" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <LayoutDashboard className="w-4 h-4 inline mr-1.5" />Dashboard
        </button>
      </div>

      {tab === "sucursales" && <BranchesTab />}
      {tab === "precios" && <PricesTab />}
      {tab === "transferencias" && <TransfersTab />}
      {tab === "dashboard" && <DashboardTab />}
    </div>
  )
}

function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ codigo: "", nombre: "", direccion: "", ciudad: "", departamento: "", telefono: "", email: "", ruc: "", punto_emision: "001" })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.branches.list()
      setBranches(data)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver sucursales")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = branches.filter(b =>
    !search ||
    b.nombre.toLowerCase().includes(search.toLowerCase()) ||
    b.codigo.toLowerCase().includes(search.toLowerCase()) ||
    (b.ciudad?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const handleSubmit = async () => {
    if (!form.codigo || !form.nombre) {
      toast.error("Error", "Código y nombre son obligatorios")
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await api.branches.update(editingId, form)
        toast.success("Actualizada", "Sucursal actualizada correctamente")
      } else {
        await api.branches.create(form)
        toast.success("Creada", "Sucursal creada correctamente")
      }
      setShowModal(false)
      setEditingId(null)
      setForm({ codigo: "", nombre: "", direccion: "", ciudad: "", departamento: "", telefono: "", email: "", ruc: "", punto_emision: "001" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar la sucursal")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setForm({
      codigo: branch.codigo,
      nombre: branch.nombre,
      direccion: branch.direccion || "",
      ciudad: branch.ciudad || "",
      departamento: branch.departamento || "",
      telefono: branch.telefono || "",
      email: branch.email || "",
      ruc: branch.ruc || "",
      punto_emision: String(branch.punto_emision || "001"),
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.branches.delete(id)
      toast.success("Eliminada", "Sucursal eliminada correctamente")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar la sucursal")
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Building2 className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{branches.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Check className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activas</span></div>
          <p className="text-2xl font-bold text-green-500">{branches.filter(b => b.activo).length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><X className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inactivas</span></div>
          <p className="text-2xl font-bold text-red-500">{branches.filter(b => !b.activo).length}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por nombre, código o ciudad..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setEditingId(null); setForm({ codigo: "", nombre: "", direccion: "", ciudad: "", departamento: "", telefono: "", email: "", ruc: "", punto_emision: "001" }); setShowModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva sucursal
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Código</th>
              <th className="table-cell">Nombre</th>
              <th className="table-cell">Ubicación</th>
              <th className="table-cell">Contacto</th>
              <th className="table-cell">Pto. Emisión</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay sucursales</td></tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{b.codigo}</td>
                  <td className="table-td font-medium">{b.nombre}</td>
                  <td className="table-td text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {b.ciudad || b.direccion || "—"}
                    </div>
                  </td>
                  <td className="table-td text-sm">
                    {b.telefono || b.email ? (
                      <div className="space-y-0.5">
                        {b.telefono && <div className="flex items-center gap-1 text-gray-500"><Phone className="w-3 h-3" />{b.telefono}</div>}
                        {b.email && <div className="flex items-center gap-1 text-gray-500"><Mail className="w-3 h-3" />{b.email}</div>}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Hash className="w-3 h-3" />
                      {b.punto_emision}
                    </div>
                  </td>
                  <td className="table-td">
                    <StatusBadge status={b.activo ? "activo" : "inactivo"} map={{ activo: "badge-success", inactivo: "badge-danger" }} />
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost" title="Editar" onClick={() => handleEdit(b)}><Edit className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400 hover:text-red-500" title="Eliminar" onClick={() => handleDelete(b.id)}><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? "Editar sucursal" : "Nueva sucursal"}</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Código</label>
                  <input className="input-field" placeholder="SUC-001" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required">Nombre</label>
                  <input className="input-field" placeholder="Sucursal Central" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label">Dirección</label>
                <input className="input-field" placeholder="Av. España 1234" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Ciudad</label>
                  <input className="input-field" placeholder="Asunción" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Departamento</label>
                  <input className="input-field" placeholder="Central" value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Teléfono</label>
                  <input className="input-field" placeholder="021 123 456" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input className="input-field" type="email" placeholder="sucursal@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">RUC</label>
                  <input className="input-field" placeholder="80012345-6" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Punto de Emisión</label>
                  <input className="input-field" value={form.punto_emision} onChange={(e) => setForm({ ...form, punto_emision: e.target.value })} />
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

function PricesTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [prices, setPrices] = useState<BranchPrice[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [priceForm, setPriceForm] = useState({ branch_id: "", product_id: "", precio: "" })
  const [submitting, setSubmitting] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [b, p, pr] = await Promise.all([
        api.branches.list(),
        api.branches.prices.list(),
        api.products.list({ activo: true }),
      ])
      setBranches(b.filter(x => x.activo))
      setPrices(p)
      setProducts(pr)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver precios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = prices.filter(p =>
    (!selectedBranch || p.branch_id === selectedBranch) &&
    (!productSearch || (p.product_nombre || "").toLowerCase().includes(productSearch.toLowerCase()))
  )

  const handleUpsertPrice = async () => {
    if (!priceForm.branch_id || !priceForm.product_id || !priceForm.precio) {
      toast.error("Error", "Todos los campos son obligatorios")
      return
    }
    setSubmitting(true)
    try {
      await api.branches.prices.upsert({
        branch_id: priceForm.branch_id,
        product_id: priceForm.product_id,
        precio: parseFloat(priceForm.precio),
      })
      toast.success("Precio guardado", "Precio actualizado correctamente")
      setShowModal(false)
      setPriceForm({ branch_id: "", product_id: "", precio: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar el precio")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePrice = async (id: string) => {
    try {
      await api.branches.prices.delete(id)
      toast.success("Eliminado", "Precio eliminado correctamente")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar el precio")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por producto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
        </div>
        <select className="input-field w-64" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <button onClick={() => { setPriceForm({ branch_id: branches[0]?.id || "", product_id: "", precio: "" }); setShowModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo precio
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Sucursal</th>
              <th className="table-cell">Producto</th>
              <th className="table-cell">Precio</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">No hay precios configurados</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-td font-medium">{p.branch_nombre || "—"}</td>
                  <td className="table-td">{p.product_nombre || p.product_id}</td>
                  <td className="table-td font-bold text-primary">Gs. {p.precio.toLocaleString()}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost" title="Editar" onClick={() => {
                        setPriceForm({ branch_id: p.branch_id || "", product_id: p.product_id || "", precio: String(p.precio) })
                        setShowModal(true)
                      }}><Edit className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400 hover:text-red-500" title="Eliminar" onClick={() => handleDeletePrice(p.id)}><Trash2 className="w-4 h-4" /></button>
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
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {priceForm.product_id ? "Editar precio" : "Nuevo precio"}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Sucursal</label>
                <select className="input-field" value={priceForm.branch_id} onChange={(e) => setPriceForm({ ...priceForm, branch_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required">Producto</label>
                <select className="input-field" value={priceForm.product_id} onChange={(e) => setPriceForm({ ...priceForm, product_id: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.nombre} ({pr.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required">Precio</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00" value={priceForm.precio} onChange={(e) => setPriceForm({ ...priceForm, precio: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleUpsertPrice} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TransfersTab() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [transfers, setTransfers] = useState<BranchTransfer[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<string | null>(null)
  const [showReceive, setShowReceive] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const [form, setForm] = useState({
    origen_branch_id: "",
    destino_branch_id: "",
    notas: "",
    transportista: "",
    items: [] as { product_id: string; cantidad: string; costo_unitario: string }[],
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [b, t, p] = await Promise.all([
        api.branches.list(),
        api.branches.transfers.list(estadoFilter ? { estado: estadoFilter } : undefined),
        api.products.list({ activo: true }),
      ])
      setBranches(b)
      setTransfers(t)
      setProducts(p)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver transferencias")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [estadoFilter])

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { product_id: "", cantidad: "1", costo_unitario: "" }] })
  }

  const removeItem = (idx: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
  }

  const updateItem = (idx: number, field: string, value: string) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    setForm({ ...form, items })
  }

  const handleCreate = async () => {
    if (!form.origen_branch_id || !form.destino_branch_id) {
      toast.error("Error", "Origen y destino son obligatorios")
      return
    }
    if (form.origen_branch_id === form.destino_branch_id) {
      toast.error("Error", "Origen y destino deben ser diferentes")
      return
    }
    if (form.items.length === 0 || !form.items[0].product_id) {
      toast.error("Error", "Agregá al menos un producto")
      return
    }
    setSubmitting(true)
    try {
      await api.branches.transfers.create({
        origen_branch_id: form.origen_branch_id,
        destino_branch_id: form.destino_branch_id,
        notas: form.notas || undefined,
        transportista: form.transportista || undefined,
        items: form.items.map(i => ({
          product_id: i.product_id,
          cantidad: parseInt(i.cantidad) || 1,
          costo_unitario: i.costo_unitario ? parseFloat(i.costo_unitario) : undefined,
        })),
      })
      toast.success("Creada", "Transferencia creada correctamente")
      setShowCreate(false)
      setForm({ origen_branch_id: "", destino_branch_id: "", notas: "", transportista: "", items: [] })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la transferencia")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceive = async () => {
    if (!showReceive) return
    const transfer = transfers.find(t => t.id === showReceive)
    if (!transfer) return
    const items = transfer.items?.map(it => ({
      item_id: it.id,
      cantidad_recibida: it.cantidad_recibida ?? it.cantidad,
    })) || []
    setSubmitting(true)
    try {
      await api.branches.transfers.receive(showReceive, { items })
      toast.success("Recibida", "Transferencia recibida correctamente")
      setShowReceive(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo recibir la transferencia")
    } finally {
      setSubmitting(false)
    }
  }

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      pendiente: "badge-warning",
      en_transito: "badge-info",
      recibido: "badge-success",
      cancelado: "badge-danger",
    }
    return <StatusBadge status={estado} map={map} />
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <select className="input-field w-48" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
          {ESTADOS_TRANSFER.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
        <button onClick={() => setShowCreate(true)} className="btn-primary ml-auto">
          <Plus className="w-4 h-4" />
          Nueva transferencia
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Número</th>
              <th className="table-cell">Origen</th>
              <th className="table-cell">Destino</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Items</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay transferencias</td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{t.numero}</td>
                  <td className="table-td">{t.origen_nombre || t.origen_branch_id}</td>
                  <td className="table-td">{t.destino_nombre || t.destino_branch_id}</td>
                  <td className="table-td">{estadoBadge(t.estado)}</td>
                  <td className="table-td">{t.items?.length || 0}</td>
                  <td className="table-td text-sm text-gray-500">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      {t.estado === "pendiente" && (
                        <button className="btn-ghost" title="Enviar" onClick={async () => {
                          try {
                            await api.branches.transfers.send(t.id)
                            toast.success("Enviada", "Transferencia marcada como en tránsito")
                            fetchData()
                          } catch { toast.error("Error", "No se pudo actualizar") }
                        }}><Truck className="w-4 h-4" /></button>
                      )}
                      {t.estado === "en_transito" && (
                        <button className="btn-ghost text-green-500" title="Recibir" onClick={() => setShowReceive(t.id)}><Check className="w-4 h-4" /></button>
                      )}
                      <button className="btn-ghost" title="Ver detalle" onClick={() => setShowDetail(showDetail === t.id ? null : t.id)}><Eye className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDetail && (() => {
        const t = transfers.find(x => x.id === showDetail)
        if (!t) return null
        return (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Transferencia {t.numero}
              </h3>
              <button onClick={() => setShowDetail(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-gray-400">Origen:</span> <span className="font-medium">{t.origen_nombre || t.origen_branch_id}</span></div>
              <div><span className="text-gray-400">Destino:</span> <span className="font-medium">{t.destino_nombre || t.destino_branch_id}</span></div>
              <div><span className="text-gray-400">Estado:</span> {estadoBadge(t.estado)}</div>
              <div><span className="text-gray-400">Transportista:</span> <span className="font-medium">{t.transportista || "—"}</span></div>
              {t.notas && <div className="col-span-2"><span className="text-gray-400">Notas:</span> <span>{t.notas}</span></div>}
            </div>
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Producto</th>
                  <th className="table-cell">Cantidad</th>
                  <th className="table-cell">Costo Unit.</th>
                  <th className="table-cell">Recibido</th>
                </tr>
              </thead>
              <tbody>
                {t.items?.map((it) => (
                  <tr key={it.id} className="table-row">
                    <td className="table-td">{it.product_nombre || it.product_id}</td>
                    <td className="table-td">{it.cantidad}</td>
                    <td className="table-td">{it.costo_unitario ? `Gs. ${it.costo_unitario.toLocaleString()}` : "—"}</td>
                    <td className="table-td">{it.cantidad_recibida ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}

      {showReceive && (() => {
        const t = transfers.find(x => x.id === showReceive)
        if (!t) return null
        return (
          <div className="modal-overlay" onClick={() => setShowReceive(null)}>
            <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recibir transferencia {t.numero}</h3>
                <button onClick={() => setShowReceive(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">Confirmar recepción de todos los items de esta transferencia.</p>
                <table className="w-full text-sm">
                  <thead><tr className="table-header"><th className="table-cell">Producto</th><th className="table-cell">Enviado</th><th className="table-cell">A recibir</th></tr></thead>
                  <tbody>
                    {t.items?.map((it) => (
                      <tr key={it.id} className="table-row">
                        <td className="table-td">{it.product_nombre || it.product_id}</td>
                        <td className="table-td">{it.cantidad}</td>
                        <td className="table-td font-bold">{it.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-3 pt-4">
                  <button className="btn-outline flex-1" onClick={() => setShowReceive(null)}>Cancelar</button>
                  <button className="btn-primary flex-1" onClick={handleReceive} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar recepción"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva transferencia</h3>
              <button onClick={() => setShowCreate(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Origen</label>
                  <select className="input-field" value={form.origen_branch_id} onChange={(e) => setForm({ ...form, origen_branch_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Destino</label>
                  <select className="input-field" value={form.destino_branch_id} onChange={(e) => setForm({ ...form, destino_branch_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Transportista</label>
                  <input className="input-field" placeholder="Nombre del transportista" value={form.transportista} onChange={(e) => setForm({ ...form, transportista: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Notas</label>
                  <input className="input-field" placeholder="Notas opcionales" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="input-label label-required mb-0">Productos</label>
                  <button onClick={addItem} className="btn-outline text-xs py-1 px-2">
                    <Plus className="w-3 h-3" /> Agregar producto
                  </button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-end">
                    <div className="col-span-2">
                      <select className="input-field text-sm" value={item.product_id} onChange={(e) => updateItem(idx, "product_id", e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <input className="input-field text-sm" type="number" min="1" placeholder="Cant." value={item.cantidad} onChange={(e) => updateItem(idx, "cantidad", e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                      <input className="input-field text-sm flex-1" type="number" step="0.01" placeholder="Costo" value={item.costo_unitario} onChange={(e) => updateItem(idx, "costo_unitario", e.target.value)} />
                      <button onClick={() => removeItem(idx)} className="btn-ghost text-red-400 p-1"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCreate} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear transferencia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardTab() {
  const [dashboard, setDashboard] = useState<ConsolidatedDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.branches.dashboard()
      setDashboard(data)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver el dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
  }

  if (!dashboard) {
    return <div className="card p-6 text-center text-gray-400">No hay datos disponibles</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Building2 className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursales</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.total_branches}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ventas totales</span></div>
          <p className="text-2xl font-bold text-green-500">Gs. {dashboard.total_ventas.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Package className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor stock</span></div>
          <p className="text-2xl font-bold text-blue-500">Gs. {dashboard.total_stock_valor.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ArrowLeftRight className="w-5 h-5 text-orange-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transf. pendientes</span></div>
          <p className="text-2xl font-bold text-orange-500">{dashboard.transferencias_pendientes}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Rendimiento por sucursal</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Sucursal</th>
              <th className="table-cell">Ventas totales</th>
              <th className="table-cell">Cant. ventas</th>
              <th className="table-cell">Valor stock</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.branches.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">No hay sucursales activas</td></tr>
            ) : (
              dashboard.branches.map((b) => (
                <tr key={b.branch_id} className="table-row">
                  <td className="table-td font-medium">{b.branch_nombre}</td>
                  <td className="table-td font-bold text-green-500">Gs. {b.total_ventas.toLocaleString()}</td>
                  <td className="table-td">{b.cantidad_ventas}</td>
                  <td className="table-td text-blue-500">Gs. {b.stock_valor.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
