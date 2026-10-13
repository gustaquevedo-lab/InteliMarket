import { useEntityLookup, getCustomerName } from "../../hooks/useEntityLookup"
import { useState, useEffect, type ReactNode } from "react"
import {
  LayoutDashboard, Shirt, ShoppingCart, Users, Award, Percent, Calendar,
  BarChart3, TrendingUp, Package, DollarSign, Loader2, Plus, Search, X,
  CheckCircle, XCircle, Eye, Printer, Truck, MessageCircle, Send,
  Tag, Palette, Layers, Grid3X3, ArrowUpDown, RefreshCw, Star, Gift,
  Camera, MapPin, Clock, User, ExternalLink, ChevronRight, ShoppingBag,
  RotateCcw, Award as AwardIcon, Zap, Sparkles, Pencil, Trash2, Settings,
  UserCheck, UserPlus, Phone, Mail, CalendarDays, AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { boutiqueApi, type DashboardData, type BoutProduct, type BoutVariant,
  type BoutSize, type BoutColor, type BoutCategory, type BoutCollection,
  type BoutSale, type BoutReturn, type BoutClientProfile, type BoutInteraction,
  type BoutMeasurement, type BoutLoyaltyConfig, type BoutLoyaltyAccount,
  type BoutMarkdownRule, type BoutEvent, type BoutEventGuest,
  type BoutGiftWrap, type BoutCrossSellItem, type Pedido, type PedidoItem,
  type BoutStockMovement } from "../../api/boutique"
import { intelientregasApi, type TrackDriver, type TrackDelivery, type TrackTrackingEvent } from "../../api/intelientregas"
import { api, type Product, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { generatePedidoTicket } from "../../utils/boutiquePrint"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TabKey = "dashboard" | "productos" | "ventas" | "clientes" | "loyalty" | "markdown" | "eventos"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { key: "productos",  label: "Productos",  icon: Shirt },
  { key: "ventas",     label: "Ventas",     icon: ShoppingCart },
  { key: "clientes",   label: "Clientes",   icon: Users },
  { key: "loyalty",    label: "Loyalty",    icon: Award },
  { key: "markdown",   label: "Markdown",   icon: Percent },
  { key: "eventos",    label: "Eventos",    icon: Calendar },
]


export default function BoutiquePage() {
  useEntityLookup()
  const [custMap, setCustMap] = useState<Record<string, string>>({})
  useEffect(() => {
    api.customers.list({ limit: 500 }).then((res: any) => {
      const list = Array.isArray(res) ? res : res?.data || []
      const map: Record<string, string> = {}
      list.forEach((c: any) => { if (c.id) map[c.id] = c.razon_social || c.nombre || c.ruc })
      setCustMap(map)
    }).catch(() => {})
  }, [])

  const [tab, setTab] = useState<TabKey>("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Boutique / Indumentaria</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión completa de moda — productos, ventas, clientes, loyalty, markdown IA, eventos</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"  && <DashboardTab />}
      {tab === "productos"  && <ProductosTab />}
      {tab === "ventas"     && <VentasTab />}
      {tab === "clientes"   && <ClientesTab />}
      {tab === "loyalty"    && <LoyaltyTab />}
      {tab === "markdown"   && <MarkdownTab />}
      {tab === "eventos"    && <EventosTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: { icon: LucideIcon; label: string; value?: ReactNode; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ==================== DASHBOARD ====================
function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    boutiqueApi.getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <div className="text-center py-12 text-gray-400">No se pudo cargar el dashboard</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Productos" value={data.total_productos} sub={`${data.total_variantes} variantes`} color="blue" />
        <KpiCard icon={ShoppingCart} label="Ventas del Mes" value={data.total_ventas_mes} sub={formatPYG(data.total_ingresos_mes)} color="green" />
        <KpiCard icon={Users} label="Clientes" value={data.total_clientes} color="purple" />
        <KpiCard icon={RotateCcw} label="Devoluciones" value={data.devoluciones_mes} color="red" />
        <KpiCard icon={AlertTriangle} label="Bajo Stock" value={data.productos_bajo_stock} color="yellow" />
        <KpiCard icon={Percent} label="Markdown Activos" value={data.variantes_con_markdown} color="pink" />
        <KpiCard icon={Award} label="Puntos Emitidos" value={data.loyalty_puntos_emitidos} color="indigo" />
      </div>
    </div>
  )
}

// ==================== PRODUCTOS ====================
function ProductosTab() {
  const [products, setProducts] = useState<BoutProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [editProduct, setEditProduct] = useState<BoutProduct | null>(null)
  const toast = useToast()

  async function load(pageNum = 1) {
    setLoading(true)
    try {
      const res = await boutiqueApi.listProducts({ page: pageNum, page_size: 20, activo: undefined })
      setProducts(res.items)
      setTotal(res.total)
      setPage(pageNum)
    } catch { toast.error("Error", "No se pudieron cargar productos") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = search
    ? products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
        <button onClick={() => load()} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Shirt className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay productos</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onEdit={() => setEditProduct(p)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
          <button key={i} onClick={() => load(i + 1)}
            className={`px-3 py-1 rounded text-sm ${page === i + 1 ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{i + 1}</button>
        ))}
      </div>

      {showCreate && <ProductFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
      {editProduct && <ProductFormModal product={editProduct} onClose={() => setEditProduct(null)} onSaved={() => { setEditProduct(null); load() }} />}
    </div>
  )
}

function ProductCard({ product, onEdit }: { product: BoutProduct; onEdit: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-32 bg-gradient-to-br from-primary/10 to-purple-100 dark:from-primary/5 dark:to-purple-900/20 flex items-center justify-center">
        {product.imagen_principal ? (
          <img src={product.imagen_principal} alt={product.nombre} className="h-full w-full object-cover" />
        ) : (
          <Shirt className="w-10 h-10 text-primary/40" />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{product.nombre}</p>
            <p className="text-xs text-gray-400">{product.codigo} {product.marca && `• ${product.marca}`}</p>
          </div>
          <button onClick={onEdit} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-primary">{formatPYG(product.precio_base)}</span>
          <span className="text-xs text-gray-400">{product.variantes?.length || 0} vars</span>
        </div>
        {product.genero && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{product.genero}</span>}
      </div>
    </div>
  )
}

function ProductFormModal({ product, onClose, onSaved }: { product?: BoutProduct; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    codigo: product?.codigo || "", nombre: product?.nombre || "", descripcion: product?.descripcion || "",
    categoria_id: product?.categoria_id || "", tipo_producto: product?.tipo_producto || "indumentaria",
    genero: product?.genero || "", marca: product?.marca || "", material: product?.material || "",
    precio_base: product?.precio_base || 0, moneda: "PYG", activo: true, destacado: product?.destacado || false,
  })
  const [variantes, setVariantes] = useState<{ size_id?: string; color_id?: string; sku: string; precio_sobrecargo: number; stock_actual: number; stock_minimo: number }[]>(
    product?.variantes?.map(v => ({ size_id: v.size_id, color_id: v.color_id, sku: v.sku, precio_sobrecargo: v.precio_sobrecargo || 0, stock_actual: v.stock_actual || 0, stock_minimo: v.stock_minimo || 0 })) || []
  )
  const [saving, setSaving] = useState(false)
  const [sizes, setSizes] = useState<BoutSize[]>([])
  const [colors, setColors] = useState<BoutColor[]>([])
  const [categories, setCategories] = useState<BoutCategory[]>([])
  const toast = useToast()

  useEffect(() => {
    boutiqueApi.listSizes({ activo: true }).then(setSizes).catch(() => {})
    boutiqueApi.listColors({ activo: true }).then(setColors).catch(() => {})
    boutiqueApi.listCategories({ activo: true }).then(setCategories).catch(() => {})
  }, [])

  async function handleSubmit() {
    if (!form.codigo || !form.nombre || !form.precio_base) { toast.error("Error", "Código, nombre y precio base son requeridos"); return }
    setSaving(true)
    try {
      const payload = { ...form, variantes: variantes.length > 0 ? variantes : undefined }
      if (product) {
        await boutiqueApi.updateProduct(product.id, payload)
        toast.success("Actualizado", "Producto actualizado correctamente")
      } else {
        await boutiqueApi.createProduct(payload)
        toast.success("Creado", "Producto creado correctamente")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el producto") }
    finally { setSaving(false) }
  }

  function addVariant() {
    setVariantes([...variantes, { sku: `${form.codigo}-${variantes.length + 1}`, precio_sobrecargo: 0, stock_actual: 0, stock_minimo: 0 }])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product ? "Editar Producto" : "Nuevo Producto"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Código *</label>
            <input className="input-field w-full" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
            <input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Categoría</label>
            <select className="input-field w-full" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Género</label>
            <select className="input-field w-full" value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })}>
              <option value="">Sin género</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
              <option value="unisex">Unisex</option>
              <option value="nino">Niño</option>
              <option value="nina">Niña</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Marca</label>
            <input className="input-field w-full" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Material</label>
            <input className="input-field w-full" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio Base *</label>
            <input className="input-field w-full" type="number" value={form.precio_base} onChange={(e) => setForm({ ...form, precio_base: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="flex items-center gap-2 mt-6 text-sm"><input type="checkbox" checked={form.destacado} onChange={(e) => setForm({ ...form, destacado: e.target.checked })} className="rounded" />Destacado</label></div>
        </div>

        {/* Variants */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Variantes ({variantes.length})</h4>
            <button onClick={addVariant} className="text-sm text-primary font-medium">+ Agregar variante</button>
          </div>
          <div className="space-y-2">
            {variantes.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                <select className="input-field w-28 text-xs" value={v.size_id || ""} onChange={(e) => { const n = [...variantes]; n[idx].size_id = e.target.value; setVariantes(n) }}>
                  <option value="">Talle</option>
                  {sizes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <select className="input-field w-28 text-xs" value={v.color_id || ""} onChange={(e) => { const n = [...variantes]; n[idx].color_id = e.target.value; setVariantes(n) }}>
                  <option value="">Color</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <input className="input-field w-20 text-xs" placeholder="SKU" value={v.sku} onChange={(e) => { const n = [...variantes]; n[idx].sku = e.target.value; setVariantes(n) }} />
                <input className="input-field w-16 text-xs" type="number" placeholder="+" value={v.precio_sobrecargo} onChange={(e) => { const n = [...variantes]; n[idx].precio_sobrecargo = parseFloat(e.target.value) || 0; setVariantes(n) }} />
                <input className="input-field w-14 text-xs" type="number" placeholder="Stk" value={v.stock_actual} onChange={(e) => { const n = [...variantes]; n[idx].stock_actual = parseInt(e.target.value) || 0; setVariantes(n) }} />
                <input className="input-field w-14 text-xs" type="number" placeholder="Min" value={v.stock_minimo} onChange={(e) => { const n = [...variantes]; n[idx].stock_minimo = parseInt(e.target.value) || 0; setVariantes(n) }} />
                <button onClick={() => setVariantes(variantes.filter((_, i) => i !== idx))} className="text-red-400 p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : product ? "Actualizar" : "Crear Producto"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== VENTAS (Sales + Returns + Pedidos legacy) ====================
function VentasTab() {
  const [subtab, setSubtab] = useState<"pedidos" | "ventas" | "devoluciones">("pedidos")

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-1 w-fit">
        {(["pedidos", "ventas", "devoluciones"] as const).map((s) => (
          <button key={s} onClick={() => setSubtab(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${subtab === s ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"}`}>
            {s === "pedidos" ? "Pedidos" : s === "ventas" ? "Ventas" : "Devoluciones"}
          </button>
        ))}
      </div>
      {subtab === "pedidos" && <PedidosSubTab />}
      {subtab === "ventas" && <SalesSubTab />}
      {subtab === "devoluciones" && <ReturnsSubTab />}
    </div>
  )
}

// ==================== PEDIDOS SUBTAB (legacy) ====================
const ESTADOS = ["pendiente", "en_preparacion", "listo", "aprobado", "rechazado", "facturado", "cancelado"] as const
const estadoColors: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  en_preparacion: "bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200",
  listo: "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200",
  aprobado: "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200",
  facturado: "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200",
  cancelado: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
}
const deliveryStatusColors: Record<string, string> = {
  pending_assignment: "bg-gray-100 text-gray-600", assigned: "bg-blue-100 text-blue-700",
  picked_up: "bg-amber-100 text-amber-700", in_transit: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700",
}

function PedidosSubTab() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState("")
  const [searchFilter, setSearchFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Pedido | null>(null)
  const [showDelivery, setShowDelivery] = useState<Pedido | null>(null)
  const [showRendir, setShowRendir] = useState<Pedido | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const toast = useToast()

  async function loadPedidos() {
    setLoading(true)
    try {
      const data = await boutiqueApi.list({ estado: estadoFilter || undefined, search: searchFilter || undefined })
      setPedidos(data)
    } catch { toast.error("Error", "No se pudieron cargar los pedidos") }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPedidos() }, [])

  const paginated = pedidos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(pedidos.length / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por número..." value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadPedidos()} />
        </div>
        <select className="input-field w-44" value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value); loadPedidos() }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo</button>
        <button onClick={loadPedidos} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><ShoppingBag className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay pedidos</p></div>
        ) : paginated.map((p) => (
          <div key={p.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-700"}`}>
                  {p.estado.replace(/_/g, " ")}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{p.numero}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.fecha || p.created_at || "").toLocaleDateString("es-PY")} - {formatPYG(p.total)}
                    {p.sale_id && <span className="ml-2 text-purple-500">✓ Facturado</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.intelientregas_delivery_id && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Truck className="w-3 h-3" />Delivery
                  </span>
                )}
                {p.sale_id && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">SIFEN</span>}
                <button onClick={(e) => { e.stopPropagation(); setSelected(p) }} className="btn-ghost p-2"><Eye className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`px-3 py-1 rounded text-sm ${page === i ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{i + 1}</button>
          ))}
        </div>
      )}

      {showCreate && <CreatePedidoModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadPedidos() }} />}
      {selected && (
        <PedidoDetailModal pedido={selected} onClose={() => setSelected(null)} onUpdated={loadPedidos}
          onShowDelivery={() => { setShowDelivery(selected); setSelected(null) }}
          onShowRendir={() => { setShowRendir(selected); setSelected(null) }} />
      )}
      {showDelivery && <AssignDeliveryModal pedido={showDelivery} onClose={() => setShowDelivery(null)} onAssigned={() => { setShowDelivery(null); loadPedidos() }} />}
      {showRendir && <RendirModal pedido={showRendir} onClose={() => setShowRendir(null)} onDone={() => { setShowRendir(null); loadPedidos() }} />}
    </div>
  )
}

function CreatePedidoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ customer_id: "", customer_data: "", direccion_entrega: "", coordenadas: "", observaciones: "" })
  const [items, setItems] = useState([{ producto_id: "", cantidad: 1, precio_unitario: 0, iva_tasa: 10 }])
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [showProductSearch, setShowProductSearch] = useState<number | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const toast = useToast()

  useEffect(() => { if (productSearch.length > 1) api.products.list({ search: productSearch }).then(setProducts).catch(() => {}) }, [productSearch])
  useEffect(() => { if (customerSearch.length > 1) api.customers.list({ search: customerSearch }).then(setCustomers).catch(() => {}) }, [customerSearch])

  async function handleSubmit() {
    if (items.length === 0) { toast.error("Error", "Agregá al menos un producto"); return }
    setSaving(true)
    try {
      await boutiqueApi.create({ customer_id: form.customer_id || undefined, customer_data: form.customer_data || undefined, direccion_entrega: form.direccion_entrega || undefined, coordenadas: form.coordenadas || undefined, observaciones: form.observaciones || undefined, items })
      toast.success("Pedido creado", "Se creó correctamente"); onCreated()
    } catch { toast.error("Error", "No se pudo crear el pedido") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo Pedido</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cliente</label>
            <input className="input-field w-full" placeholder="Buscar cliente..." value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true) }} onFocus={() => setShowCustomerSearch(true)} />
            {showCustomerSearch && customers.length > 0 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {customers.map((c) => (
                  <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                    onClick={() => { setForm({ ...form, customer_id: c.id, customer_data: c.nombre }); setCustomerSearch(c.nombre); setShowCustomerSearch(false) }}>
                    {c.nombre} {c.ruc ? `- ${c.ruc}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Datos del cliente</label>
            <input className="input-field w-full" placeholder="Razón social / RUC" value={form.customer_data} onChange={(e) => setForm({ ...form, customer_data: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Dirección de entrega</label>
            <textarea className="input-field w-full" placeholder="Dirección completa" rows={2} value={form.direccion_entrega} onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Coordenadas</label>
            <input className="input-field w-full" placeholder="-25.123, -57.456" value={form.coordenadas} onChange={(e) => setForm({ ...form, coordenadas: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Observaciones</label>
            <input className="input-field w-full" placeholder="Notas" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
        </div>
        <div className="space-y-2 mt-4">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Productos</h4>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 relative">
                <input className="input-field w-full" placeholder="Buscar producto..." value={showProductSearch === idx ? productSearch : item.producto_id}
                  onChange={(e) => { setShowProductSearch(idx); setProductSearch(e.target.value) }} onFocus={() => setShowProductSearch(idx)} />
                {showProductSearch === idx && products.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {products.map((p) => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                        onClick={() => { const n = [...items]; n[idx] = { ...n[idx], producto_id: p.id, precio_unitario: p.precio || 0 }; setItems(n); setShowProductSearch(null); setProductSearch("") }}>
                        {p.nombre} - {formatPYG(p.precio || 0)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input className="input-field w-20" type="number" placeholder="Cant" value={item.cantidad}
                onChange={(e) => { const n = [...items]; n[idx].cantidad = parseInt(e.target.value) || 1; setItems(n) }} />
              <input className="input-field w-28" type="number" placeholder="Precio" value={item.precio_unitario}
                onChange={(e) => { const n = [...items]; n[idx].precio_unitario = parseFloat(e.target.value) || 0; setItems(n) }} />
              <select className="input-field w-20" value={item.iva_tasa}
                onChange={(e) => { const n = [...items]; n[idx].iva_tasa = parseFloat(e.target.value); setItems(n) }}>
                <option value={10}>10%</option><option value={5}>5%</option><option value={0}>Exenta</option>
              </select>
              {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={() => setItems([...items, { producto_id: "", cantidad: 1, precio_unitario: 0, iva_tasa: 10 }])}
            className="text-sm text-primary font-medium">+ Agregar producto</button>
        </div>
        <div className="flex justify-end text-sm text-gray-500 mt-2">
          Total estimado: <span className="font-bold ml-1">{formatPYG(items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))}</span>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : "Crear Pedido"}
          </button>
        </div>
      </div>
    </div>
  )
}

function PedidoDetailModal({ pedido, onClose, onUpdated, onShowDelivery, onShowRendir }: {
  pedido: Pedido; onClose: () => void; onUpdated: () => void; onShowDelivery: () => void; onShowRendir: () => void
}) {
  const [detail, setDetail] = useState<Pedido | null>(null)
  const [delivery, setDelivery] = useState<TrackDelivery | null>(null)
  const [tracking, setTracking] = useState<TrackTrackingEvent[]>([])
  const [activeTab, setActiveTab] = useState<"info" | "tracking">("info")
  const [waMessage, setWaMessage] = useState("")
  const [waSending, setWaSending] = useState(false)
  const [waOpen, setWaOpen] = useState(false)

  useEffect(() => { boutiqueApi.get(pedido.id).then(setDetail) }, [pedido.id])
  useEffect(() => {
    if (pedido.intelientregas_delivery_id) {
      intelientregasApi.deliveries.get(pedido.intelientregas_delivery_id).then(setDelivery).catch(() => {})
      intelientregasApi.tracking.byDelivery(pedido.intelientregas_delivery_id).then(setTracking).catch(() => {})
    }
  }, [pedido.intelientregas_delivery_id])

  const p = detail || pedido
  const canAssignDelivery = ["pendiente", "en_preparacion", "listo"].includes(p.estado)
  const canRendir = p.intelientregas_delivery_id != null && !["facturado", "cancelado", "rechazado", "aprobado"].includes(p.estado)
  const hasTracking = tracking.length > 0

  async function handleAction(action: string) {
    try {
      if (action === "marcar_listo") await boutiqueApi.update(p.id, { estado: "listo" })
      else if (action === "cancelar") await boutiqueApi.update(p.id, { estado: "cancelado" })
      onUpdated()
    } catch { alert("Error") }
  }

  async function handleSendWhatsApp() {
    if (!waMessage.trim()) return
    setWaSending(true)
    try {
      const phone = p.customer_data ? p.customer_data.replace(/\D/g, "") : ""
      if (!phone) { alert("No hay teléfono del cliente"); return }
      await api.whatsapp.testMessage({ to: phone, message: `🧾 *Pedido ${p.numero}*\n\n${waMessage}` })
      setWaMessage(""); setWaOpen(false); alert("Mensaje enviado")
    } catch { alert("Error al enviar WhatsApp") }
    finally { setWaSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="text-lg font-bold text-gray-900 dark:text-white">Pedido {p.numero}</h3>
            <p className="text-xs text-gray-500">{p.fecha ? new Date(p.fecha).toLocaleString("es-PY") : ""}</p></div>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[p.estado]}`}>{p.estado.replace(/_/g, " ")}</span>
          {delivery && <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${deliveryStatusColors[delivery.estado] || "bg-gray-100"}`}><Truck className="w-3 h-3" />{delivery.estado.replace(/_/g, " ")}</span>}
          {p.sale_id && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Facturado</span>}
        </div>
        <div className="flex gap-4 border-b mb-4">
          <button onClick={() => setActiveTab("info")} className={`pb-2 text-sm font-medium ${activeTab === "info" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}>Información</button>
          <button onClick={() => setActiveTab("tracking")} className={`pb-2 text-sm font-medium ${activeTab === "tracking" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}>Tracking {hasTracking && <span className="ml-1 text-xs bg-primary text-white px-1.5 py-0.5 rounded-full">{tracking.length}</span>}</button>
        </div>
        {activeTab === "info" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{p.customer_data || p.customer_id || "N/A"}</span></div>
              <div><span className="text-gray-500">Delivery ID:</span> <span className="font-mono text-xs">{p.intelientregas_delivery_id || "—"}</span></div>
              {delivery && <><div><span className="text-gray-500">Dirección:</span> <span>{delivery.direccion || p.direccion_entrega}</span></div><div><span className="text-gray-500">Prioridad:</span> <span>{delivery.prioridad}</span></div></>}
              {!delivery && p.direccion_entrega && <div className="col-span-2"><span className="text-gray-500">Dirección:</span> <span>{p.direccion_entrega}</span></div>}
              {p.sale_id && <div className="col-span-2"><span className="text-gray-500">Sale ID:</span> <span className="font-mono text-xs">{p.sale_id}</span></div>}
              {p.observaciones && <div className="col-span-2"><span className="text-gray-500">Obs:</span> <span>{p.observaciones}</span></div>}
            </div>
            {p.items && p.items.length > 0 && (
              <div><h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Productos</h4>
                <div className="space-y-1">
                  {p.items.map((item: PedidoItem) => (
                    <div key={item.id} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span><span className="font-medium">{item.producto_id}</span> × {item.cantidad}</span>
                      <div className="text-right"><span className="font-mono">{formatPYG(item.subtotal)}</span>{item.iva_tasa != null && <span className="text-xs text-gray-400 ml-1">IVA {item.iva_tasa}%</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-300 dark:border-gray-600">
              <span>Total</span><div className="text-right"><span className="font-mono">{formatPYG(p.total)}</span><span className="text-xs text-gray-400 ml-1">{p.moneda || "PYG"}</span></div>
            </div>
          </div>
        )}
        {activeTab === "tracking" && (
          <div className="space-y-3">
            {delivery && (
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Estado delivery</span><span className="font-medium">{delivery.estado.replace(/_/g, " ")}</span></div>
                {delivery.driver_id && <div className="flex justify-between"><span className="text-gray-500">Driver ID</span><span className="font-mono text-xs">{delivery.driver_id}</span></div>}
                {delivery.assigned_at && <div className="flex justify-between"><span className="text-gray-500">Asignado</span><span>{new Date(delivery.assigned_at).toLocaleString("es-PY")}</span></div>}
                {delivery.picked_up_at && <div className="flex justify-between"><span className="text-gray-500">Retirado</span><span>{new Date(delivery.picked_up_at).toLocaleString("es-PY")}</span></div>}
                {delivery.delivered_at && <div className="flex justify-between"><span className="text-gray-500">Entregado</span><span>{new Date(delivery.delivered_at).toLocaleString("es-PY")}</span></div>}
                {delivery.motivo_falla && <div className="flex justify-between"><span className="text-red-500">Motivo falla</span><span>{delivery.motivo_falla}</span></div>}
              </div>
            )}
            {hasTracking ? (
              <div className="space-y-2">
                {tracking.map((evt, idx) => (
                  <div key={evt.id || idx} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-primary" : "bg-gray-300"}`} />
                      {idx < tracking.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="font-medium">{evt.evento.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500">{new Date(evt.created_at).toLocaleString("es-PY")}</p>
                      {evt.latitud != null && evt.longitud != null && <p className="text-xs text-gray-400">{evt.latitud.toFixed(4)}, {evt.longitud.toFixed(4)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : delivery ? <p className="text-sm text-gray-400 text-center py-4">Sin eventos de tracking aún</p>
              : <p className="text-sm text-gray-400 text-center py-4">Sin delivery asignado</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => generatePedidoTicket({ ...p, items: p.items || [], total: p.total || 0 }, "InteliMarket").print()}
            className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700"><Printer className="w-4 h-4 inline mr-1" />Ticket</button>
          {canAssignDelivery && (
            <button onClick={onShowDelivery} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"><Truck className="w-4 h-4 inline mr-1" />Asignar Delivery</button>
          )}
          {p.estado === "en_preparacion" && (
            <button onClick={() => handleAction("marcar_listo")} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"><CheckCircle className="w-4 h-4 inline mr-1" />Marcar Listo</button>
          )}
          {canRendir && (
            <button onClick={onShowRendir} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"><CheckCircle className="w-4 h-4 inline mr-1" />Rendir</button>
          )}
          {!["facturado", "cancelado"].includes(p.estado) && (
            <button onClick={() => handleAction("cancelar")} className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600"><XCircle className="w-4 h-4 inline mr-1" />Cancelar</button>
          )}
          <button onClick={() => setWaOpen(!waOpen)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"><MessageCircle className="w-4 h-4 inline mr-1" />WhatsApp</button>
        </div>
        {waOpen && (
          <div className="mt-3 flex gap-2">
            <input type="text" value={waMessage} onChange={e => setWaMessage(e.target.value)} placeholder="Escribe un mensaje..."
              className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
            <button onClick={handleSendWhatsApp} disabled={!waMessage.trim() || waSending}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {waSending ? <Spinner /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AssignDeliveryModal({ pedido, onClose, onAssigned }: { pedido: Pedido; onClose: () => void; onAssigned: () => void }) {
  const [driverId, setDriverId] = useState("")
  const [drivers, setDrivers] = useState<TrackDriver[]>([])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { intelientregasApi.drivers.list({ activo: true }).then(setDrivers).catch(() => {}) }, [])

  async function handleAssign() {
    setSaving(true)
    try {
      await boutiqueApi.assignDelivery(pedido.id, { driver_id: driverId || undefined })
      toast.success("Delivery asignado", `Pedido ${pedido.numero} → InteliEntregas`); onAssigned()
    } catch { toast.error("Error", "No se pudo asignar delivery") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Asignar Delivery</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-1">Pedido: <strong>{pedido.numero}</strong></p>
        <p className="text-xs text-gray-400 mb-4">ID: {pedido.id}</p>
        <select className="input-field w-full" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">Driver automático</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.nombre} {d.status === "available" ? "(Disponible)" : `(${d.status})`}</option>)}
        </select>
        {drivers.length === 0 && <p className="text-xs text-amber-600 mt-2">No hay drivers activos — asignación automática</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleAssign} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Asignar"}</button>
        </div>
      </div>
    </div>
  )
}

function RendirModal({ pedido, onClose, onDone }: { pedido: Pedido; onClose: () => void; onDone: () => void }) {
  const [conforme, setConforme] = useState(true)
  const [emitirFactura, setEmitirFactura] = useState(true)
  const [observaciones, setObservaciones] = useState("")
  const [saving, setSaving] = useState(false)
  const [tipoComprobante, setTipoComprobante] = useState("ticket")
  const [condicion, setCondicion] = useState("contado")
  const toast = useToast()

  async function handleRendir() {
    setSaving(true)
    try {
      await boutiqueApi.rendir(pedido.id, { cliente_conforme: conforme, emitir_factura: emitirFactura, observaciones, tipo_comprobante: tipoComprobante, condicion })
      toast.success("Rendición completada", conforme ? "Cliente conforme" : "Pedido rechazado"); onDone()
    } catch { toast.error("Error", "No se pudo rendir") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rendir Entrega</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-1">Pedido: <strong>{pedido.numero}</strong> — Total: {formatPYG(pedido.total)}</p>
        <div className="flex gap-3 my-4">
          <button onClick={() => setConforme(true)} className={`flex-1 p-3 rounded-lg text-sm font-bold ${conforme ? "bg-green-100 text-green-700 border-2 border-green-500" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}><CheckCircle className="w-5 h-5 inline mr-1" />Conforme</button>
          <button onClick={() => setConforme(false)} className={`flex-1 p-3 rounded-lg text-sm font-bold ${!conforme ? "bg-red-100 text-red-700 border-2 border-red-500" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}><XCircle className="w-5 h-5 inline mr-1" />No conforme</button>
        </div>
        {conforme && <>
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={emitirFactura} onChange={(e) => setEmitirFactura(e.target.checked)} className="rounded" />Emitir factura SIFEN</label>
          {emitirFactura && <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select className="input-field w-full" value={tipoComprobante} onChange={(e) => setTipoComprobante(e.target.value)}>
                <option value="ticket">Ticket</option><option value="factura">Factura</option><option value="nota_credito">Nota de crédito</option><option value="nota_debito">Nota de débito</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Condición</label>
              <select className="input-field w-full" value={condicion} onChange={(e) => setCondicion(e.target.value)}>
                <option value="contado">Contado</option><option value="credito">Crédito</option>
              </select></div>
          </div>}
        </>}
        <textarea className="input-field w-full" placeholder="Observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleRendir} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Confirmar Rendición"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== SALES SUBTAB ====================
function SalesSubTab() {
  const [sales, setSales] = useState<BoutSale[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.listSales({ page, page_size: 20 })
      .then(res => { setSales(res.items); setTotal(res.total) })
      .catch(() => toast.error("Error", "No se pudieron cargar las ventas"))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr className="text-xs text-gray-500 uppercase">
            <th className="text-left px-4 py-3">Código</th>
            <th className="text-left px-4 py-3">Cliente</th>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-right px-4 py-3">Total</th>
            <th className="text-center px-4 py-3">Tipo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {sales.map((s) => (
            <tr key={s.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-4 py-3 font-medium">{s.codigo}</td>
              <td className="px-4 py-3 text-gray-500">{getCustomerName(s.customer_id)}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(s.fecha).toLocaleDateString("es-PY")}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">{formatPYG(s.total)}</td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">{s.tipo_venta}</span>
              </td>
            </tr>
          ))}
          {sales.length === 0 && (
            <tr><td colSpan={5} className="text-center py-8 text-gray-400">No hay ventas registradas</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex justify-center gap-2 p-4">
        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
          <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 rounded text-sm ${page === i + 1 ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{i + 1}</button>
        ))}
      </div>
    </div>
  )
}

// ==================== RETURNS SUBTAB ====================
function ReturnsSubTab() {
  const [returns, setReturns] = useState<BoutReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.listReturns({ page, page_size: 20 })
      .then(res => { setReturns(res.items); setTotal(res.total) })
      .catch(() => toast.error("Error", "No se pudieron cargar las devoluciones"))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr className="text-xs text-gray-500 uppercase">
            <th className="text-left px-4 py-3">Código</th>
            <th className="text-left px-4 py-3">Motivo</th>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-center px-4 py-3">Estado</th>
            <th className="text-right px-4 py-3">Reintegro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {returns.map((r) => (
            <tr key={r.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-4 py-3 font-medium">{r.codigo}</td>
              <td className="px-4 py-3 text-gray-500">{r.motivo}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(r.fecha).toLocaleDateString("es-PY")}</td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.estado === "completado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{r.estado}</span>
              </td>
              <td className="px-4 py-3 text-right font-mono">{r.total_reintegro != null ? formatPYG(r.total_reintegro) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ==================== CLIENTES ====================
function ClientesTab() {
  const [profiles, setProfiles] = useState<BoutClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.listClientProfiles({ page: 1, page_size: 50 })
      .then(res => setProfiles(res.items))
      .catch(() => toast.error("Error", "No se pudieron cargar los perfiles"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search ? profiles.filter(p =>
    p.customer_id.toLowerCase().includes(search.toLowerCase()) ||
    (p.estilo && p.estilo.toLowerCase().includes(search.toLowerCase()))
  ) : profiles

  if (selectedId) return <ClientDetail customerId={selectedId} onBack={() => setSelectedId(null)} />

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input-field pl-10 w-full" placeholder="Buscar por ID de cliente o estilo..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Users className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay perfiles de clientes</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedId(p.customer_id)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-5 h-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">Cliente</p>
                  <p className="text-xs text-gray-400 truncate">{p.customer_id}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>{p.total_compras} compras</span>
                <span>•</span>
                <span>{formatPYG(p.total_gastado)}</span>
                {p.estilo && <><span>•</span><span>{p.estilo}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const [profile, setProfile] = useState<BoutClientProfile | null>(null)
  const [interactions, setInteractions] = useState<BoutInteraction[]>([])
  const [measurements, setMeasurements] = useState<BoutMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [showInteraction, setShowInteraction] = useState(false)
  const [showMeasurement, setShowMeasurement] = useState(false)
  const [subtab, setSubtab] = useState<"profile" | "interactions" | "measurements">("profile")
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      boutiqueApi.getClientProfile(customerId).catch(() => null),
      boutiqueApi.listInteractions(customerId).catch(() => ({ items: [] as BoutInteraction[] })),
      boutiqueApi.getMeasurements(customerId).catch(() => []),
    ]).then(([p, i, m]) => {
      setProfile(p); setInteractions(i?.items || []); setMeasurements(m || [])
    }).finally(() => setLoading(false))
  }, [customerId])

  async function handleUpsertProfile(data: any) {
    try {
      await boutiqueApi.upsertClientProfile(customerId, data)
      const updated = await boutiqueApi.getClientProfile(customerId)
      setProfile(updated)
      toast.success("Perfil actualizado")
    } catch { toast.error("Error", "No se pudo actualizar el perfil") }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-primary font-medium flex items-center gap-1"><ChevronRight className="w-3 h-3 rotate-180" /> Volver a clientes</button>

      <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-1 w-fit">
        {(["profile", "interactions", "measurements"] as const).map((s) => (
          <button key={s} onClick={() => setSubtab(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${subtab === s ? "bg-primary text-white" : "text-gray-500 hover:text-gray-700"}`}>
            {s === "profile" ? "Perfil" : s === "interactions" ? "Interacciones" : "Medidas"}
          </button>
        ))}
      </div>

      {subtab === "profile" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Perfil del Cliente</h3>
          {profile ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium ml-1">{profile.tipo_cliente}</span></div>
              <div><span className="text-gray-500">Estilo:</span> <span className="font-medium ml-1">{profile.estilo || "—"}</span></div>
              <div><span className="text-gray-500">Género preferido:</span> <span className="font-medium ml-1">{profile.genero_preferido || "—"}</span></div>
              <div><span className="text-gray-500">Temporada:</span> <span className="font-medium ml-1">{profile.temporada_preferida || "—"}</span></div>
              <div><span className="text-gray-500">Total compras:</span> <span className="font-medium ml-1">{profile.total_compras}</span></div>
              <div><span className="text-gray-500">Total gastado:</span> <span className="font-medium ml-1">{formatPYG(profile.total_gastado)}</span></div>
              {profile.ultima_visita && <div className="col-span-2"><span className="text-gray-500">Última visita:</span> <span className="font-medium ml-1">{new Date(profile.ultima_visita).toLocaleString("es-PY")}</span></div>}
              {profile.marcas_preferidas && profile.marcas_preferidas.length > 0 && (
                <div className="col-span-2"><span className="text-gray-500">Marcas preferidas:</span>
                  <div className="flex gap-1 mt-1">{profile.marcas_preferidas.map(m => <span key={m} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{m}</span>)}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin perfil aún. Creá uno para este cliente.</p>
          )}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Actualizar Perfil</h4>
            <div className="grid grid-cols-2 gap-3">
              <select id="pf-estilo" className="input-field text-sm" onChange={(e) => handleUpsertProfile({ estilo: e.target.value })}>
                <option value="">Estilo</option>
                <option value="casual">Casual</option><option value="formal">Formal</option>
                <option value="deportivo">Deportivo</option><option value="elegante">Elegante</option>
                <option value="alternativo">Alternativo</option>
              </select>
              <select id="pf-genero" className="input-field text-sm" onChange={(e) => handleUpsertProfile({ genero_preferido: e.target.value })}>
                <option value="">Género preferido</option>
                <option value="hombre">Hombre</option><option value="mujer">Mujer</option>
                <option value="unisex">Unisex</option>
              </select>
              <input id="pf-marcas" className="input-field text-sm" placeholder="Marcas (coma separada)"
                onBlur={(e) => { if (e.target.value) handleUpsertProfile({ marcas_preferidas: e.target.value.split(",").map(s => s.trim()) }) }} />
              <input id="pf-cumple" className="input-field text-sm" type="date" placeholder="Cumpleaños"
                onChange={(e) => { if (e.target.value) handleUpsertProfile({ cumpleanos: e.target.value }) }} />
            </div>
          </div>
        </div>
      )}

      {subtab === "interactions" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Interacciones</h3>
            <button onClick={() => setShowInteraction(true)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Nueva</button>
          </div>
          {interactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin interacciones registradas</p>
          ) : (
            <div className="space-y-2">
              {interactions.map((ix) => (
                <div key={ix.id} className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{ix.tipo}</span>
                      {ix.canal && <span className="text-xs text-gray-400">{ix.canal}</span>}
                    </div>
                    {ix.notas && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{ix.notas}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(ix.fecha).toLocaleDateString("es-PY")}</span>
                </div>
              ))}
            </div>
          )}
          {showInteraction && (
            <InteractionForm customerId={customerId} onClose={() => setShowInteraction(false)} onCreated={() => {
              setShowInteraction(false)
              boutiqueApi.listInteractions(customerId).then(res => setInteractions(res.items)).catch(() => {})
            }} />
          )}
        </div>
      )}

      {subtab === "measurements" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Medidas Corporales</h3>
            <button onClick={() => setShowMeasurement(true)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Agregar</button>
          </div>
          {measurements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin medidas registradas</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {measurements.map((m) => (
                <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {m.contorno_busto && <div><span className="text-gray-500">Busto:</span> <span className="font-medium">{m.contorno_busto} cm</span></div>}
                    {m.contorno_cintura && <div><span className="text-gray-500">Cintura:</span> <span className="font-medium">{m.contorno_cintura} cm</span></div>}
                    {m.contorno_cadera && <div><span className="text-gray-500">Cadera:</span> <span className="font-medium">{m.contorno_cadera} cm</span></div>}
                    {m.largo_espalda && <div><span className="text-gray-500">Espalda:</span> <span className="font-medium">{m.largo_espalda} cm</span></div>}
                    {m.largo_manga && <div><span className="text-gray-500">Manga:</span> <span className="font-medium">{m.largo_manga} cm</span></div>}
                    {m.talle && <div><span className="text-gray-500">Talle:</span> <span className="font-medium">{m.talle}</span></div>}
                  </div>
                  {m.notas && <p className="text-xs text-gray-400 mt-2">{m.notas}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(m.fecha_tomada || m.created_at).toLocaleDateString("es-PY")}</p>
                </div>
              ))}
            </div>
          )}
          {showMeasurement && (
            <MeasurementForm customerId={customerId} onClose={() => setShowMeasurement(false)} onCreated={() => {
              setShowMeasurement(false)
              boutiqueApi.getMeasurements(customerId).then(setMeasurements).catch(() => {})
            }} />
          )}
        </div>
      )}
    </div>
  )
}

function InteractionForm({ customerId, onClose, onCreated }: { customerId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ tipo: "consulta", canal: "tienda", notas: "", proximo_seguimiento: "" })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    setSaving(true)
    try {
      await boutiqueApi.createInteraction({ customer_id: customerId, ...form, proximo_seguimiento: form.proximo_seguimiento || undefined })
      toast.success("Interacción registrada"); onCreated()
    } catch { toast.error("Error", "No se pudo registrar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Nueva Interacción</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="consulta">Consulta</option><option value="compra">Compra</option>
            <option value="devolucion">Devolución</option><option value="seguimiento">Seguimiento</option>
            <option value="evento">Evento</option><option value="queja">Queja</option>
            <option value="otro">Otro</option>
          </select>
          <select className="input-field w-full" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
            <option value="tienda">Tienda</option><option value="whatsapp">WhatsApp</option>
            <option value="telefono">Teléfono</option><option value="email">Email</option>
            <option value="evento">Evento</option><option value="instagram">Instagram</option>
          </select>
          <textarea className="input-field w-full" rows={3} placeholder="Notas..." value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Próximo seguimiento</label>
            <input className="input-field w-full" type="date" value={form.proximo_seguimiento} onChange={(e) => setForm({ ...form, proximo_seguimiento: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Registrar"}</button>
        </div>
      </div>
    </div>
  )
}

function MeasurementForm({ customerId, onClose, onCreated }: { customerId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ contorno_busto: "", contorno_cintura: "", contorno_cadera: "", largo_espalda: "", largo_manga: "", talle: "", tipo_prenda: "", notas: "" })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    setSaving(true)
    try {
      const data: any = { customer_id: customerId, tipo_prenda: form.tipo_prenda || undefined, talle: form.talle || undefined, notas: form.notas || undefined }
      if (form.contorno_busto) data.contorno_busto = parseFloat(form.contorno_busto)
      if (form.contorno_cintura) data.contorno_cintura = parseFloat(form.contorno_cintura)
      if (form.contorno_cadera) data.contorno_cadera = parseFloat(form.contorno_cadera)
      if (form.largo_espalda) data.largo_espalda = parseFloat(form.largo_espalda)
      if (form.largo_manga) data.largo_manga = parseFloat(form.largo_manga)
      await boutiqueApi.createMeasurement(data)
      toast.success("Medidas guardadas"); onCreated()
    } catch { toast.error("Error", "No se pudieron guardar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Agregar Medidas</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "contorno_busto", label: "Busto (cm)" },
            { key: "contorno_cintura", label: "Cintura (cm)" },
            { key: "contorno_cadera", label: "Cadera (cm)" },
            { key: "largo_espalda", label: "Espalda (cm)" },
            { key: "largo_manga", label: "Manga (cm)" },
            { key: "talle", label: "Talle" },
          ].map(f => (
            <div key={f.key}><label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input className="input-field w-full" value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /></div>
          ))}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Prenda</label>
            <input className="input-field w-full" value={form.tipo_prenda} onChange={(e) => setForm({ ...form, tipo_prenda: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <input className="input-field w-full" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Guardar"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== LOYALTY ====================
function LoyaltyTab() {
  const [config, setConfig] = useState<BoutLoyaltyConfig | null>(null)
  const [customerId, setCustomerId] = useState("")
  const [account, setAccount] = useState<BoutLoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeemPuntos, setRedeemPuntos] = useState(0)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.getLoyaltyConfig()
      .then(c => setConfig(c))
      .catch(() => boutiqueApi.createLoyaltyConfig().then(setConfig).catch(() => {}))
      .finally(() => setLoading(false))
  }, [])

  async function loadAccount() {
    if (!customerId.trim()) return
    setBusy(true)
    try {
      const acct = await boutiqueApi.getLoyaltyAccount(customerId)
      setAccount(acct)
    } catch { toast.error("Error", "No se encontró cuenta para ese cliente") }
    finally { setBusy(false) }
  }

  async function handleRedeem() {
    if (!account || redeemPuntos <= 0) return
    setBusy(true)
    try {
      await boutiqueApi.redeemPoints(account.customer_id, redeemPuntos)
      toast.success("Canje exitoso", `${redeemPuntos} puntos canjeados`)
      loadAccount()
      setRedeemPuntos(0)
    } catch { toast.error("Error", "No se pudieron canjear los puntos") }
    finally { setBusy(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-4 h-4" />Configuración</h3>
        {config ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center"><p className="text-xs text-gray-500">Puntos × 1000 Gs</p><p className="text-lg font-bold text-blue-600">{config.puntos_por_1000 || 1}</p></div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center"><p className="text-xs text-gray-500">Canje 1000 pts</p><p className="text-lg font-bold text-green-600">{formatPYG(config.canje_1000_puntos || 0)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="flex justify-between"><span>Bronze</span><span className="font-medium">×{config.multiplier_bronze || 1}</span></div>
              <div className="flex justify-between"><span>Plata</span><span className="font-medium">×{config.multiplier_plata || 1}</span></div>
              <div className="flex justify-between"><span>Oro</span><span className="font-medium">×{config.multiplier_oro || 1}</span></div>
              <div className="flex justify-between"><span>Platino</span><span className="font-medium">×{config.multiplier_platino || 1}</span></div>
            </div>
          </div>
        ) : <p className="text-sm text-gray-400">Sin configuración</p>}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><AwardIcon className="w-4 h-4" />Cuenta de Cliente</h3>
        <div className="flex gap-2 mb-4">
          <input className="input-field flex-1" placeholder="Customer ID..." value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <button onClick={loadAccount} disabled={busy || !customerId.trim()} className="btn-primary">{busy ? <Spinner /> : "Buscar"}</button>
        </div>
        {account && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Disponibles</p><p className="text-xl font-bold text-indigo-600">{account.puntos_disponibles}</p></div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Acumulados</p><p className="text-xl font-bold text-amber-600">{account.puntos_acumulados}</p></div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Canjeados</p><p className="text-xl font-bold text-green-600">{account.puntos_canjeados}</p></div>
            </div>
            <p className="text-sm text-gray-500">Gasto total: <span className="font-bold">{formatPYG(account.gasto_total)}</span></p>
            <div className="flex gap-2">
              <input className="input-field flex-1" type="number" placeholder="Puntos a canjear..." value={redeemPuntos} onChange={(e) => setRedeemPuntos(parseInt(e.target.value) || 0)} />
              <button onClick={handleRedeem} disabled={busy || redeemPuntos <= 0 || redeemPuntos > (account.puntos_disponibles || 0)} className="btn-primary">{busy ? <Spinner /> : "Canjear"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== MARKDOWN ====================
function MarkdownTab() {
  const [rules, setRules] = useState<BoutMarkdownRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.listMarkdownRules()
      .then(setRules)
      .catch(() => toast.error("Error", "No se pudieron cargar reglas"))
      .finally(() => setLoading(false))
  }, [])

  async function handleApply(ruleId: string) {
    setApplying(ruleId)
    try {
      const res = await boutiqueApi.applyMarkdown(ruleId)
      toast.success("Markdown aplicado", `Resultado: ${JSON.stringify(res)}`)
    } catch { toast.error("Error", "No se pudo aplicar markdown") }
    finally { setApplying(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva Regla</button>
      </div>
      {rules.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Percent className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay reglas de markdown</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{r.nombre}</p>
                  <p className="text-xs text-gray-400">{r.codigo} • {r.tipo}</p>
                </div>
                <button onClick={() => handleApply(r.id)} disabled={applying === r.id}
                  className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-medium hover:bg-primary/20 disabled:opacity-50">
                  {applying === r.id ? <Spinner /> : "Aplicar"}
                </button>
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>Dcto: {r.descuento_minimo}%–{r.descuento_maximo}%</span>
                {r.temporada && <span>• {r.temporada}</span>}
                {r.dias_antes_fin_temporada && <span>• {r.dias_antes_fin_temporada}d antes</span>}
              </div>
              {r.factor_rotacion_minimo != null && <p className="text-xs text-gray-400 mt-1">Rotación min: {r.factor_rotacion_minimo}</p>}
            </div>
          ))}
        </div>
      )}
      {showCreate && <MarkdownForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); boutiqueApi.listMarkdownRules().then(setRules).catch(() => {}) }} />}
    </div>
  )
}

function MarkdownForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ codigo: "", nombre: "", tipo: "temporada", temporada: "", descuento_maximo: 70, descuento_minimo: 5, dias_antes_fin_temporada: 30, factor_rotacion_minimo: 0.5, prioridad: 0 })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.codigo || !form.nombre) { toast.error("Error", "Código y nombre requeridos"); return }
    setSaving(true)
    try {
      await boutiqueApi.createMarkdownRule(form)
      toast.success("Regla creada"); onCreated()
    } catch { toast.error("Error", "No se pudo crear") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Nueva Regla de Markdown</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Código *</label><input className="input-field w-full" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label><input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="temporada">Temporada</option><option value="rotacion">Rotación</option>
              <option value="manual">Manual</option><option value="liquidacion">Liquidación</option>
            </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Temporada</label><input className="input-field w-full" value={form.temporada} onChange={(e) => setForm({ ...form, temporada: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Dto. Min %</label><input className="input-field w-full" type="number" value={form.descuento_minimo} onChange={(e) => setForm({ ...form, descuento_minimo: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Dto. Max %</label><input className="input-field w-full" type="number" value={form.descuento_maximo} onChange={(e) => setForm({ ...form, descuento_maximo: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Días antes fin</label><input className="input-field w-full" type="number" value={form.dias_antes_fin_temporada} onChange={(e) => setForm({ ...form, dias_antes_fin_temporada: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Rotación min</label><input className="input-field w-full" type="number" step="0.1" value={form.factor_rotacion_minimo} onChange={(e) => setForm({ ...form, factor_rotacion_minimo: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Crear"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== EVENTOS ====================
function EventosTab() {
  const [events, setEvents] = useState<BoutEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<BoutEvent | null>(null)
  const [guests, setGuests] = useState<BoutEventGuest[]>([])
  const [showGuest, setShowGuest] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    boutiqueApi.listEvents()
      .then(setEvents)
      .catch(() => toast.error("Error", "No se pudieron cargar eventos"))
      .finally(() => setLoading(false))
  }, [])

  async function loadGuests(eventId: string) {
    try {
      const g = await boutiqueApi.listEventGuests(eventId)
      setGuests(g)
    } catch { toast.error("Error", "No se pudieron cargar invitados") }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo Evento</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay eventos</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev) => (
            <div key={ev.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="h-24 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-purple-400" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{ev.nombre}</p>
                    <p className="text-xs text-gray-400">{ev.codigo}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${ev.estado === "activo" ? "bg-green-100 text-green-700" : ev.estado === "borrador" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>{ev.estado}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p><CalendarDays className="w-3 h-3 inline mr-1" />{new Date(ev.fecha_inicio).toLocaleDateString("es-PY")} {ev.fecha_fin ? `- ${new Date(ev.fecha_fin).toLocaleDateString("es-PY")}` : ""}</p>
                  {ev.ubicacion && <p><MapPin className="w-3 h-3 inline mr-1" />{ev.ubicacion}</p>}
                  {ev.invitados != null && <p><Users className="w-3 h-3 inline mr-1" />{ev.invitados} invitados {ev.capacidad_maxima ? `/ ${ev.capacidad_maxima}` : ""}</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setSelectedEvent(ev); loadGuests(ev.id) }}
                    className="flex-1 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary/20">
                    Ver Invitados
                  </button>
                  <button onClick={() => { setSelectedEvent(ev); setShowGuest(true) }}
                    className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                    + Invitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <EventForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); boutiqueApi.listEvents().then(setEvents).catch(() => {}) }} />}

      {selectedEvent && !showGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Invitados — {selectedEvent.nombre}</h3>
              <button onClick={() => setSelectedEvent(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            {guests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin invitados aún</p>
            ) : (
              <div className="space-y-2">
                {guests.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{g.customer_id}</p>
                      <p className="text-xs text-gray-400">{g.acompanantes} acompañante(s)</p>
                    </div>
                    <div className="flex gap-1">
                      {g.confirmado && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Confirmado</span>}
                      {g.asistio && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Asistió</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showGuest && selectedEvent && (
        <GuestForm eventId={selectedEvent.id} onClose={() => { setShowGuest(false); setSelectedEvent(null) }} onCreated={() => {
          setShowGuest(false)
          if (selectedEvent) loadGuests(selectedEvent.id)
        }} />
      )}
    </div>
  )
}

function EventForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    codigo: "", nombre: "", tipo: "lanzamiento", descripcion: "",
    fecha_inicio: "", fecha_fin: "", ubicacion: "", capacidad_maxima: 100, estado: "borrador",
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.codigo || !form.nombre || !form.fecha_inicio) { toast.error("Error", "Código, nombre y fecha inicio requeridos"); return }
    setSaving(true)
    try {
      await boutiqueApi.createEvent({
        ...form,
        fecha_inicio: form.fecha_inicio ? new Date(form.fecha_inicio).toISOString() : undefined,
        fecha_fin: form.fecha_fin ? new Date(form.fecha_fin).toISOString() : undefined,
      })
      toast.success("Evento creado"); onCreated()
    } catch { toast.error("Error", "No se pudo crear") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Nuevo Evento</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Código *</label><input className="input-field w-full" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label><input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="lanzamiento">Lanzamiento</option><option value="temporada">Temporada</option>
              <option value="vip">VIP</option><option value="liquidacion">Liquidación</option>
              <option value="desfile">Desfile</option>
            </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select className="input-field w-full" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              <option value="borrador">Borrador</option><option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option>
            </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha Inicio *</label><input className="input-field w-full" type="datetime-local" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha Fin</label><input className="input-field w-full" type="datetime-local" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Ubicación</label><input className="input-field w-full" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label><textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Capacidad Máxima</label><input className="input-field w-full" type="number" value={form.capacidad_maxima} onChange={(e) => setForm({ ...form, capacidad_maxima: parseInt(e.target.value) || 0 })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Crear Evento"}</button>
        </div>
      </div>
    </div>
  )
}

function GuestForm({ eventId, onClose, onCreated }: { eventId: string; onClose: () => void; onCreated: () => void }) {
  const [customerId, setCustomerId] = useState("")
  const [acompanantes, setAcompanantes] = useState(1)
  const [notas, setNotas] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!customerId.trim()) { toast.error("Error", "Customer ID requerido"); return }
    setSaving(true)
    try {
      await boutiqueApi.addEventGuest(eventId, { customer_id: customerId, acompanantes, notas: notas || undefined })
      toast.success("Invitado agregado"); onCreated()
    } catch { toast.error("Error", "No se pudo invitar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Invitar Cliente</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Customer ID *</label><input className="input-field w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Acompañantes</label><input className="input-field w-full" type="number" value={acompanantes} onChange={(e) => setAcompanantes(parseInt(e.target.value) || 0)} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notas</label><input className="input-field w-full" value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Invitar"}</button>
        </div>
      </div>
    </div>
  )
}
