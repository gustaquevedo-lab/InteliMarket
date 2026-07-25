import { useEffect } from "react"
import { useToast } from "../context/ToastContext"

export function PWAUpdatePrompt() {
  const toast = useToast()

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      toast.info("Actualización disponible", "Recargando para aplicar cambios...")
      window.location.reload()
    })
  }, [toast])

  return null
}
