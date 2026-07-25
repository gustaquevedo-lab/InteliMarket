import { motion } from "framer-motion"

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
  badge?: string
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors whitespace-nowrap ${
            active === tab.id
              ? "text-primary"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          {active === tab.id && (
            <motion.div
              layoutId="active-tab"
              className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-bold">
              {tab.count}
            </span>
          )}
          {tab.badge && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
