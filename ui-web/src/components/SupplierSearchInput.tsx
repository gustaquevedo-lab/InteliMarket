import React, { useState, useEffect, useRef, useMemo } from "react"
import { Search, X, Building2, Check, User, Loader2 } from "lucide-react"
import { api } from "../api"

export interface SupplierOption {
  id: string
  razon_social?: string
  nombre_fantasia?: string
  nombre?: string
  ruc?: string
  telefono?: string
  tipo_provision?: string
  total_productos?: number
}

export interface SupplierSearchInputProps {
  value: string
  supplierId?: string
  onSelectSupplier: (supplier: { id?: string; name: string; ruc?: string; supplier?: SupplierOption }) => void
  onClear?: () => void
  suppliers?: SupplierOption[]
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  allowManual?: boolean
  soloMercaderia?: boolean
  showTypeToggle?: boolean
  showProductCount?: boolean
}

let cachedSuppliers: SupplierOption[] | null = null

export default function SupplierSearchInput({
  value,
  supplierId,
  onSelectSupplier,
  onClear,
  suppliers: propSuppliers,
  label = "Beneficiario / Proveedor",
  placeholder = "Buscar por Razón Social, Nombre Fantasía o RUC...",
  required = false,
  disabled = false,
  className = "",
  allowManual = true,
  soloMercaderia = false,
  showTypeToggle = false,
  showProductCount = false,
}: SupplierSearchInputProps) {
  const [internalSuppliers, setInternalSuppliers] = useState<SupplierOption[]>(() => propSuppliers || cachedSuppliers || [])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [filterType, setFilterType] = useState<"mercaderia" | "todos">(soloMercaderia ? "mercaderia" : "todos")
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Sincronizar o cargar proveedores automáticamente si no se pasaron como prop
  useEffect(() => {
    if (propSuppliers && propSuppliers.length > 0) {
      setInternalSuppliers(propSuppliers)
      cachedSuppliers = propSuppliers
      return
    }

    if (!cachedSuppliers) {
      setLoading(true)
      api.purchases
        .listSuppliers()
        .then((data: any) => {
          const list = Array.isArray(data) ? data : []
          cachedSuppliers = list
          setInternalSuppliers(list)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setInternalSuppliers(cachedSuppliers)
    }
  }, [propSuppliers])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const mercaderiasCount = useMemo(() => {
    return internalSuppliers.filter((s) => (s.total_productos || 0) > 0 || s.tipo_provision === "bienes" || s.tipo_provision === "mixto").length
  }, [internalSuppliers])

  const filteredSuppliers = useMemo(() => {
    let list = internalSuppliers
    if (filterType === "mercaderia") {
      list = list.filter((s) => (s.total_productos || 0) > 0)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list.slice(0, 30)
    const qClean = q.replace(/[^0-9kK]/g, "")
    return list
      .filter((s) => {
        const razon = (s.razon_social || "").toLowerCase()
        const fantasia = (s.nombre_fantasia || "").toLowerCase()
        const nombre = (s.nombre || "").toLowerCase()
        const rucRaw = (s.ruc || "").toLowerCase()
        const rucClean = rucRaw.replace(/[^0-9kK]/g, "")
        
        const matchText = razon.includes(q) || fantasia.includes(q) || nombre.includes(q)
        const matchRuc = rucRaw.includes(q) || (qClean.length >= 2 && rucClean.includes(qClean))
        return matchText || matchRuc
      })
      .slice(0, 40)
  }, [internalSuppliers, query, filterType])

  const selectedSupplierObj = useMemo(() => {
    if (!supplierId && !value) return null
    if (supplierId) {
      const match = internalSuppliers.find((s) => s.id === supplierId)
      if (match) return match
    }
    return internalSuppliers.find(
      (s) =>
        (s.razon_social && s.razon_social.toLowerCase() === value.toLowerCase()) ||
        (s.nombre_fantasia && s.nombre_fantasia.toLowerCase() === value.toLowerCase()) ||
        (s.nombre && s.nombre.toLowerCase() === value.toLowerCase())
    )
  }, [supplierId, value, internalSuppliers])

  const handleSelect = (s: SupplierOption) => {
    const name = s.razon_social || s.nombre_fantasia || s.nombre || ""
    onSelectSupplier({ id: s.id, name, ruc: s.ruc, supplier: s })
    setQuery("")
    setIsOpen(false)
  }

  const handleManualBeneficiary = () => {
    if (!query.trim()) return
    onSelectSupplier({ name: query.trim() })
    setQuery("")
    setIsOpen(false)
  }

  const handleClear = () => {
    if (onClear) {
      onClear()
    } else {
      onSelectSupplier({ name: "" })
    }
    setQuery("")
  }

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="label-field mb-1 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {value && (
            <span className="text-[10px] font-normal text-slate-400">
              {supplierId || selectedSupplierObj ? "Proveedor registrado" : "Beneficiario manual"}
            </span>
          )}
        </label>
      )}

      {/* Si ya hay un beneficiario/proveedor seleccionado y no estamos buscando */}
      {value && !isOpen ? (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                supplierId || selectedSupplierObj
                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {supplierId || selectedSupplierObj ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{value}</span>
                {(selectedSupplierObj?.ruc || supplierId) && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                    RUC: {selectedSupplierObj?.ruc || "Registrado"}
                  </span>
                )}
                {showProductCount && selectedSupplierObj?.total_productos !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    selectedSupplierObj.total_productos > 0
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {selectedSupplierObj.total_productos} {selectedSupplierObj.total_productos === 1 ? "artículo" : "artículos"}
                  </span>
                )}
              </div>
              {selectedSupplierObj?.nombre_fantasia && selectedSupplierObj.nombre_fantasia !== value && (
                <p className="text-[10px] text-slate-400 truncate">Fantasia: {selectedSupplierObj.nombre_fantasia}</p>
              )}
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={() => {
                handleClear()
                setIsOpen(true)
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
              title="Cambiar beneficiario"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* Campo de Búsqueda Interactiva */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!isOpen) setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="input-field pl-9 pr-8 text-xs font-medium"
            />
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3" />}
            {!loading && query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Menú Desplegable con Resultados */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Selector de Tipo de Proveedor (Mercaderías vs Todos) */}
              {showTypeToggle && (
                <div className="sticky top-0 z-10 flex items-center gap-1 p-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setFilterType("mercaderia")}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                      filterType === "mercaderia"
                        ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <span>📦 Mercaderías ({mercaderiasCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("todos")}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                      filterType === "todos"
                        ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <span>📋 Todos ({internalSuppliers.length})</span>
                  </button>
                </div>
              )}

              {/* Opción de usar el texto manual tipeado (solo si allowManual es true) */}
              {allowManual && query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleManualBeneficiary}
                  className="w-full text-left px-3.5 py-2.5 bg-purple-50/70 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-purple-900 dark:text-purple-200 font-semibold">
                      Usar <strong className="underline">"{query.trim()}"</strong> como beneficiario particular
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
                    Manual
                  </span>
                </button>
              )}

              {filteredSuppliers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      <span>Cargando proveedores...</span>
                    </div>
                  ) : (
                    <div>
                      <p>No se encontraron proveedores con ese criterio de búsqueda.</p>
                      {filterType === "mercaderia" && (
                        <button
                          type="button"
                          onClick={() => setFilterType("todos")}
                          className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Ver en todos los proveedores ({internalSuppliers.length})
                        </button>
                      )}
                      {allowManual && query.trim() && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Podés pulsar arriba para usarlo como beneficiario manual.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                    <span>{filterType === "mercaderia" ? "Proveedores con Mercaderías" : "Todos los Proveedores"}</span>
                    <span>{filteredSuppliers.length} mostrados</span>
                  </div>
                  {filteredSuppliers.map((s) => {
                    const name = s.razon_social || s.nombre_fantasia || s.nombre || "Proveedor"
                    const isSelected = supplierId === s.id || value === name

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelect(s)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-purple-50/80 dark:hover:bg-purple-950/40 border-b border-slate-100 dark:border-slate-800/80 last:border-0 flex items-center justify-between transition ${
                          isSelected ? "bg-purple-50 dark:bg-purple-950/50 font-bold" : ""
                        }`}
                      >
                        <div className="overflow-hidden pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-semibold truncate">{name}</span>
                            {s.nombre_fantasia && s.nombre_fantasia !== s.razon_social && (
                              <span className="text-[10px] text-slate-400 truncate">({s.nombre_fantasia})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {s.ruc && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                RUC: {s.ruc}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {showProductCount && s.total_productos !== undefined && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                s.total_productos > 0
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                              }`}
                            >
                              {s.total_productos} {s.total_productos === 1 ? "artículo" : "artículos"}
                            </span>
                          )}
                          {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
