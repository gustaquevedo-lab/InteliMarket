import React, { useState, useEffect, useCallback, useRef } from "react"
import { Search, Loader2, AlertCircle, X } from "lucide-react"
import { api, type Product } from "../../api"
import { formatPYG } from "../../utils/format"

export interface ProductSearchPickerProps {
  selectedProduct: Product | null
  onSelect: (p: Product) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  onAfterSelect?: (p: Product) => void
}

/**
 * Buscador de productos con autocompletado por código de barra / SKU / nombre.
 * Soporta lectura rápida por pistola/lector (Enter automático con coincidencia exacta),
 * navegación por flechas del teclado y descarte visual claro.
 */
export default function ProductSearchPicker({
  selectedProduct,
  onSelect,
  onClear,
  placeholder = "Buscar por código de barra, SKU o nombre...",
  disabled = false,
  autoFocus = false,
  onAfterSelect,
}: ProductSearchPickerProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<any>(null)

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [])

  const selectProduct = useCallback(
    (p: Product) => {
      setQuery("")
      setResults([])
      setOpen(false)
      setErrorMessage(null)
      setSelectedIndex(-1)
      onSelect(p)
      onAfterSelect?.(p)
      // Mantener el foco en el input para carga continua de productos
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    },
    [onSelect, onAfterSelect]
  )

  const executeSearchAndSelect = useCallback(
    async (term: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      const cleanTerm = term.trim()
      if (!cleanTerm) return

      setLoading(true)
      setErrorMessage(null)

      try {
        const res = (await api.products.list({ search: cleanTerm, limit: 25 })) || []
        const qLower = cleanTerm.toLowerCase()

        // 1. Coincidencia exacta por código de barra
        const exactBarcode = res.find(
          (p) => p.codigo_barra && p.codigo_barra.trim().toLowerCase() === qLower
        )
        if (exactBarcode) {
          selectProduct(exactBarcode)
          return
        }

        // 2. Coincidencia exacta por SKU
        const exactSku = res.find((p) => p.sku && p.sku.trim().toLowerCase() === qLower)
        if (exactSku) {
          selectProduct(exactSku)
          return
        }

        // 3. Coincidencia exacta por nombre
        const exactName = res.find((p) => p.nombre && p.nombre.trim().toLowerCase() === qLower)
        if (exactName) {
          selectProduct(exactName)
          return
        }

        // 4. Si hay exactamente 1 resultado
        if (res.length === 1) {
          selectProduct(res[0])
          return
        }

        // 5. Si no se encontró ningún producto
        if (res.length === 0) {
          setResults([])
          setOpen(false)
          setErrorMessage(`No se encontró ningún producto con el código "${cleanTerm}"`)
          inputRef.current?.select()
          return
        }

        // 6. Múltiples resultados sin coincidencia exacta
        setResults(res)
        setSelectedIndex(0)
        setOpen(true)
        setErrorMessage(null)
      } catch (err: any) {
        setResults([])
        setOpen(false)
        setErrorMessage("Error al conectar con el servidor para buscar el producto.")
      } finally {
        setLoading(false)
      }
    },
    [selectProduct]
  )

  // Debounce para búsqueda interactiva por tipeo normal
  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) {
      setResults([])
      setSelectedIndex(-1)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      api.products
        .list({ search: clean, limit: 20 })
        .then((res) => {
          if (!cancelled) {
            setResults(res || [])
            setSelectedIndex(-1)
            setOpen(true)
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error("Error buscando productos:", err)
            setResults([])
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    searchTimeoutRef.current = timer
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // Manejador de teclado para lector de código de barras (Enter) y navegación con flechas
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        selectProduct(results[selectedIndex])
        return
      }
      if (results.length === 1) {
        selectProduct(results[0])
        return
      }
      executeSearchAndSelect(query)
    } else if (e.key === "ArrowDown") {
      if (!open && results.length > 0) {
        setOpen(true)
        setSelectedIndex(0)
      } else if (results.length > 0) {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      }
    } else if (e.key === "ArrowUp") {
      if (results.length > 0) {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setErrorMessage(null)
    }
  }

  if (disabled && selectedProduct) {
    return (
      <div className="input-field w-full text-xs font-bold opacity-60 flex items-center justify-between">
        <span>
          {selectedProduct.nombre} (SKU: {selectedProduct.sku})
        </span>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {selectedProduct && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setQuery("")
            setErrorMessage(null)
            setOpen(true)
          }}
          className="input-field w-full text-xs font-bold flex items-center justify-between disabled:opacity-60 bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
        >
          <span className="truncate text-left">
            {selectedProduct.nombre}{" "}
            <span className="font-mono text-slate-400 font-normal">
              ({selectedProduct.codigo_barra ? `Cód: ${selectedProduct.codigo_barra} · ` : ""}SKU:{" "}
              {selectedProduct.sku})
            </span>
          </span>
          {!disabled && (
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 shrink-0 ml-2"
              onClick={(e) => {
                e.stopPropagation()
                setQuery("")
                setErrorMessage(null)
                onClear?.()
              }}
            />
          )}
        </button>
      ) : (
        <div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              autoFocus={autoFocus || open}
              disabled={disabled}
              value={query}
              onChange={(e) => {
                const val = e.target.value
                setQuery(val)
                if (val.trim().length >= 2) {
                  setOpen(true)
                }
                if (errorMessage) setErrorMessage(null)
              }}
              onFocus={() => {
                if (query.trim().length >= 2 || results.length > 0) {
                  setOpen(true)
                }
              }}
              onClick={() => {
                if (query.trim().length >= 2 || results.length > 0) {
                  setOpen(true)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`input-field w-full text-xs font-bold pl-8 pr-8 ${
                errorMessage
                  ? "border-rose-400 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20 focus:border-rose-500"
                  : ""
              }`}
            />
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setResults([])
                  setOpen(false)
                  setErrorMessage(null)
                  inputRef.current?.focus()
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {errorMessage && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-fade-in shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute z-[100] mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl">
          {loading ? (
            <div className="p-3.5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Buscando productos...
            </div>
          ) : results.length === 0 ? (
            <div className="p-3.5 text-center text-xs text-rose-500 font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              Sin resultados para "{query}"
            </div>
          ) : (
            results.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectProduct(p)
                }}
                className={`w-full text-left px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex items-center justify-between gap-3 transition-colors ${
                  selectedIndex === idx
                    ? "bg-amber-100 dark:bg-amber-900/50"
                    : "hover:bg-amber-50 dark:hover:bg-amber-950/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {p.nombre}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                    {p.codigo_barra && (
                      <span>
                        Cod:{" "}
                        <strong className="text-slate-600 dark:text-slate-300">
                          {p.codigo_barra}
                        </strong>
                      </span>
                    )}
                    {p.sku && <span>SKU: {p.sku}</span>}
                  </div>
                </div>
                {p.precio_venta != null && (
                  <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {formatPYG(p.precio_venta)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
