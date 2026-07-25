import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Package } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import EcommerceLayout from "./EcommerceLayout"

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente", confirmado: "Confirmado", preparando: "En Preparación",
  enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado",
}
const statusColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparando: "bg-purple-100 text-purple-700",
  enviado: "bg-cyan-100 text-cyan-700",
  entregado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

export default function EcommerceOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) { navigate("/tienda/login"); return }
    ecommerceApi.orders().then(setOrders).catch(() => navigate("/tienda/login")).finally(() => setLoading(false))
  }, [])

  if (loading) return <EcommerceLayout><div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></EcommerceLayout>

  return (
    <EcommerceLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Pedidos</h1>
        <Link to="/tienda" className="text-sm text-blue-600 hover:underline">Ir al Catálogo</Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No tenés pedidos aún</p>
          <Link to="/tienda" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Comprar Ahora
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/tienda/pedido/${o.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 dark:text-white">#{o.numero}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[o.estado] || "bg-gray-100"}`}>
                  {statusLabels[o.estado] || o.estado}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{o.items_count} items · {o.metodo_pago || "—"} · {o.pago_estado === "pagado" ? "Pagado" : "Pendiente"}</span>
                <span className="font-bold text-blue-600">Gs. {o.total?.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(o.created_at).toLocaleString("es-PY")}</p>
            </Link>
          ))}
        </div>
      )}
    </EcommerceLayout>
  )
}
