import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"

interface WidgetProps {
  title: string
  subtitle?: string
  children: ReactNode
  loading?: boolean
  error?: string | null
  className?: string
  action?: ReactNode
  size?: "sm" | "md" | "lg" | "full"
}

const sizeMap = {
  sm: "lg:col-span-1",
  md: "lg:col-span-2",
  lg: "lg:col-span-3",
  full: "lg:col-span-4",
}

export function Widget({ title, subtitle, children, loading, error, className = "", action, size = "md" }: WidgetProps) {
  return (
    <div className={`card p-5 ${sizeMap[size]} ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 py-4 text-center">{error}</div>
      ) : (
        children
      )}
    </div>
  )
}
