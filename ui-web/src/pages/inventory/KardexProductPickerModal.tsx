import React, { useState, useEffect, useRef } from "react"
import { Search, Loader2, X, Package } from "lucide-react"
import { api, type Product } from "../../api"

interface KardexProductPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectProduct: (p: Product) => void
}

/**
 * Modal estándar (Regla 14) para buscar cualquier producto en la BD (~11.000+ productos)
 * y abrir su Kardex detallado. Soporta búsqueda con debounce y pistola/lector.
 */
export default function KardexProductPickerModal({
  isOpen,
  onClose,
  onSelectProduct,
}: KardexProductPickerModalProps) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setSearch("")
      setResults([])
      return
    }

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const clean = search.trim()
    if (!clean) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const prods = await api.products.list({ search: clean, limit: 20 })
        if (!cancelled) {
          setResults(prods || [])
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault()
      onSelectProduct(results[0])
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera (shrink-0) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm leading-tight">
                Consultar Kardex en Base de Datos
              </h3>
              <p className="text-[10px] text-slate-400">
                Búsqueda en tiempo real sobre todos los productos del supermercado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador Superior Fijo (shrink-0) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí nombre, código de barras o SKU (o escaneá con pistola)..."
              className="input-field pl-9 pr-8 py-2 text-xs w-full font-medium"
            />
            {loading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading && results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Consultando base de datos...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
              <Package className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p>
                {search.trim()
                  ? `No se encontraron productos coincidentes con "${search}"`
                  : "Escribí o escaneá para buscar entre los 11.000+ productos"}
              </p>
            </div>
          ) : (
            results.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className="p-3 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer flex items-center justify-between rounded-xl transition group"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {p.nombre}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono mt-0.5">
                    <span>SKU: {p.sku}</span>
                    {p.codigo_barra && <span>CB: {p.codigo_barra}</span>}
                    {p.supplier_nombre && (
                      <span className="text-slate-500 font-sans truncate max-w-[150px]">
                        Prov: {p.supplier_nombre}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
                  Ver Kardex →
                </span>
              </div>
            ))
          )}
        </div>

        {/* Pie de Acciones Fijo (shrink-0) */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-mono">
            {results.length > 0 ? `${results.length} coincidencias encontradas` : "Listo para buscar"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
