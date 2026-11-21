import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ToastProvider } from "./context/ToastContext"
import ErrorBoundary from "./components/ErrorBoundary"
import { ConfirmProvider } from "./components/ConfirmDialog"
import App from "./App"
import { initMonitor } from "./monitor"
import "./index.css"

// Credencial de estacion pasada por URL (?token=...). Se procesa ACA, antes de
// montar React: si se hiciera dentro de la pantalla, ProtectedRoute evaluaria
// la sesion primero, no encontraria nada y mandaria al login sin llegar nunca
// a guardar el token -- el enlace de configuracion no serviria.
;(() => {
  try {
    const isValidJwt = (t: string | null | undefined): t is string => {
      if (!t || typeof t !== "string") return false
      const parts = t.trim().split(".")
      return parts.length === 3 && parts.every((p) => p.length > 0)
    }

    const url = new URL(window.location.href)
    const token = url.searchParams.get("token")
    if (token) {
      if (isValidJwt(token)) {
        localStorage.setItem("access_token", token)
        // Copia permanente. La credencial de estacion no tiene refresh_token, y
        // el cliente borra access_token ante cualquier 401 --incluso uno pasajero,
        // como el de un reinicio del API a mitad de un pedido--. Sin esta copia,
        // un 401 de un segundo destruye para siempre una credencial de 5 anios y
        // el gondolero se encuentra con una pantalla de login.
        localStorage.setItem("station_token", token)
      } else {
        console.warn("[Station] Token en URL inválido o truncado. Se ignora para no dañar la estación.")
      }
      url.searchParams.delete("token")
      window.history.replaceState({}, "", url.pathname + url.search + url.hash)
    }
    // Al arrancar: si la sesion se perdio pero esta maquina es una estacion,
    // se restaura sola si el token almacenado es estructuralmente valido.
    const estacion = localStorage.getItem("station_token")
    if (estacion && !isValidJwt(estacion)) {
      console.warn("[Station] station_token en localStorage corrupto o truncado. Purgando.")
      localStorage.removeItem("station_token")
      localStorage.removeItem("access_token")
    } else if (!localStorage.getItem("access_token") && estacion) {
      localStorage.setItem("access_token", estacion)
    }
  } catch {
    // sin acceso a localStorage (modo restringido): que la app arranque igual
  }
})()

// Manejo proactivo de chunks dinamicos desactualizados tras un nuevo deploy:
// si el navegador intenta cargar un hash anterior, recarga la pagina limpiamente.
window.addEventListener("vite:preloadError", (event) => {
  const key = "im_vite_preload_reload"
  const last = Number(sessionStorage.getItem(key) || 0)
  if (Date.now() - last > 15000) {
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }
})

try { initMonitor() } catch { /* el monitor nunca frena el arranque */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
)
