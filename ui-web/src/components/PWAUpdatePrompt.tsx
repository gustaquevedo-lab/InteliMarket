/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useRef } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useToast } from "../context/ToastContext"

const CHECK_INTERVAL_MS = 30 * 60 * 1000

export function PWAUpdatePrompt() {
  const toast = useToast()
  const notified = useRef(false)

  const { needRefresh } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    if (needRefresh[0] && !notified.current) {
      notified.current = true
      toast.info(
        "Actualización disponible",
        "Se aplicará sola la próxima vez que se cierre sesión o se reinicie la aplicación, sin interrumpir la venta actual."
      )
    }
  }, [needRefresh, toast])

  return null
}
