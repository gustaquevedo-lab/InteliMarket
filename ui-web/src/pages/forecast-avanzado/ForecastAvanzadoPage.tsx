import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, Calendar, Cloud, Percent, DollarSign,
  ShoppingBag, Loader2, RefreshCcw, Sun, Snowflake, Gift, Tag,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

const DEPT_OPTIONS = [
  { id: "carniceria", label: "Carnicería" },
  { id: "panaderia", label: "Panadería" },
  { id: "verduleria", label: "Verdulería" },
  { id: "almacen", label: "Almacén" },
  { id: "limpieza", label: "Limpieza" },
  { id: "bebidas", label: "Bebidas" },
  { id: "lacteos", label: "Lácteos" },
  { id: "congelados", label: "Congelados" },
  { id: "perfumeria", label: "Perfumería" },
  { id: "bazar", label: "Bazar" },
]

export default function ForecastAvanzadoPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forecasting Avanzado</h1>
          <p className="text-sm text-gray-500 mt-1">Modelo predictivo con factores externos: feriados PY, clima, promociones, eventos, estacionalidad</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "forecast", label: "Generar Forecast", icon: TrendingUp },
            { key: "holidays", label: "Feriados PY", icon: Calendar },
            { key: "factors", label: "Factores", icon: Cloud },
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
      {tab === "forecast" && <ForecastTab />}
      {tab === "holidays" && <HolidaysTab />}
      {tab === "factors" && <FactorsTab />}
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

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.forecastAvanzado.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={BarChart3} label="Modelos Calibrados" value={data?.total_configs} color="blue" />
        <KpiCard icon={TrendingUp} label="Pronósticos Generados" value={data?.total_forecasts} color="green" />
        <KpiCard icon={Percent} label="MAPE Promedio" value={data?.avg_mape != null ? `${data.avg_mape}%` : "—"} color="purple" />
        <KpiCard icon={ShoppingBag} label="Categorías Cubiertas" value={data?.categories_covered?.length ?? 0} color="indigo" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-blue-500" /> Próximos Feriados
        </h3>
        <div className="space-y-2">
          {(data?.upcoming_holidays ?? []).map((h: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Gift className="w-3 h-3 text-orange-400" />
                <span className="text-gray-900 dark:text-white font-medium">{h.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{h.date}</span>
                <span className="text-blue-600 font-medium">+{Math.round((h.lift - 1) * 100)}% lift</span>
              </div>
            </div>
          ))}
          {(!data?.upcoming_holidays || data.upcoming_holidays.length === 0) && (
            <p className="text-xs text-gray-400">Sin feriados próximos</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pronósticos Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Target</th>
                <th className="pb-2 pr-2">Fecha</th>
                <th className="pb-2 pr-2">Baseline</th>
                <th className="pb-2">Pronóstico</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_forecasts ?? []).map((f: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium capitalize">{f.target}</td>
                  <td className="py-2 pr-2 text-gray-500">{f.date}</td>
                  <td className="py-2 pr-2">Gs {(f.baseline || 0).toLocaleString()}</td>
                  <td className="py-2 font-medium text-blue-600">Gs {(f.forecast || 0).toLocaleString()}</td>
                </tr>
              ))}
              {(!data?.recent_forecasts || data.recent_forecasts.length === 0) && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sin pronósticos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Resumen del Modelo</h3>
        <div className="text-xs space-y-2">
          <div className="flex justify-between"><span className="text-gray-500">Coeficiente Clima</span><span>{data?.factor_summary?.weather_coefficient ?? 0.015}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tipos de Promo</span><span>{(data?.factor_summary?.promo_types ?? []).join(", ")}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Feriados en Calendario</span><span>{data?.factor_summary?.holidays_in_calendar ?? 17}</span></div>
        </div>
      </div>
    </div>
  )
}

// ===== FORECAST =====

function ForecastTab() {
  const [dept, setDept] = useState("almacen")
  const [days, setDays] = useState(14)
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await api.forecastAvanzado.generateForecast({
        target_type: "department",
        target_id: dept,
        target_name: DEPT_OPTIONS.find((d) => d.id === dept)?.label || dept,
        days,
        include_decomposition: true,
      })
      setForecast(res)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { handleGenerate() }, [])

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Departamento</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
              {DEPT_OPTIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Días</label>
            <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs border rounded-lg px-2 py-1.5 w-20 bg-white dark:bg-gray-800 dark:border-gray-700" min={1} max={90} />
          </div>
          <button onClick={handleGenerate} disabled={loading}
            className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
            {loading ? <Spinner /> : <TrendingUp className="w-3 h-3" />}
            Generar Forecast
          </button>
        </div>
      </div>

      {forecast?.forecasts && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Pronóstico {forecast.target_name} — {days} días
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2 pr-2">Fecha</th>
                  <th className="pb-2 pr-2">Baseline</th>
                  <th className="pb-2 pr-2">Ajustado</th>
                  <th className="pb-2 pr-2">Mín</th>
                  <th className="pb-2 pr-2">Máx</th>
                  <th className="pb-2">Descomposición</th>
                </tr>
              </thead>
              <tbody>
                {forecast.forecasts.map((f: any, i: number) => {
                  const fd = f.factor_decomposition || {}
                  const parts = []
                  if (fd.holiday_impact_pct) parts.push(`Feriado: ${fd.holiday_impact_pct}%`)
                  if (fd.weather_impact_pct) parts.push(`Clima: ${fd.weather_impact_pct}%`)
                  if (fd.promo_impact_pct) parts.push(`Promo: ${fd.promo_impact_pct}%`)
                  return (
                    <tr key={i} className="border-b dark:border-gray-700/50">
                      <td className="py-2 pr-2 text-gray-900 dark:text-white">{f.forecast_date}</td>
                      <td className="py-2 pr-2">Gs {(f.baseline || 0).toLocaleString()}</td>
                      <td className="py-2 pr-2 font-medium text-blue-600">Gs {(f.adjusted_forecast || 0).toLocaleString()}</td>
                      <td className="py-2 pr-2 text-gray-500">Gs {(f.lower_bound || 0).toLocaleString()}</td>
                      <td className="py-2 pr-2 text-gray-500">Gs {(f.upper_bound || 0).toLocaleString()}</td>
                      <td className="py-2 text-[10px] text-gray-500">{parts.join(" | ") || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {forecast?.factor_impacts && forecast.factor_impacts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Impacto de Factores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2 pr-2">Día</th>
                  <th className="pb-2 pr-2">Baseline Gs</th>
                  <th className="pb-2 pr-2">Feriado</th>
                  <th className="pb-2 pr-2">Clima</th>
                  <th className="pb-2 pr-2">Promo</th>
                  <th className="pb-2">Ajustado</th>
                </tr>
              </thead>
              <tbody>
                {forecast.factor_impacts.map((fi: any, i: number) => (
                  <tr key={i} className="border-b dark:border-gray-700/50">
                    <td className="py-2 pr-2 text-gray-900 dark:text-white">{fi.day}</td>
                    <td className="py-2 pr-2">Gs {(fi.baseline || 0).toLocaleString()}</td>
                    <td className="py-2 pr-2 text-green-600">{(fi.holiday_impact || 0) > 0 ? `+Gs ${fi.holiday_impact.toLocaleString()}` : "—"}</td>
                    <td className="py-2 pr-2 text-blue-600">{(fi.weather_impact || 0) > 0 ? `+Gs ${fi.weather_impact.toLocaleString()}` : "—"}</td>
                    <td className="py-2 pr-2 text-purple-600">{(fi.promo_impact || 0) > 0 ? `+Gs ${fi.promo_impact.toLocaleString()}` : "—"}</td>
                    <td className="py-2 font-medium">Gs {(fi.adjusted_forecast || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== HOLIDAYS =====

function HolidaysTab() {
  const [holidays, setHolidays] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.forecastAvanzado.listHolidays(COMPANY_ID, { year: 2026 }).then(setHolidays).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Feriado</th>
              <th className="pb-2 pr-2">Fecha</th>
              <th className="pb-2 pr-2">Categoría</th>
              <th className="pb-2 pr-2">Impacto</th>
              <th className="pb-2 pr-2">Lift</th>
              <th className="pb-2">Categorías Afectadas</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{h.name}</td>
                <td className="py-2 pr-2 text-gray-500">{h.holiday_date}</td>
                <td className="py-2 pr-2"><span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">{h.category}</span></td>
                <td className="py-2 pr-2">{Math.round(h.impact_weight * 100)}%</td>
                <td className="py-2 pr-2 text-green-600 font-medium">+{Math.round((h.lift_multiplier - 1) * 100)}%</td>
                <td className="py-2">{(h.affected_categories || []).join(", ") || "Todas"}</td>
              </tr>
            ))}
            {holidays.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin feriados configurados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== FACTORS =====

function FactorsTab() {
  const [factors, setFactors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.forecastAvanzado.listFactors(COMPANY_ID).then(setFactors).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const typeIcons: Record<string, any> = { weather: Cloud, promotion: Tag, event: Calendar }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Tipo</th>
              <th className="pb-2 pr-2">Nombre</th>
              <th className="pb-2 pr-2">Fecha</th>
              <th className="pb-2 pr-2">Valor</th>
              <th className="pb-2">Categorías</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f: any, i: number) => {
              const Icon = typeIcons[f.factor_type] || Cloud
              return (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2"><Icon className="w-3.5 h-3.5 text-gray-400" /></td>
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{f.name}</td>
                  <td className="py-2 pr-2 text-gray-500">{f.factor_date}</td>
                  <td className="py-2 pr-2">{f.value}{f.factor_type === "weather" ? "°C" : "%"}</td>
                  <td className="py-2">{(f.affected_categories || []).join(", ") || "Todas"}</td>
                </tr>
              )
            })}
            {factors.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-400">Sin factores externos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
