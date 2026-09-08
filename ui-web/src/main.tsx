import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ToastProvider } from "./context/ToastContext"
import ErrorBoundary from "./components/ErrorBoundary"
import { ConfirmProvider } from "./components/ConfirmDialog"
import App from "./App"
import "./index.css"

// Credencial de estacion pasada por URL (?token=...). Se procesa ACA, antes de
// montar React: si se hiciera dentro de la pantalla, ProtectedRoute evaluaria
// la sesion primero, no encontraria nada y mandaria al login sin llegar nunca
// a guardar el token -- el enlace de configuracion no serviria.
;(() => {
  try {
    const url = new URL(window.location.href)
    const token = url.searchParams.get("token")
    if (token) {
      localStorage.setItem("access_token", token)
      // Copia permanente. La credencial de estacion no tiene refresh_token, y
      // el cliente borra access_token ante cualquier 401 --incluso uno pasajero,
      // como el de un reinicio del API a mitad de un pedido--. Sin esta copia,
      // un 401 de un segundo destruye para siempre una credencial de 5 anios y
      // el gondolero se encuentra con una pantalla de login.
      localStorage.setItem("station_token", token)
      url.searchParams.delete("token")
      window.history.replaceState({}, "", url.pathname + url.search + url.hash)
    }
    // Al arrancar: si la sesion se perdio pero esta maquina es una estacion,
    // se restaura sola. Nadie tiene que escribir una contrasena.
    const estacion = localStorage.getItem("station_token")
    if (!localStorage.getItem("access_token") && estacion) {
      localStorage.setItem("access_token", estacion)
    }
  } catch {
    // sin acceso a localStorage (modo restringido): que la app arranque igual
  }
})()

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
