import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Truck, ClipboardList, PackageOpen, XCircle, Plus, Search, Loader2, X, Check, AlertTriangle, Calendar, Clock, Thermometer, Ban, Shield } from "lucide-react"
import { formatDate, formatDateTime, formatTime } from "../../utils/format"

type SubTab = "schedules" | "receivings" | "items" | "rejections" | "dashboard"

const MOCK_SCHEDULES = [
  { id: "s1", proveedor_nombre: "Distribuidora XYZ", numero_oc: "OC-2026-001", fecha_programada: "2026-05-27", ventana_inicio: "2026-05-27T08:00:00", ventana_fin: "2026-05-27T10:00:00", muelle: "M-01", tipo_carga: "seco", transportista: "Transportes ABC", patente: "ABC-1234", conductor: "Juan Pérez", estado: "programada" },
  { id: "s2", proveedor_nombre: "Lácteos SA", numero_oc: "OC-2026-002", fecha_programada: "2026-05-27", ventana_inicio: "2026-05-27T10:00:00", ventana_fin: "2026-05-27T12:00:00", muelle: "M-02", tipo_carga: "frio", estado: "programada" },
  { id: "s3", proveedor_nombre: "Cárnicos del Sur", numero_oc: "OC-2026-003", fecha_programada: "2026-05-27", ventana_inicio: "2026-05-27T06:00:00", ventana_fin: "2026-05-27T08:00:00", muelle: "M-03", tipo_carga: "congelado", transportista: "Carga Fría SRL", conductor: "María López", conductor_telefono: "0981-123-456", estado: "en_curso" },
  { id: "s4", proveedor_nombre: "Bebidas del Paraguay", numero_oc: "OC-2026-004", fecha_programada: "2026-05-27", ventana_inicio: "2026-05-27T14:00:00", ventana_fin: "2026-05-27T16:00:00", muelle: "M-01", tipo_carga: "seco", estado: "programada" },
]

const MOCK_RECEIVINGS = [
  { id: "r1", proveedor_nombre: "Cárnicos del Sur", numero_oc: "OC-2026-003", fecha_recepcion: new Date().toISOString(), recibido_por_nombre: "Carlos Gómez", total_bultos_recibidos: 45, total_bultos_rechazados: 2, temp_ambiente_descarga: 18.5, estado: "en_curso", items: [
    { id: "i1", producto_nombre: "Carne Vacuna Premium kg", cantidad_solicitada: 500, cantidad_recibida: 480, cantidad_aceptada: 475, temperatura_producto: 2.1, temp_conforme: true, lote: "L-20260527", condicion_visual: "buena", inspeccion_conforme: true },
    { id: "i2", producto_nombre: "Carne de Cerdo kg", cantidad_solicitada: 300, cantidad_recibida: 300, cantidad_aceptada: 290, temperatura_producto: 3.5, temp_conforme: true, lote: "L-20260527-B", condicion_visual: "regular", inspeccion_conforme: true },
  ]},
  { id: "r2", proveedor_nombre: "Distribuidora XYZ", numero_oc: "OC-2026-001", fecha_recepcion: new Date(Date.now() - 86400000).toISOString(), recibido_por_nombre: "Ana Martínez", total_bultos_recibidos: 120, total_bultos_rechazados: 0, estado: "completada" },
]

export default function DsdTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<any[]>(MOCK_SCHEDULES)
  const [receivings, setReceivings] = useState<any[]>(MOCK_RECEIVINGS)
  const [selectedReceiving, setSelectedReceiving] = useState<any>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showReceivingModal, setShowReceivingModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [dashData, setDashData] = useState<any>({})
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "schedules") p.push(api.dsd.schedules.list().then(setSchedules))
      if (subTab === "receivings" || subTab === "items" || subTab === "rejections") p.push(api.dsd.receivings.list().then(setReceivings))
      if (subTab === "dashboard") p.push(api.dsd.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: Truck },
    { k: "schedules", l: "Programación", i: Calendar },
    { k: "receivings", l: "Recepciones", i: ClipboardList },
    { k: "items", l: "Items", i: PackageOpen },
    { k: "rejections", l: "Rechazos", i: XCircle },
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
            { label: "Programadas Hoy", value: dashData.hoy_programadas || 0, icon: Calendar, color: "text-blue-600" },
            { label: "En Curso", value: dashData.en_curso || 0, icon: Clock, color: "text-amber-600" },
            { label: "Completadas Hoy", value: dashData.completadas_hoy || 0, icon: Check, color: "text-green-600" },
            { label: "Rechazos Temp", value: dashData.rechazos_temp || 0, icon: Thermometer, color: "text-red-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-2">{s.value}</p>
            </div>
          ))}
          <div className="md:col-span-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Próximas Programadas</h3>
            {dashData.proximas_programadas?.length > 0 ? (
              <div className="space-y-2">
                {dashData.proximas_programadas.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50/50 dark:bg-slate-700/50 rounded-xl">
                    <div><p className="font-medium text-sm">{p.proveedor_nombre || "Proveedor"}</p><p className="text-xs text-gray-400">OC: {p.numero_oc}</p></div>
                    <span className="text-xs text-gray-500">{formatTime(p.ventana_inicio)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Sin programaciones futuras</p>}
          </div>
        </div>
      )}

      {subTab === "schedules" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-gray-600/50 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Nueva Programación</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">OC</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Ventana</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Carga</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.filter(s => !search || s.proveedor_nombre?.toLowerCase().includes(search.toLowerCase())).map(s => (
                    <tr key={s.id} className="border-b border-gray-100/50 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-2 font-medium">{s.proveedor_nombre}</td>
                      <td className="py-3 px-2 text-gray-500">{s.numero_oc}</td>
                      <td className="py-3 px-2">{formatDate(s.fecha_programada)}</td>
                      <td className="py-3 px-2 text-gray-500">{formatTime(s.ventana_inicio)} - {formatTime(s.ventana_fin)}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.tipo_carga === "frio" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30" : s.tipo_carga === "congelado" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30" : "bg-gray-100 text-gray-700 dark:bg-gray-700"}`}>{s.tipo_carga}</span></td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "programada" ? "bg-blue-100 text-blue-700" : s.estado === "en_curso" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{s.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "receivings" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Recepciones DSD</h3>
            <button onClick={() => setShowReceivingModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Nueva Recepción</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">OC</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Recibido</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Bultos</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Rechazos</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {receivings.map(r => (
                    <tr key={r.id} className="border-b border-gray-100/50 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => { setSelectedReceiving(r); setSubTab("items") }}>
                      <td className="py-3 px-2 font-medium">{r.proveedor_nombre}</td>
                      <td className="py-3 px-2 text-gray-500">{r.numero_oc}</td>
                      <td className="py-3 px-2 text-gray-500">{formatDate(r.fecha_recepcion)}</td>
                      <td className="py-3 px-2">{r.total_bultos_recibidos || "-"}</td>
                      <td className="py-3 px-2">{r.total_bultos_rechazados ? <span className="text-red-600">{r.total_bultos_rechazados}</span> : "-"}</td>
                      <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.estado === "en_curso" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{r.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(subTab === "items" || subTab === "rejections") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><PackageOpen className="w-4 h-4" /> Items Recibidos</h3>
            <select className="w-full p-2 mb-3 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-gray-600/50 text-sm" onChange={e => {
              const r = receivings.find(r => r.id === e.target.value)
              setSelectedReceiving(r || null)
            }}>
              <option value="">Seleccionar recepción</option>
              {receivings.map(r => <option key={r.id} value={r.id}>{r.proveedor_nombre} - {r.numero_oc}</option>)}
            </select>
            {selectedReceiving?.items ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                      <th className="text-left py-2 px-2 font-medium text-gray-500">Producto</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Solic.</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Recib.</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Acept.</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-500">Temp</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-500">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReceiving.items.map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-100/50 dark:border-gray-700/30">
                        <td className="py-2 px-2 font-medium">{item.producto_nombre}</td>
                        <td className="py-2 px-2 text-right">{item.cantidad_solicitada}</td>
                        <td className="py-2 px-2 text-right">{item.cantidad_recibida}</td>
                        <td className="py-2 px-2 text-right">{item.cantidad_aceptada || "-"}</td>
                        <td className="py-2 px-2 text-right">{item.temperatura_producto ? `${item.temperatura_producto}°C` : "-"}</td>
                        <td className="py-2 px-2 text-center">{item.temp_conforme ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-red-600 mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 py-4">Seleccioná una recepción para ver sus items</p>}
            <button onClick={() => setShowItemModal(true)} className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-700"><Plus className="w-3.5 h-3.5" /> Agregar Item</button>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2"><Ban className="w-4 h-4" /> Rechazos</h3>
            {selectedReceiving?.items ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/50 dark:border-gray-700/50">
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Producto</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-500">Cant.</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-500">Motivo</th>
                        <th className="text-center py-2 px-2 font-medium text-gray-500">NC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceiving.items.filter((i: any) => !i.inspeccion_conforme).map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100/50 dark:border-gray-700/30">
                          <td className="py-2 px-2">{item.producto_nombre}</td>
                          <td className="py-2 px-2 text-right text-red-600">{item.cantidad_aceptada !== undefined ? item.cantidad_recibida - item.cantidad_aceptada : "-"}</td>
                          <td className="py-2 px-2 text-gray-500">{item.condicion_visual === "mala" ? "Condición visual deficiente" : "Temp fuera de rango"}</td>
                          <td className="py-2 px-2 text-center"><Check className="w-4 h-4 text-green-600 mx-auto" /></td>
                        </tr>
                      ))}
                      {(!selectedReceiving.items.some((i: any) => !i.inspeccion_conforme)) && <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin rechazos en esta recepción</td></tr>}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setShowRejectionModal(true)} className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700"><XCircle className="w-3.5 h-3.5" /> Registrar Rechazo</button>
              </div>
            ) : <p className="text-sm text-gray-400 py-4">Seleccioná una recepción para ver rechazos</p>}
          </div>
        </div>
      )}
    </div>
  )
}
