import { type ReactNode, useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  footer?: ReactNode
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
  closeOnOverlay?: boolean
  className?: string
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  full: "max-w-[95vw] h-[92vh]",
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  size = "md",
  closeOnOverlay = true,
  className = "",
}: ModalProps) {
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`relative w-full max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/60 dark:bg-slate-850/60">
            <div className="flex items-center gap-3">
              {icon && <div className="shrink-0">{icon}</div>}
              <div>
                <div className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  {title}
                </div>
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0 p-6">{children}</div>
        {footer && (
          <div className="flex-shrink-0 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

interface ModalHeaderProps {
  children: ReactNode
  className?: string
}

export function ModalHeader({ children, className = "" }: ModalHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 ${className}`}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 ${className}`}
    >
      {children}
    </div>
  )
}
