import { ShoppingBag } from "lucide-react"

export default function Logo({ variant = "full" }: { variant?: "full" | "icon" }) {
  if (variant === "icon") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/30">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/30">
        <ShoppingBag className="w-5 h-5 text-white" />
      </div>
      <div className="flex items-baseline">
        <span className="text-lg font-bold text-white tracking-tight">Inteli</span>
        <span className="text-lg font-bold text-accent tracking-tight">market</span>
      </div>
    </div>
  )
}
