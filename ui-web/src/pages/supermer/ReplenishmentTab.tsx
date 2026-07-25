import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { RefreshCw, Plus, Search, Loader2, Check, AlertTriangle, X, Settings, Lightbulb, Zap, BarChart3, TrendingUp, Truck } from "lucide-react"
import { formatDate, formatPYG } from "../../utils/format"

type SubTab = "dashboard" | "rules" | "suggestions" | "crossdock"

const MOCK_RULES = [
  { id: "r1", producto_nombre: "Leche Entera 1L", proveedor_preferente_nombre: "Lácteos SA", lead_time_dias: 2, stock_seguridad_dias: 3, stock_seguridad_unidades: 150, lote_economico: 500, multiplo_pedido: 12, punto_pedido: 350, metodo_pronostico: "promedio", activa: true },
  { id: "r2", producto_nombre: "Pan Artesanal kg", proveedor_preferente_nombre: "Panificadora ABC", lead_time_dias: 1, stock_seguridad_dias: 2, stock_seguridad_unidades: 50, lote_economico: 100, multiplo_pedido: 10, punto_pedido: 80, metodo_pronostico: "ventana", activa: true },
  { id: "r3", producto_nombre: "Carne Vacuna Premium kg", proveedor_preferente_nombre: "Cárnicos del Sur", lead_time_dias: 3, stock_seguridad_dias: 2, stock_seguridad_unidades: 200, multiplo_pedido: 50, punto_pedido: 500, metodo_pronostico: "seasonal", activa: false },
]

const MOCK_SUGGESTIONS = [
  { id: "sg1", producto_nombre: "Leche Entera 1L", proveedor_nombre: "Lácteos SA", stock_actual: 120, stock_pendiente_recibir: 0, demanda_diaria_avg: 85, cantidad_sugerida: 500, costo_unitario_estimado: 5500, costo_total_estimado: 2750000, estado: "pendiente", fecha_generacion: new Date().toISOString() },
  { id: "sg2", producto_nombre: "Yogurt Natural 200g", proveedor_nombre: "Lácteos SA", stock_actual: 60, stock_pendiente_recibir: 200, demanda_diaria_avg: 40, cantidad_sugerida: 300, costo_unitario_estimado: 3500, costo_total_estimado: 1050000, estado: "aprobada", revisado_nombre: "Admin", revisado_at: new Date().toISOString() },
]

const MOCK_CROSSDOCK = [
  { id: "cd1", producto_nombre: "Coca Cola 2L", proveedor_nombre: "Bebidas del Paraguay", cantidad: 500, fecha_crossdock: "2026-05-27", destino: "gondola", estado: "pendiente" },
  { id: "cd2", producto_nombre: "Cerveza Pilsen 6pk", proveedor_nombre: "Bebidas del Paraguay", cantidad: 200, fecha_crossdock: "2026-05-27", destino: "exhibicion", estado: "completado" },
]

export default function ReplenishmentTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<any[]>(MOCK_RULES)
  const [suggestions, setSuggestions] = useState<any[]>(MOCK_SUGGESTIONS)
  const [crossdock, setCrossdock] = useState<any[]>(MOCK_CROSSDOCK)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [showCrossdockModal, setShowCrossdockModal] = useState(false)
  const [dashData, setDashData] = useState<any>({})
  const [search, setSearch] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "rules") p.push(api.replenishment.rules.list().then(setRules))
      if (subTab === "suggestions") p.push(api.replenishment.suggestions.list().then(setSuggestions))
      if (subTab === "crossdock") p.push(api.replenishment.crossdock.list().then(setCrossdock))
      if (subTab === "dashboard") p.push(api.replenishment.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await api.replenishment.generate()
      setSuggestions(prev => [...res, ...prev])
      toast.success(`${res.length} sugerencias generadas`)
    } catch (e: any) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const handleReview = async (id: string, accion: string) => {
    setSaving(true)
    try {
      const res = await api.replenishment.suggestions.review(id, { accion })
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, ...res } : s))
      toast.success(accion === "aprobar" ? "Sugerencia aprobada" : "Sugerencia rechazada")
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const handleCompleteCrossdock = async (id: string) => {
    try {
      const res = await api.replenishment.crossdock.complete(id)
      setCrossdock(prev => prev.map(c => c.id === id ? { ...c, ...res } : c))
      toast.success("Cross-dock completado")
    } catch (e: any) { toast.error(e.message) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "rules", l: "Reglas", i: Settings },
    { k: "suggestions", l: "Sugerencias", i: Lightbulb },
    { k: "crossdock", l: "Cross-Dock", i: Zap },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              subTab === t.k ? "bg-white dark:bg-slate-700 shadow-lg text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}>
            <t.i className="w-4 h-4" /> {t.l}
          </button>
        ))}
      </div>

      {subTab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Reglas Activas", value: dashData.reglas_activas || 0, icon: Settings },
            { label: "Sug. Pendientes", value: dashData.sugerencias_pendientes || 0, icon: Lightbulb },
            { label: "Sug. Aprobadas", value: dashData.sugerencias_aprobadas || 0, icon: Check },
            { label: "Cross-Dock Hoy", value: dashData.crossdock_hoy || 0, icon: Zap },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                <s.icon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-2">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === "rules" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-gray-600/50 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Regla</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Lead Time</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Stk Seg.</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Pto Pedido</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Lote Eco.</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Activa</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.filter(r => !search || r.producto_nombre?.toLowerCase().includes(search.toLowerCase())).map(r => (
                    <tr key={r.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                      <td className="py-3 px-2 font-medium">{r.producto_nombre}</td>
                      <td className="py-3 px-2 text-gray-500">{r.proveedor_preferente_nombre || "-"}</td>
                      <td className="py-3 px-2 text-right">{r.lead_time_dias}d</td>
                      <td className="py-3 px-2 text-right">{r.stock_seguridad_unidades || r.stock_seguridad_dias + "d"}</td>
                      <td className="py-3 px-2 text-right font-medium">{r.punto_pedido || "-"}</td>
                      <td className="py-3 px-2 text-right">{r.lote_economico || "-"}</td>
                      <td className="py-3 px-2 text-center">{r.activa ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-red-600 mx-auto" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "suggestions" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Sugerencias de Reposición</h3>
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} /> Generar Sugerencias</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Stock</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Demanda</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Sugerido</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Costo Est.</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map(s => (
                    <tr key={s.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                      <td className="py-3 px-2 font-medium">{s.producto_nombre}</td>
                      <td className="py-3 px-2 text-right">{s.stock_actual}</td>
                      <td className="py-3 px-2 text-right">{s.demanda_diaria_avg || "-"}</td>
                      <td className="py-3 px-2 text-right font-medium text-emerald-700">{s.cantidad_sugerida}</td>
                      <td className="py-3 px-2 text-right">{formatPYG(s.costo_total_estimado)}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "aprobada" ? "bg-green-100 text-green-700" : s.estado === "rechazada" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{s.estado}</span></td>
                      <td className="py-3 px-2 text-center">
                        {s.estado === "pendiente" && (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleReview(s.id, "aprobar")} disabled={saving} className="p-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleReview(s.id, "rechazar")} disabled={saving} className="p-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "crossdock" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Cross-Docking</h3>
            <button onClick={() => setShowCrossdockModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Orden</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Cantidad</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Destino</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {crossdock.map(c => (
                    <tr key={c.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                      <td className="py-3 px-2 font-medium">{c.producto_nombre}</td>
                      <td className="py-3 px-2 text-gray-500">{c.proveedor_nombre}</td>
                      <td className="py-3 px-2 text-right">{c.cantidad}</td>
                      <td className="py-3 px-2">{formatDate(c.fecha_crossdock)}</td>
                      <td className="py-3 px-2"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{c.destino}</span></td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.estado === "completado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{c.estado}</span></td>
                      <td className="py-3 px-2 text-center">
                        {c.estado === "pendiente" && <button onClick={() => handleCompleteCrossdock(c.id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"><Check className="w-3.5 h-3.5 inline" /> Completar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
