import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Trash2, ArrowLeft, ShoppingBag, Plus, Minus, Truck,
  Store, ShieldCheck, CreditCard, ChevronRight, Sparkles, MapPin
} from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import EcommerceLayout from "./EcommerceLayout"

export default function EcommerceCart() {
  const toast = useToast()
  const navigate = useNavigate()

  const [items, setItems] = useState<any[]>([])
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery")
  const [selectedBranch, setSelectedBranch] = useState("Sucursal Central (Av. Eusebio Ayala)")
  const [loading, setLoading] = useState(true)

  const loadCart = async () => {
    setLoading(true)
    const token = localStorage.getItem("ecommerce_token")
    if (token) {
      try {
        const c: any = await ecommerceApi.cart()
        setItems(c.items || [])
      } catch {
        // Cargar del local
        const local = JSON.parse(localStorage.getItem("super_extra_cart") || "[]")
        setItems(local)
      }
    } else {
      const local = JSON.parse(localStorage.getItem("super_extra_cart") || "[]")
      setItems(local)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCart()
  }, [])

  const handleUpdateQty = (itemId: string, delta: number) => {
    const next = items.map((i) => {
      if (i.id === itemId || i.product_id === itemId) {
        const newQ = Math.max(1, (i.cantidad || 1) + delta)
        return { ...i, cantidad: newQ }
      }
      return i
    })
    setItems(next)
    localStorage.setItem("super_extra_cart", JSON.stringify(next))

    const token = localStorage.getItem("ecommerce_token")
    if (token) {
      const item = items.find((i) => i.id === itemId)
      if (item) {
        ecommerceApi.updateCartItem(itemId, Math.max(1, item.cantidad + delta)).catch(() => {})
      }
    }
  }

  const handleRemove = (itemId: string) => {
    const next = items.filter((i) => i.id !== itemId && i.product_id !== itemId)
    setItems(next)
    localStorage.setItem("super_extra_cart", JSON.stringify(next))
    toast.info("Producto eliminado", "Se quitó el producto del carrito")

    const token = localStorage.getItem("ecommerce_token")
    if (token) {
      ecommerceApi.removeCartItem(itemId).catch(() => {})
    }
  }

  const subtotal = items.reduce((sum, i) => sum + ((i.precio_unitario || i.precio || 0) * (i.cantidad || 1)), 0)
  const deliveryCost = deliveryType === "delivery" ? (subtotal > 150000 ? 0 : 15000) : 0
  const total = subtotal + deliveryCost

  if (loading) {
    return (
      <EcommerceLayout>
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 font-bold">Cargando tu carrito de compras...</p>
        </div>
      </EcommerceLayout>
    )
  }

  return (
    <EcommerceLayout>
      <div className="space-y-6">
        <Link to="/tienda" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-red-600 transition">
          <ArrowLeft className="w-4 h-4" /> Volver a las Góndolas & Catálogo
        </Link>

        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
              Carrito de Compras
            </h1>
            <p className="text-xs text-gray-400">Revisá tus productos antes de confirmar el pedido</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800">
            {items.length} {items.length === 1 ? "artículo" : "artículos"}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="card p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-4 max-w-md mx-auto my-8 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto text-3xl">
              🛒
            </div>
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Tu carrito está vacío</h3>
            <p className="text-xs text-gray-400">Explorá las miles de ofertas y productos frescos de Super Extra</p>
            <Link
              to="/tienda"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-red-600/20 transition"
            >
              <span>Explorar Catálogo</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* LISTA DE PRODUCTOS */}
            <div className="lg:col-span-2 space-y-3">
              <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100 dark:divide-slate-800/80">
                {items.map((item) => {
                  const itemId = item.id || item.product_id
                  const price = Number(item.precio_unitario || item.precio || 0)
                  const itemSubtotal = price * (item.cantidad || 1)

                  return (
                    <div key={itemId} className="p-4 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                      {/* FOTO */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.imagen_url ? (
                          <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>

                      {/* DETALLE */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-xs text-gray-900 dark:text-white truncate">
                          {item.nombre}
                        </h4>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {formatPYG(price)} x unidad
                        </p>
                      </div>

                      {/* CANTIDAD */}
                      <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                        <button
                          onClick={() => handleUpdateQty(itemId, -1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-xs px-1">{item.cantidad || 1}</span>
                        <button
                          onClick={() => handleUpdateQty(itemId, 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* SUBTOTAL & BORRAR */}
                      <div className="text-right shrink-0">
                        <p className="font-mono font-black text-sm text-red-600 dark:text-red-400">
                          {formatPYG(itemSubtotal)}
                        </p>
                        <button
                          onClick={() => handleRemove(itemId)}
                          className="text-[10px] text-gray-400 hover:text-red-600 flex items-center gap-0.5 mt-1 ml-auto transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* AVISO DE ENVIO GRATIS */}
              {subtotal < 150000 && deliveryType === "delivery" && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    ¡Agregá <strong>{formatPYG(150000 - subtotal)}</strong> más para tener <strong>Envío Gratis</strong> a tu domicilio!
                  </span>
                </div>
              )}
            </div>

            {/* RESUMEN DEL PEDIDO & MODALIDAD */}
            <div className="space-y-4">
              <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                  Modalidad de Entrega
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDeliveryType("delivery")}
                    className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                      deliveryType === "delivery"
                        ? "border-red-600 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold shadow-xs"
                        : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <Truck className="w-4 h-4 text-red-600 mb-1" />
                    <p className="font-extrabold text-xs">Delivery</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">A tu puerta</p>
                  </button>

                  <button
                    onClick={() => setDeliveryType("pickup")}
                    className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                      deliveryType === "pickup"
                        ? "border-red-600 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold shadow-xs"
                        : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <Store className="w-4 h-4 text-red-600 mb-1" />
                    <p className="font-extrabold text-xs">Retiro Pickup</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">En auto (Gratis)</p>
                  </button>
                </div>

                {deliveryType === "pickup" && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 text-xs">
                    <p className="font-black uppercase text-[9px] text-gray-400 mb-1">Sucursal de Retiro</p>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-transparent font-bold text-gray-800 dark:text-gray-200 outline-none text-xs"
                    >
                      <option value="Sucursal Central (Av. Eusebio Ayala)">Sucursal Central (Av. Eusebio Ayala)</option>
                      <option value="Sucursal Shopping (Av. Mcal. López)">Sucursal Shopping (Av. Mcal. López)</option>
                      <option value="Sucursal Centro (Calle Palma)">Sucursal Centro (Calle Palma)</option>
                    </select>
                  </div>
                )}

                {/* TOTALES */}
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal Productos</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-gray-500">
                    <span>Costo de Envío</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {deliveryCost === 0 ? <strong className="text-emerald-600">¡GRATIS!</strong> : formatPYG(deliveryCost)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-baseline">
                    <span className="font-black uppercase text-sm text-gray-900 dark:text-white">Total a Pagar</span>
                    <span className="font-mono font-black text-xl text-red-600 dark:text-red-400">
                      {formatPYG(total)}
                    </span>
                  </div>
                </div>

                <Link
                  to="/tienda/checkout"
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition active:scale-95 text-center"
                >
                  <span>Continuar al Pago</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-medium text-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Factura legal con RUC/CI garantizada</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </EcommerceLayout>
  )
}
