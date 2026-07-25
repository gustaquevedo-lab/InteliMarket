import { useState, useCallback } from "react"
import { api } from "../api"

export function useAsync<T>() {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      setData(result)
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, execute, setData }
}

export function formatPYG(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(",", ".")) : value
  return "₲ " + num.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
}
