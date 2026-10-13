import { useEffect, useRef, useCallback } from "react"

interface SSEEvent {
  type: string
  [key: string]: unknown
}

interface UseSSEOptions {
  companyId: string
  onEvent?: (event: SSEEvent) => void
  enabled?: boolean
}

export function useSSE({ companyId, onEvent, enabled = true }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  const retryCount = useRef(0)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(() => {
    if (!enabled || !companyId) return

    const baseUrl = import.meta.env.VITE_API_URL || ""
    const cleanBase = baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl
    const token = localStorage.getItem("access_token") || ""
    const url = `${cleanBase}/api/v1/events/stream?company_id=${companyId}&token=${encodeURIComponent(token)}`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent
        if (data.type !== "ping") {
          onEventRef.current?.(data)
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      retryCount.current += 1
      if (retryCount.current < 3) {
        setTimeout(connect, 5000)
      } else {
        console.warn("SSE connection failed 3 times, giving up.")
      }
    }
  }, [enabled, companyId])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return { connect, disconnect }
}
