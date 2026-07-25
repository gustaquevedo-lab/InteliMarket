import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search, ShoppingCartPlus, Filter } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import EcommerceLayout from "./EcommerceLayout"

export default function EcommerceCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get("q") || "")
  const [categoryId, setCategoryId] = useState(searchParams.get("cat") || "")
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const perPage = 20

  const loadCatalog = () => {
    setLoading(true)
    const cat = categoryId || ""
    Promise.all([
      ecommerceApi.catalog(search, cat, page),
      ecommerceApi.categories(),
    ]).then(([catalog, cats]) => {
      setProducts(catalog.products || [])
      setTotal(catalog.total || 0)
      setCategories(cats || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadCatalog() }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadCatalog()
  }

  const handleAddToCart = async (productId: string) => {
    const token = localStorage.getItem("ecommerce_token")
    if (!token) return
    setAddingId(productId)
    try { await ecommerceApi.addToCart(productId, 1) } catch {}
    setAddingId(null)
  }

  return (
    <EcommerceLayout>
      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
        </form>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} productos encontrados</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition">
                <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-gray-300">📦</span>
                  )}
                </div>
                <div className="p-4">
                  <Link to={`/tienda/producto/${p.id}`}>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate hover:text-blue-600">{p.nombre}</h3>
                  </Link>
                  <p className="text-xs text-gray-500 mt-1 truncate">{p.descripcion || p.unidad_medida || ""}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-bold text-blue-600">Gs. {p.precio?.toLocaleString() || "—"}</span>
                    {p.stock > 0 ? (
                      <button onClick={() => handleAddToCart(p.id)} disabled={addingId === p.id}
                        className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-100 transition disabled:opacity-50">
                        <ShoppingCartPlus className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-red-500 font-medium">Sin stock</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Stock: {p.stock}</p>
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-12 text-gray-400">No se encontraron productos</div>
          )}

          {total > perPage && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: Math.ceil(total / perPage) }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${page === i + 1 ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </EcommerceLayout>
  )
}
