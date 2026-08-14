import { useState, useEffect } from "react"
import { ClipboardList, TrendingUp, Search, CheckCircle, XCircle, RefreshCw, AlertTriangle, Coins, Loader2, Settings, Zap, Plus, Check, X } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "suggestions" | "rules" | "crossdock"

interface Suggestion {
  id: string
  producto_id: string
  producto_nombre?: string | null
  proveedor_id?: string | null
  proveedor_nombre?: string | null
  stock_actual: number
  stock_pendiente_recibir: number
  demanda_diaria_avg?: number | null
  demanda_pronosticada?: number | null
  cantidad_sugerida: number
  costo_unitario_estimado?: number | null
  costo_total_estimado?: number | null
  oc_generada: boolean
  oc_numero?: string | null
  estado: string
}

interface Dashboard {
  reglas_activas: number
  sugerencias_pendientes: number
  sugerencias_aprobadas: number
  productos_criticos: number
  crossdock_hoy: number
}

const emptyRuleForm = {
  producto_id: "",
  producto_nombre: "",
  proveedor_preferente_id: "",
  lead_time_dias: 2,
  stock_seguridad_dias: 3,
  stock_seguridad_unidades: "",
  lote_economico: "",
  multiplo_pedido: "",
  metodo_pronostico: "promedio",
  activa: true,
}

const emptyCrossdockForm = {
  producto_id: "",
  producto_nombre: "",
  proveedor_id: "",
  cantidad: "",
  fecha_crossdock: new Date().toISOString().slice(0, 10),
  destino: "gondola",
}

export default function AutoReplenishPage() {
  const [tab, setTab] = useState<Tab>("suggestions")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [crossdock, setCrossdock] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [search, setSearch] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState(emptyRuleForm)
  const [productQuery, setProductQuery] = useState("")
  const [productResults, setProductResults] = useState<any[]>([])
  const [showCrossdockModal, setShowCrossdockModal] = useState(false)
  const [crossdockForm, setCrossdockForm] = useState(emptyCrossdockForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const dash = await api.replenishment.dashboard()
      setDashboard(dash)
      if (tab === "suggestions") setSuggestions(await api.replenishment.suggestions.list({ estado: "pendiente" }))
      if (tab === "rules") setRules(await api.replenishment.rules.list())
      if (tab === "crossdock") setCrossdock(await api.replenishment.crossdock.list())
    } catch (e) {
      toast.error("Error", "No se pudo cargar la información de reabastecimiento")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab])

  useEffect(() => {
    if (!showRuleModal && !showCrossdockModal) return
    api.purchases.suppliers().then(setSuppliers).catch(() => {})
  }, [showRuleModal, showCrossdockModal])

  useEffect(() => {
    if (productQuery.trim().length < 2) { setProductResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: productQuery }).then((res) => setProductResults(res.slice(0, 8))).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  const handleToggleSelect = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleToggleAll = () => {
    if (selectedItems.length === filteredSuggestions.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredSuggestions.map((s) => s.id))
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const nuevas = await api.replenishment.generate({})
      toast.success("Sugerencias generadas", `Se generaron ${nuevas.length} sugerencias nuevas a partir de las reglas activas`)
      load()
    } catch (e) {
      toast.error("Error", "No se pudieron generar sugerencias. ¿Hay reglas de reabastecimiento configuradas?")
    } finally {
      setGenerating(false)
    }
  }

  const handleReview = async (accion: "aprobar" | "rechazar") => {
    if (selectedItems.length === 0) {
      toast.error("Sin selección", "Seleccioná al menos una sugerencia")
      return
    }
    try {
      await Promise.all(selectedItems.map((id) => api.replenishment.suggestions.review(id, { accion })))
      toast.success(accion === "aprobar" ? "Aprobadas" : "Rechazadas", `${selectedItems.length} sugerencias actualizadas`)
      setSelectedItems([])
      load()
    } catch (e) {
      toast.error("Error", "No se pudo actualizar el estado de las sugerencias")
    }
  }

  const handleCreateRule = async () => {
    if (!ruleForm.producto_id) { toast.error("Falta producto", "Elegí un producto real de la lista"); return }
    setSaving(true)
    try {
      await api.replenishment.rules.create({
        producto_id: ruleForm.producto_id,
        proveedor_preferente_id: ruleForm.proveedor_preferente_id || undefined,
        lead_time_dias: Number(ruleForm.lead_time_dias),
        stock_seguridad_dias: Number(ruleForm.stock_seguridad_dias),
        stock_seguridad_unidades: ruleForm.stock_seguridad_unidades ? Number(ruleForm.stock_seguridad_unidades) : undefined,
        lote_economico: ruleForm.lote_economico ? Number(ruleForm.lote_economico) : undefined,
        multiplo_pedido: ruleForm.multiplo_pedido ? Number(ruleForm.multiplo_pedido) : undefined,
        metodo_pronostico: ruleForm.metodo_pronostico,
        activa: ruleForm.activa,
      })
      toast.success("Regla creada", `Reabastecimiento configurado para ${ruleForm.producto_nombre}`)
      setShowRuleModal(false)
      setRuleForm(emptyRuleForm)
      setProductQuery("")
      load()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo crear la regla")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCrossdock = async () => {
    if (!crossdockForm.producto_id || !crossdockForm.cantidad) { toast.error("Faltan datos", "Elegí un producto y una cantidad"); return }
    setSaving(true)
    try {
      await api.replenishment.crossdock.create({
        producto_id: crossdockForm.producto_id,
        proveedor_id: crossdockForm.proveedor_id || undefined,
        cantidad: Number(crossdockForm.cantidad),
        fecha_crossdock: crossdockForm.fecha_crossdock,
        destino: crossdockForm.destino,
      })
      toast.success("Orden de Cross-Dock creada")
      setShowCrossdockModal(false)
      setCrossdockForm(emptyCrossdockForm)
      setProductQuery("")
      load()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo crear la orden")
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteCrossdock = async (id: string) => {
    try {
      const res = await api.replenishment.crossdock.complete(id)
      setCrossdock((prev) => prev.map((c) => (c.id === id ? { ...c, ...res } : c)))
      toast.success("Cross-dock completado")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo completar la orden")
    }
  }

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !search ||
      (s.producto_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.proveedor_nombre || "").toLowerCase().includes(search.toLowerCase())
  )

  const filteredRules = rules.filter((r) => !search || (r.producto_nombre || "").toLowerCase().includes(search.toLowerCase()))

  const totalSuggestedCost = suggestions
    .filter((s) => selectedItems.includes(s.id))
    .reduce((sum, s) => sum + (s.costo_total_estimado || 0), 0)

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "suggestions", l: "Sugerencias", i: ClipboardList },
    { k: "rules", l: "Reglas", i: Settings },
    { k: "crossdock", l: "Cross-Dock", i: Zap },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Reabastecimiento Predictivo
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sugerencias reales calculadas desde ventas confirmadas y stock actual, reglas de reposición por producto y logística de cross-docking.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reglas Activas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard?.reglas_activas ?? "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sugerencias Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{dashboard?.sugerencias_pendientes ?? "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aprobadas</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{dashboard?.sugerencias_aprobadas ?? "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cross-Dock Hoy</span>
          </div>
          <p className="text-2xl font-bold text-primary">{dashboard?.crossdock_hoy ?? "—"}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-max">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => { setTab(t.k); setSearch(""); setSelectedItems([]) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"
            }`}
          >
            <t.i className="w-3.5 h-3.5" /> {t.l}
          </button>
        ))}
      </div>

      {tab === "suggestions" && (
        <>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Buscar por producto o proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleGenerate} disabled={generating} className="btn-outline flex items-center gap-2 disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generar sugerencias
              </button>
              <button
                onClick={() => handleReview("aprobar")}
                disabled={selectedItems.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" /> Aprobar {selectedItems.length || ""}
              </button>
              <button
                onClick={() => handleReview("rechazar")}
                disabled={selectedItems.length === 0}
                className="btn-outline flex items-center gap-2 disabled:opacity-50 text-red-500 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" /> Rechazar
              </button>
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="card p-3 flex items-center gap-2 text-xs">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-gray-500">Inversión seleccionada:</span>
              <span className="font-bold text-primary">{formatPYG(totalSuggestedCost)}</span>
            </div>
          )}

          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.length > 0 && selectedItems.length === filteredSuggestions.length}
                      onChange={handleToggleAll}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                  </th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Stock Actual</th>
                  <th className="p-3 text-right">Demanda Diaria (real)</th>
                  <th className="p-3 text-right">Sugerido</th>
                  <th className="p-3 text-right">Costo Estimado</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </td>
                  </tr>
                ) : filteredSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      Sin sugerencias pendientes. Configurá reglas de reabastecimiento por producto y generá sugerencias.
                    </td>
                  </tr>
                ) : (
                  filteredSuggestions.map((s) => (
                    <tr key={s.id} className="table-row">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(s.id)}
                          onChange={() => handleToggleSelect(s.id)}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                      </td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">{s.producto_nombre || s.producto_id}</td>
                      <td className="p-3 font-medium text-gray-600 dark:text-gray-300">{s.proveedor_nombre || "—"}</td>
                      <td className="p-3 text-right font-mono font-bold">{s.stock_actual}</td>
                      <td className="p-3 text-right font-mono text-gray-500">{s.demanda_diaria_avg?.toFixed(1) ?? "—"} /d</td>
                      <td className="p-3 text-right font-mono font-bold text-primary text-sm bg-primary/5">{s.cantidad_sugerida}</td>
                      <td className="p-3 text-right font-mono font-bold">{s.costo_total_estimado ? formatPYG(s.costo_total_estimado) : "—"}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {s.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowRuleModal(true)} className="btn-primary flex items-center gap-2 ml-auto">
              <Plus className="w-4 h-4" /> Nueva Regla
            </button>
          </div>

          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-3">Producto</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Lead Time</th>
                  <th className="p-3 text-right">Stk Seg.</th>
                  <th className="p-3 text-right">Lote Eco.</th>
                  <th className="p-3">Pronóstico</th>
                  <th className="p-3 text-center">Activa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">Sin reglas configuradas todavía. Creá una para que el motor pueda sugerir compras de ese producto.</td>
                  </tr>
                ) : (
                  filteredRules.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">{r.producto_nombre}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{r.proveedor_preferente_nombre || "—"}</td>
                      <td className="p-3 text-right font-mono">{r.lead_time_dias}d</td>
                      <td className="p-3 text-right font-mono">{r.stock_seguridad_unidades ?? `${r.stock_seguridad_dias}d`}</td>
                      <td className="p-3 text-right font-mono">{r.lote_economico ?? "—"}</td>
                      <td className="p-3 text-gray-500">{r.metodo_pronostico}</td>
                      <td className="p-3 text-center">{r.activa ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-red-600 mx-auto" />}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "crossdock" && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowCrossdockModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva Orden
            </button>
          </div>

          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-3">Producto</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Destino</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td>
                  </tr>
                ) : crossdock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">Sin órdenes de cross-dock todavía.</td>
                  </tr>
                ) : (
                  crossdock.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">{c.producto_nombre}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{c.proveedor_nombre || "—"}</td>
                      <td className="p-3 text-right font-mono">{c.cantidad}</td>
                      <td className="p-3">{formatDate(c.fecha_crossdock)}</td>
                      <td className="p-3"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{c.destino}</span></td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${c.estado === "completado" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>{c.estado}</span>
                      </td>
                      <td className="p-3 text-center">
                        {c.estado === "pendiente" && (
                          <button onClick={() => handleCompleteCrossdock(c.id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Completar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showRuleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Regla de Reabastecimiento</h3>
            <div>
              <label className="input-label">Producto</label>
              {ruleForm.producto_id ? (
                <div className="flex items-center justify-between input-field">
                  <span>{ruleForm.producto_nombre}</span>
                  <button onClick={() => setRuleForm({ ...ruleForm, producto_id: "", producto_nombre: "" })} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input className="input-field" placeholder="Buscar producto por nombre o SKU..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                      {productResults.map((p) => (
                        <button key={p.id} onClick={() => { setRuleForm({ ...ruleForm, producto_id: p.id, producto_nombre: p.nombre }); setProductQuery(""); setProductResults([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600">
                          {p.nombre} <span className="text-gray-400 text-xs">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="input-label">Proveedor preferente</label>
              <select className="input-field" value={ruleForm.proveedor_preferente_id} onChange={(e) => setRuleForm({ ...ruleForm, proveedor_preferente_id: e.target.value })}>
                <option value="">Sin especificar</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Lead time (días)</label>
                <input type="number" min={0} className="input-field" value={ruleForm.lead_time_dias} onChange={(e) => setRuleForm({ ...ruleForm, lead_time_dias: Number(e.target.value) })} />
              </div>
              <div>
                <label className="input-label">Stock seguridad (días)</label>
                <input type="number" min={0} className="input-field" value={ruleForm.stock_seguridad_dias} onChange={(e) => setRuleForm({ ...ruleForm, stock_seguridad_dias: Number(e.target.value) })} />
              </div>
              <div>
                <label className="input-label">Stock seguridad (unidades)</label>
                <input type="number" min={0} className="input-field" value={ruleForm.stock_seguridad_unidades} onChange={(e) => setRuleForm({ ...ruleForm, stock_seguridad_unidades: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Lote económico</label>
                <input type="number" min={0} className="input-field" value={ruleForm.lote_economico} onChange={(e) => setRuleForm({ ...ruleForm, lote_economico: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Múltiplo de pedido</label>
                <input type="number" min={0} className="input-field" value={ruleForm.multiplo_pedido} onChange={(e) => setRuleForm({ ...ruleForm, multiplo_pedido: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Método de pronóstico</label>
                <select className="input-field" value={ruleForm.metodo_pronostico} onChange={(e) => setRuleForm({ ...ruleForm, metodo_pronostico: e.target.value })}>
                  <option value="promedio">Promedio</option>
                  <option value="ventana">Ventana móvil</option>
                  <option value="seasonal">Estacional</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ruleForm.activa} onChange={(e) => setRuleForm({ ...ruleForm, activa: e.target.checked })} className="rounded text-primary" />
              Regla activa
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowRuleModal(false); setRuleForm(emptyRuleForm); setProductQuery("") }} className="btn-outline">Cancelar</button>
              <button onClick={handleCreateRule} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Regla"}</button>
            </div>
          </div>
        </div>
      )}

      {showCrossdockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Orden de Cross-Dock</h3>
            <div>
              <label className="input-label">Producto</label>
              {crossdockForm.producto_id ? (
                <div className="flex items-center justify-between input-field">
                  <span>{crossdockForm.producto_nombre}</span>
                  <button onClick={() => setCrossdockForm({ ...crossdockForm, producto_id: "", producto_nombre: "" })} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input className="input-field" placeholder="Buscar producto por nombre o SKU..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                      {productResults.map((p) => (
                        <button key={p.id} onClick={() => { setCrossdockForm({ ...crossdockForm, producto_id: p.id, producto_nombre: p.nombre }); setProductQuery(""); setProductResults([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600">
                          {p.nombre} <span className="text-gray-400 text-xs">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="input-label">Proveedor</label>
              <select className="input-field" value={crossdockForm.proveedor_id} onChange={(e) => setCrossdockForm({ ...crossdockForm, proveedor_id: e.target.value })}>
                <option value="">Sin especificar</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Cantidad</label>
                <input type="number" min={0} className="input-field" value={crossdockForm.cantidad} onChange={(e) => setCrossdockForm({ ...crossdockForm, cantidad: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Fecha</label>
                <input type="date" className="input-field" value={crossdockForm.fecha_crossdock} onChange={(e) => setCrossdockForm({ ...crossdockForm, fecha_crossdock: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="input-label">Destino</label>
              <select className="input-field" value={crossdockForm.destino} onChange={(e) => setCrossdockForm({ ...crossdockForm, destino: e.target.value })}>
                <option value="gondola">Góndola</option>
                <option value="exhibicion">Exhibición</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowCrossdockModal(false); setCrossdockForm(emptyCrossdockForm); setProductQuery("") }} className="btn-outline">Cancelar</button>
              <button onClick={handleCreateCrossdock} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Orden"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
