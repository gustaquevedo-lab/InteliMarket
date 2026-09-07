import type { MockBlock, MockColumn, MockRow } from "./types"

const badgeColorMap: Record<string, string> = {
  green: "badge-success",
  amber: "badge-warning",
  red: "badge-danger",
  blue: "badge-info",
  purple: "badge-accent",
  gray: "badge-gray",
}

const kpiColorMap: Record<string, string> = {
  green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
}

function formatMoney(n: string | number): string {
  if (typeof n === "string") {
    if (/[₲$]/.test(n)) return n
    const num = parseFloat(n.replace(/\D/g, "") || "0")
    return `₲ ${num.toLocaleString("es-PY")}`
  }
  return `₲ ${n.toLocaleString("es-PY")}`
}

function renderCell(col: MockColumn, raw: unknown, row: MockRow) {
  let content: React.ReactNode = String(raw ?? "")
  if (col.currency) content = formatMoney(typeof raw === "string" || typeof raw === "number" ? raw : "")
  if (col.badge) {
    const badgeKey = row.badges?.[col.value] ?? row.badge
    const color = typeof badgeKey === "string" && badgeColorMap[badgeKey] ? badgeKey : "gray"
    content = <span className={badgeColorMap[color] || badgeColorMap.gray}>{String(raw ?? "")}</span>
  }
  return <td className="table-td">{content}</td>
}

function TableBlock({ block }: { block: MockBlock }) {
  const cols = block.columns || []
  const rows: MockRow[] = block.rows || []
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-slate-900/60">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              {cols.map((c) => (
                <th key={c.label} className="table-cell">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="table-row">
                {cols.map((c) => renderCell(c, r[c.value], r))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiGridBlock({ block }: { block: MockBlock }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {(block.kpis || []).map((k, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`p-2 rounded-lg ${kpiColorMap[k.color || "blue"]}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            {k.trend && (
              <span className={`text-xs font-bold ${k.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                {k.trend === "up" ? "↑" : "↓"}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{k.label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 font-mono tabular-nums">{k.value}</p>
          {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function ListBlock({ block }: { block: MockBlock }) {
  return (
    <div className="space-y-2">
      {(block.items || []).map((item, i) => (
        <div key={i} className="card p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.title}</p>
            {item.sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{item.sub}</p>}
          </div>
          {item.right && <span className="text-sm font-bold text-gray-800 dark:text-gray-200 shrink-0">{item.right}</span>}
          {item.badge && (
            <span className={`${badgeColorMap[item.badgeColor || "gray"]} shrink-0`}>{item.badge}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function BarChartBlock({ block }: { block: MockBlock }) {
  const points = block.chart?.points || []
  const max = Math.max(...points.map((p) => p.value), 1)
  return (
    <div className="card p-4">
      <div className="flex items-end gap-2 h-40">
        {points.map((p, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full bg-blue-500/90 dark:bg-blue-500/80 rounded-t-md transition-all duration-500"
              style={{ height: `${Math.max((p.value / max) * 100, 4)}%` }} />
            <span className="text-[10px] font-medium text-gray-400">{p.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">{block.chart?.unit || ""} — valores ilustrativos</p>
    </div>
  )
}

function LineChartBlock({ block }: { block: MockBlock }) {
  const points = block.chart?.points || []
  const max = Math.max(...points.map((p) => p.value), 1)
  const w = 300, h = 120
  const stepX = w / Math.max(points.length - 1, 1)
  const coords = points.map((p, i) => ({ x: i * stepX, y: h - (p.value / max) * h }))
  return (
    <div className="card p-4">
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full h-40">
        <polyline points={coords.map((c) => `${c.x},${c.y}`).join(" ")} fill="none"
          stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <line x1="0" y1="0" x2="0" y2="0" stroke="none" />
      </svg>
      <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-1">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1 text-center">{block.chart?.unit || ""} — valores ilustrativos</p>
    </div>
  )
}

function AreaChartBlock({ block }: { block: MockBlock }) {
  const points = block.chart?.points || []
  const max = Math.max(...points.map((p) => p.value), 1)
  const w = 320, h = 120
  const stepX = w / Math.max(points.length - 1, 1)
  const coords = points.map((p, i) => ({ x: i * stepX, y: h - (p.value / max) * h }))
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ")
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <div className="card p-4">
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full h-40">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaGrad)" />
        <polyline points={coords.map((c) => `${c.x},${c.y}`).join(" ")} fill="none"
          stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] font-medium text-gray-400 mt-1">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1 text-center">{block.chart?.unit || ""} — valores ilustrativos</p>
    </div>
  )
}

function DonutChartBlock({ block }: { block: MockBlock }) {
  const points = block.chart?.points || []
  const total = points.reduce((s, p) => s + p.value, 0) || 1
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4"]
  const segments = points.reduce<Array<{ label: string; value: number; from: number; to: number; color: string }>>(
    (acc, p, i) => {
      const from = (acc.at(-1)?.to ?? 0)
      const to = from + (p.value / total) * 360
      acc.push({ ...p, from, to, color: colors[i % colors.length] })
      return acc
    },
    []
  )
  const polar = (angle: number, r: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return `${50 + r * Math.cos(rad)},${50 + r * Math.sin(rad)}`
  }
  return (
    <div className="card p-4 flex flex-col items-center">
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="w-40 h-40">
          {segments.map((s, i) => (
            <path key={i} d={`M50,50 L${polar(s.from, 40)} A40,40 0 ${s.to - s.from > 180 ? 1 : 0} 1 ${polar(s.to, 40)} Z`}
              fill={s.color} opacity={0.85} />
          ))}
        </svg>
        <div className="space-y-1.5">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="text-gray-400 font-bold">{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">valores ilustrativos</p>
    </div>
  )
}

function ChartBlock({ block }: { block: MockBlock }) {
  if (!block.chart) return null
  switch (block.chart.kind) {
    case "bar": return <BarChartBlock block={block} />
    case "line": return <LineChartBlock block={block} />
    case "area": return <AreaChartBlock block={block} />
    case "donut": return <DonutChartBlock block={block} />
    default: return null
  }
}

function FormBlock({ block }: { block: MockBlock }) {
  return (
    <div className="card p-5 space-y-4">
      {(block.formFields || []).map((f, i) => (
        <div key={i}>
          <label className="input-label">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
          <div className="relative">
            {f.type === "select" ? (
              <div className="input-field flex items-center justify-between cursor-pointer select-none">
                <span className="text-gray-900 dark:text-white text-sm">{f.value || f.placeholder || "Seleccione…"}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            ) : (
              <input
                type={f.type || "text"}
                readOnly
                value={f.value || ""}
                placeholder={f.placeholder}
                className="input-field cursor-default"
              />
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <span className="btn-primary text-xs py-2 px-4 cursor-default select-none">Guardar</span>
        <span className="btn-outline text-xs py-2 px-4 cursor-default select-none">Cancelar</span>
      </div>
    </div>
  )
}

function PosBlock(_props: { block: MockBlock }) {
  const items = [
    { nombre: "Coca-Cola 2.25L", qty: 2, precio: 9800, total: 19600 },
    { nombre: "Pan francés (docena)", qty: 1, precio: 7500, total: 7500 },
    { nombre: "Carne vacío", qty: 1.2, precio: 69000, total: 82800 },
  ]
  const total = items.reduce((s, i) => s + i.total, 0)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="card p-4">
        <p className="section-label">Carrito (3 ítems)</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-gray-700/50 pb-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{it.nombre}</p>
                <p className="text-xs text-gray-400">×{it.qty} · {formatMoney(it.precio)}</p>
              </div>
              <span className="font-bold text-gray-900 dark:text-white shrink-0">{formatMoney(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t-2 border-dashed border-gray-200 dark:border-gray-600 flex justify-between">
          <span className="font-black text-sm uppercase tracking-wider">TOTAL</span>
          <span className="font-black text-lg text-primary">{formatMoney(total)}</span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>Efectivo</span><span>{formatMoney(150000)}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-green-600">
          <span>Vuelto</span><span>{formatMoney(150000 - total)}</span>
        </div>
      </div>
      <div className="card p-4">
        <p className="section-label">Catálogo rápido</p>
        <div className="grid grid-cols-2 gap-2">
          {["Coca-Cola", "Pan francés", "Leche 1L", "Arroz 5kg", "Carne vacío", "Cerveza Pilsen"].map((p, i) => (
            <div key={i} className="pos-product-card !p-2.5">
              <p className="pos-product-name !text-xs">{p}</p>
              <p className="text-xs font-bold text-primary mt-0.5">{formatMoney([9800, 7500, 8900, 28500, 69000, 28500][i])}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          💡 Leer o escanear cualquier código agrega el producto al instante.
        </div>
      </div>
    </div>
  )
}

function ChatBlock({ block }: { block: MockBlock }) {
  return (
    <div className="card p-4 space-y-3">
      {(block.chatMessages || []).map((m, i) => (
        <div key={i} className={`flex ${m.from === "bot" ? "justify-start" : "justify-end"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
            m.from === "bot"
              ? "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
              : "bg-primary/10 text-gray-900 dark:text-white rounded-tr-sm"
          }`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  )
}

function ReciboBlock(_props: { block: MockBlock }) {
  return (
    <div className="flex justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-4 w-56 font-mono text-[10px] text-gray-800 dark:text-gray-200">
        <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
          <p className="font-bold text-xs">GRUPO SANTA TERESA E.A.S.</p>
          <p>RUC 80150377-9</p>
          <p>Avda. Principal esq. Curupayty Nº1450</p>
        </div>
        <p>Fecha: 07/09/2026 14:02</p>
        <p>Nº 001-012-00014825</p>
        <div className="border-b border-dashed border-gray-300 my-2" />
        {[
          ["Coca-Cola 2.25L", "×2", 19600],
          ["Pan francés (doc)", "×1", 7500],
          ["Carne vacío", "1.2kg", 82800],
        ].map((r, i) => (
          <div key={i} className="flex justify-between">
            <span>{r[0]}</span><span>{r[1]}</span><span>{formatMoney(r[2] as number)}</span>
          </div>
        ))}
        <div className="border-b border-dashed border-gray-300 my-2" />
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatMoney(109900)}</span></div>
        <div className="flex justify-between"><span>Efectivo</span><span>{formatMoney(150000)}</span></div>
        <div className="flex justify-between"><span>VUELTO</span><span>{formatMoney(40100)}</span></div>
        <div className="text-center mt-2 pt-2 border-t border-dashed border-gray-300">
          <p>¡Gracias por su compra!</p>
        </div>
      </div>
    </div>
  )
}

function MapBlock(_props: { block: MockBlock }) {
  return (
    <div className="relative card overflow-hidden h-52">
      <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="200" fill="#eef2f7" />
        {[40, 90, 140, 190, 240, 290, 340].map((x, i) => (
          <line key={i} x1={x} y1="0" x2={x - 60} y2="200" stroke="#dbe3ee" strokeWidth="6" />
        ))}
        {[20, 70, 120, 170].map((y, i) => (
          <line key={i} x1="0" y1={y} x2="400" y2={y + 30} stroke="#dbe3ee" strokeWidth="6" />
        ))}
        <circle cx="80" cy="70" r="8" fill="#22c55e" /><circle cx="80" cy="70" r="14" fill="#22c55e" opacity="0.25" />
        <circle cx="210" cy="120" r="8" fill="#3b82f6" /><circle cx="210" cy="120" r="14" fill="#3b82f6" opacity="0.25" />
        <circle cx="320" cy="60" r="8" fill="#f59e0b" /><circle cx="320" cy="60" r="14" fill="#f59e0b" opacity="0.25" />
        <circle cx="290" cy="160" r="8" fill="#a855f7" /><circle cx="290" cy="160" r="14" fill="#a855f7" opacity="0.25" />
      </svg>
      <div className="absolute bottom-2 left-2 right-2 flex gap-2 flex-wrap">
        {[{ c: "#22c55e", l: "Entregado" }, { c: "#3b82f6", l: "En tránsito" }, { c: "#f59e0b", l: "Asignado" }, { c: "#a855f7", l: "Pendiente" }].map((x, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white/90 dark:bg-slate-900/90 rounded-full px-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: x.c }} /> {x.l}
          </span>
        ))}
      </div>
    </div>
  )
}

function CalendarBlock(_props: { block: MockBlock }) {
  const days = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"]
  const marks: Record<number, string> = { 1: "bg-amber-100 text-amber-600", 4: "bg-green-100 text-green-600", 5: "bg-green-100 text-green-600", 6: "bg-green-100 text-green-600", 10: "bg-blue-100 text-blue-600" }
  return (
    <div className="card p-4">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((d) => <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</span>)}
        {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
          <div key={d} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold ${marks[d] || "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> Sin turno</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400" /> Producción</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-400" /> Entrega</span>
      </div>
    </div>
  )
}

function TradeGridBlock(_props: { block: MockBlock }) {
  const rows = [
    ["Lunes", "₲ 118.4M", "+4.2%", "up"],
    ["Martes", "₲ 104.2M", "−2.1%", "down"],
    ["Miércoles", "₲ 152.8M", "+9.8%", "up"],
    ["Jueves", "₲ 143.1M", "+6.4%", "up"],
    ["Viernes", "₲ 205.9M", "+15.1%", "up"],
    ["Sábado", "₲ 267.4M", "+21.2%", "up"],
    ["Domingo", "₲ 142.0M", "−3.5%", "down"],
  ]
  return (
    <div className="card p-4 space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-600 dark:text-gray-300 w-20">{r[0]}</span>
          <span className="font-bold text-gray-900 dark:text-white flex-1">{r[1]}</span>
          <span className={`text-xs font-bold ${r[3] === "up" ? "text-green-500" : "text-red-500"}`}>{r[2]}</span>
        </div>
      ))}
    </div>
  )
}

function WorkflowBlock({ block }: { block: MockBlock }) {
  const steps = (block.caption || "").split("→").map((s) => s.trim()).filter(Boolean)
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {s}
            </span>
            {i < steps.length - 1 && (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MockBlockViewer({ block }: { block: MockBlock }) {
  if (!block) return null
  return (
    <div className="space-y-2">
      {block.title && <p className="section-label">{block.title}</p>}
      {block.type === "kpiGrid" && <KpiGridBlock block={block} />}
      {block.type === "table" && <TableBlock block={block} />}
      {block.type === "list" && <ListBlock block={block} />}
      {block.type === "chart" && <ChartBlock block={block} />}
      {block.type === "form" && <FormBlock block={block} />}
      {block.type === "pos" && <PosBlock block={block} />}
      {block.type === "chat" && <ChatBlock block={block} />}
      {block.type === "recibo" && <ReciboBlock block={block} />}
      {block.type === "map" && <MapBlock block={block} />}
      {block.type === "calendar" && <CalendarBlock block={block} />}
      {block.type === "tradeGrid" && <TradeGridBlock block={block} />}
      {block.type === "workflow" && <WorkflowBlock block={block} />}
      {block.caption && block.type !== "workflow" && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3.5 py-2.5">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-sm text-blue-700 dark:text-blue-300">{block.caption}</span>
        </div>
      )}
    </div>
  )
}