import React, { useState, useEffect, useRef, useMemo } from "react"
import { Search, X, User, Check, Loader2, MapPin, AlertTriangle, ShieldAlert } from "lucide-react"
import { api } from "../api"

export interface CustomerOption {
  id: string
  razon_social?: string
  nombre?: string
  nombre_fantasia?: string
  ruc?: string
  telefono?: string
  direccion?: string
  latitud?: number
  longitud?: number
  tiene_gps?: boolean
  limite_credito?: number
  saldo_utilizado?: number
  saldo_pendiente?: number
  bloqueado_por_mora?: boolean
}

export interface CustomerSearchInputProps {
  value?: string
  customerId?: string
  onSelectCustomer: (customer: CustomerOption) => void
  onClear?: () => void
  customers?: CustomerOption[]
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  showGpsBadge?: boolean
  autoFocus?: boolean
}

let cachedCustomers: CustomerOption[] | null = null

export default function CustomerSearchInput({
  value,
  customerId,
  onSelectCustomer,
  onClear,
  customers: propCustomers,
  label,
  placeholder = "Buscar por Razón Social, Nombre o RUC...",
  required = false,
  disabled = false,
  className = "",
  showGpsBadge = false,
  autoFocus = false,
}: CustomerSearchInputProps) {
  const [internalCustomers, setInternalCustomers] = useState<CustomerOption[]>(() => propCustomers || cachedCustomers || [])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (propCustomers && propCustomers.length > 0) {
      setInternalCustomers(propCustomers)
      cachedCustomers = propCustomers
      return
    }

    if (!cachedCustomers) {
      setLoading(true)
      api.customers
        .list({ limit: 1000 })
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res?.data || []
          cachedCustomers = list
          setInternalCustomers(list)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setInternalCustomers(cachedCustomers)
    }
  }, [propCustomers])

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

  // Encontrar el cliente seleccionado actual
  const selectedCustomer = useMemo(() => {
    if (customerId) {
      return internalCustomers.find((c) => c.id === customerId) || null
    }
    if (value) {
      return internalCustomers.find(
        (c) =>
          c.id === value ||
          (c.razon_social && c.razon_social.toLowerCase() === value.toLowerCase()) ||
          (c.nombre && c.nombre.toLowerCase() === value.toLowerCase())
      ) || null
    }
    return null
  }, [customerId, value, internalCustomers])

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return internalCustomers.slice(0, 25)
    const qClean = q.replace(/[^0-9kK]/g, "")

    return internalCustomers
      .filter((c) => {
        const razon = (c.razon_social || "").toLowerCase()
        const nombre = (c.nombre || "").toLowerCase()
        const fantasia = (c.nombre_fantasia || "").toLowerCase()
        const rucRaw = (c.ruc || "").toLowerCase()
        const rucClean = rucRaw.replace(/[^0-9kK]/g, "")
        const dir = (c.direccion || "").toLowerCase()

        const matchText = razon.includes(q) || nombre.includes(q) || fantasia.includes(q) || dir.includes(q)
        const matchRuc = rucRaw.includes(q) || (qClean.length >= 2 && rucClean.includes(qClean))
        return matchText || matchRuc
      })
      .slice(0, 30)
  }, [query, internalCustomers])

  const handleSelect = (customer: CustomerOption) => {
    onSelectCustomer(customer)
    setQuery("")
    setIsOpen(false)
  }

  const handleClear = () => {
    if (onClear) {
      onClear()
    }
    setQuery("")
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {selectedCustomer?.bloqueado_por_mora && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
              <ShieldAlert className="w-3 h-3" /> Bloqueado por mora
            </span>
          )}
        </label>
      )}

      {selectedCustomer ? (
        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-950/30 text-xs text-slate-800 dark:text-slate-100 shadow-sm transition">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="font-bold truncate flex items-center gap-2">
                <span>{selectedCustomer.razon_social || selectedCustomer.nombre}</span>
                {selectedCustomer.ruc && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200/70 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200">
                    RUC: {selectedCustomer.ruc}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                {selectedCustomer.direccion && <span>{selectedCustomer.direccion}</span>}
                {showGpsBadge && (
                  selectedCustomer.latitud && selectedCustomer.longitud ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <MapPin className="w-3 h-3" /> GPS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> Sin GPS
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg hover:bg-blue-200/50 dark:hover:bg-blue-900/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition ml-2 shrink-0"
              title="Cambiar cliente"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Search className="w-4 h-4" />}
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Menú desplegable */}
      {isOpen && !selectedCustomer && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs">
          {filteredCustomers.length === 0 ? (
            <div className="p-3 text-center text-slate-400">
              No se encontraron clientes coincidentes con "{query}".
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const hasGps = Boolean(cust.latitud && cust.longitud)
              return (
                <div
                  key={cust.id}
                  onClick={() => handleSelect(cust)}
                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                      <span>{cust.razon_social || cust.nombre}</span>
                      {cust.nombre_fantasia && cust.nombre_fantasia !== cust.razon_social && (
                        <span className="text-[10px] text-slate-400 font-normal italic">
                          ({cust.nombre_fantasia})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                      {cust.ruc && <span className="font-mono">RUC: {cust.ruc}</span>}
                      {cust.direccion && <span className="truncate max-w-[200px]">{cust.direccion}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasGps ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <MapPin className="w-2.5 h-2.5" /> GPS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        Sin GPS
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
