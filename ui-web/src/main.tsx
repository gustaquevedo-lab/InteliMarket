import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ToastProvider } from "./context/ToastContext"
import ErrorBoundary from "./components/ErrorBoundary"
import { ConfirmProvider } from "./components/ConfirmDialog"
import App from "./App"
import "./index.css"

// Desactivar Service Workers cacheados para evitar código viejo en el POS
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
    }
  })
}

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
