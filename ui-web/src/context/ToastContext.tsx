import React, { createContext, useContext, useState, useCallback, useRef } from "react"
import { AlertCircle, CheckCircle2, AlertTriangle, Info, Copy, MessageSquare, Check, X } from "lucide-react"

export type ToastType = "success" | "error" | "warning" | "info"

const WHATSAPP_NUMBER = "595994516360"

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  errorDetails?: string
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string, errorDetails?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${++nextId}`
      const newToast = { ...toast, id }
      setToasts((prev) => [...prev, newToast])
      const duration = toast.duration ?? (toast.type === "error" ? 8000 : 4000)
      if (duration > 0) {
        const timer = window.setTimeout(() => removeToast(id), duration)
        timersRef.current.set(id, timer)
      }
    },
    [removeToast]
  )

  const success = useCallback((title: string, message?: string) => addToast({ type: "success", title, message }), [addToast])
  const error = useCallback((title: string, message?: string, errorDetails?: string) => addToast({ type: "error", title, message, errorDetails, duration: 8000 }), [addToast])
  const warning = useCallback((title: string, message?: string) => addToast({ type: "warning", title, message }), [addToast])
  const info = useCallback((title: string, message?: string) => addToast({ type: "info", title, message }), [addToast])

  const contextValue = React.useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  }), [toasts, addToast, removeToast, success, error, warning, info])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyToast = async (toast: Toast) => {
    const text = `🚨 [Error InteliMarket]\n• Título: ${toast.title}\n• Detalle: ${toast.message || ""}\n• Contexto: ${toast.errorDetails || "N/A"}\n• Ruta: ${window.location.pathname}\n• Fecha: ${new Date().toLocaleString("es-PY")}`
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        throw new Error("fallback")
      }
    } catch {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        textarea.style.top = "-9999px"
        textarea.style.opacity = "0"
        textarea.setAttribute("readonly", "")
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      } catch (err) {
        console.error("Toast copy failed", err)
      }
    }
    setCopiedId(toast.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleWhatsAppToast = (toast: Toast) => {
    const text = `🚨 *Alerta de Error — InteliMarket*\n• *Título:* ${toast.title}\n• *Mensaje:* ${toast.message || ""}\n• *Módulo:* ${window.location.pathname}\n• *Hora:* ${new Date().toLocaleTimeString("es-PY")}`
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md animate-in slide-in-from-right duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800"
              : toast.type === "error"
              ? "bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800"
              : toast.type === "warning"
              ? "bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800"
              : "bg-blue-50/95 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800"
          }`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black ${
                toast.type === "success" ? "text-emerald-900 dark:text-emerald-200" :
                toast.type === "error" ? "text-rose-900 dark:text-rose-200" :
                toast.type === "warning" ? "text-amber-900 dark:text-amber-200" :
                "text-blue-900 dark:text-blue-200"
              }`}>
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-300 leading-snug">{toast.message}</p>
              )}

              {/* Botones de acción directa en Toasts de Error */}
              {toast.type === "error" && (
                <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-800/60 flex items-center gap-2">
                  <button
                    onClick={() => handleCopyToast(toast)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/80 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-white border border-rose-200 dark:border-rose-700 transition shadow-sm"
                  >
                    {copiedId === toast.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedId === toast.id ? "Copiado" : "Copiar"}
                  </button>

                  <button
                    onClick={() => handleWhatsAppToast(toast)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
                  >
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
