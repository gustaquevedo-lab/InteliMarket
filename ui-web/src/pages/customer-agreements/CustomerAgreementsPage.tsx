import { useState, useEffect, useMemo } from "react"
import {
  BarChart3, Search, Plus, Loader2, CheckCircle, XCircle, AlertTriangle,
  DollarSign, Calendar, TrendingUp, TrendingDown, Clock, Zap, Shield,
  ChevronDown, Tag, Package, ArrowRight, Edit, Trash2, X, Building2,
  Users, Target, Percent, RefreshCw, Bell, Gauge, Eye, Download,
  Filter, LayoutGrid, ArrowUpDown, PieChart, Activity, BadgePercent,
  CreditCard, History, ArrowUpRight, Layers, Save, Copy
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"

type Tab = "dashboard" | "acuerdos" | "matriz" | "comparador" | "alertas" | "tendencias"

const formatPYG = (n?: number | string) => n != null ? "Gs " + Number(n).toLocaleString("es-PY") : "Gs 0"
const formatDate = (d?: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-PY", { timeZone: "UTC", day: "2-digit", month: "short", year: "2-digit" }) : "-"
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000) : null

const statusColors: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  borrador: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  vencido: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rescindido: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  cancelado: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}
const Badge = ({ s }: { s: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusColors[s] || "bg-gray-100 text-gray-500"}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
)

interface AgreementForm {
  customer_id: string; nombre: string; tipo: string; fecha_inicio: string; fecha_fin: string
  descuento_general_pct: number | ""; plazo_pago_dias: number; limite_credito: number | ""
  moneda: string; observaciones: string; archivo_url: string
  items: Array<{ product_id: string; nombre: string; precio_especial: number | ""; descuento_pct: number | ""; cantidad_minima: number | "" }>
}
const defaultForm = (): AgreementForm => ({
  customer_id: "", nombre: "", tipo: "precio_especial", fecha_inicio: "", fecha_fin: "",
  descuento_general_pct: "", plazo_pago_dias: 30, limite_credito: "", moneda: "PYG", observaciones: "", archivo_url: "",
  items: [],
})

export default function CustomerAgreementsPage() {
  const { user } = useAuth()
  const companyId = user?.tenant_id || ""
  const toast = useToast()

  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [agreements, setAgreements] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterTipo, setFilterTipo] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<AgreementForm>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [showProductPicker, setShowProductPicker] = useState(false)

  // Comparador
  const [compareA, setCompareA] = useState<string>("")
  const [compareB, setCompareB] = useState<string>("")

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredProducts = useMemo(() =>
    products.filter(p => !productSearch || p.nombre.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 50),
  [products, productSearch])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [agr, cust, prod] = await Promise.all([
        api.distribuidora.customerAgreements.list(companyId).catch(() => []),
        (api as any).customers?.list?.({ activo: true })?.catch(() => []) || [],
        (api as any).products?.list?.({ activo: true })?.catch(() => []) || [],
      ])
      setAgreements(agr)
      setCustomers(Array.isArray(cust) ? cust : [])
      setProducts(Array.isArray(prod) ? prod : [])
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { if (companyId) fetchAll() }, [companyId])

  // Analytics
  const analytics = useMemo(() => {
    const activos = agreements.filter(a => a.estado === "activo")
    const porVencer = agreements.filter(a => { const d = daysUntil(a.fecha_fin); return a.estado === "activo" && d !== null && d <= 30 && d > 0 })
    const vencidos = agreements.filter(a => a.estado === "vencido" || (daysUntil(a.fecha_fin) !== null && daysUntil(a.fecha_fin)! <= 0))
    const creditoTotal = agreements.filter(a => a.estado === "activo").reduce((s, a) => s + (Number(a.limite_credito || 0)), 0)
    const dtoPromedio = activos.length > 0 ? activos.reduce((s, a) => s + (Number(a.descuento_general_pct || 0)), 0) / activos.length : 0
    const byTipo = activos.reduce((acc: Record<string, number>, a) => { acc[a.tipo || "otro"] = (acc[a.tipo || "otro"] || 0) + 1; return acc }, {})
    return { activos: activos.length, porVencer: porVencer.length, vencidos: vencidos.length, creditoTotal, dtoPromedio: Math.round(dtoPromedio * 10) / 10, byTipo }
  }, [agreements])

  // Filters
  const filtered = useMemo(() => {
    let list = agreements
    if (search) list = list.filter(a => a.nombre?.toLowerCase().includes(search.toLowerCase()) || a.numero?.toLowerCase().includes(search.toLowerCase()) || a.customer?.nombre?.toLowerCase().includes(search.toLowerCase()))
    if (filterStatus !== "all") list = list.filter(a => a.estado === filterStatus)
    if (filterTipo !== "all") list = list.filter(a => a.tipo === filterTipo)
    return list
  }, [agreements, search, filterStatus, filterTipo])

  // ---- Form handlers ----
  const addItem = (p: any) => { if (form.items.find(i => i.product_id === p.id)) return; setForm(f => ({ ...f, items: [...f.items, { product_id: p.id, nombre: p.nombre, precio_especial: p.precio_venta || "", descuento_pct: "", cantidad_minima: "" }] })); setShowProductPicker(false); setProductSearch("") }
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i: number, k: string, v: any) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }))

  const openEdit = (a: any) => {
    setEditing(a)
    setForm({
      customer_id: a.customer_id || "", nombre: a.nombre || "", tipo: a.tipo || "precio_especial",
      fecha_inicio: a.fecha_inicio || "", fecha_fin: a.fecha_fin || "",
      descuento_general_pct: a.descuento_general_pct || "", plazo_pago_dias: a.plazo_pago_dias || 30,
      limite_credito: a.limite_credito || "", moneda: a.moneda || "PYG",
      observaciones: a.observaciones || "", archivo_url: a.archivo_url || "",
      items: (a.items || []).map((i: any) => ({ product_id: i.product_id, nombre: i.producto?.nombre || "", precio_especial: i.precio_especial || "", descuento_pct: i.descuento_pct || "", cantidad_minima: i.cantidad_minima || "" })),
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.customer_id || !form.nombre) { toast.error("Error", "Cliente y nombre son obligatorios"); return }
    setSaving(true)
    try {
      const payload = {
        ...form, descuento_general_pct: Number(form.descuento_general_pct) || 0,
        limite_credito: Number(form.limite_credito) || 0,
        items: form.items.map(i => ({ product_id: i.product_id, precio_especial: Number(i.precio_especial) || 0, descuento_pct: Number(i.descuento_pct) || 0, cantidad_minima: Number(i.cantidad_minima) || 0 })),
      }
      if (editing) {
        await api.distribuidora.customerAgreements.update(editing.id, payload)
        toast.success("Acuerdo actualizado")
      } else {
        await api.distribuidora.customerAgreements.create(companyId, payload)
        toast.success("Acuerdo creado")
      }
      setShowForm(false); setEditing(null); setForm(defaultForm()); fetchAll()
    } catch (e: any) { toast.error("Error", e.message || "No se pudo guardar") }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este acuerdo?")) return
    try { await api.distribuidora.customerAgreements.update(id, { estado: "cancelado" } as any); toast.success("Cancelado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) }
  }

  const toggleSelect = (id: string) => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s) }
  const bulkActivate = async () => { try { for (const id of selectedIds) { await api.distribuidora.customerAgreements.update(id, { estado: "activo" } as any) }; toast.success(`${selectedIds.size} acuerdos activados`); setSelectedIds(new Set()); fetchAll() } catch (e: any) { toast.error("Error", e.message) } }
  const bulkRenew = async () => { try { for (const id of selectedIds) { const a = agreements.find(x => x.id === id); if (a) { const end = new Date(a.fecha_fin + "T00:00:00"); await api.distribuidora.customerAgreements.update(id, { fecha_fin: new Date(end.setFullYear(end.getFullYear() + 1)).toISOString().slice(0, 10), estado: "activo" } as any) } }; toast.success(`${selectedIds.size} acuerdos renovados`); setSelectedIds(new Set()); fetchAll() } catch (e: any) { toast.error("Error", e.message) } }

  const getAlert = (d?: string) => {
    const days = daysUntil(d)
    if (days === null) return null
    if (days <= 0) return { color: "red", label: "Vencido", icon: AlertTriangle }
    if (days <= 15) return { color: "orange", label: `${days}d`, icon: Clock }
    if (days <= 30) return { color: "yellow", label: `${days}d`, icon: Clock }
    if (days <= 60) return { color: "blue", label: `${days}d`, icon: Calendar }
    return null
  }

  // Margin analysis: for each active agreement, calculate estimated margin
  const marginAnalysis = useMemo(() => {
    return agreements.filter(a => a.estado === "activo").map(a => {
      const items = a.items || []
      const totalLista = items.reduce((s: number, i: any) => s + (Number(i.precio_lista_referencia || 0) * (i.cantidad_minima || 1)), 0)
      const totalEspecial = items.reduce((s: number, i: any) => s + (Number(i.precio_especial || 0) * (i.cantidad_minima || 1)), 0)
      const margin = totalLista > 0 ? Math.round((1 - totalEspecial / totalLista) * 100) : 0
      return { ...a, totalLista, totalEspecial, margin }
    }).sort((a, b) => a.margin - b.margin)
  }, [agreements])

  const customerOptions = useMemo(() => {
    const seen = new Set()
    return customers.filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
  }, [customers])

  // ---- COMPONENTS ----

  const DashboardTab = () => (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Acuerdos Activos", value: analytics.activos, icon: FileText, color: "blue" },
          { label: "Por Vencer <30d", value: analytics.porVencer, icon: Bell, color: "orange" },
          { label: "Crédito Otorgado", value: formatPYG(analytics.creditoTotal), icon: CreditCard, color: "emerald" },
          { label: "Dto. Promedio", value: `${analytics.dtoPromedio}%`, icon: BadgePercent, color: "purple" },
          { label: "Vencidos", value: analytics.vencidos, icon: AlertTriangle, color: "red" },
        ].map((k, i) => (
          <div key={i} className="card p-5 hover:shadow-lg transition-shadow cursor-default">
            <div className="flex items-center gap-3"><div className={`w-11 h-11 rounded-xl bg-${k.color}-100 dark:bg-${k.color}-900/30 flex items-center justify-center`}><k.icon className={`w-5 h-5 text-${k.color}-600`} /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{k.label}</p><p className="text-lg font-bold truncate">{k.value}</p></div></div>
          </div>
        ))}
      </div>

      {/* Margin Guardian Cards */}
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-primary" />Margin Guardian — Acuerdos con menor margen</h3>
        <div className="grid grid-cols-4 gap-3">
          {marginAnalysis.slice(0, 4).map(a => {
            const isLow = a.margin < 15
            const isMedium = a.margin >= 15 && a.margin < 25
            return (
              <div key={a.id} className={`rounded-xl border p-4 ${isLow ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10" : isMedium ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10" : "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10"}`}>
                <p className="text-xs font-bold truncate">{a.nombre}</p>
                <p className="text-[10px] text-gray-400">{a.customer?.nombre || ""}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{formatPYG(a.totalEspecial)}</span>
                  <span className={`text-sm font-bold ${isLow ? "text-red-600" : isMedium ? "text-orange-600" : "text-emerald-600"}`}>{a.margin}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1"><div className={`h-full rounded-full ${isLow ? "bg-red-500" : isMedium ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(a.margin, 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Type Distribution */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4"><PieChart className="w-4 h-4 text-primary" />Distribución por Tipo</h3>
        <div className="flex gap-4">
          {Object.entries(analytics.byTipo).map(([tipo, count]) => (
            <div key={tipo} className="flex-1 bg-gray-50 dark:bg-slate-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{count as number}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{tipo.replace(/_/g, " ")}</p>
            </div>
          ))}
          {Object.keys(analytics.byTipo).length === 0 && <p className="text-sm text-gray-400 text-center w-full py-4">Sin acuerdos activos</p>}
        </div>
      </div>

      {/* Expiration Timeline */}
      {agreements.filter(a => { const al = getAlert(a.fecha_fin); return al && al.color !== "blue" }).length > 0 && (
        <div className="card p-5 border-l-4 border-l-orange-500">
          <h3 className="font-bold flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-orange-500" />Pipeline de Vencimientos</h3>
          <div className="grid grid-cols-3 gap-3">
            {agreements.filter(a => { const al = getAlert(a.fecha_fin); return al && al.color !== "blue" }).slice(0, 6).map(a => {
              const al = getAlert(a.fecha_fin)!
              return (
                <div key={a.id} className="bg-white dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-gray-600 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold truncate">{a.nombre}</p><al.icon className={`w-3 h-3 text-${al.color}-500`} /></div>
                  <p className="text-xs text-gray-400">{a.customer?.nombre || ""}</p>
                  <div className="flex items-center justify-between mt-2"><span className="text-xs text-gray-500">{formatDate(a.fecha_fin)}</span><span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${al.color}-100 text-${al.color}-700`}>{al.label}</span></div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const AcuerdosTab = () => (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-bold">{selectedIds.size} seleccionados</span>
          <div className="flex gap-2">
            <button onClick={bulkActivate} className="btn-outline text-xs"><Zap className="w-3.5 h-3.5" />Activar todos</button>
            <button onClick={bulkRenew} className="btn-outline text-xs"><RefreshCw className="w-3.5 h-3.5" />Renovar todos</button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-xs">Cancelar</button>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center text-gray-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" />Sin acuerdos con clientes. Creá tu primer acuerdo comercial.</div>
      ) : filtered.map(a => {
        const isExp = expandedId === a.id
        const items = a.items || []
        const dtoGral = Number(a.descuento_general_pct || 0)
        return (
          <div key={a.id} className="card overflow-hidden transition-shadow hover:shadow-md">
            <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExp ? null : a.id)}>
              <div className="flex items-start gap-4">
                <input type="checkbox" checked={selectedIds.has(a.id)} onChange={e => { e.stopPropagation(); toggleSelect(a.id) }} className="mt-1 rounded" onClick={e => e.stopPropagation()} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center"><Users className="w-5 h-5 text-white" /></div>
                      <div>
                        <p className="font-bold">{a.nombre}</p>
                        <p className="text-xs text-gray-400">{a.customer?.nombre || a.customer_id} · {formatDate(a.fecha_inicio)} → {formatDate(a.fecha_fin)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {dtoGral > 0 && <span className="text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full">{dtoGral}% dto.</span>}
                      {Number(a.limite_credito) > 0 && <span className="text-xs font-bold text-emerald-600">{formatPYG(a.limite_credito)} crédito</span>}
                      <div className="flex items-center gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{a.tipo?.replace(/_/g, " ")}</span><Badge s={a.estado} /></div>
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 mt-2 transition-transform ${isExp ? "rotate-180" : ""}`} />
              </div>
            </div>
            {isExp && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-5 bg-gray-50/50 dark:bg-slate-800/50 space-y-4">
                {/* Info grid */}
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div className="bg-white dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Plazo pago</p><p className="font-bold">{a.plazo_pago_dias || 30} días</p></div>
                  <div className="bg-white dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Límite crédito</p><p className="font-bold">{formatPYG(a.limite_credito)}</p></div>
                  <div className="bg-white dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Moneda</p><p className="font-bold">{a.moneda || "PYG"}</p></div>
                  <div className="bg-white dark:bg-slate-700 rounded-xl p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos</p><p className="font-bold">{items.length}</p></div>
                </div>
                {/* Price comparison table */}
                {items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-primary" />Comparativa de Precios</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-200 dark:border-gray-600"><th className="text-left py-2 px-3 font-bold text-gray-500">Producto</th><th className="text-right py-2 px-3 font-bold text-gray-500">Precio Lista</th><th className="text-right py-2 px-3 font-bold text-gray-500">Precio Especial</th><th className="text-right py-2 px-3 font-bold text-gray-500">Ahorro</th><th className="text-center py-2 px-3 font-bold text-gray-500">Dto. %</th><th className="text-center py-2 px-3 font-bold text-gray-500">Cant. Mín.</th></tr></thead>
                        <tbody>
                          {items.map((it: any, idx: number) => {
                            const lista = Number(it.precio_lista_referencia || 0)
                            const especial = Number(it.precio_especial || 0)
                            const ahorro = lista - especial
                            const pct = lista > 0 ? Math.round((ahorro / lista) * 100) : 0
                            return (
                              <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-2 px-3 font-medium">{it.producto?.nombre || it.nombre || it.product_id}</td>
                                <td className="py-2 px-3 text-right font-mono text-gray-500">{formatPYG(lista)}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-primary">{formatPYG(especial)}</td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-600">{ahorro > 0 ? `-${formatPYG(ahorro)}` : "-"}</td>
                                <td className="py-2 px-3 text-center"><span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{pct}%</span></td>
                                <td className="py-2 px-3 text-center font-mono">{it.cantidad_minima || "-"}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {a.observaciones && <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400"><span className="font-bold">Notas:</span> {a.observaciones}</div>}
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(a) }} className="btn-outline text-xs"><Edit className="w-3.5 h-3.5" />Editar</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }} className="btn-outline text-xs text-red-500"><Trash2 className="w-3.5 h-3.5" />Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const MatrizTab = () => {
    const activeAgreements = agreements.filter(a => a.estado === "activo")
    const allItems = activeAgreements.flatMap(a => (a.items || []).map((i: any) => ({ ...i, agreementId: a.id, agreementNombre: a.nombre, customerNombre: a.customer?.nombre || "" })))
    const uniqueProducts = [...new Map(allItems.map(i => [i.product_id, i])).values()].slice(0, 20)
    const matrixCustomers = activeAgreements.slice(0, 15)
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 bg-gray-50 dark:bg-slate-700 z-10">
                <th className="text-left py-3 px-3 font-bold text-gray-500 sticky left-0 bg-gray-50 dark:bg-slate-700 z-20 min-w-[180px]">Cliente \ Producto</th>
                {uniqueProducts.map(p => <th key={p.product_id as string} className="text-center py-3 px-3 font-bold text-gray-500 whitespace-nowrap max-w-[120px]"><span className="truncate block" title={p.nombre || p.producto?.nombre || ""}>{(p.nombre || p.producto?.nombre || "").slice(0, 20)}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {matrixCustomers.map(c => {
                const cItems = allItems.filter(i => i.agreementId === c.id)
                return (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-3 font-bold sticky left-0 bg-white dark:bg-slate-800 z-10">{c.customer?.nombre || c.nombre}</td>
                    {uniqueProducts.map(p => {
                      const item = cItems.find(i => i.product_id === p.product_id)
                      if (!item) return <td key={p.product_id as string} className="text-center py-3 px-3 text-gray-300">—</td>
                      const lista = Number(item.precio_lista_referencia || 0)
                      const especial = Number(item.precio_especial || 0)
                      const pct = lista > 0 ? Math.round((1 - especial / lista) * 100) : 0
                      const intensity = pct <= 5 ? "bg-red-100 text-red-700" : pct <= 15 ? "bg-orange-100 text-orange-700" : pct <= 30 ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"
                      return <td key={p.product_id as string} className="text-center py-3 px-1"><span className={`text-[10px] px-2 py-1 rounded-full font-bold ${intensity}`}>{pct}%</span></td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-700 text-xs">
          <span className="text-gray-500">Leyenda:</span>
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">0-5% (Riesgo)</span>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">5-15%</span>
          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">15-30%</span>
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">30%+ (Sano)</span>
        </div>
      </div>
    )
  }

  const ComparadorTab = () => {
    const a1 = agreements.find(a => a.id === compareA)
    const a2 = agreements.find(a => a.id === compareB)
    const commonProducts = a1 && a2 ? (a1.items || []).filter((i1: any) => (a2.items || []).some((i2: any) => i2.product_id === i1.product_id)) : []
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label text-xs font-bold">Cliente A</label>
            <select className="input-field" value={compareA} onChange={e => setCompareA(e.target.value)}>
              <option value="">Seleccionar...</option>
              {agreements.filter(a => a.estado === "activo").map(a => <option key={a.id} value={a.id}>{a.customer?.nombre || a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label text-xs font-bold">Cliente B</label>
            <select className="input-field" value={compareB} onChange={e => setCompareB(e.target.value)}>
              <option value="">Seleccionar...</option>
              {agreements.filter(a => a.estado === "activo" && a.id !== compareA).map(a => <option key={a.id} value={a.id}>{a.customer?.nombre || a.nombre}</option>)}
            </select>
          </div>
        </div>
        {a1 && a2 && (
          <div className="card p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2"><ArrowUpDown className="w-4 h-4 text-primary" />{a1.customer?.nombre || a1.nombre} vs {a2.customer?.nombre || a2.nombre}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-sky-50 dark:bg-sky-950/20 rounded-xl p-4 border border-sky-200 dark:border-sky-800"><p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Cliente A</p><p className="font-bold">{a1.customer?.nombre || a1.nombre}</p><p className="text-xs text-gray-500 mt-1">Dto: {a1.descuento_general_pct || 0}% · Crédito: {formatPYG(a1.limite_credito)} · Plazo: {a1.plazo_pago_dias}d</p></div>
              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800"><p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Cliente B</p><p className="font-bold">{a2.customer?.nombre || a2.nombre}</p><p className="text-xs text-gray-500 mt-1">Dto: {a2.descuento_general_pct || 0}% · Crédito: {formatPYG(a2.limite_credito)} · Plazo: {a2.plazo_pago_dias}d</p></div>
            </div>
            {commonProducts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-200 dark:border-gray-600"><th className="text-left py-2 px-3 font-bold">Producto</th><th className="text-right py-2 px-3 font-bold text-sky-600">{a1.customer?.nombre?.split(" ")[0] || "A"}</th><th className="text-right py-2 px-3 font-bold text-purple-600">{a2.customer?.nombre?.split(" ")[0] || "B"}</th><th className="text-right py-2 px-3 font-bold">Diferencia</th><th className="text-center py-2 px-3 font-bold">¿Mejor precio?</th></tr></thead>
                  <tbody>
                    {commonProducts.map((cp: any) => {
                      const i2 = (a2.items || []).find((i: any) => i.product_id === cp.product_id)
                      const p1 = Number(cp.precio_especial || 0)
                      const p2 = Number(i2?.precio_especial || 0)
                      const diff = p1 - p2
                      return (
                        <tr key={cp.product_id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 px-3 font-medium">{(cp.nombre || cp.producto?.nombre || "")}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPYG(p1)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPYG(p2)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${diff < 0 ? "text-emerald-600" : diff > 0 ? "text-red-600" : "text-gray-400"}`}>{diff !== 0 ? (diff < 0 ? "-" : "+") + formatPYG(Math.abs(diff)) : "Igual"}</td>
                          <td className="py-2 px-3 text-center">{diff < 0 ? <span className="text-xs font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">{a1.customer?.nombre?.split(" ")[0]}</span> : diff > 0 ? <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{a2.customer?.nombre?.split(" ")[0]}</span> : <span className="text-xs text-gray-400">Igual</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {commonProducts.length === 0 && <p className="text-center py-8 text-gray-400">Sin productos en común entre estos clientes</p>}
          </div>
        )}
      </div>
    )
  }

  const AlertasTab = () => {
    const alerts = agreements.flatMap(a => {
      const result: any[] = []
      const days = daysUntil(a.fecha_fin)
      if (a.estado === "activo" && days !== null && days <= 60) result.push({ ...a, type: "expiration", days, severity: days <= 0 ? "critical" : days <= 15 ? "high" : days <= 30 ? "medium" : "low" })
      const items = a.items || []
      items.forEach((i: any) => {
        const lista = Number(i.precio_lista_referencia || 0)
        const especial = Number(i.precio_especial || 0)
        if (lista > 0) {
          const margin = Math.round((1 - especial / lista) * 100)
          if (margin < 10) result.push({ ...a, type: "low_margin", product: i.producto?.nombre || i.nombre, margin, severity: margin < 5 ? "critical" : "high" })
        }
      })
      return result
    })
    const critical = alerts.filter(a => a.severity === "critical")
    const high = alerts.filter(a => a.severity === "high")
    const medium = alerts.filter(a => a.severity === "medium")
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-red-600">{critical.length}</p><p className="text-xs font-black uppercase tracking-widest text-red-400 mt-1">Críticas</p></div>
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-orange-600">{high.length}</p><p className="text-xs font-black uppercase tracking-widest text-orange-400 mt-1">Altas</p></div>
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-yellow-600">{medium.length}</p><p className="text-xs font-black uppercase tracking-widest text-yellow-400 mt-1">Medias</p></div>
        </div>
        {alerts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400"><CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-500" />No hay alertas activas</div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 30).map((a, idx) => {
              const sev = a.severity === "critical" ? { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800", text: "text-red-700" } : a.severity === "high" ? { bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700" } : a.severity === "medium" ? { bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-700" } : { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700" }
              return (
                <div key={`${a.id}-${idx}`} className={`rounded-xl border p-4 ${sev.bg} ${sev.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    {a.type === "expiration" ? <Clock className={`w-5 h-5 ${sev.text}`} /> : <AlertTriangle className={`w-5 h-5 ${sev.text}`} />}
                    <div>
                      <p className="text-sm font-bold">{a.type === "expiration" ? `Acuerdo por vencer` : `Margen bajo en ${a.product}`}</p>
                      <p className="text-xs text-gray-500">{a.customer?.nombre || a.nombre} · {a.type === "expiration" ? `Vence en ${a.days} días (${formatDate(a.fecha_fin)})` : `Margen: ${a.margin}%`}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(a)} className="btn-outline text-xs">Revisar</button>
                    {a.type === "expiration" && <button onClick={async () => { try { await api.distribuidora.customerAgreements.update(a.id, { estado: "activo", fecha_fin: new Date(new Date(a.fecha_fin).setFullYear(new Date(a.fecha_fin).getFullYear() + 1)).toISOString().slice(0, 10) } as any); toast.success("Renovado"); fetchAll() } catch (e: any) { toast.error("Error", e.message) } }} className="btn-primary text-xs">Renovar</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const TendenciasTab = () => (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Top Clientes por Volumen de Acuerdo</h3>
        <div className="space-y-3">
          {agreements.filter(a => a.estado === "activo").sort((a, b) => (Number(b.limite_credito || 0)) - (Number(a.limite_credito || 0))).slice(0, 8).map((a, idx) => {
            const max = Number(agreements.filter(x => x.estado === "activo")[0]?.limite_credito || 1)
            const pct = max > 0 ? Math.round((Number(a.limite_credito || 0) / max) * 100) : 0
            return (
              <div key={a.id} className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 w-6">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1"><span className="text-sm font-bold">{a.customer?.nombre || a.nombre}</span><span className="text-xs font-mono">{formatPYG(a.limite_credito)}</span></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full" style={{ width: `${Math.max(pct, 5)}%` }} /></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Descuento Promedio por Tipo</h3>
          <div className="space-y-2">
            {Object.entries(agreements.filter(a => a.estado === "activo").reduce((acc: Record<string, number[]>, a) => { const t = a.tipo || "otro"; if (!acc[t]) acc[t] = []; acc[t].push(Number(a.descuento_general_pct || 0)); return acc }, {})).map(([t, vals]) => (
              <div key={t} className="flex items-center gap-3"><span className="text-xs font-bold w-28 text-right">{t.replace(/_/g, " ")}</span><div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((vals.reduce((s, v) => s + v, 0) / vals.length) * 2, 100)}%` }} /></div><span className="text-xs font-mono w-14">{(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)}%</span></div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4 text-orange-500" />Próximos Vencimientos</h3>
          <div className="space-y-2">
            {agreements.filter(a => a.estado === "activo" && daysUntil(a.fecha_fin) !== null).sort((a, b) => (daysUntil(a.fecha_fin) || 999) - (daysUntil(b.fecha_fin) || 999)).slice(0, 10).map(a => {
              const d = daysUntil(a.fecha_fin)!
              const pct = Math.max(0, Math.min(100, ((365 - d) / 365) * 100))
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-20 text-right text-gray-500">{formatDate(a.fecha_fin)}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"><div className={`h-full rounded-full ${d <= 30 ? "bg-red-500" : d <= 60 ? "bg-orange-500" : "bg-blue-400"}`} style={{ width: `${pct}%` }} /></div>
                  <span className="text-xs font-mono w-10 text-right">{d}d</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acuerdos con Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Precios especiales, descuentos, crédito y fidelización B2B</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setForm(defaultForm()); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo acuerdo</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {([{ k: "dashboard" as Tab, l: "Dashboard", i: BarChart3 }, { k: "acuerdos" as Tab, l: "Acuerdos", i: Users }, { k: "matriz" as Tab, l: "Matriz Precios", i: LayoutGrid }, { k: "comparador" as Tab, l: "Comparador", i: ArrowUpDown }, { k: "alertas" as Tab, l: "Alertas", i: Bell }, { k: "tendencias" as Tab, l: "Tendencias", i: Activity }]).map(({ k, l, i: Icon }) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}><Icon className="w-4 h-4" />{l}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="input-field pl-10" placeholder="Buscar por nombre, cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input-field w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Todos los estados</option><option value="activo">Activo</option><option value="borrador">Borrador</option><option value="vencido">Vencido</option><option value="cancelado">Cancelado</option></select>
        <select className="input-field w-auto" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}><option value="all">Todos los tipos</option><option value="precio_especial">Precio Especial</option><option value="descuento_volumen">Descuento Volumen</option><option value="bonificacion">Bonificación</option><option value="promocion">Promoción</option><option value="contrato">Contrato</option></select>
      </div>

      {/* Content */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> :
        tab === "dashboard" ? <DashboardTab /> :
        tab === "acuerdos" ? <AcuerdosTab /> :
        tab === "matriz" ? <MatrizTab /> :
        tab === "comparador" ? <ComparadorTab /> :
        tab === "alertas" ? <AlertasTab /> :
        <TendenciasTab />}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? "Editar Acuerdo" : "Nuevo Acuerdo con Cliente"}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="input-label label-required">Cliente</label><select className="input-field" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}><option value="">Seleccionar cliente...</option>{customerOptions.map((c: any) => <option key={c.id} value={c.id}>{c.nombre || c.razon_social}</option>)}</select></div>
                <div className="col-span-2"><label className="input-label label-required">Nombre del acuerdo</label><input className="input-field" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Precio Especial Hotel Sheraton" /></div>
                <div><label className="input-label">Tipo</label><select className="input-field" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}><option value="precio_especial">Precio Especial</option><option value="descuento_volumen">Descuento por Volumen</option><option value="bonificacion">Bonificación</option><option value="promocion">Promoción</option><option value="contrato">Contrato Formal</option></select></div>
                <div><label className="input-label">Moneda</label><select className="input-field" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}><option value="PYG">PYG (Gs)</option><option value="USD">USD ($)</option></select></div>
                <div><label className="input-label label-required">Inicio</label><input type="date" className="input-field" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
                <div><label className="input-label label-required">Fin</label><input type="date" className="input-field" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
                <div><label className="input-label">Descuento general (%)</label><input type="number" className="input-field" value={form.descuento_general_pct} onChange={e => setForm(f => ({ ...f, descuento_general_pct: e.target.value }))} min="0" max="100" step="0.5" /></div>
                <div><label className="input-label">Plazo pago (días)</label><input type="number" className="input-field" value={form.plazo_pago_dias} onChange={e => setForm(f => ({ ...f, plazo_pago_dias: +e.target.value }))} /></div>
                <div><label className="input-label">Límite crédito</label><input type="number" className="input-field" value={form.limite_credito} onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))} /></div>
                <div><label className="input-label">Archivo URL</label><input className="input-field" value={form.archivo_url} onChange={e => setForm(f => ({ ...f, archivo_url: e.target.value }))} placeholder="https://..." /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-sm">Productos del Acuerdo ({form.items.length})</h3><button onClick={() => { setShowProductPicker(true); setProductSearch("") }} className="btn-outline text-xs"><Plus className="w-3.5 h-3.5" />Agregar</button></div>
                {form.items.map((it, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold">{it.nombre}</span><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Precio especial</label><input type="number" className="input-field text-xs" value={it.precio_especial} onChange={e => updateItem(idx, "precio_especial", e.target.value)} /></div>
                      <div><label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Dto. %</label><input type="number" className="input-field text-xs" value={it.descuento_pct} onChange={e => updateItem(idx, "descuento_pct", e.target.value)} /></div>
                      <div><label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Cant. mín.</label><input type="number" className="input-field text-xs" value={it.cantidad_minima} onChange={e => updateItem(idx, "cantidad_minima", e.target.value)} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div><label className="input-label">Observaciones</label><textarea className="input-field" rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="btn-outline">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Guardar" : "Crear acuerdo"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowProductPicker(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between"><h3 className="font-bold">Productos</h3><button onClick={() => setShowProductPicker(false)} className="btn-ghost"><X className="w-4 h-4" /></button></div>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700"><input className="input-field" placeholder="Buscar..." autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)} /></div>
            <div className="flex-1 overflow-y-auto">
              {filteredProducts.map(p => <button key={p.id} onClick={() => addItem(p)} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between border-b border-gray-50 dark:border-gray-700"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" /><div><p className="text-sm font-bold">{p.nombre}</p><p className="text-xs text-gray-400">{p.sku}</p></div></div><span className="text-xs font-mono text-primary">{formatPYG(p.precio_venta)}</span></button>)}
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-center"><p className="text-xs text-gray-400 flex items-center justify-center gap-1"><History className="w-3 h-3" />Historial de cambios disponible próximamente para cada acuerdo individual</p></div>
    </div>
  )
}
