import { useState, useEffect } from "react"
import { Smartphone, Store, Users, Package, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Activity, Search, Filter, Loader2, AlertCircle, MapPin, Globe, Settings, List, BarChart3, Tablet, Monitor, Shield, ToggleLeft } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "clientes" | "dispositivos" | "configuracion"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Activo", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  inactive: { label: "Inactivo", color: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400", icon: XCircle },
  blocked: { label: "Bloqueado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
  online: { label: "Online", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: Activity },
  offline: { label: "Offline", color: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400", icon: Clock },
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  android: { label: "Android", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ios: { label: "iOS", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
}

const DUMMY_DASHBOARD = {
  total_clientes: 28,
  activos: 22,
  bloqueados: 3,
  dispositivos_vinculados: 52,
  pedidos_mes: 186,
  ventas_mes: 12350000,
  ticket_promedio: 66398,
  comision_mes: 987500,
  clientes_nuevos_mes: 5,
  dispositivos_online: 18,
  pedidos_pendientes: 7,
}

const DUMMY_CLIENTES = [
  { id: "c1", nombre: "Distribuidora San Lorenzo SRL", ruc: "80012345-6", email: "info@sanlorenzo.com.py", telefono: "021 555 1001", ciudad: "San Lorenzo", direccion: "Avda. Mariscal López 4500", estado: "active", total_pedidos: 142, total_gastado: 18750000, ultimo_pedido: "2026-06-09T14:30:00", creado: "2025-08-15", encargado: "Carlos Benítez" },
  { id: "c2", nombre: "Supermercado La Familia", ruc: "80067890-1", email: "ventas@lafamilia.com.py", telefono: "021 555 2002", ciudad: "Asunción", direccion: "Avda. España 1500", estado: "active", total_pedidos: 98, total_gastado: 14200000, ultimo_pedido: "2026-06-08T10:15:00", creado: "2025-10-01", encargado: "María González" },
  { id: "c3", nombre: "Almacén Doña Juana", ruc: "80011123-4", email: "donajuana@gmail.com", telefono: "0981 123 456", ciudad: "Capiatá", direccion: "Calle Pettirossi 300", estado: "active", total_pedidos: 67, total_gastado: 8750000, ultimo_pedido: "2026-06-07T16:45:00", creado: "2025-11-20", encargado: "Juana Martínez" },
  { id: "c4", nombre: "Comercial ABC Importaciones", ruc: "80022234-5", email: "abc@importaciones.com.py", telefono: "021 555 3003", ciudad: "Asunción", direccion: "Avda. San Martín 2345", estado: "active", total_pedidos: 203, total_gastado: 26500000, ultimo_pedido: "2026-06-09T09:00:00", creado: "2025-06-01", encargado: "Roberto Acosta" },
  { id: "c5", nombre: "Despensa Don Pedro", ruc: "80033345-6", email: "donpedro@hotmail.com", telefono: "0982 987 654", ciudad: "Luque", direccion: "Avda. Rodríguez de Francia 500", estado: "inactive", total_pedidos: 12, total_gastado: 980000, ultimo_pedido: "2026-04-15T11:30:00", creado: "2026-01-10", encargado: "Pedro Ramírez" },
  { id: "c6", nombre: "Distribuidora Norte SRL", ruc: "80044456-7", email: "norte@distribuidora.com.py", telefono: "021 555 4004", ciudad: "Concepción", direccion: "Avda. Pinedo 789", estado: "active", total_pedidos: 45, total_gastado: 5600000, ultimo_pedido: "2026-06-06T13:20:00", creado: "2025-12-05", encargado: "Ana Martínez" },
  { id: "c7", nombre: "Almacén San Blas", ruc: "80055567-8", email: "sanblas@email.com.py", telefono: "0983 456 789", ciudad: "Itauguá", direccion: "Calle Gral. Díaz 120", estado: "blocked", total_pedidos: 8, total_gastado: 720000, ultimo_pedido: "2026-05-20T10:00:00", creado: "2026-02-14", encargado: "Blas Villalba" },
  { id: "c8", nombre: "Emporio Doña Rosa", ruc: "80066678-9", email: "rosasemporio@yahoo.com", telefono: "0984 567 890", ciudad: "San Antonio", direccion: "Avda. Acceso Sur 2340", estado: "active", total_pedidos: 34, total_gastado: 4100000, ultimo_pedido: "2026-06-05T15:10:00", creado: "2026-03-01", encargado: "Rosa López" },
]

const DUMMY_DISPOSITIVOS = [
  { id: "d1", nombre: "Samsung Galaxy A54", plataforma: "android", version_app: "3.2.1", ultima_sincronizacion: "2026-06-10T08:15:00", estado: "online", cliente: "Distribuidora San Lorenzo SRL", cliente_encargado: "Carlos Benítez", imei: "352627111111111" },
  { id: "d2", nombre: "Motorola G84", plataforma: "android", version_app: "3.2.1", ultima_sincronizacion: "2026-06-10T14:20:00", estado: "online", cliente: "Supermercado La Familia", cliente_encargado: "María González", imei: "352627222222222" },
  { id: "d3", nombre: "iPhone 14", plataforma: "ios", version_app: "3.2.0", ultima_sincronizacion: "2026-06-10T13:45:00", estado: "online", cliente: "Comercial ABC Importaciones", cliente_encargado: "Roberto Acosta", imei: "355477333333333" },
  { id: "d4", nombre: "Xiaomi Redmi Note 13", plataforma: "android", version_app: "3.2.1", ultima_sincronizacion: "2026-06-10T12:30:00", estado: "online", cliente: "Almacén Doña Juana", cliente_encargado: "Juana Martínez", imei: "352627444444444" },
  { id: "d5", nombre: "Samsung Galaxy Tab A9", plataforma: "android", version_app: "3.1.0", ultima_sincronizacion: "2026-06-08T17:00:00", estado: "offline", cliente: "Distribuidora Norte SRL", cliente_encargado: "Ana Martínez", imei: "352627555555555" },
  { id: "d6", nombre: "iPhone 13", plataforma: "ios", version_app: "3.2.0", ultima_sincronizacion: "2026-06-07T09:30:00", estado: "offline", cliente: "Despensa Don Pedro", cliente_encargado: "Pedro Ramírez", imei: "355477666666666" },
  { id: "d7", nombre: "Motorola Edge 50", plataforma: "android", version_app: "3.2.1", ultima_sincronizacion: "2026-06-10T07:00:00", estado: "online", cliente: "Emporio Doña Rosa", cliente_encargado: "Rosa López", imei: "352627777777777" },
  { id: "d8", nombre: "Samsung Galaxy A34", plataforma: "android", version_app: "3.1.2", ultima_sincronizacion: "2026-06-03T11:00:00", estado: "offline", cliente: "Almacén San Blas", cliente_encargado: "Blas Villalba", imei: "352627888888888" },
]

export default function ClientAppPage() {
  const [tab, setTab] = useState<Tab>("clientes")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const filteredClientes = DUMMY_CLIENTES.filter(c => {
    if (statusFilter && c.estado !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.nombre.toLowerCase().includes(q) && !c.ruc.includes(q) && !c.ciudad.toLowerCase().includes(q)) return false
    }
    return true
  })

  const filteredDispositivos = DUMMY_DISPOSITIVOS.filter(d => {
    if (platformFilter && d.plataforma !== platformFilter) return false
    if (statusFilter && d.estado !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.nombre.toLowerCase().includes(q) && !d.cliente.toLowerCase().includes(q) && !d.cliente_encargado.toLowerCase().includes(q)) return false
    }
    return true
  })

  const tabs = [
    { id: "clientes" as Tab, label: "Clientes Registrados", icon: Store },
    { id: "dispositivos" as Tab, label: "Dispositivos", icon: Tablet },
    { id: "configuracion" as Tab, label: "Configuración", icon: Settings },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-violet-500" />
            App Clientes — Marketplace B2B
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Administración de la aplicación móvil para pedidos B2B — clientes, dispositivos y configuración
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white dark:bg-slate-700 shadow-sm text-violet-600 dark:text-violet-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "clientes" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Store className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Clientes</p>
                  <p className="text-xl font-bold">{DUMMY_DASHBOARD.total_clientes}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Activos</p>
                  <p className="text-xl font-bold">{DUMMY_DASHBOARD.activos}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ventas Mes</p>
                  <p className="text-xl font-bold">{formatPYG(DUMMY_DASHBOARD.ventas_mes)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pedidos Mes</p>
                  <p className="text-xl font-bold">{DUMMY_DASHBOARD.pedidos_mes}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" placeholder="Buscar cliente..." />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" /> Filtros:
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase bg-gray-50 dark:bg-slate-800/50">
                    <th className="p-4">Cliente</th>
                    <th className="p-4">RUC</th>
                    <th className="p-4">Contacto</th>
                    <th className="p-4">Ciudad</th>
                    <th className="p-4">Pedidos</th>
                    <th className="p-4">Gastado</th>
                    <th className="p-4">Último Pedido</th>
                    <th className="p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin inline" /> Cargando...
                      </td>
                    </tr>
                  ) : filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">No se encontraron clientes</td>
                    </tr>
                  ) : filteredClientes.map(c => {
                    const sc = STATUS_CONFIG[c.estado] || STATUS_CONFIG.active
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{c.nombre}</span>
                            <span className="text-xs text-gray-500">{c.encargado}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400">{c.ruc}</td>
                        <td className="p-4">
                          <div className="flex flex-col text-xs">
                            <span>{c.email}</span>
                            <span className="text-gray-500">{c.telefono}</span>
                          </div>
                        </td>
                        <td className="p-4">{c.ciudad}</td>
                        <td className="p-4 font-medium">{c.total_pedidos}</td>
                        <td className="p-4 font-medium text-emerald-600">{formatPYG(c.total_gastado)}</td>
                        <td className="p-4 text-xs text-gray-500">
                          {c.ultimo_pedido ? new Date(c.ultimo_pedido).toLocaleDateString("es-PY") : "-"}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                            <sc.icon className="w-3 h-3" /> {sc.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "dispositivos" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Tablet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Dispositivos</p>
                  <p className="text-xl font-bold">{DUMMY_DASHBOARD.dispositivos_vinculados}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                  <p className="text-xl font-bold">{DUMMY_DASHBOARD.dispositivos_online}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Android</p>
                  <p className="text-xl font-bold">{DUMMY_DISPOSITIVOS.filter(d => d.plataforma === "android").length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Monitor className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">iOS</p>
                  <p className="text-xl font-bold">{DUMMY_DISPOSITIVOS.filter(d => d.plataforma === "ios").length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" placeholder="Buscar dispositivo..." />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" /> Filtros:
              </div>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                <option value="">Todas las plataformas</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPlatformFilter(platformFilter) }}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                <option value="">Todos los estados</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase bg-gray-50 dark:bg-slate-800/50">
                    <th className="p-4">Dispositivo</th>
                    <th className="p-4">Plataforma</th>
                    <th className="p-4">App</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Encargado</th>
                    <th className="p-4">Última Sync</th>
                    <th className="p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin inline" /> Cargando...
                      </td>
                    </tr>
                  ) : filteredDispositivos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">No se encontraron dispositivos</td>
                    </tr>
                  ) : filteredDispositivos.map(d => {
                    const sc = STATUS_CONFIG[d.estado] || STATUS_CONFIG.offline
                    const pc = PLATFORM_CONFIG[d.plataforma] || PLATFORM_CONFIG.android
                    return (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {d.plataforma === "ios" ? <Monitor className="w-4 h-4 text-gray-400" /> : <Smartphone className="w-4 h-4 text-green-500" />}
                            <span className="font-medium">{d.nombre}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pc.color}`}>
                            {pc.label}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs">v{d.version_app}</td>
                        <td className="p-4 font-medium">{d.cliente}</td>
                        <td className="p-4 text-sm">{d.cliente_encargado}</td>
                        <td className="p-4 text-xs text-gray-500">
                          {d.ultima_sincronizacion ? new Date(d.ultima_sincronizacion).toLocaleString("es-PY") : "-"}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                            <sc.icon className="w-3 h-3" /> {sc.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "configuracion" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-violet-500" /> Información del Marketplace</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Nombre del Marketplace</label>
                    <input type="text" defaultValue="InteliMarket B2B"
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">URL de Acceso</label>
                    <input type="text" defaultValue="https://b2b.intelimarket.com.py"
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-mono" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                  <textarea rows={3} defaultValue="Plataforma B2B para distribuidores y comercios — pedidos mayoristas, catálogo actualizado, seguimiento en tiempo real."
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Logo URL</label>
                  <input type="text" defaultValue="https://intelimarket.com.py/logo-b2b.png"
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-mono" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-violet-500" /> Reglas del Marketplace</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Pedido Mínimo (Gs)</label>
                    <input type="number" defaultValue={500000}
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Radio de Entrega (km)</label>
                    <input type="number" defaultValue={50}
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Comisión por Pedido (%)</label>
                    <input type="number" defaultValue={3.5} step={0.1}
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Plazo de Pago (días)</label>
                    <input type="number" defaultValue={30}
                      className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Habilitar Registro Abierto</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Requiere Aprobación Admin</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Notificar Nuevos Pedidos</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Sync Automático Catálogo</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Smartphone className="w-4 h-4 text-violet-500" /> Versión de la App</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Versión Actual</label>
                  <p className="text-lg font-bold text-violet-600">v3.2.1</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Última Actualización</label>
                  <p className="text-sm">10 Jun 2026</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Android (Google Play)</label>
                  <p className="text-sm font-mono">com.intelimarket.b2b</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">iOS (App Store)</label>
                  <p className="text-sm font-mono">com.intelimarket.b2b.ios</p>
                </div>
                <button className="w-full text-sm bg-violet-500 hover:bg-violet-600 text-white rounded-lg py-2 font-medium transition-colors flex items-center justify-center gap-1">
                  <Package className="w-4 h-4" /> Publicar Nueva Versión
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-violet-500" /> Resumen Financiero</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Comisión del Mes</span>
                  <span className="font-semibold text-emerald-600">{formatPYG(DUMMY_DASHBOARD.comision_mes)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ticket Promedio</span>
                  <span className="font-semibold">{formatPYG(DUMMY_DASHBOARD.ticket_promedio)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nuevos Clientes (Mes)</span>
                  <span className="font-semibold text-violet-600">{DUMMY_DASHBOARD.clientes_nuevos_mes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pedidos Pendientes</span>
                  <span className="font-semibold text-amber-600">{DUMMY_DASHBOARD.pedidos_pendientes}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-500" /> Cobertura Geográfica</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Asunción</span><span className="font-medium">12 clientes</span></div>
                <div className="flex justify-between"><span>San Lorenzo</span><span className="font-medium">5 clientes</span></div>
                <div className="flex justify-between"><span>Luque</span><span className="font-medium">3 clientes</span></div>
                <div className="flex justify-between"><span>Capiatá</span><span className="font-medium">3 clientes</span></div>
                <div className="flex justify-between"><span>Concepción</span><span className="font-medium">2 clientes</span></div>
                <div className="flex justify-between"><span>Itauguá</span><span className="font-medium">2 clientes</span></div>
                <div className="flex justify-between"><span>San Antonio</span><span className="font-medium">1 cliente</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
