import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"

interface KPICardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sublabel?: string
  trend?: { direction: "up" | "down"; value: string }
  color?: "green" | "blue" | "amber" | "purple" | "indigo" | "red" | "primary"
  loading?: boolean
  onClick?: () => void
}

const colorMap = {
  green: { icon: "text-green-500", value: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  blue: { icon: "text-blue-500", value: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  amber: { icon: "text-amber-500", value: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  purple: { icon: "text-purple-500", value: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  indigo: { icon: "text-indigo-500", value: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  red: { icon: "text-red-500", value: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
  primary: { icon: "text-primary", value: "text-primary", bg: "bg-primary/10" },
}

export function KPICard({ icon: Icon, label, value, sublabel, trend, color = "primary", loading, onClick }: KPICardProps) {
  const c = colorMap[color]
  return (
    <button onClick={onClick} className={`card p-5 w-full text-left transition-all hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend.direction === "up" ? "text-green-500" : "text-red-500"}`}>
            <span>{trend.direction === "up" ? "↑" : "↓"}</span>
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      ) : (
        <>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sublabel && <p className="text-sm text-gray-400 mt-1">{sublabel}</p>}
        </>
      )}
    </button>
  )
}
