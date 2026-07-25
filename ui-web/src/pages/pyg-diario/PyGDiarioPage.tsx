import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle,
  ShoppingBag, Beef, Croissant, Apple, Package, Sparkles, Wine,
  Loader2, RefreshCcw, ChevronUp, ChevronDown, Minus,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const TODAY = new Date().toISOString().slice(0, 10)

const DEPT_ICONS: Record<string, any> = {
  carniceria: Beef, panaderia: Croissant, verduleria: Apple,
  almacen: Package, limpieza: Sparkles, bebidas: Wine,
}
const DEPT_COLORS: Record<string, string> = {
  carniceria: "red", panaderia: "yellow", verduleria: "green",
  almacen: "blue", limpieza: "purple", bebidas: "indigo",
}

export default function PyGDiarioPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PyG Diario por Departamento</h1>
          <p className="text-sm text-gray-500 mt-1">Estado de resultados diario: margen bruto real vs teórico, merma, costos asignables, tendencias</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "details", label: "Detalle por Depto.", icon: ShoppingBag },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "details" && <DetailsTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
    orange: "bg-orange-50 text-orange-600",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function DeptCard({ dept, data }: { dept: string; data: any }) {
  const Icon = DEPT_ICONS[dept] || ShoppingBag
  const color = DEPT_COLORS[dept] || "blue"
  const labels: Record<string, string> = {
    carniceria: "Carnicería", panaderia: "Panadería", verduleria: "Verdulería",
    almacen: "Almacén", limpieza: "Limpieza", bebidas: "Bebidas",
  }

  if (!data) return null
  const marginOk = data.today_margin_pct >= (data.budgeted_margin_pct || 15)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg bg-${color}-50 text-${color}-600`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{labels[dept] || dept}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <p className="text-gray-500">Ventas Hoy</p>
          <p className="font-bold text-gray-900 dark:text-white">Gs {(data.today_sales || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Ventas Ayer</p>
          <p className="font-medium text-gray-600">Gs {(data.yesterday_sales || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Margen Real</p>
          <p className={`font-bold ${marginOk ? "text-green-600" : "text-red-500"}`}>{data.today_margin_pct}%</p>
        </div>
        <div>
          <p className="text-gray-500">Vs. Ayer</p>
          <p className={`font-medium flex items-center gap-0.5 ${data.variance_vs_yesterday >= 0 ? "text-green-600" : "text-red-500"}`}>
            {data.variance_vs_yesterday >= 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {Math.abs(data.variance_vs_yesterday)}pp
          </p>
        </div>
      </div>
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Presupuesto: {data.budgeted_margin_pct}%</span>
          <span className={data.variance_vs_budget >= 0 ? "text-green-600" : "text-red-500"}>
            {data.variance_vs_budget >= 0 ? "+" : ""}{data.variance_vs_budget}pp vs presup.
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${marginOk ? "bg-green-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(100, data.today_margin_pct * 2)}%` }} />
        </div>
      </div>
    </div>
  )
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.pygDiario.getDashboard(COMPANY_ID, TODAY).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Ventas Totales Hoy" value={`Gs ${(data?.total_sales || 0).toLocaleString()}`} color="blue" />
        <KpiCard icon={Percent} label="Margen Bruto Real" value={`${data?.total_margin_pct ?? 0}%`} sub={`Gs ${(data?.total_margin || 0).toLocaleString()}`} color="green" />
        <KpiCard icon={AlertTriangle} label="Merma Total" value={`Gs ${(data?.total_shrinkage || 0).toLocaleString()}`} color="red" />
        <KpiCard icon={TrendingUp} label="Costo Laboral" value={`Gs ${(data?.total_labor || 0).toLocaleString()}`} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.department_comparisons ?? []).map((d: any) => (
          <DeptCard key={d.department} dept={d.department} data={d} />
        ))}
      </div>

      {data?.negative_margin_products && data.negative_margin_products.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Productos con Margen Negativo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2 pr-2">Producto</th>
                  <th className="pb-2 pr-2">Margen</th>
                  <th className="pb-2 pr-2">Margen %</th>
                  <th className="pb-2">Ventas Gs</th>
                </tr>
              </thead>
              <tbody>
                {data.negative_margin_products.map((p: any, i: number) => (
                  <tr key={i} className="border-b dark:border-gray-700/50">
                    <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="py-2 pr-2 text-red-500">Gs {(p.margin || 0).toLocaleString()}</td>
                    <td className="py-2 pr-2 text-red-500">{p.margin_pct}%</td>
                    <td className="py-2">Gs {(p.sales || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tendencia 7 Días</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-4">Fecha</th>
                <th className="pb-2 pr-4">Ventas</th>
                <th className="pb-2 pr-4">Margen Gs</th>
                <th className="pb-2">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {(data?.trends_7d ?? []).map((t: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-4 text-gray-900 dark:text-white">{t.date}</td>
                  <td className="py-2 pr-4 font-medium">Gs {(t.total_sales || 0).toLocaleString()}</td>
                  <td className="py-2 pr-4">Gs {(t.total_margin || 0).toLocaleString()}</td>
                  <td className="py-2">
                    <span className={`font-medium ${(t.total_margin_pct || 0) >= 30 ? "text-green-600" : "text-red-500"}`}>
                      {t.total_margin_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== DETAIL =====

function DetailsTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState("")

  useEffect(() => {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    api.pygDiario.listEntries(COMPANY_ID, desde, TODAY, deptFilter || undefined)
      .then(setEntries).catch(() => {}).finally(() => setLoading(false))
  }, [deptFilter])

  const deptLabels: Record<string, string> = {
    carniceria: "Carnicería", panaderia: "Panadería", verduleria: "Verdulería",
    almacen: "Almacén", limpieza: "Limpieza", bebidas: "Bebidas",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
          <option value="">Todos los departamentos</option>
          <option value="carniceria">Carnicería</option>
          <option value="panaderia">Panadería</option>
          <option value="verduleria">Verdulería</option>
          <option value="almacen">Almacén</option>
          <option value="limpieza">Limpieza</option>
          <option value="bebidas">Bebidas</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Depto</th>
              <th className="pb-2 pr-2">Fecha</th>
              <th className="pb-2 pr-2">Ventas</th>
              <th className="pb-2 pr-2">Costo</th>
              <th className="pb-2 pr-2">Margen Real</th>
              <th className="pb-2 pr-2">Margen Teórico</th>
              <th className="pb-2 pr-2">Variación</th>
              <th className="pb-2 pr-2">Merma</th>
              <th className="pb-2 pr-2">Laboral</th>
              <th className="pb-2">Neto</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{deptLabels[e.department] || e.department}</td>
                <td className="py-2 pr-2 text-gray-500">{e.fecha}</td>
                <td className="py-2 pr-2">Gs {(e.sales_amount || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">Gs {(e.cost_of_sales || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">
                  <span className={`font-medium ${e.gross_margin_real_pct >= 30 ? "text-green-600" : "text-red-500"}`}>
                    {e.gross_margin_real_pct}%
                  </span>
                </td>
                <td className="py-2 pr-2 text-gray-500">{e.gross_margin_theoretical_pct}%</td>
                <td className="py-2 pr-2">
                  <span className={e.margin_variance >= 0 ? "text-green-600" : "text-red-500"}>
                    {e.margin_variance >= 0 ? "+" : ""}{e.margin_variance_pct}pp
                  </span>
                </td>
                <td className="py-2 pr-2 text-red-500">Gs {(e.shrinkage_cost || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">Gs {(e.labor_cost || 0).toLocaleString()}</td>
                <td className="py-2">
                  <span className={`font-medium ${e.net_margin >= 0 ? "text-green-600" : "text-red-500"}`}>
                    Gs {(e.net_margin || 0).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={10} className="py-4 text-center text-gray-400">Sin datos de PyG diario</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
