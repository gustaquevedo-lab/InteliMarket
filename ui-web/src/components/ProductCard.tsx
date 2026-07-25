import { Package } from "lucide-react"

interface ProductCardProps {
  nombre: string
  sku: string
  precio: number
  stock: number
  iva_tasa?: number
  imagen_url?: string | null
  selected?: boolean
  onSelect: () => void
  formatPrice: (v: number) => string
}

export function ProductCard({ nombre, sku, precio, stock, iva_tasa, imagen_url, selected, onSelect, formatPrice }: ProductCardProps) {
  const lowStock = stock > 0 && stock <= 5
  const outOfStock = stock <= 0

  return (
    <button
      onClick={onSelect}
      className={`card p-3 text-left hover:shadow-md transition-all relative group ${
        selected ? "ring-2 ring-primary shadow-lg" : ""
      } ${outOfStock ? "opacity-50" : ""}`}
    >
      {imagen_url ? (
        <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gray-100 dark:bg-gray-800">
          <img src={imagen_url} alt={nombre} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-full aspect-square rounded-lg mb-2 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
          <Package className="w-8 h-8 text-primary/40" />
        </div>
      )}

      {iva_tasa === 0 && (
        <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Exento</span>
      )}
      {iva_tasa === 5 && (
        <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">IVA 5%</span>
      )}
      {lowStock && (
        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{stock}u</span>
      )}

      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">{nombre}</p>
      <p className="text-[10px] font-mono text-gray-400 mt-0.5">{sku}</p>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-base font-black text-primary">{formatPrice(precio)}</p>
        {!outOfStock && (
          <p className="text-[10px] text-gray-400">{stock} disp.</p>
        )}
        {outOfStock && (
          <p className="text-[10px] text-red-400 font-bold">S/Stock</p>
        )}
      </div>
    </button>
  )
}
