import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ToastProvider } from "./context/ToastContext"
import ErrorBoundary from "./components/ErrorBoundary"
import { ConfirmProvider } from "./components/ConfirmDialog"
import App from "./App"
import "./index.css"

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
