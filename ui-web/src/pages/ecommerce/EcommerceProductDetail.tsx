import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, ShoppingCart } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import EcommerceLayout from "./EcommerceLayout"

export default function EcommerceProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cantidad, setCantidad] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (id) {
      ecommerceApi.productDetail(id).then(setProduct).catch(() => {}).finally(() => setLoading(false))
    }
  }, [id])

  const handleAddToCart = async () => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) return
    try {
      await ecommerceApi.addToCart(id!, cantidad)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch {}
  }

  if (loading) return <EcommerceLayout><div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div></EcommerceLayout>

  if (!product) return <EcommerceLayout><div className="text-center py-12 text-gray-400">Producto no encontrado</div></EcommerceLayout>

  return (
    <EcommerceLayout>
      <Link to="/tienda" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver al catálogo
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <div className="h-64 md:h-96 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
            <span className="text-6xl text-gray-300">📦</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{product.nombre}</h1>
            {product.descripcion && <p className="text-gray-500">{product.descripcion}</p>}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">SKU:</span> <span className="font-medium">{product.sku}</span></div>
              <div><span className="text-gray-500">Código:</span> <span className="font-medium">{product.codigo_barra || "—"}</span></div>
              <div><span className="text-gray-500">Unidad:</span> <span className="font-medium">{product.unidad_medida || "Unidad"}</span></div>
              <div><span className="text-gray-500">IVA:</span> <span className="font-medium">{product.iva_tasa ? `${product.iva_tasa}%` : "—"}</span></div>
            </div>

            {product.prices && product.prices.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Precios</h3>
                <div className="space-y-1">
                  {product.prices.map((pr: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                      <span className="text-gray-500">{pr.lista?.slice(0, 8)}</span>
                      <span className="font-bold text-blue-600">Gs. {pr.precio?.toLocaleString()} ({pr.moneda})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stock:</span>
              <span className={`font-bold ${(product.stock || 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                {product.stock || 0} unidades
              </span>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} className="px-3 py-2 text-gray-500 hover:text-gray-700">-</button>
                <span className="px-4 py-2 font-medium text-gray-900 dark:text-white border-x border-gray-300 dark:border-gray-600">{cantidad}</span>
                <button onClick={() => setCantidad(cantidad + 1)} className="px-3 py-2 text-gray-500 hover:text-gray-700">+</button>
              </div>
              <button onClick={handleAddToCart}
                className={`flex-1 py-2.5 font-medium rounded-lg transition ${added ? "bg-green-500 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                {added ? "✓ Agregado" : "Agregar al Carrito"}
              </button>
            </div>

            {product.variants && product.variants.length > 0 && (
              <div className="pt-2">
                <h3 className="font-semibold text-sm mb-2">Variantes</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v: any) => (
                    <span key={v.id} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                      {v.tipo}: {v.valor} {v.precio_extra > 0 && `(+Gs. ${v.precio_extra.toLocaleString()})`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </EcommerceLayout>
  )
}
