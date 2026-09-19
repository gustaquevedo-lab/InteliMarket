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

/**
 * Formatea un valor monetario entero en Guaraníes (PYG) con separador de miles '.'
 * Ej: 1500000 -> "1.500.000", "" -> ""
 */
export function formatInputPYG(raw: string | number | null | undefined): { formatted: string; numValue: number } {
  if (raw == null || raw === "") return { formatted: "", numValue: 0 }
  const clean = String(raw).replace(/\D/g, "")
  if (!clean) return { formatted: "", numValue: 0 }
  const numValue = parseInt(clean, 10)
  return {
    formatted: numValue.toLocaleString("es-PY"),
    numValue,
  }
}

/**
 * Extrae el número entero de un string con formato de Guaraníes
 */
export function parseInputPYG(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0
  const clean = String(raw).replace(/\D/g, "")
  return clean ? parseInt(clean, 10) : 0
}

/**
 * Formatea un valor decimal (R$, US$) con separador de miles '.' y decimal ','
 * Ej: 1250.5 -> "1.250,50"
 */
export function formatDecimal(value: number | string | null | undefined, decimals = 2): string {
  if (value == null || value === "") return ""
  let num: number
  if (typeof value === "string") {
    num = parseFloat(value.replace(/\./g, "").replace(",", "."))
  } else {
    num = value
  }
  if (isNaN(num)) return ""
  return num.toLocaleString("es-PY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Procesa la entrada en tiempo real de un usuario para monedas con decimales (R$, US$).
 * Formatea miles con '.' y decimales con ',', manejando centavos con fluidez.
 * Si el usuario pulsa '.' o ',' se asume inicio de decimales.
 */
export function formatInputDecimal(raw: string | number | null | undefined): { formatted: string; numValue: number } {
  if (raw == null || raw === "") return { formatted: "", numValue: 0 }
  const str = String(raw).trim()
  if (!str) return { formatted: "", numValue: 0 }

  let hasDecimal = false
  let intStr = ""
  let decStr = ""

  if (str.includes(",")) {
    hasDecimal = true
    const parts = str.split(",")
    intStr = parts[0].replace(/\D/g, "")
    decStr = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2)
  } else if (str.endsWith(".")) {
    hasDecimal = true
    intStr = str.slice(0, -1).replace(/\D/g, "")
    decStr = ""
  } else if (/^\d+\.\d{1,2}$/.test(str)) {
    // Es un string decimal estándar (ej: "1250.50" o "0.25")
    hasDecimal = true
    const parts = str.split(".")
    intStr = parts[0].replace(/\D/g, "")
    decStr = parts[1].replace(/\D/g, "").slice(0, 2)
  } else {
    intStr = str.replace(/\D/g, "")
  }

  const intNum = intStr ? parseInt(intStr, 10) : 0
  const intFormatted = intStr ? intNum.toLocaleString("es-PY") : ""

  let formatted = intFormatted
  if (hasDecimal) {
    formatted = (intFormatted || "0") + "," + decStr
  }

  const numVal = Number((intStr || "0") + "." + (decStr || "0"))
  return { formatted, numValue: isNaN(numVal) ? 0 : numVal }
}

/**
 * Parsea un string decimal (en formato "1.250,50" o "1250.5") a number
 */
export function parseInputDecimal(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw
  const str = String(raw).trim()
  if (!str) return 0
  if (str.includes(",")) {
    const parts = str.split(",")
    const intPart = parts[0].replace(/\D/g, "") || "0"
    const decPart = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2) || "0"
    const val = parseFloat(`${intPart}.${decPart}`)
    return isNaN(val) ? 0 : val
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    // Miles en formato es-PY sin decimal
    return parseInt(str.replace(/\./g, ""), 10) || 0
  }
  const val = parseFloat(str.replace(/,/g, ""))
  return isNaN(val) ? 0 : val
}

