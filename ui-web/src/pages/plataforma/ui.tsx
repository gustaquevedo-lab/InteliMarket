import { ReactNode } from "react"
import { formatDistanceToNowStrict, format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, Bug, Globe, Monitor, Plug, Server, XCircle, Info } from "lucide-react"

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ")

export function hace(iso?: string | null): string {
  if (!iso) return "—"
  try { return formatDistanceToNowStrict(new Date(iso), { locale: es, addSuffix: true }) } catch { return "—" }
}
export function fecha(iso?: string | null): string {
  if (!iso) return "—"
  try { return format(new Date(iso), "dd/MM/yyyy HH:mm:ss") } catch { return "—" }
}
export const num = (n?: number | null) => (n ?? 0).toLocaleString("es-PY")

export const LEVEL: Record<string, { dot: string; chip: string; label: string; Icon: typeof Bug }> = {
  fatal: { dot: "bg-rose-600", chip: "bg-rose-600 text-white border-rose-700", label: "Fatal", Icon: XCircle },
  error: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30", label: "Error", Icon: Bug },
  warning: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30", label: "Aviso", Icon: AlertTriangle },
  info: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30", label: "Info", Icon: Info },
}

export const SOURCE: Record<string, { label: string; chip: string; Icon: typeof Bug }> = {
  backend: { label: "Servidor", chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30", Icon: Server },
  frontend: { label: "Navegador", chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30", Icon: Globe },
  electron: { label: "App de caja", chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30", Icon: Monitor },
  integration: { label: "Integración", chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30", Icon: Plug },
}

export function Chip({ className, children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border whitespace-nowrap", className)}>
      {children}
    </span>
  )
}

export function Card({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
          {right}
        </header>
      )}
      <div className={pad ? "px-4 pb-4 pt-1" : ""}>{children}</div>
    </section>
  )
}

export function Stat({ icon, label, value, sub, tone = "slate" }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: "slate" | "rose" | "amber" | "emerald" | "sky" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
      <div className={cx("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">{value}</div>
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

/** Mini grafico de linea con area, sin librerias: sirve para listas con muchas filas. */
export function Spark({ data, color = "#f43f5e", w = 96, h = 26 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(1, ...data)
  const n = Math.max(1, data.length - 1)
  const pts = data.map((v, i) => [(i / n) * w, h - 2 - (v / max) * (h - 5)])
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const area = `${line} L${w},${h} L0,${h} Z`
  const id = `sp${Math.abs(data.reduce((a, v, i) => a + v * (i + 3), 0)) % 9973}${data.length}`
  const total = data.reduce((a, b) => a + b, 0)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" role="img" aria-label={`${total} ocurrencias`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {total === 0 ? <line x1="0" x2={w} y1={h - 2} y2={h - 2} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1.5" /> : (
        <>
          <path d={area} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; badge?: number }[] }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5",
            value === o.value ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
          )}
        >
          {o.label}
          {!!o.badge && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] leading-[18px] text-center">{o.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 gap-2 text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">{icon}</div>
      <div className="text-sm font-black text-slate-700 dark:text-slate-200">{title}</div>
      {hint && <div className="text-xs max-w-sm">{hint}</div>}
    </div>
  )
}

export function Skel({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800", className)} />
}
