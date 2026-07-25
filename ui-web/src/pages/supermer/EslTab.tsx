import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Wifi, BarChart3, Plus, Search, Loader2, Check, X, AlertTriangle, Battery, Tag, Zap, Radio } from "lucide-react"
import { formatPYG, formatDateTime } from "../../utils/format"

type SubTab = "dashboard" | "devices" | "zones" | "syncs"

const MOCK_DEVICES = [
  { id: "d1", codigo_dispositivo: "ESL-001", producto_nombre: "Leche Entera 1L", precio_actual: 6500, ubicacion: "Pasillo 3 - A", zona_nombre: "Lácteos", estado: "online", bateria_pct: 85, ultima_sync: new Date().toISOString() },
  { id: "d2", codigo_dispositivo: "ESL-002", producto_nombre: "Pan Artesanal kg", precio_actual: 19000, ubicacion: "Panadería", zona_nombre: "Panadería", estado: "online", bateria_pct: 45, ultima_sync: new Date(Date.now() - 3600000).toISOString() },
  { id: "d3", codigo_dispositivo: "ESL-003", producto_nombre: "Coca Cola 2L", precio_actual: 8500, ubicacion: "Pasillo 1 - B", zona_nombre: "Bebidas", estado: "offline", bateria_pct: 12, ultima_sync: new Date(Date.now() - 86400000).toISOString() },
  { id: "d4", codigo_dispositivo: "ESL-004", producto_nombre: null, precio_actual: null, ubicacion: "Pasillo 5 - C", zona_nombre: "Limpieza", estado: "online", bateria_pct: 92, ultima_sync: null },
]

const MOCK_ZONES = [
  { id: "z1", nombre: "Lácteos", descripcion: "Pasillo 3 y 4 - productos refrigerados" },
  { id: "z2", nombre: "Panadería", descripcion: "Sección panadería y pastelería" },
  { id: "z3", nombre: "Bebidas", descripcion: "Pasillo 1 y 2 - gaseosas, aguas, jugos" },
]

const MOCK_SYNCS = [
  { id: "s1", esl_device_id: "d1", producto_nombre: "Leche Entera 1L", precio_anterior: 6800, precio_nuevo: 6500, estado: "confirmado", created_at: new Date().toISOString(), completado_at: new Date().toISOString() },
  { id: "s2", esl_device_id: "d2", producto_nombre: "Pan Artesanal kg", precio_anterior: 19000, precio_nuevo: 18500, estado: "enviado", created_at: new Date().toISOString() },
]

export default function EslTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<any[]>(MOCK_DEVICES)
  const [zones, setZones] = useState<any[]>(MOCK_ZONES)
  const [syncs, setSyncs] = useState<any[]>(MOCK_SYNCS)
  const [dashData, setDashData] = useState<any>({})
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "devices") p.push(api.esl.devices.list().then(setDevices))
      if (subTab === "zones") p.push(api.esl.zones.list().then(setZones))
      if (subTab === "syncs") p.push(api.esl.syncs.list().then(setSyncs))
      if (subTab === "dashboard") p.push(api.esl.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const handleConfirmSync = async (id: string) => {
    try { await api.esl.syncs.confirm(id); toast.success("Sync confirmado"); fetchAll() }
    catch (e: any) { toast.error(e.message) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "devices", l: "Dispositivos", i: Tag },
    { k: "zones", l: "Zonas", i: Radio },
    { k: "syncs", l: "Syncs", i: Zap },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              subTab === t.k ? "bg-white dark:bg-slate-700 shadow-lg text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}><t.i className="w-4 h-4" />{t.l}</button>
        ))}
      </div>

      {subTab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total ESL", value: dashData.total_dispositivos || 0, icon: Tag },
            { label: "Online", value: dashData.online || 0, icon: Wifi },
            { label: "Offline", value: dashData.offline || 0, icon: AlertTriangle },
            { label: "Batería Baja", value: dashData.bateria_baja || 0, icon: Battery },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm text-gray-500">{s.label}</p><s.icon className="w-5 h-5 text-gray-400" /></div>
              <p className="text-3xl font-bold text-gray-800 mt-2">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === "devices" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Etiquetas Electrónicas</h3>
            <button onClick={() => setShowDeviceModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nuevo ESL</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devices.map(d => (
              <div key={d.id} className={`p-4 rounded-xl border ${d.estado === "offline" ? "border-red-300 bg-red-50/30" : "border-gray-200/50"} ${!d.bateria_pct || d.bateria_pct < 20 ? "border-amber-300" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{d.codigo_dispositivo}</p>
                    <p className="text-sm text-gray-600">{d.producto_nombre || <span className="italic text-gray-400">Sin asignar</span>}</p>
                    {d.precio_actual && <p className="text-lg font-bold text-emerald-700">{formatPYG(d.precio_actual)}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.estado === "online" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{d.estado}</span>
                    {d.bateria_pct && <p className={`text-xs mt-1 ${d.bateria_pct < 20 ? "text-red-600 font-bold" : "text-gray-400"}`}><Battery className="w-3 h-3 inline" /> {d.bateria_pct}%</p>}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{d.ubicacion} {d.zona_nombre ? `· ${d.zona_nombre}` : ""}</p>
                {d.ultima_sync && <p className="text-xs text-gray-400">Última sync: {formatDateTime(d.ultima_sync)}</p>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">💡 Dispositivos offline o con batería &lt;20% necesitan atención. Asigná un producto para que muestre precio.</p>
        </div>
      )}

      {subTab === "zones" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Zonas ESL</h3>
            <button onClick={() => setShowZoneModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Zona</button>
          </div>
          <div className="space-y-2">
            {zones.map(z => (
              <div key={z.id} className="p-3 rounded-xl bg-gray-50/50 dark:bg-slate-700/50">
                <p className="font-medium">{z.nombre}</p>
                {z.descripcion && <p className="text-xs text-gray-400">{z.descripcion}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "syncs" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Sincronizaciones ESL</h3>
            <button onClick={() => setShowSyncModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4" /> Nueva Sync</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200/50"><th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th><th className="text-right py-3 px-2 font-medium text-gray-500">Anterior</th><th className="text-right py-3 px-2 font-medium text-gray-500">Nuevo</th><th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th><th className="text-center py-3 px-2 font-medium text-gray-500"></th></tr></thead>
              <tbody>{syncs.map(s => (
                <tr key={s.id} className="border-b border-gray-100/50">
                  <td className="py-3 px-2">{s.producto_nombre}</td>
                  <td className="py-3 px-2 text-right">{formatPYG(s.precio_anterior)}</td>
                  <td className="py-3 px-2 text-right font-bold text-emerald-700">{formatPYG(s.precio_nuevo)}</td>
                  <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado === "confirmado" ? "bg-green-100 text-green-700" : s.estado === "enviado" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{s.estado}</span></td>
                  <td className="py-3 px-2 text-center">{s.estado === "enviado" && <button onClick={() => handleConfirmSync(s.id)} className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs"><Check className="w-3 h-3 inline" /> Confirmar</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">💡 Flujo: cambiar precio en sistema → enviar a ESL → dispositivo confirma recepción. Syncs sin confirmar pueden reintentarse.</p>
        </div>
      )}
    </div>
  )
}
