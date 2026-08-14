export function formatPYG(value: number | string | null | undefined): string {
  if (value == null) return "₲ 0"
  let num: number
  if (typeof value === "number") {
    num = value
  } else {
    const str = String(value).trim()
    if (str.includes(".") && str.includes(",")) {
      num = parseFloat(str.replace(/\./g, "").replace(",", "."))
    } else {
      num = parseFloat(str)
    }
  }
  if (isNaN(num)) return "₲ 0"
  return `₲ ${Math.round(num).toLocaleString("es-PY")}`
}

export function formatUSD(value: number | string | null | undefined): string {
  if (value == null) return "$ 0.00"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "$ 0.00"
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCurrency(value: number | string | null | undefined, currency = "PYG"): string {
  if (currency === "USD") return formatUSD(value)
  return formatPYG(value)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
}

export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
  if (value == null) return "0"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0"
  return num.toLocaleString("es-PY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "0%"
  return `${value.toFixed(decimals)}%`
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), ms)
  }
}
