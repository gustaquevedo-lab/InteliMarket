import { useState, useEffect, useRef } from "react"
import { Bell, X, ShoppingCart, CreditCard, Package, AlertTriangle, Settings, Tag, Check, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api, Notification } from "../api"

const demoNotifications: Notification[] = [
  { id: "1", tenant_id: "", user_id: "", title: "Nueva venta registrada", body: "Venta #1234 por Gs. 2.500.000", tipo: "venta", link: "/sales", leida: false, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "2", tenant_id: "", user_id: "", title: "Pago recibido", body: "Cliente Juan Pérez pagó Gs. 500.000", tipo: "pago", link: "/payments", leida: false, created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "3", tenant_id: "", user_id: "", title: "Stock bajo", body: "Producto 'Laptop HP' con stock mínimo", tipo: "inventario", link: "/inventory", leida: true, created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "4", tenant_id: "", user_id: "", title: "Alerta de sistema", body: "Copia de seguridad completada", tipo: "sistema", leida: true, created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "5", tenant_id: "", user_id: "", title: "Promoción activa", body: "20% de descuento en electrónica", tipo: "promocion", leida: true, created_at: new Date(Date.now() - 48 * 3600000).toISOString() },
]

const tipoIcons: Record<string, typeof ShoppingCart> = {
  venta: ShoppingCart,
  pago: CreditCard,
  inventario: Package,
  alerta: AlertTriangle,
  sistema: Settings,
  promocion: Tag,
}

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

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function loadNotifications() {
    try {
      const data = await api.notifications.listNotifications({ limit: 10 })
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      setNotifications(demoNotifications)
      setUnreadCount(demoNotifications.filter(n => !n.leida).length)
    } finally {
      setLoading(false)
    }
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.leida) {
      try {
        await api.notifications.markAsRead([n.id])
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch { setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x)) }
    }
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  async function markAllRead() {
    try {
      await api.notifications.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
      setUnreadCount(0)
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
      setUnreadCount(0)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Marcar todo como leído
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <Clock className="w-6 h-6 mx-auto mb-2 animate-pulse" />
                <p>Cargando...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = (n.tipo && tipoIcons[n.tipo]) || Bell
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!n.leida ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${n.tipo === "venta" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : n.tipo === "pago" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : n.tipo === "inventario" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : n.tipo === "alerta" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm truncate ${n.leida ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>{n.title}</p>
                          {!n.leida && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{n.created_at ? formatTimeAgo(n.created_at) : ""}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50">
            <button
              onClick={() => { setOpen(false); navigate("/notifications") }}
              className="w-full text-center text-sm text-primary hover:underline"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  )
}