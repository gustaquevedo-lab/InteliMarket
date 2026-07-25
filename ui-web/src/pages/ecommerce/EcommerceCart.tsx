import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Trash2, ArrowLeft, ShoppingBag } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import EcommerceLayout from "./EcommerceLayout"

export default function EcommerceCart() {
  const [cart, setCart] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadCart = () => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) { navigate("/tienda/login"); return }
    ecommerceApi.cart().then(setCart).catch(() => navigate("/tienda/login")).finally(() => setLoading(false))
  }

  useEffect(() => { loadCart() }, [])

  const handleUpdate = async (itemId: string, delta: number) => {
    const item = cart.items.find((i: any) => i.id === itemId)
    if (!item) return
    const newQ = Math.max(0.5, item.cantidad + delta)
    try {
      const c = await ecommerceApi.updateCartItem(itemId, newQ)
      setCart(c)
    } catch {}
  }

  const handleRemove = async (itemId: string) => {
    try {
      const c = await ecommerceApi.removeCartItem(itemId)
      setCart(c)
    } catch {}
  }

  if (loading) return <EcommerceLayout><div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></EcommerceLayout>

  return (
    <EcommerceLayout>
      <Link to="/tienda" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Seguir comprando
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Carrito de Compras</h1>

      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400">Tu carrito está vacío</p>
          <Link to="/tienda" className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Ver Catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {cart.items.map((item: any) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/tienda/producto/${item.product_id}`} className="font-medium text-sm text-gray-900 dark:text-white hover:text-blue-600 truncate block">
                    {item.product_nombre || item.product_id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">Gs. {item.precio_unitario?.toLocaleString()} / ud.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => handleUpdate(item.id, -1)} className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-700 text-sm">-</button>
                    <span className="w-8 text-center font-medium text-sm">{item.cantidad}</span>
                    <button onClick={() => handleUpdate(item.id, 1)} className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-gray-700 text-sm">+</button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-blue-600">Gs. {item.subtotal?.toLocaleString()}</p>
                  <button onClick={() => handleRemove(item.id)} className="mt-1 text-red-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 h-fit">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">Gs. {cart.total?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Descuento</span>
                <span className="font-medium text-green-600">Gs. 0</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-blue-600">Gs. {cart.total?.toLocaleString()}</span>
              </div>
            </div>
            <Link to="/tienda/checkout"
              className="mt-4 block w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition">
              Ir a Pagar
            </Link>
          </div>
        </div>
      )}
    </EcommerceLayout>
  )
}
