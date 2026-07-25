import { useState, useEffect } from "react"
import { Bell, ShoppingCart, CreditCard, Package, AlertTriangle, Settings, Tag, Trash2, Check, X, Clock, Filter } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api, Notification, NotificationTemplate, UserNotificationPreference } from "../../api"

const demoNotifications: Notification[] = [
  { id: "1", tenant_id: "", user_id: "", title: "Nueva venta registrada", body: "Venta #1234 por Gs. 2.500.000", tipo: "venta", link: "/sales", leida: false, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "2", tenant_id: "", user_id: "", title: "Pago recibido", body: "Cliente Juan Pérez pagó Gs. 500.000", tipo: "pago", link: "/payments", leida: false, created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "3", tenant_id: "", user_id: "", title: "Stock bajo", body: "Producto 'Laptop HP' con stock mínimo", tipo: "inventario", link: "/inventory", leida: true, created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "4", tenant_id: "", user_id: "", title: "Alerta de sistema", body: "Copia de seguridad completada", tipo: "sistema", leida: true, created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "5", tenant_id: "", user_id: "", title: "Promoción activa", body: "20% de descuento en electrónica", tipo: "promocion", leida: true, created_at: new Date(Date.now() - 48 * 3600000).toISOString() },
  { id: "6", tenant_id: "", user_id: "", title: "Nueva venta", body: "Venta #1235 por Gs. 1.200.000", tipo: "venta", link: "/sales", leida: true, created_at: new Date(Date.now() - 72 * 3600000).toISOString() },
]

const tipoIcons: Record<string, typeof ShoppingCart> = {
  venta: ShoppingCart,
  pago: CreditCard,
  inventario: Package,
  alerta: AlertTriangle,
  sistema: Settings,
  promocion: Tag,
}

const tipos = ["todas", "venta", "pago", "inventario", "alerta", "sistema", "promocion"]

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString("es-PY")
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("todas")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrefs, setShowPrefs] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    try {
      const unread_only = activeTab === "no_leidas"
      const tipo_filter = activeTab !== "todas" && activeTab !== "no_leidas" ? activeTab : undefined
      const data = await api.notifications.listNotifications({ unread_only: unread_only, limit: 50 })
      let filtered = data.notifications
      if (tipo_filter) filtered = filtered.filter(n => n.tipo === tipo_filter)
      setNotifications(filtered)
    } catch {
      let filtered = demoNotifications
      if (activeTab === "no_leidas") filtered = filtered.filter(n => !n.leida)
      else if (activeTab !== "todas") filtered = filtered.filter(n => n.tipo === activeTab)
      setNotifications(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotifications() }, [activeTab])

  async function handleMarkRead(n: Notification) {
    try {
      await api.notifications.markAsRead([n.id])
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
    } catch { setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x)) }
  }

  async function handleMarkAllRead() {
    try {
      await api.notifications.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
    } catch { setNotifications(prev => prev.map(n => ({ ...n, leida: true }))) }
  }

  async function handleDelete(id: string) {
    try {
      await api.notifications.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch { setNotifications(prev => prev.filter(n => n.id !== id)) }
  }

  const unreadCount = notifications.filter(n => !n.leida).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notificaciones</h1>
            <p className="text-gray-500 dark:text-gray-400">Gestiona tus notificaciones y preferencias</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showPrefs ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Preferencias
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              <Check className="w-4 h-4 inline mr-2" />
              Marcar todo leído
            </button>
          )}
        </div>
      </div>

      {showPrefs && (
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Preferencias de notificaciones</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tipos.filter(t => t !== "todas").map(tipo => (
              <div key={tipo} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{tipo}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  {["email", "push", "sms"].map(canal => (
                    <label key={canal} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="capitalize">{canal}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {["todas", "no_leidas", "venta", "pago", "inventario", "alerta", "sistema", "promocion"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {tab === "todas" ? "Todas" : tab === "no_leidas" ? "No leídas" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Clock className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-pulse" />
            <p className="text-gray-500">Cargando notificaciones...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No hay notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map(n => {
              const Icon = tipoIcons[n.tipo || "info"] || Bell
              return (
                <div
                  key={n.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!n.leida ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      n.tipo === "venta" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                      n.tipo === "pago" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                      n.tipo === "inventario" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
                      n.tipo === "alerta" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium ${n.leida ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>{n.title}</h4>
                        {!n.leida && <span className="w-2 h-2 bg-primary rounded-full" />}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{n.body}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{n.created_at ? formatTimeAgo(n.created_at) : "—"}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!n.leida && (
                        <button
                          onClick={() => handleMarkRead(n)}
                          className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Marcar como leído"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {n.link && (
                        <button
                          onClick={() => navigate(n.link!)}
                          className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Ir a"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}