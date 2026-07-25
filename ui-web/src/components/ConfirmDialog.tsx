import { createContext, useContext, useState, useCallback } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions & { resolve: (value: boolean) => void; open: boolean }>({
    title: "",
    message: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "danger",
    resolve: () => {},
    open: false,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve, open: true })
    })
  }, [])

  const handleConfirm = () => {
    setState((prev) => {
      prev.resolve(true)
      return { ...prev, open: false }
    })
  }

  const handleCancel = () => {
    setState((prev) => {
      prev.resolve(false)
      return { ...prev, open: false }
    })
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                state.variant === "danger" ? "bg-red-100 dark:bg-red-900/30" :
                state.variant === "warning" ? "bg-amber-100 dark:bg-amber-900/30" :
                "bg-blue-100 dark:bg-blue-900/30"
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  state.variant === "danger" ? "text-red-600" :
                  state.variant === "warning" ? "text-amber-600" :
                  "text-blue-600"
                }`} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{state.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{state.message}</p>
              <div className="flex gap-3">
                <button onClick={handleCancel} className="btn-outline flex-1">{state.cancelText}</button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 text-white font-bold py-2 px-4 rounded-xl transition-colors ${
                    state.variant === "danger" ? "bg-red-600 hover:bg-red-700" :
                    state.variant === "warning" ? "bg-amber-600 hover:bg-amber-700" :
                    "bg-primary hover:bg-primary/90"
                  }`}
                >
                  {state.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx.confirm
}
