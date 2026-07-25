import { useState, useCallback, useRef, useEffect } from "react"
import { useToast } from "../context/ToastContext"

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
}

export function useApi<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options?: {
    autoFetch?: boolean
    successMessage?: string
    errorMessage?: string
  }
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })
  const abortRef = useRef(false)
  const toast = useToast()

  const execute = useCallback(
    async (...args: unknown[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const result = await fn(...args)
        if (!abortRef.current) {
          setState({ data: result, loading: false, error: null })
          if (options?.successMessage) toast.success(options.successMessage)
        }
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido"
        if (!abortRef.current) {
          setState({ data: null, loading: false, error: message })
          toast.error(options?.errorMessage || "Error", message)
        }
        return null
      }
    },
    [fn, options?.successMessage, options?.errorMessage, toast]
  )

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ data: null, loading: false, error: null })
  }, [])

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data, error: null }))
  }, [])

  useEffect(() => {
    if (options?.autoFetch) {
      execute()
    }
    return () => {
      abortRef.current = true
    }
  }, [execute, options?.autoFetch])

  return { ...state, execute, reset, setData }
}

interface UsePaginatedState<T> {
  data: T[]
  loading: boolean
  error: string | null
  page: number
  totalPages: number
}

export function usePaginated<T>(
  fn: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  options?: { limit?: number; autoFetch?: boolean }
) {
  const limit = options?.limit ?? 20
  const [state, setState] = useState<UsePaginatedState<T>>({
    data: [],
    loading: false,
    error: null,
    page: 1,
    totalPages: 1,
  })
  const toast = useToast()

  const fetchPage = useCallback(
    async (page: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null, page }))
      try {
        const result = await fn(page, limit)
        setState({
          data: result.items,
          loading: false,
          error: null,
          page,
          totalPages: Math.ceil(result.total / limit),
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error"
        setState((prev) => ({ ...prev, loading: false, error: message }))
        toast.error("Error al cargar datos", message)
      }
    },
    [fn, limit, toast]
  )

  useEffect(() => {
    if (options?.autoFetch) fetchPage(1)
  }, [fetchPage, options?.autoFetch])

  return {
    ...state,
    fetchPage,
    nextPage: () => state.page < state.totalPages && fetchPage(state.page + 1),
    prevPage: () => state.page > 1 && fetchPage(state.page - 1),
  }
}
