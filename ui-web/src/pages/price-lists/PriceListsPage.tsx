import React, { useState, useEffect } from "react"
import {
  LayoutDashboard, List, Package, Users, Layers, Plus, X, Loader2, RefreshCw,
  Pencil, Trash2, Tag, ChevronRight, ArrowUpRight, Sparkles, Filter, CheckCircle2,
  Search, Save, DollarSign,
  type LucideIcon,
} from "lucide-react"
import { api, COMPANY_ID, type PriceList, type PriceListItem, type Product, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabKey = "dashboard" | "lists" | "items" | "assignments" | "tiers" | "margen"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard",   label: "Dashboard Ejecutivo", icon: LayoutDashboard },
  { key: "lists",       label: "Listas de Precios",   icon: List },
  { key: "items",       label: "Precios por Producto", icon: Package },
  { key: "assignments", label: "Asignaciones & Grupos", icon: Users },
  { key: "tiers",       label: "Escalones por Volumen", icon: Layers },
  { key: "margen",      label: "Editor de Margen",    icon: DollarSign },
]

export default function PriceListsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")
  const [lists, setLists] = useState<PriceList[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function loadLists() {
    try {
      setLists(await api.priceLists.list())
    } catch {}
  }

  useEffect(() => { loadLists() }, [])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    await loadLists()
    setRefreshing(false)
  }

  const activeLists = lists.filter(l => l.activo !== false)
  const clientLists = lists.filter(l => l.tipo === "cliente")
  const groupLists = lists.filter(l => l.tipo === "grupo")

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/90 text-white p-7 border border-sky-500/20 shadow-2xl shadow-sky-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 border border-sky-400/30 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <List className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase bg-sky-500/10 px-2.5 py-0.5 rounded-md border border-sky-500/20">
                    ESTRATEGIA TARIFARIA · SEGMENTACIÓN & MAYORISTA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    {activeLists.length} Listas Tarifarias Activas
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Listas de Precios & Escalamiento por Volumen
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Tarifas diferenciales para mayoristas, grupos comerciales, convenios y descuentos por escala de compra
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-sky-300">
                🏷️ {lists.length} listas configuradas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                👥 {clientLists.length} convenios exclusivos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Listas</span>
              <span className="text-[10px] font-bold text-sky-400">Tarifario</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-sky-300">
              {lists.length}
            </p>
            <p className="text-[11px] text-slate-400">Listas comerciales en catálogo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Listas Activas</span>
              <span className="text-[10px] font-bold text-emerald-400">Vigentes</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {activeLists.length}
            </p>
            <p className="text-[11px] text-slate-400">En uso en cajas y pedidos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Listas por Grupo</span>
              <span className="text-[10px] font-bold text-purple-400">Canales</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {groupLists.length}
            </p>
            <p className="text-[11px] text-slate-400">Segmentación mayorista</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Convenios Especiales</span>
              <span className="text-[10px] font-mono text-amber-400">1-a-1</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-300">
              {clientLists.length}
            </p>
            <p className="text-[11px] text-slate-400">Clientes con tarifa cerrada</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ SUBTABS ══════════════════════ */}
      {tab === "dashboard"    && <DashboardTab lists={lists} />}
      {tab === "lists"        && <ListsTab lists={lists} reload={loadLists} />}
      {tab === "items"        && <ItemsTab lists={lists} />}
      {tab === "assignments"  && <AssignmentsTab lists={lists} />}
      {tab === "tiers"        && <TieredPricesTab lists={lists} />}
      {tab === "margen"       && <MargenEditorTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> }

function resolveCustomerLabel(c: Customer): string {
  return c.nombre || (c as any).nombre_fantasia || c.razon_social || "Sin nombre"
}

function useDebouncedSearch<T>(searchFn: (q: string) => Promise<T[]>, query: string, minLen = 2, delayMs = 300) {
  const [results, setResults] = useState<T[]>([])
  useEffect(() => {
    if (query.trim().length < minLen) { setResults([]); return }
    const timer = setTimeout(() => {
      searchFn(query).then(setResults).catch(() => setResults([]))
    }, delayMs)
    return () => clearTimeout(timer)
  }, [query])
  return results
}

function ProductPicker({ productId, productLabel, onChange }: { productId: string; productLabel: string; onChange: (id: string, label: string) => void }) {
  const [search, setSearch] = useState("")
  const results = useDebouncedSearch<Product>((q) => api.products.list({ search: q }), search)
  return (
    <div className="relative">
      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Producto</label>
      <input
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
        placeholder="Buscar producto por nombre o SKU..."
        value={productId && !search ? productLabel : search}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange("", "") }}
      />
      {results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center"
              onClick={() => { onChange(p.id, p.nombre); setSearch("") }}
            >
              <span className="font-bold text-slate-900 dark:text-white">{p.nombre}</span>
              <span className="font-mono text-emerald-600 font-bold text-[11px]">{formatPYG(p.precio || 0)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerPicker({ customerId, customerLabel, onChange }: { customerId: string; customerLabel: string; onChange: (id: string, label: string) => void }) {
  const [search, setSearch] = useState("")
  const results = useDebouncedSearch<Customer>((q) => api.customers.list({ search: q }), search)
  return (
    <div className="relative">
      <label className="block text-xs font-black uppercase text-slate-400 mb-1">Cliente</label>
      <input
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
        placeholder="Buscar cliente por Razón Social o RUC..."
        value={customerId && !search ? customerLabel : search}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange("", "") }}
      />
      {results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center"
              onClick={() => { onChange(c.id, resolveCustomerLabel(c)); setSearch("") }}
            >
              <span className="font-bold text-slate-900 dark:text-white">{resolveCustomerLabel(c)}</span>
              <span className="font-mono text-slate-400 text-[11px]">{c.ruc ? `RUC ${c.ruc}` : c.ci ? `CI ${c.ci}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TipoRefFields({
  tipo, refId, refLabel, onRefChange, freeTextTypes, freeTextPlaceholders,
}: {
  tipo: string
  refId: string
  refLabel: string
  onRefChange: (id: string, label: string) => void
  freeTextTypes: string[]
  freeTextPlaceholders: Record<string, string>
}) {
  if (tipo === "cliente") {
    return <CustomerPicker customerId={refId} customerLabel={refLabel} onChange={onRefChange} />
  }
  if (freeTextTypes.includes(tipo)) {
    return (
      <div>
        <label className="block text-xs font-black uppercase text-slate-400 mb-1">{freeTextPlaceholders[tipo] || "Referencia"}</label>
        <input
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
          value={refId}
          onChange={(e) => onRefChange(e.target.value, e.target.value)}
          placeholder={freeTextPlaceholders[tipo] || ""}
        />
      </div>
    )
  }
  return null
}

function DashboardTab({ lists }: { lists: PriceList[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sky-500" />
          Estructura Tarifaria Comercial
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Las listas de precios permiten asignar márgenes y condiciones específicas a distintos canales de venta (Salón Minorista, Mayorista, Distribución, Kiosco) y asociar listas personalizadas a clientes corporativos con convenios vigentes.
        </p>
      </div>
    </div>
  )
}

function ListsTab({ lists, reload }: { lists: PriceList[]; reload: () => void }) {
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editList, setEditList] = useState<PriceList | null>(null)
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const toast = useToast()

  async function load() {
    setLoading(true)
    try { await reload() } catch { toast.error("Error", "No se pudieron cargar las listas") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const ids = Array.from(new Set(lists.filter(l => l.tipo === "cliente" && l.customer_id).map(l => l.customer_id as string)))
    const missing = ids.filter(id => !(id in customerNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.customers.get(id).then(c => [id, resolveCustomerLabel(c)] as const).catch(() => [id, id] as const)))
      .then(pairs => setCustomerNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [lists])

  async function handleDelete(listId: string) {
    try {
      await api.priceLists.delete(listId)
      toast.success("Eliminada", "Lista eliminada correctamente")
      load()
    } catch { toast.error("Error", "No se pudo eliminar la lista") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <button
          onClick={() => { setEditList(null); setShowModal(true) }}
          className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          Nueva Lista de Precios
        </button>

        <button onClick={load} className="p-2.5 text-slate-400 hover:text-sky-500 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Nombre de Lista</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Cliente / Grupo Destino</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                    <span>Cargando listas de precios...</span>
                  </td>
                </tr>
              ) : lists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    No hay listas de precios configuradas.
                  </td>
                </tr>
              ) : (
                lists.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{l.nombre}</td>
                    <td className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-wider">{l.tipo || "general"}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {l.tipo === "cliente" && l.customer_id ? (customerNames[l.customer_id] || "…") : l.tipo === "grupo" ? l.grupo : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${l.activo !== false ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                        {l.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => { setEditList(l); setShowModal(true) }} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(l.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <ListFormModal list={editList} onClose={() => { setShowModal(false); setEditList(null) }} onSaved={() => { setShowModal(false); setEditList(null); load() }} />}
    </div>
  )
}

function ListFormModal({ list, onClose, onSaved }: { list?: PriceList | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(list?.nombre || "")
  const [tipo, setTipo] = useState(list?.tipo || "general")
  const [customerId, setCustomerId] = useState(list?.customer_id || "")
  const [customerLabel, setCustomerLabel] = useState("")
  const [grupo, setGrupo] = useState(list?.grupo || "")
  const [activo, setActivo] = useState(list?.activo !== false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (list?.tipo === "cliente" && list.customer_id) {
      api.customers.get(list.customer_id).then(c => setCustomerLabel(resolveCustomerLabel(c))).catch(() => {})
    }
  }, [list])

  function handleTipoChange(next: string) {
    setTipo(next)
    setCustomerId(""); setCustomerLabel(""); setGrupo("")
  }

  async function handleSubmit() {
    if (!nombre.trim()) { toast.error("Error", "Nombre es requerido"); return }
    if (tipo === "cliente" && !customerId) { toast.error("Error", "Elegí un cliente"); return }
    if (tipo === "grupo" && !grupo.trim()) { toast.error("Error", "Ingresá el nombre del grupo"); return }
    setSaving(true)
    try {
      const payload = {
        nombre,
        tipo,
        customer_id: tipo === "cliente" ? customerId : null,
        grupo: tipo === "grupo" ? grupo : null,
        activo,
      }
      if (list) {
        await api.priceLists.update(list.id, payload)
        toast.success("Actualizada", "Lista actualizada correctamente")
      } else {
        await api.priceLists.create(payload)
        toast.success("Creada", "Lista creada correctamente")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar la lista") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{list ? "Editar Lista de Precios" : "Nueva Lista de Precios"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nombre *</label>
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Tipo</label>
            <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              <option value="general">General</option>
              <option value="grupo">Grupo</option>
              <option value="cliente">Cliente (Convenio Exclusivo)</option>
            </select>
          </div>
          <TipoRefFields
            tipo={tipo} refId={tipo === "cliente" ? customerId : grupo} refLabel={customerLabel}
            onRefChange={(id, label) => { if (tipo === "cliente") { setCustomerId(id); setCustomerLabel(label) } else { setGrupo(id) } }}
            freeTextTypes={["grupo"]} freeTextPlaceholders={{ grupo: "Nombre del grupo" }}
          />
          <label className="flex items-center gap-2 text-xs pt-1 font-bold"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="rounded" />Activo para ventas</label>
        </div>
        <div className="flex gap-2 pt-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20">
            {saving ? <Spinner /> : list ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemsTab({ lists }: { lists: PriceList[] }) {
  const [selectedListId, setSelectedListId] = useState("")
  const [items, setItems] = useState<PriceListItem[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<PriceListItem | null>(null)
  const toast = useToast()

  async function loadItems(listId: string) {
    setLoading(true)
    try {
      const data = await api.priceLists.items(listId)
      setItems(data)
    } catch { toast.error("Error", "No se pudieron cargar los items") }
    finally { setLoading(false) }
  }

  function onListChange(listId: string) {
    setSelectedListId(listId)
    if (listId) loadItems(listId)
    else setItems([])
  }

  useEffect(() => {
    const ids = Array.from(new Set(items.filter(i => i.product_id).map(i => i.product_id as string)))
    const missing = ids.filter(id => !(id in productNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.products.get(id).then(p => [id, p.nombre] as const).catch(() => [id, id] as const)))
      .then(pairs => setProductNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [items])

  async function handleRemoveItem(itemId: string) {
    try {
      await api.priceLists.removeItem(selectedListId, itemId)
      toast.success("Eliminado", "Item eliminado de la lista")
      loadItems(selectedListId)
    } catch { toast.error("Error", "No se pudo eliminar el item") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <select
          className="w-full sm:max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          value={selectedListId}
          onChange={(e) => onListChange(e.target.value)}
        >
          <option value="">Seleccionar lista de precios...</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre} {l.tipo && l.tipo !== "general" ? `(${l.tipo})` : ""}</option>
          ))}
        </select>

        {selectedListId && (
          <button
            onClick={() => { setEditItem(null); setShowModal(true) }}
            className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            Agregar Item
          </button>
        )}
      </div>

      {selectedListId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Producto</th>
                  <th className="p-4 text-right">Precio Diferencial</th>
                  <th className="p-4">Notas</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                      <span>Cargando productos de la lista...</span>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      Sin items configurados en esta lista.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{item.product_id ? (productNames[item.product_id] || "…") : "—"}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">{item.precio != null ? formatPYG(item.precio) : "—"}</td>
                      <td className="p-4 text-slate-500 text-[11px]">{item.notas || "—"}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.activo !== false ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                          {item.activo !== false ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => { setEditItem(item); setShowModal(true) }} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <List className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-sm">Seleccioná una lista de precios para gestionar sus artículos</p>
        </div>
      )}

      {showModal && selectedListId && (
        <ItemFormModal listId={selectedListId} item={editItem} productNames={productNames}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadItems(selectedListId) }} />
      )}
    </div>
  )
}

function ItemFormModal({ listId, item, productNames, onClose, onSaved }: { listId: string; item?: PriceListItem | null; productNames: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState(item?.product_id || "")
  const [productLabel, setProductLabel] = useState(item?.product_id ? (productNames[item.product_id] || "") : "")
  const [precio, setPrecio] = useState(item?.precio || 0)
  const [notas, setNotas] = useState(item?.notas || "")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!productId) { toast.error("Error", "Seleccioná un producto"); return }
    if (precio <= 0) { toast.error("Error", "El precio debe ser mayor a cero"); return }
    setSaving(true)
    try {
      if (item) {
        await api.priceLists.updateItem(listId, item.id, { precio, notas })
        toast.success("Actualizado", "Item actualizado correctamente")
      } else {
        await api.priceLists.addItem(listId, { product_id: productId, precio, notas, moneda: "PYG" })
        toast.success("Agregado", "Item agregado a la lista")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el item") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{item ? "Editar Item" : "Agregar Item a Lista"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 text-xs">
          {item ? (
            <div>
              <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Producto</label>
              <p className="text-xs font-bold py-2">{productLabel || productId}</p>
            </div>
          ) : (
            <ProductPicker productId={productId} productLabel={productLabel} onChange={(id, label) => { setProductId(id); setProductLabel(label) }} />
          )}
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Precio Diferencial (₲)</label>
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white" type="number" value={precio} onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Notas</label>
            <textarea className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20">
            {saving ? <Spinner /> : item ? "Actualizar" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  )
}

type Assignment = { id: string; company_id: string; price_list_id: string; tipo: string; ref_id: string; created_at: string }
const ASSIGNMENT_TIPOS = [
  { value: "cliente", label: "Cliente Específico" },
  { value: "grupo", label: "Grupo Comercial" },
  { value: "canal", label: "Canal de Venta" },
  { value: "zona", label: "Zona Geográfica" },
]
const ASSIGNMENT_PLACEHOLDERS: Record<string, string> = {
  grupo: "Nombre del grupo", canal: "Slug del canal", zona: "Nombre de la zona",
}

function AssignmentsTab({ lists }: { lists: PriceList[] }) {
  const [selectedListId, setSelectedListId] = useState("")
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const toast = useToast()

  async function loadAssignments(listId: string) {
    setLoading(true)
    try {
      const data = await api.smartPricing.listAssignments(COMPANY_ID, listId)
      setAssignments(data)
    } catch { toast.error("Error", "No se pudieron cargar las asignaciones") }
    finally { setLoading(false) }
  }

  function onListChange(listId: string) {
    setSelectedListId(listId)
    if (listId) loadAssignments(listId)
    else setAssignments([])
  }

  useEffect(() => {
    const ids = Array.from(new Set(assignments.filter(a => a.tipo === "cliente").map(a => a.ref_id)))
    const missing = ids.filter(id => !(id in customerNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.customers.get(id).then(c => [id, resolveCustomerLabel(c)] as const).catch(() => [id, id] as const)))
      .then(pairs => setCustomerNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [assignments])

  async function handleDelete(id: string) {
    try {
      await api.smartPricing.deleteAssignment(id)
      toast.success("Eliminada", "Asignación eliminada")
      loadAssignments(selectedListId)
    } catch { toast.error("Error", "No se pudo eliminar la asignación") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <select className="w-full sm:max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none" value={selectedListId} onChange={(e) => onListChange(e.target.value)}>
          <option value="">Seleccionar lista...</option>
          {lists.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
        </select>
        {selectedListId && (
          <button onClick={() => setShowModal(true)} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-sky-500/20">
            <Plus className="w-4 h-4" /> Nueva Asignación
          </button>
        )}
      </div>

      {selectedListId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Referencia / Entidad</th>
                  <th className="p-4">Creada</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr><td colSpan={4} className="p-12 text-center text-slate-400"><Spinner /></td></tr>
                ) : assignments.length === 0 ? (
                  <tr><td colSpan={4} className="p-12 text-center text-slate-400">Sin asignaciones para esta lista.</td></tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 uppercase text-[10px] font-black text-slate-500">{a.tipo}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{a.tipo === "cliente" ? (customerNames[a.ref_id] || "…") : a.ref_id}</td>
                      <td className="p-4 font-mono text-slate-400 text-[11px]">{a.created_at ? new Date(a.created_at).toLocaleDateString("es-PY") : "—"}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleDelete(a.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-sm">Seleccioná una lista para ver sus asignaciones</p>
        </div>
      )}

      {showModal && selectedListId && (
        <AssignmentFormModal listId={selectedListId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadAssignments(selectedListId) }} />
      )}
    </div>
  )
}

function AssignmentFormModal({ listId, onClose, onSaved }: { listId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState("cliente")
  const [refId, setRefId] = useState("")
  const [refLabel, setRefLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function handleTipoChange(next: string) {
    setTipo(next)
    setRefId(""); setRefLabel("")
  }

  async function handleSubmit() {
    if (!refId.trim()) { toast.error("Error", "Completá la referencia"); return }
    setSaving(true)
    try {
      await api.smartPricing.createAssignment({ price_list_id: listId, tipo, ref_id: refId })
      toast.success("Creada", "Asignación creada correctamente")
      onSaved()
    } catch { toast.error("Error", "No se pudo crear la asignación") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Nueva Asignación</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Tipo</label>
            <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              {ASSIGNMENT_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <TipoRefFields
            tipo={tipo} refId={refId} refLabel={refLabel}
            onRefChange={(id, label) => { setRefId(id); setRefLabel(label) }}
            freeTextTypes={["grupo", "canal", "zona"]} freeTextPlaceholders={ASSIGNMENT_PLACEHOLDERS}
          />
        </div>
        <div className="flex gap-2 pt-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20">
            {saving ? <Spinner /> : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

type TieredPriceDto = {
  id: string; company_id: string; price_list_id: string | null; product_id: string
  min_qty: number; max_qty: number | null; precio_unitario: number; moneda: string; activo: boolean
}

function TieredPricesTab({ lists }: { lists: PriceList[] }) {
  const [productId, setProductId] = useState("")
  const [productLabel, setProductLabel] = useState("")
  const [priceListId, setPriceListId] = useState("")
  const [tiers, setTiers] = useState<TieredPriceDto[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTier, setEditTier] = useState<TieredPriceDto | null>(null)
  const toast = useToast()

  async function loadTiers() {
    if (!productId) return
    setLoading(true)
    try {
      const data = await api.smartPricing.listTieredPrices(COMPANY_ID, productId, priceListId || undefined)
      setTiers(data)
    } catch { toast.error("Error", "No se pudieron cargar los precios por escalón") }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTiers() }, [productId, priceListId])

  async function handleDelete(id: string) {
    try {
      await api.smartPricing.deleteTieredPrice(id)
      toast.success("Eliminado", "Precio por escalón eliminado")
      loadTiers()
    } catch { toast.error("Error", "No se pudo eliminar") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <ProductPicker productId={productId} productLabel={productLabel} onChange={(id, label) => { setProductId(id); setProductLabel(label) }} />
        <div>
          <label className="block text-xs font-black uppercase text-slate-400 mb-1">Lista de Precios</label>
          <select className="w-full max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300" value={priceListId} onChange={(e) => setPriceListId(e.target.value)}>
            <option value="">Todas las listas (Escalón Global)</option>
            {lists.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
          </select>
        </div>
        {productId && (
          <button onClick={() => { setEditTier(null); setShowModal(true) }} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-sky-500/20">
            <Plus className="w-4 h-4" /> Nuevo Escalón
          </button>
        )}
      </div>

      {!productId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-sm">Seleccioná un producto para configurar escalones por volumen</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4 text-right">Cant. Mínima</th>
                  <th className="p-4 text-right">Cant. Máxima</th>
                  <th className="p-4 text-right">Precio Unitario</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400"><Spinner /></td></tr>
                ) : tiers.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400">Sin precios por escalón configurados.</td></tr>
                ) : (
                  tiers.sort((a, b) => a.min_qty - b.min_qty).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{t.min_qty} un.</td>
                      <td className="p-4 text-right font-mono text-slate-500">{t.max_qty ? `${t.max_qty} un.` : "Sin límite"}</td>
                      <td className="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{formatPYG(t.precio_unitario)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.activo !== false ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                          {t.activo !== false ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => { setEditTier(t); setShowModal(true) }} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && productId && (
        <TieredPriceFormModal productId={productId} priceListId={priceListId || null} tier={editTier} existingTiers={tiers}
          onClose={() => { setShowModal(false); setEditTier(null) }}
          onSaved={() => { setShowModal(false); setEditTier(null); loadTiers() }} />
      )}
    </div>
  )
}

function TieredPriceFormModal({
  productId, priceListId, tier, existingTiers, onClose, onSaved,
}: {
  productId: string; priceListId: string | null; tier?: TieredPriceDto | null; existingTiers: TieredPriceDto[]
  onClose: () => void; onSaved: () => void
}) {
  const [minQty, setMinQty] = useState(tier?.min_qty ?? 1)
  const [maxQty, setMaxQty] = useState<string>(tier?.max_qty != null ? String(tier.max_qty) : "")
  const [precioUnitario, setPrecioUnitario] = useState(tier?.precio_unitario ?? 0)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function overlaps(): boolean {
    const maxVal = maxQty.trim() ? parseInt(maxQty, 10) : Infinity
    return existingTiers
      .filter(t => t.id !== tier?.id)
      .some(t => {
        const tMax = t.max_qty ?? Infinity
        return minQty <= tMax && t.min_qty <= maxVal
      })
  }

  async function handleSubmit() {
    if (precioUnitario <= 0) { toast.error("Error", "El precio debe ser mayor a cero"); return }
    if (maxQty.trim() && parseInt(maxQty, 10) < minQty) { toast.error("Error", "La cantidad máxima no puede ser menor a la mínima"); return }
    if (overlaps()) { toast.error("Rango solapado", "Este escalón se superpone con uno ya existente"); return }
    setSaving(true)
    try {
      const maxQtyVal = maxQty.trim() ? parseInt(maxQty, 10) : null
      if (tier) {
        await api.smartPricing.updateTieredPrice(tier.id, { min_qty: minQty, max_qty: maxQtyVal, precio_unitario: precioUnitario })
        toast.success("Actualizado", "Precio por escalón actualizado")
      } else {
        await api.smartPricing.createTieredPrice({
          price_list_id: priceListId, product_id: productId,
          min_qty: minQty, max_qty: maxQtyVal, precio_unitario: precioUnitario, moneda: "PYG",
        })
        toast.success("Creado", "Precio por escalón creado")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el precio por escalón") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{tier ? "Editar Escalón" : "Nuevo Escalón por Volumen"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Cant. Mínima</label>
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-mono font-bold" type="number" min={1} value={minQty} onChange={(e) => setMinQty(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div>
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Cant. Máxima</label>
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-mono font-bold" type="number" placeholder="Sin límite" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Precio Unitario (₲)</label>
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm" type="number" value={precioUnitario} onChange={(e) => setPrecioUnitario(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20">
            {saving ? <Spinner /> : tier ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}


function MargenEditorTab() {
  const toast = useToast()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filterMargen, setFilterMargen] = useState<"ALL" | "LOW" | "HEALTHY" | "HIGH">("ALL")
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [newPrice, setNewPrice] = useState<number>(0)
  const [updating, setUpdating] = useState(false)

  const fetchProducts = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.products.list({ limit: 100 })
      if (Array.isArray(res) && res.length > 0) setProducts(res)
    } catch (err: any) {
      toast.error("Error al cargar productos", err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const productsWithMargin = React.useMemo(() => {
    return products.map((p) => {
      const precio = Number(p.precio ?? p.precio_venta ?? 0)
      const costo = Number(p.costo_promedio ?? p.ultimo_costo ?? p.costo_landed ?? (precio > 0 ? precio * 0.76 : 0))
      const margenGs = precio - costo
      const margenPct = precio > 0 ? (margenGs / precio) * 100 : 0
      return { ...p, precioCalculado: precio, costoCalculado: costo, margenGs, margenPct }
    })
  }, [products])

  const filteredProducts = React.useMemo(() => {
    return productsWithMargin.filter((p) => {
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      let matchMargen = true
      if (filterMargen === "LOW") matchMargen = p.margenPct < 15
      if (filterMargen === "HEALTHY") matchMargen = p.margenPct >= 15 && p.margenPct <= 30
      if (filterMargen === "HIGH") matchMargen = p.margenPct > 30
      return matchSearch && matchMargen
    })
  }, [productsWithMargin, search, filterMargen])

  const handleUpdatePrice = async () => {
    if (!selectedProduct || newPrice <= 0) return
    setUpdating(true)
    try {
      await api.products.update(selectedProduct.id, { precio_venta: newPrice, precio: newPrice })
      setProducts((prev) => prev.map((p) => (p.id === selectedProduct.id ? { ...p, precio: newPrice, precio_venta: newPrice } : p)))
      toast.success("¡Precio Actualizado!", `El precio de ${selectedProduct.nombre} ha cambiado a ${formatPYG(newPrice)}.`)
      setSelectedProduct(null)
    } catch (err: any) {
      toast.error("Error al actualizar precio", err.message)
    } finally {
      setUpdating(false)
    }
  }

  const totalProducts = productsWithMargin.length
  const lowMarginCount = productsWithMargin.filter((p) => p.margenPct < 15).length
  const healthyMarginCount = productsWithMargin.filter((p) => p.margenPct >= 15 && p.margenPct <= 30).length
  const highMarginCount = productsWithMargin.filter((p) => p.margenPct > 30).length

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          Editor de Margen por Producto
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Auditoría rápida de rentabilidad bruta por SKU (costo vs. precio de venta actual) y ajuste directo del precio -- para escalas por cantidad o listas de precio por canal/cliente, usá las pestañas &quot;Escalones por Volumen&quot; y &quot;Listas de Precios&quot;.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKUs analizados</span>
          <p className="text-xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen crítico (&lt;15%)</span>
          <p className="text-xl font-black font-mono text-rose-500 mt-1">{lowMarginCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen saludable</span>
          <p className="text-xl font-black font-mono text-sky-500 mt-1">{healthyMarginCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen alto (&gt;30%)</span>
          <p className="text-xl font-black font-mono text-purple-500 mt-1">{highMarginCount}</p>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5">
        {[
          { id: "ALL", label: "Todos", count: totalProducts },
          { id: "LOW", label: "Crítico (<15%)", count: lowMarginCount },
          { id: "HEALTHY", label: "Saludable (15-30%)", count: healthyMarginCount },
          { id: "HIGH", label: "Alto (>30%)", count: highMarginCount },
        ].map((t) => {
          const active = filterMargen === t.id
          return (
            <button
              key={t.id}
              onClick={() => setFilterMargen(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, SKU o código de barra..."
          className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white outline-none"
        />
        <button onClick={fetchProducts} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Producto / SKU</th>
                <th className="p-4 text-right">Costo Estimado</th>
                <th className="p-4 text-right">Precio Venta</th>
                <th className="p-4 text-right">Margen (₲)</th>
                <th className="p-4 text-center">Margen (%)</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />Analizando márgenes...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">No se encontraron productos coincidentes.</td></tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.margenPct < 15
                  const isHealthy = p.margenPct >= 15 && p.margenPct <= 30
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white max-w-[240px] truncate">{p.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.sku || p.codigo_barra || `SKU-${p.id.slice(0, 6)}`}</p>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-500 text-[11px]">{formatPYG(p.costoCalculado)}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(p.precioCalculado)}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatPYG(p.margenGs)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${isLow ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" : isHealthy ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"}`}>
                          {p.margenPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => { setSelectedProduct(p); setNewPrice(p.precioCalculado) }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-[11px] transition"
                        >
                          Ajustar Precio
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Ajustar Precio</h3>
                <p className="text-xs text-slate-400 truncate max-w-[220px]">{selectedProduct.nombre}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Costo Base:</span><span className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG(selectedProduct.costoCalculado)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Precio Actual:</span><span className="font-mono text-slate-500">{formatPYG(selectedProduct.precioCalculado)} ({selectedProduct.margenPct.toFixed(1)}%)</span></div>
              </div>
              <div>
                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nuevo Precio de Venta (₲)</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-base font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none"
                />
              </div>
              {newPrice > 0 && (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Margen Simulado:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{(((newPrice - selectedProduct.costoCalculado) / newPrice) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    <span>Ganancia Bruta:</span>
                    <span className="font-mono font-bold">{formatPYG(newPrice - selectedProduct.costoCalculado)} /un</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedProduct(null)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
              <button
                onClick={handleUpdatePrice}
                disabled={updating || newPrice <= 0}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar Nuevo Precio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
