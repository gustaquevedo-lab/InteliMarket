// Los formularios de Operaciones de Salón (equipos, HACCP, rotisería, etc.)
// inicializan sus campos opcionales de fecha/número como "" (el valor por
// defecto de un <input> controlado en React) -- pero el backend (Pydantic)
// espera Optional[date]/Optional[Decimal] y rechaza "" con un 422 real
// ("Input should be a valid date", "Input should be a valid decimal"),
// distinto de omitir el campo. Se usa antes de mandar cualquier payload de
// creación/edición de esos módulos, para que un campo opcional vacío se
// omita de verdad en vez de viajar como string vacío.
export function cleanOptionalPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === "" || value === undefined) continue
    cleaned[key] = value
  }
  return cleaned as Partial<T>
}

export function formatPYG(value: number | string | null | undefined): string {
  if (value == null) return "₲ 0"
  let num: number
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      num = Math.round(parseFloat(trimmed))
    } else {
      num = Math.round(parseFloat(trimmed.replace(/\./g, "").replace(",", ".")))
    }
  } else {
    num = Math.round(value)
  }
  if (isNaN(num)) return "₲ 0"
  return `₲ ${num.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatUSD(value: number | string | null | undefined): string {
  if (value == null) return "US$ 0.00"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "US$ 0.00"
  return `US$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatBRL(value: number | string | null | undefined): string {
  if (value == null) return "R$ 0,00"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "R$ 0,00"
  return `R$ ${num.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCurrency(value: number | string | null | undefined, currency = "PYG"): string {
  if (currency === "USD") return formatUSD(value)
  if (currency === "BRL") return formatBRL(value)
  return formatPYG(value)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-PY", {
    timeZone: "America/Asuncion",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("es-PY", {
    timeZone: "America/Asuncion",
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
  return d.toLocaleTimeString("es-PY", {
    timeZone: "America/Asuncion",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getTodayAsuncion(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())
}

export function getAsuncionDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(d)
}

export function parseAsuncionDateStr(date: string | Date | null | undefined): string {
  if (!date) return ""
  try {
    const d = typeof date === "string" ? new Date(date) : date
    if (isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(d)
  } catch {
    return ""
  }
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
