import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { CreditCard, QrCode, Building, Banknote, CheckCircle } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import EcommerceLayout from "./EcommerceLayout"

const paymentMethods = [
  { id: "pagopar", label: "Pagopar", icon: CreditCard, color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200" },
  { id: "kuapay", label: "Kuapay QR", icon: QrCode, color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-200" },
  { id: "bancard", label: "Bancard VPOS", icon: Building, color: "bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200" },
  { id: "transferencia", label: "Transferencia Bancaria", icon: Banknote, color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200" },
]

export default function EcommerceCheckout() {
  const [cart, setCart] = useState<any>(null)
  const [method, setMethod] = useState("")
  const [direccion, setDireccion] = useState("")
  const [notas, setNotas] = useState("")
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) { navigate("/tienda/login"); return }
    ecommerceApi.cart().then((c) => {
      if (!c.items?.length) { navigate("/tienda/carrito"); return }
      setCart(c)
    }).catch(() => navigate("/tienda/login")).finally(() => setLoading(false))
    ecommerceApi.me().then((m) => setDireccion(m.direccion_envio || "")).catch(() => {})
  }, [])

  const handleCheckout = async () => {
    if (!method) return
    setProcessing(true)
    try {
      const res = await ecommerceApi.checkout(method, direccion, notas)
      setResult(res)
    } catch {}
    setProcessing(false)
  }

  if (loading) return <EcommerceLayout><div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></EcommerceLayout>

  if (result) {
    return (
      <EcommerceLayout>
        <div className="max-w-md mx-auto text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Pedido Confirmado!</h2>
          <p className="text-gray-500 mb-2">Número: <span className="font-bold text-blue-600">{result.numero}</span></p>
          <p className="text-sm text-gray-400 mb-6">Total: Gs. {result.total?.toLocaleString()}</p>
          <div className="flex gap-3 justify-center">
            <Link to={`/tienda/pedido/${result.order_id}`} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Ver Pedido
            </Link>
            <Link to="/tienda" className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition">
              Seguir Comprando
            </Link>
          </div>
        </div>
      </EcommerceLayout>
    )
  }

  return (
    <EcommerceLayout>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Dirección de Envío</h3>
            <textarea value={direccion} onChange={(e) => setDireccion(e.target.value)}
              rows={2} className="input-field w-full" placeholder="Ingresá tu dirección de envío" />
          </div>

          {/* Payment */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Medio de Pago</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentMethods.map((pm) => (
                <button key={pm.id} onClick={() => setMethod(pm.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${method === pm.id ? `${pm.color} border-current` : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                  <pm.icon className="w-6 h-6" />
                  <span className="font-medium text-sm">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Notas (opcional)</h3>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
              rows={2} className="input-field w-full" placeholder="Instrucciones especiales..." />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 h-fit">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
          <div className="space-y-2 text-sm mb-4 max-h-60 overflow-y-auto">
            {cart?.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-gray-500 truncate">{item.product_nombre || "Producto"} x{item.cantidad}</span>
                <span className="font-medium">Gs. {item.subtotal?.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-blue-600">Gs. {cart?.total?.toLocaleString()}</span>
          </div>
          <button onClick={handleCheckout} disabled={!method || processing}
            className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition">
            {processing ? "Procesando..." : "Confirmar Pedido"}
          </button>
          {!method && <p className="text-xs text-red-500 mt-2 text-center">Seleccioná un medio de pago</p>}
        </div>
      </div>
    </EcommerceLayout>
  )
}
