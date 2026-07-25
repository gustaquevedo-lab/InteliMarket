import { createContext, useContext, useState, useCallback, useRef } from "react"

export type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
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
      const duration = toast.duration ?? 4000
      if (duration > 0) {
        const timer = window.setTimeout(() => removeToast(id), duration)
        timersRef.current.set(id, timer)
      }
    },
    [removeToast]
  )

  const success = useCallback((title: string, message?: string) => addToast({ type: "success", title, message }), [addToast])
  const error = useCallback((title: string, message?: string) => addToast({ type: "error", title, message, duration: 6000 }), [addToast])
  const warning = useCallback((title: string, message?: string) => addToast({ type: "warning", title, message }), [addToast])
  const info = useCallback((title: string, message?: string) => addToast({ type: "info", title, message }), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
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

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-right duration-200 ${
            toast.type === "success"
              ? "bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-800"
              : toast.type === "error"
              ? "bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-800"
              : toast.type === "warning"
              ? "bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-800"
              : "bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-800"
          }`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${
                toast.type === "success" ? "text-green-800 dark:text-green-200" :
                toast.type === "error" ? "text-red-800 dark:text-red-200" :
                toast.type === "warning" ? "text-amber-800 dark:text-amber-200" :
                "text-blue-800 dark:text-blue-200"
              }`}>
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-300">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
