export function InteliMarketIsotype({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className} fill="none">
      <defs>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Punto de la 'i' */}
      <circle cx="165" cy="110" r="34" fill="url(#greenGrad)" />

      {/* Barra vertical izquierda (tallo de 'i' / trasera carrito) */}
      <rect x="138" y="172" width="54" height="160" rx="27" fill="url(#blueGrad)" />

      {/* Barra vertical central (centro 'M') */}
      <rect x="229" y="212" width="54" height="120" rx="27" fill="url(#blueGrad)" />

      {/* Barra vertical derecha (frente carrito) */}
      <rect x="320" y="172" width="54" height="160" rx="27" fill="url(#blueGrad)" />

      {/* Barra base conectora */}
      <rect x="138" y="278" width="236" height="54" rx="27" fill="url(#blueGrad)" />

      {/* Ruedas del carrito */}
      <circle cx="192" cy="405" r="30" fill="url(#greenGrad)" />
      <circle cx="320" cy="405" r="30" fill="url(#greenGrad)" />
    </svg>
  )
}

export function InteliMarketIsotypeWhite({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className} fill="none">
      <defs>
        <linearGradient id="greenGradWhite" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Punto de la 'i' */}
      <circle cx="165" cy="110" r="34" fill="url(#greenGradWhite)" />

      {/* Barras en blanco brillante */}
      <rect x="138" y="172" width="54" height="160" rx="27" fill="#ffffff" />
      <rect x="229" y="212" width="54" height="120" rx="27" fill="#ffffff" />
      <rect x="320" y="172" width="54" height="160" rx="27" fill="#ffffff" />
      <rect x="138" y="278" width="236" height="54" rx="27" fill="#ffffff" />

      {/* Ruedas */}
      <circle cx="192" cy="405" r="30" fill="url(#greenGradWhite)" />
      <circle cx="320" cy="405" r="30" fill="url(#greenGradWhite)" />
    </svg>
  )
}

export default function Logo({ variant = "full" }: { variant?: "full" | "icon" }) {
  if (variant === "icon") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-slate-900/60 dark:bg-slate-800/80 border border-slate-700/50 p-1.5 flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <InteliMarketIsotypeWhite className="w-6 h-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-slate-900/60 dark:bg-slate-800/80 border border-slate-700/50 p-1.5 flex items-center justify-center shadow-lg shadow-indigo-500/10">
        <InteliMarketIsotypeWhite className="w-6 h-6" />
      </div>
      <div className="flex items-baseline">
        <span className="text-lg font-black text-white tracking-tight">Inteli</span>
        <span className="text-lg font-black text-emerald-400 tracking-tight">market</span>
      </div>
    </div>
  )
}
