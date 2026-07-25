import { useState, useMemo } from "react"
import { Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
  sortable?: boolean
  sortValue?: (item: T) => string | number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T) => void
  className?: string
  pageSize?: number
  striped?: boolean
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No hay datos disponibles",
  onRowClick,
  className = "",
  pageSize = 0,
  striped = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : String((a as Record<string, unknown>)[sortKey] ?? "")
      const bv = col.sortValue ? col.sortValue(b) : String((b as Record<string, unknown>)[sortKey] ?? "")
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, columns])

  const totalPages = pageSize > 0 ? Math.ceil(sorted.length / pageSize) : 1
  const paged = pageSize > 0 ? sorted.slice(page * pageSize, (page + 1) * pageSize) : sorted

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-sm font-bold">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`table-cell select-none ${col.className || ""} ${col.sortable !== false ? "cursor-pointer hover:text-primary" : ""}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : col.sortable !== false ? (
                      <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-30" />
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item, i) => (
              <tr
                key={item.id}
                className={`table-row ${onRowClick ? "cursor-pointer hover:bg-primary/5" : ""} ${striped && i % 2 === 1 ? "bg-black/[0.02] dark:bg-white/[0.02]" : ""}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`table-td ${col.className || ""}`}>
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {sorted.length} resultados · Pág. {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button className="btn-ghost p-1" disabled={page === 0} onClick={() => setPage(0)}><ChevronsLeft className="w-4 h-4" /></button>
            <button className="btn-ghost p-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-bold mx-2">{page + 1}</span>
            <button className="btn-ghost p-1" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="w-4 h-4" /></button>
            <button className="btn-ghost p-1" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatusBadgeProps {
  status: string
  map?: Record<string, string>
  className?: string
}

export function StatusBadge({ status, map, className = "" }: StatusBadgeProps) {
  const defaults: Record<string, string> = {
    activo: "badge-success",
    confirmado: "badge-success",
    aprobado: "badge-success",
    completado: "badge-success",
    recibido: "badge-success",
    pagado: "badge-success",
    pendiente: "badge-warning",
    en_transito: "badge-warning",
    parcial: "badge-warning",
    borrador: "badge-accent",
    cancelado: "badge-danger",
    rechazado: "badge-danger",
    devuelto: "badge-danger",
    info: "badge-info",
  }
  const badgeClass = (map || defaults)[status] || "badge-info"
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${badgeClass} ${className}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center">
      {icon && <div className="mb-4 text-gray-300 dark:text-gray-600">{icon}</div>}
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
      {message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4">
          {action.label}
        </button>
      )}
    </div>
  )
}
