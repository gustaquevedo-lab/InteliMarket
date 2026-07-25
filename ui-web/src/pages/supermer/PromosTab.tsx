import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Calendar, BarChart3, Plus, Search, Loader2, Check, X, AlertTriangle, TrendingUp, DollarSign, Target, Percent } from "lucide-react"
import { formatDate, formatPYG } from "../../utils/format"

type SubTab = "dashboard" | "calendar" | "effectiveness"

const MOCK_PROMOS = [
  { id: "p1", nombre: "Semana Santa", tipo: "feriado", fecha_inicio: "2026-03-25", fecha_fin: "2026-03-31", presupuesto_asignado: 50000000, estado: "completado" },
  { id: "p2", nombre: "Día de la Madre", tipo: "evento", fecha_inicio: "2026-05-10", fecha_fin: "2026-05-15", presupuesto_asignado: 80000000, estado: "activo" },
  { id: "p3", nombre: "Limpieza Primavera", tipo: "limpieza", fecha_inicio: "2026-09-01", fecha_fin: "2026-09-15", presupuesto_asignado: 30000000, estado: "planificado" },
  { id: "p4", nombre: "Lanzamiento Línea Light", tipo: "lanzamiento", fecha_inicio: "2026-06-10", fecha_fin: "2026-06-24", presupuesto_asignado: 15000000, estado: "planificado" },
]

const MOCK_EFFECTIVENESS = [
  { id: "e1", promo_nombre: "Semana Santa", producto_nombre: "Pescado Congelado kg", ventas_antes: 2000000, ventas_durante: 5200000, ventas_despues: 1800000, lift_pct: 160, canibalizacion_pct: 10 },
  { id: "e2", promo_nombre: "Día de la Madre", producto_nombre: "Perfume Importado", ventas_antes: 1500000, ventas_durante: 3800000, ventas_despues: 1400000, lift_pct: 153, canibalizacion_pct: 6.7 },
]

export default function PromosTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [promos, setPromos] = useState<any[]>(MOCK_PROMOS)
  const [effectiveness, setEffectiveness] = useState<any[]>(MOCK_EFFECTIVENESS)
  const [dashData, setDashData] = useState<any>({})
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [showEffectModal, setShowEffectModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "calendar") p.push(api.promos.list().then(setPromos))
      if (subTab === "effectiveness") p.push(api.promos.effectiveness.list().then(setEffectiveness))
      if (subTab === "dashboard") p.push(api.promos.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "calendar", l: "Calendario", i: Calendar },
    { k: "effectiveness", l: "Efectividad", i: TrendingUp },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              subTab === t.k ? "bg-white dark:bg-slate-700 shadow-lg text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}><t.i className="w-4 h-4" />{t.l}</button>
        ))}
      </div>

      {subTab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Activas", value: dashData.promos_activas || 0, icon: Calendar },
            { label: "Planificadas", value: dashData.promos_planificadas || 0, icon: Target },
            { label: "Completadas Mes", value: dashData.completadas_mes || 0, icon: Check },
            { label: "Presupuesto Mes", value: formatPYG(dashData.presupuesto_total_mes || 0), icon: DollarSign },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm text-gray-500">{s.label}</p><s.icon className="w-5 h-5 text-gray-400" /></div>
              <p className="text-xl md:text-3xl font-bold text-gray-800 mt-2">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === "calendar" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Calendario Promocional</h3>
            <button onClick={() => setShowPromoModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Promo</button>
          </div>
          <div className="space-y-3">
            {promos.map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-gray-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{p.nombre}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.tipo === "feriado" ? "bg-red-100 text-red-700" :
                        p.tipo === "evento" ? "bg-purple-100 text-purple-700" :
                        p.tipo === "limpieza" ? "bg-blue-100 text-blue-700" :
                        p.tipo === "lanzamiento" ? "bg-amber-100 text-amber-700" : "bg-gray-100"
                      }`}>{p.tipo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.estado === "activo" ? "bg-green-100 text-green-700" :
                        p.estado === "completado" ? "bg-blue-100 text-blue-700" :
                        p.estado === "planificado" ? "bg-amber-100 text-amber-700" : "bg-gray-100"
                      }`}>{p.estado}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(p.fecha_inicio)} → {formatDate(p.fecha_fin)}</p>
                  </div>
                  <div className="text-right">
                    {p.presupuesto_asignado && <p className="font-semibold text-emerald-700">{formatPYG(p.presupuesto_asignado)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">📅 Planificá promos por temporada. Activá automáticamente en fecha de inicio. El sistema calcula lift vs canibalización.</p>
        </div>
      )}

      {subTab === "effectiveness" && (
        <div className="space-y-4">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Efectividad de Promociones</h3>
              <button onClick={() => setShowEffectModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Registrar</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200/50"><th className="text-left py-3 px-2 font-medium text-gray-500">Promo</th><th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th><th className="text-right py-3 px-2 font-medium text-gray-500">Antes</th><th className="text-right py-3 px-2 font-medium text-gray-500">Durante</th><th className="text-right py-3 px-2 font-medium text-gray-500">Después</th><th className="text-right py-3 px-2 font-medium text-gray-500">Lift%</th><th className="text-right py-3 px-2 font-medium text-gray-500">Canib.%</th></tr></thead>
                <tbody>{effectiveness.map(e => (
                  <tr key={e.id} className="border-b border-gray-100/50">
                    <td className="py-3 px-2 font-medium">{e.promo_nombre}</td>
                    <td className="py-3 px-2">{e.producto_nombre}</td>
                    <td className="py-3 px-2 text-right">{formatPYG(e.ventas_antes)}</td>
                    <td className="py-3 px-2 text-right font-bold text-green-700">{formatPYG(e.ventas_durante)}</td>
                    <td className="py-3 px-2 text-right">{formatPYG(e.ventas_despues)}</td>
                    <td className="py-3 px-2 text-right font-bold text-green-600">+{e.lift_pct}%</td>
                    <td className="py-3 px-2 text-right">{e.canibalizacion_pct ? `${e.canibalizacion_pct}%` : "-"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">📊 Lift &gt;50% = excelente. Canibalización &gt;20% = la promo está restando ventas futuras. Buscá un balance.</p>
          </div>
          <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30 rounded-2xl p-4">
            <p className="text-sm font-medium flex items-center gap-2"><Percent className="w-4 h-4 text-amber-600" /> Interpretación de Métricas</p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
              <li><strong>Lift %</strong> = (ventas durante - ventas antes) / ventas antes × 100. Mide el incremento generado por la promo.</li>
              <li><strong>Canibalización %</strong> = caída en ventas después de la promo vs antes. Alta canibalización = clientes compraron antes de necesitar.</li>
              <li><strong>Margen incremental</strong> = ventas durante - promedio(ventas antes, ventas después). Mide el verdadero crecimiento.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
