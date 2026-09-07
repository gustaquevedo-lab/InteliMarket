/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useRef } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useToast } from "../context/ToastContext"
import { setPwaUpdateState } from "../utils/pwaUpdate"

const CHECK_INTERVAL_MS = 30 * 60 * 1000

export function PWAUpdatePrompt() {
  const toast = useToast()
  const notified = useRef(false)

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    setPwaUpdateState(needRefresh[0], () => updateServiceWorker(true))
    if (needRefresh[0] && !notified.current) {
      notified.current = true
      toast.info(
        "Actualización disponible",
        "Se aplicará sola la próxima vez que se cierre sesión o se reinicie la aplicación, sin interrumpir la venta actual."
      )
    }
  }, [needRefresh, toast, updateServiceWorker])

  return null
}
