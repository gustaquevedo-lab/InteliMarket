import { useState } from "react"
import { Search, Loader2 } from "lucide-react"

interface CatalogProduct {
  id: string
  nombre: string
  sku: string
  categoria?: string
  precio?: number
  stock?: { cantidad: number }
}

interface CatalogGridProps {
  products: CatalogProduct[]
  loading?: boolean
  onSelectProduct: (product: CatalogProduct) => void
  formatPrice: (value: number) => string
  selectedId?: string
}

export default function CatalogGrid({ products, loading, onSelectProduct, formatPrice, selectedId }: CatalogGridProps) {
  const [search, setSearch] = useState("")
  const [categoria, setCategoria] = useState("Todas")

  const categorias = ["Todas", ...Array.from(new Set(products.map(p => p.categoria || p.sku.split("-")[0])))]

  const filtered = products.filter(p => {
    const catNombre = p.categoria || p.sku.split("-")[0]
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoria === "Todas" || catNombre === categoria
    return matchSearch && matchCat
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input-field pl-10"
          placeholder="Buscar producto por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              categoria === c
                ? "bg-primary text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <span className="text-5xl mb-4">📦</span>
          <p className="text-sm font-bold">Sin productos</p>
          <p className="text-xs mt-1">No se encontraron productos con ese criterio</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProduct(p)}
              className={`card p-4 text-left hover:shadow-md transition-all group ${
                selectedId === p.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/30"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <span className="text-lg font-bold text-primary">{p.nombre.charAt(0)}</span>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">{p.nombre}</p>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{p.sku}</p>
              {p.stock && <p className="text-xs text-gray-400 mt-1">{p.stock.cantidad} disponibles</p>}
              {p.precio != null && <p className="text-base font-bold text-primary mt-2">{formatPrice(p.precio)}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
