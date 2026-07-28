import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { ClipboardList, Plus, Search, Loader2, Check, AlertTriangle, X, PackageOpen, Layers, Gavel, BarChart3, Eye, EyeOff } from "lucide-react"
import { formatDate, formatPYG } from "../../utils/format"

type SubTab = "dashboard" | "sessions" | "items" | "adjustments"

const MOCK_SESSIONS = [
  { id: "s1", codigo: "INV-2026-001", area: "Góndolas Lácteos", ubicacion: "Pasillo 3", tipo: "ciclico", abc_category: "a", contador_principal_nombre: "Carlos Gómez", contador_verificador_nombre: "Ana Martínez", fecha_inicio: "2026-05-27T08:00:00", estado: "en_curso", total_items_sistema: 120, total_items_contados: 85, total_discrepancias: 3, valor_discrepancia_total: 450000 },
  { id: "s2", codigo: "INV-2026-002", area: "Carnicería", tipo: "completo", fecha_inicio: "2026-05-26T07:00:00", estado: "completada", total_items_sistema: 200, total_items_contados: 200, total_discrepancias: 5, valor_discrepancia_total: 1280000 },
  { id: "s3", codigo: "INV-2026-003", area: "Perfumería", tipo: "abc", abc_category: "b", fecha_inicio: "2026-05-25T09:00:00", estado: "ajustada", total_items_sistema: 350, total_items_contados: 350, total_discrepancias: 8, valor_discrepancia_total: 2300000 },
]

const MOCK_COUNT_ITEMS: Record<string, any[]> = {
  s1: [
    { id: "ci1", producto_nombre: "Leche Entera 1L", codigo_barra: "7622210100126", cantidad_sistema: 45, cantidad_contada: 43, diferencia: -2, costo_promedio: 6500, valor_diferencia: -13000, conforme: false, requiere_ajuste: true },
    { id: "ci2", producto_nombre: "Yogurt Natural 200g", codigo_barra: "7622210100133", cantidad_sistema: 60, cantidad_contada: 60, diferencia: 0, conforme: true },
    { id: "ci3", producto_nombre: "Queso Paraguay 500g", codigo_barra: "7622210100140", cantidad_sistema: 15, cantidad_contada: 17, diferencia: 2, costo_promedio: 25000, valor_diferencia: 50000, conforme: false, requiere_ajuste: true },
  ],
}

const MOCK_ADJUSTMENTS = [
  { id: "a1", producto_nombre: "Leche Entera 1L", tipo: "faltante", cantidad_ajuste: -2, costo_unitario: 6500, valor_ajuste: -13000, motivo: "Diferencia en conteo físico", estado: "pendiente" },
  { id: "a2", producto_nombre: "Queso Paraguay 500g", tipo: "sobrante", cantidad_ajuste: 2, costo_unitario: 25000, valor_ajuste: 50000, motivo: "Diferencia en conteo físico", estado: "aprobado", aprobado_por_nombre: "Admin" },
]

export default function InventoryTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>(MOCK_SESSIONS)
  const [countItems, setCountItems] = useState<any>(MOCK_COUNT_ITEMS)
  const [adjustments, setAdjustments] = useState<any[]>(MOCK_ADJUSTMENTS)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [dashData, setDashData] = useState<any>({})
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "sessions") p.push(api.supermerInventory.sessions.list().then(setSessions))
      if (subTab === "items" && selectedSession) p.push(api.supermerInventory.sessions.items.list(selectedSession).then(d => setCountItems(prev => ({ ...prev, [selectedSession]: d }))))
      if (subTab === "adjustments" && selectedSession) p.push(api.supermerInventory.sessions.adjustments.list(selectedSession).then(setAdjustments))
      if (subTab === "dashboard") p.push(api.supermerInventory.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const handleCompleteSession = async (id: string) => {
    setSaving(true)
    try {
      const res = await api.supermerInventory.sessions.complete(id)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, ...res } : s))
      toast.success("Sesión completada exitosamente")
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const handleApproveAdjustment = async (id: string) => {
    try {
      const res = await api.supermerInventory.adjustments.approve(id)
      setAdjustments(prev => prev.map(a => a.id === id ? { ...a, ...res } : a))
      toast.success("Ajuste aprobado")
    } catch (e: any) { toast.error(e.message) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "sessions", l: "Sesiones", i: Layers },
    { k: "items", l: "Conteo", i: PackageOpen },
    { k: "adjustments", l: "Ajustes", i: Gavel },
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
            { label: "Sesiones Abiertas", value: dashData.sesiones_abiertas || 0, icon: Layers },
            { label: "En Curso", value: dashData.sesiones_en_curso || 0, icon: Eye },
            { label: "Completadas", value: dashData.sesiones_completadas || 0, icon: Check },
            { label: "Ajustes Pend.", value: dashData.ajustes_pendientes || 0, icon: Gavel },
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

      {subTab === "sessions" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-gray-600/50 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Nueva Sesión</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="space-y-3">
              {sessions.filter(s => !search || s.codigo?.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())).map(s => (
                <div key={s.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedSession === s.id ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-gray-200/50 dark:border-gray-700/50 hover:border-emerald-300"}`} onClick={() => setSelectedSession(s.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{s.codigo}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.abc_category === "a" ? "bg-red-100 text-red-700" : s.abc_category === "b" ? "bg-amber-100 text-amber-700" : s.abc_category === "c" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{s.abc_category ? s.abc_category.toUpperCase() : "-"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "abierta" ? "bg-blue-100 text-blue-700" : s.estado === "en_curso" ? "bg-amber-100 text-amber-700" : s.estado === "completada" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{s.estado}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{s.area} {s.ubicacion ? `- ${s.ubicacion}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Sistema: {s.total_items_sistema} / Contados: {s.total_items_contados} / Disc.: {s.total_discrepancias}</p>
                    </div>
                    <div className="flex gap-2">
                      {s.estado === "en_curso" && (
                        <button onClick={e => { e.stopPropagation(); handleCompleteSession(s.id) }} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"><Check className="w-3.5 h-3.5" /> Completar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "items" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Sesiones</h3>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className={`p-3 rounded-xl cursor-pointer text-sm ${selectedSession === s.id ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500" : "bg-gray-50/50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700"}`} onClick={() => setSelectedSession(s.id)}>
                  <p className="font-medium">{s.codigo}</p>
                  <p className="text-xs text-gray-500">{s.area}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Items Contados</h3>
              {selectedSession && <button onClick={() => setShowItemModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Agregar</button>}
            </div>
            {selectedSession && countItems[selectedSession] ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Producto</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Sistema</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Contado</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Diff</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-500">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countItems[selectedSession].map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                        <td className="py-2 px-2 font-medium">{item.producto_nombre}</td>
                        <td className="py-2 px-2 text-right">{item.cantidad_sistema}</td>
                        <td className="py-2 px-2 text-right">{item.cantidad_contada || "-"}</td>
                        <td className={`py-2 px-2 text-right font-medium ${(item.diferencia || 0) > 0 ? "text-green-600" : (item.diferencia || 0) < 0 ? "text-red-600" : ""}`}>{item.diferencia || 0}</td>
                        <td className="py-2 px-2 text-center">{item.conforme ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-red-600 mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 py-4">Seleccioná una sesión de la izquierda</p>}
          </div>
        </div>
      )}

      {subTab === "adjustments" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Ajustes de Inventario</h3>
            {selectedSession && <button onClick={() => setShowAdjustmentModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo Ajuste</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Tipo</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Cantidad</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Valor</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map(a => (
                  <tr key={a.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                    <td className="py-3 px-2 font-medium">{a.producto_nombre}</td>
                    <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.tipo === "sobrante" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{a.tipo}</span></td>
                    <td className={`py-3 px-2 text-right font-medium ${a.tipo === "sobrante" ? "text-green-600" : "text-red-600"}`}>{a.cantidad_ajuste > 0 ? `+${a.cantidad_ajuste}` : a.cantidad_ajuste}</td>
                    <td className="py-3 px-2 text-right">{formatPYG(a.valor_ajuste)}</td>
                    <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.estado === "aprobado" ? "bg-green-100 text-green-700" : a.estado === "rechazado" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{a.estado}</span></td>
                    <td className="py-3 px-2 text-center">
                      {a.estado === "pendiente" && (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleApproveAdjustment(a.id)} className="p-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                          <button className="p-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
