import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
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

export default function EcommerceOrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) { navigate("/tienda/login"); return }
    if (id) ecommerceApi.orderDetail(id).then(setOrder).catch(() => navigate("/tienda/pedidos")).finally(() => setLoading(false))
  }, [id])

  if (loading) return <EcommerceLayout><div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></EcommerceLayout>
  if (!order) return <EcommerceLayout><div className="text-center py-12 text-gray-400">Pedido no encontrado</div></EcommerceLayout>

  return (
    <EcommerceLayout>
      <Link to="/tienda/pedidos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        ← Volver a mis pedidos
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Pedido #{order.numero}</h1>
            <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString("es-PY")}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.estado] || "bg-gray-100"}`}>
            {statusLabels[order.estado] || order.estado}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-500">Método de Pago</p>
            <p className="font-medium text-sm capitalize">{order.metodo_pago || "—"}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-500">Estado del Pago</p>
            <p className="font-medium text-sm">{order.pago_estado === "pagado" ? "Pagado" : "Pendiente"}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-bold text-blue-600">Gs. {order.total?.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-500">Items</p>
            <p className="font-medium">{order.items?.length || 0}</p>
          </div>
        </div>

        {order.direccion_envio && (
          <div className="mb-6">
            <h3 className="font-semibold text-sm mb-1">Dirección de Envío</h3>
            <p className="text-sm text-gray-500">{order.direccion_envio}</p>
          </div>
        )}

        {order.notas && (
          <div className="mb-6">
            <h3 className="font-semibold text-sm mb-1">Notas</h3>
            <p className="text-sm text-gray-500">{order.notas}</p>
          </div>
        )}

        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Productos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-500 font-medium">Producto</th>
                <th className="text-right py-2 text-gray-500 font-medium">Cant.</th>
                <th className="text-right py-2 text-gray-500 font-medium">Precio</th>
                <th className="text-right py-2 text-gray-500 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2.5 font-medium">{item.product_nombre || item.product_id?.slice(0, 8)}</td>
                  <td className="py-2.5 text-right">{item.cantidad}</td>
                  <td className="py-2.5 text-right">Gs. {item.precio_unitario?.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-medium">Gs. {item.subtotal?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right py-2 font-semibold">Total</td>
                <td className="text-right py-2 font-bold text-blue-600">Gs. {order.total?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {order.payments && order.payments.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-2">Pagos</h3>
            <div className="space-y-2">
              {order.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg px-4 py-2">
                  <span className="capitalize">{p.metodo}</span>
                  <span className="font-medium">Gs. {p.monto?.toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.estado === "confirmado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.estado}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.invoice_id && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link to={`/api/v1/invoices/${order.invoice_id}/pdf`} target="_blank"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
              📄 Descargar Factura (PDF)
            </Link>
          </div>
        )}
      </div>
    </EcommerceLayout>
  )
}
