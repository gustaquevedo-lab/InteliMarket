import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { RotateCcw, Plus, Search, Loader2, Check, AlertTriangle, X, FileText, Truck, Ban, BarChart3, ArrowLeftRight, ClipboardList, Calendar } from "lucide-react"
import { formatDate, formatPYG } from "../../utils/format"

type SubTab = "dashboard" | "returns" | "authorizations" | "backhaul"

const MOCK_RETURNS = [
  { id: "rt1", proveedor_nombre: "Lácteos SA", codigo: "DEV-2026-001", tipo: "devolucion", fecha_creacion: "2026-05-27T10:00:00", total_items: 3, valor_total_estimado: 250000, estado: "pendiente", items: [
    { producto_nombre: "Leche Entera 1L", cantidad: 20, valor_unitario: 6500, valor_total: 130000, motivo: "proximo_vencer", lote: "L-202604" },
    { producto_nombre: "Yogurt Natural 200g", cantidad: 30, valor_unitario: 4000, valor_total: 120000, motivo: "vencido", lote: "L-202603" },
  ]},
  { id: "rt2", proveedor_nombre: "Cárnicos del Sur", codigo: "DEV-2026-002", tipo: "devolucion", fecha_creacion: "2026-05-26T14:00:00", total_items: 1, valor_total_estimado: 450000, estado: "autorizado", autorizado_por_nombre: "Admin" },
  { id: "rt3", proveedor_nombre: "Distribuidora XYZ", codigo: "REC-2026-001", tipo: "recall", fecha_creacion: "2026-05-25T09:00:00", total_items: 2, valor_total_estimado: 1200000, estado: "completado", nota_credito_numero: "NC-2026-001", nota_credito_monto: 1200000 },
]

const MOCK_AUTHS: Record<string, any[]> = {
  rt2: [
    { id: "a1", proveedor_nombre: "Cárnicos del Sur", numero_autorizacion: "AUT-2026-001", fecha_autorizacion: "2026-05-26", valido_hasta: "2026-06-02", autorizado_por_proveedor: "Juan Pérez" },
  ],
}

const MOCK_BACKHAULS = [
  { id: "b1", proveedor_nombre: "Lácteos SA", fecha_programada: "2026-05-28T10:00:00", transportista: "Transportes ABC", patente: "ABC-1234", total_bultos: 50, estado: "pendiente" },
  { id: "b2", proveedor_nombre: "Cárnicos del Sur", fecha_programada: "2026-05-27T14:00:00", estado: "en_ruta", conductor: "María López" },
]

export default function ReturnsTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [returns, setReturns] = useState<any[]>(MOCK_RETURNS)
  const [authorizations, setAuthorizations] = useState<any>(MOCK_AUTHS)
  const [backhauls, setBackhauls] = useState<any[]>(MOCK_BACKHAULS)
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showBackhaulModal, setShowBackhaulModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [dashData, setDashData] = useState<any>({})
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "returns") p.push(api.supplierReturns.list().then(setReturns))
      if (subTab === "backhaul") p.push(api.backhaul.list().then(setBackhauls))
      if (subTab === "dashboard") p.push(api.supplierReturns.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const loadAuthorizations = async (returnId: string) => {
    try {
      const data = await api.supplierReturns.authorizations.list(returnId)
      setAuthorizations(prev => ({ ...prev, [returnId]: data }))
    } catch {}
  }

  const handleAuthorize = async (id: string) => {
    setSaving(true)
    try {
      const res = await api.supplierReturns.authorize(id)
      setReturns(prev => prev.map(r => r.id === id ? { ...r, ...res } : r))
      toast.success("Devolución autorizada")
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const handleComplete = async (id: string) => {
    setSaving(true)
    try {
      const res = await api.supplierReturns.complete(id)
      setReturns(prev => prev.map(r => r.id === id ? { ...r, ...res } : r))
      toast.success("Devolución completada")
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "returns", l: "Devoluciones", i: RotateCcw },
    { k: "authorizations", l: "Autorizaciones", i: FileText },
    { k: "backhaul", l: "Backhaul", i: Truck },
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
            { label: "Devol. Pendientes", value: dashData.returns_pendientes || 0, icon: RotateCcw },
            { label: "Devol. Activas", value: dashData.returns_activos || 0, icon: AlertTriangle },
            { label: "Completadas Mes", value: dashData.returns_completados_mes || 0, icon: Check },
            { label: "Backhaul Pend.", value: dashData.backhaul_programados || 0, icon: Truck },
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

      {subTab === "returns" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-gray-600/50 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button onClick={() => setShowReturnModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Devolución</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="space-y-3">
              {returns.filter(r => !search || r.codigo?.toLowerCase().includes(search.toLowerCase()) || r.proveedor_nombre?.toLowerCase().includes(search.toLowerCase())).map(r => (
                <div key={r.id} className="p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{r.codigo}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.tipo === "recall" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{r.tipo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.estado === "pendiente" ? "bg-amber-100 text-amber-700" : r.estado === "autorizado" ? "bg-blue-100 text-blue-700" : r.estado === "completado" ? "bg-green-100 text-green-700" : ""}`}>{r.estado}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{r.proveedor_nombre} - {r.total_items} items</p>
                      <p className="text-xs text-gray-400">{formatDate(r.fecha_creacion)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-700">{formatPYG(r.valor_total_estimado)}</p>
                      <div className="flex gap-1 mt-2">
                        {r.estado === "pendiente" && (
                          <button onClick={() => handleAuthorize(r.id)} disabled={saving} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">Autorizar</button>
                        )}
                        {r.estado === "autorizado" && (
                          <button onClick={() => handleComplete(r.id)} disabled={saving} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium">Completar</button>
                        )}
                        {r.nota_credito_numero && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">NC: {r.nota_credito_numero}</span>}
                      </div>
                    </div>
                  </div>
                  {r.items && (
                    <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {r.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 text-sm">
                          <span>{item.producto_nombre}</span>
                          <span className="text-gray-500">{item.cantidad} x {formatPYG(item.valor_unitario)}</span>
                          <span className="text-xs text-gray-400">{item.motivo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "authorizations" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Devoluciones</h3>
            <div className="space-y-2">
              {returns.map(r => (
                <div key={r.id} className={`p-3 rounded-xl cursor-pointer text-sm ${selectedReturn === r.id ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-500" : "bg-gray-50/50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700"}`}
                  onClick={() => { setSelectedReturn(r.id); loadAuthorizations(r.id) }}>
                  <p className="font-medium">{r.codigo}</p>
                  <p className="text-xs text-gray-500">{r.proveedor_nombre}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Autorizaciones</h3>
              {selectedReturn && <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Nueva</button>}
            </div>
            {selectedReturn && authorizations[selectedReturn] ? (
              <div className="space-y-2">
                {authorizations[selectedReturn].map((a: any) => (
                  <div key={a.id} className="p-3 rounded-xl bg-gray-50/50 dark:bg-slate-700/50">
                    <div className="flex justify-between">
                      <p className="font-medium text-sm">{a.numero_autorizacion}</p>
                      <span className="text-xs text-gray-500">{formatDate(a.fecha_autorizacion)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{a.autorizado_por_proveedor}</p>
                    {a.valido_hasta && <p className="text-xs text-gray-400">Válido hasta: {formatDate(a.valido_hasta)}</p>}
                    {a.nota_credito_numero && <p className="text-xs text-green-600">NC: {a.nota_credito_numero} ({formatPYG(a.nota_credito_monto)})</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 py-4">Seleccioná una devolución de la izquierda</p>}
          </div>
        </div>
      )}

      {subTab === "backhaul" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Programación Backhaul</h3>
            <button onClick={() => setShowBackhaulModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Programar Retiro</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Transporte</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Patente</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-500">Bultos</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {backhauls.map(b => (
                    <tr key={b.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                      <td className="py-3 px-2 font-medium">{b.proveedor_nombre}</td>
                      <td className="py-3 px-2">{formatDate(b.fecha_programada)}</td>
                      <td className="py-3 px-2 text-gray-500">{b.transportista || "-"}</td>
                      <td className="py-3 px-2 text-gray-500">{b.patente || "-"}</td>
                      <td className="py-3 px-2 text-right">{b.total_bultos || "-"}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.estado === "pendiente" ? "bg-amber-100 text-amber-700" : b.estado === "en_ruta" ? "bg-blue-100 text-blue-700" : b.estado === "completado" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{b.estado}</span></td>
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
