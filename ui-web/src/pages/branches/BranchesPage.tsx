import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, Plus, Edit, Trash2, Search, Loader2, X, Check, MapPin, Phone, Mail, Hash, DollarSign, ArrowLeftRight, LayoutDashboard, Package, TrendingUp, Truck, Eye, ExternalLink } from "lucide-react"
import { api, type Branch, type BranchPrice, type BranchTransfer, type ConsolidatedDashboard } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"

type Tab = "sucursales" | "precios" | "transferencias" | "dashboard"

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
      {tab === "transferencias" && <TransfersRedirect />}
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
      toast.error("Error de conexión", "Conectá el backend para ver sucursales")
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
      toast.error("Error de conexión", "Conectá el backend para ver precios")
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

function TransfersRedirect() {
  const navigate = useNavigate()
  return (
    <div className="card p-10 text-center space-y-3">
      <ArrowLeftRight className="w-8 h-8 text-primary mx-auto" />
      <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pestana duplicaba el modulo real de Transferencias</p>
      <p className="text-sm text-gray-500 max-w-md mx-auto">Mismos datos reales, una sola pantalla -- las transferencias entre sucursales viven en su propio modulo.</p>
      <button className="btn-primary mx-auto" onClick={() => navigate("/transferencias")}><ExternalLink className="w-4 h-4" /> Ir a Transferencias</button>
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
      toast.error("Error de conexión", "Conectá el backend para ver el dashboard")
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
