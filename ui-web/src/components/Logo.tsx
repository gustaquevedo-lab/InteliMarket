export function InteliMarketIsotype({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="InteliMarket"
      className={`${className} object-contain`}
    />
  )
}

export function InteliMarketIsotypeWhite({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="InteliMarket"
      className={`${className} object-contain`}
    />
  )
}

export default function Logo({ variant = "full" }: { variant?: "full" | "icon" }) {
  if (variant === "icon") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-0.5 shadow-md shadow-indigo-950/30">
          <img src="/logo.png" alt="InteliMarket" className="w-full h-full object-contain" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-0.5 shadow-md shadow-indigo-950/30">
        <img src="/logo.png" alt="InteliMarket" className="w-full h-full object-contain" />
      </div>
      <div className="flex items-baseline">
        <span className="text-lg font-black text-white tracking-tight">Inteli</span>
        <span className="text-lg font-black text-teal-400 tracking-tight">market</span>
      </div>
    </div>
  )
}
