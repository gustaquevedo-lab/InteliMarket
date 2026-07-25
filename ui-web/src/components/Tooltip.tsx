import { useState, useRef } from "react"

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>()

  const posClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        clearTimeout(timeout.current)
        setShow(true)
      }}
      onMouseLeave={() => {
        timeout.current = setTimeout(() => setShow(false), 100)
      }}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 ${posClasses[position]} px-2 py-1 text-xs font-bold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded shadow-lg whitespace-nowrap animate-fade-in`}
          onMouseEnter={() => clearTimeout(timeout.current)}
          onMouseLeave={() => setShow(false)}
        >
          {content}
        </div>
      )}
    </div>
  )
}
