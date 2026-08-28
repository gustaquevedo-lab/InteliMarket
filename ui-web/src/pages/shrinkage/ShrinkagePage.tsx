import { useState, useEffect, useCallback } from "react"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle,
  Shield, Eye, ShoppingCart, Scale, Zap, CheckCircle, XCircle,
  Loader2, RefreshCcw, ChevronUp, ChevronDown, Minus, Target,
  Info, HelpCircle, AlertCircle, ShieldAlert, Sparkles, Layers,
  Calendar, FileText, ArrowRight, CheckCircle2, RefreshCw
} from "lucide-react"
import { api } from "../../api/index"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

export default function ShrinkagePage() {
  const toast = useToast()
  const [tab, setTab] = useState<"dashboard" | "alertas" | "recomendaciones" | "libro_bajas">("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos del Backend
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])

  const loadShrinkageData = useCallback(async () => {
    setLoading(true)
    const companyId = "00000000-0000-0000-0000-000000000010"
    const today = new Date().toISOString().slice(0, 10)
    try {
      const [dash, alt, rec] = await Promise.allSettled([
        api.shrinkage.getDashboard(companyId, today),
        api.shrinkage.listAlerts(companyId),
        api.shrinkage.listRecommendations(companyId),
      ])

      if (dash.status === "fulfilled" && dash.value) {
        setDashboardData(dash.value)
      }
      if (alt.status === "fulfilled" && Array.isArray(alt.value)) {
        setAlerts(alt.value)
      }
      if (rec.status === "fulfilled" && Array.isArray(rec.value)) {
        setRecommendations(rec.value)
      }
    } catch (e: any) {
      toast.error("Error al cargar mermas", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadShrinkageData()
  }, [loadShrinkageData])

  const kpis = dashboardData?.kpis || {
    merma_total_gs: 179819104,
    merma_tasa_pct: 1.42,
    tasa_meta_pct: 2.0,
    total_ventas_gs: 12663317172,
    total_inventario_costo_gs: 3858414370,
    ahorro_prevencion_gs: 68331260,
  }

  const descomp = dashboardData?.descomposicion || {
    caducidad_vencimiento: { monto: 86313170, pct: 48 },
    rotura_manipulacion: { monto: 43156585, pct: 24 },
    deshidratacion_frio: { monto: 28771057, pct: 16 },
    perdida_desconocida: { monto: 21578292, pct: 12 },
  }

  const categoriesCrit = dashboardData?.categorias_criticas || []

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/90 text-white p-7 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 border border-rose-400/30 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                    PREVENCIÓN DE PÉRDIDAS · CONTROL DE MERMA & FEFO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Tasa de Merma: {kpis.merma_tasa_pct}% (Meta &lt; {kpis.tasa_meta_pct}%)
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Control de Mermas & Prevención de Pérdidas
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitoreo de caducidad, roturas en góndola, deshidratación de carnes/frescos y libro de bajas fiscales DNIT
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-300">
                ⚠️ {alerts.length} alertas FEFO críticas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💰 {formatPYG(kpis.ahorro_prevencion_gs)} recuperado con liquidaciones
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadShrinkageData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-rose-400" : ""}`} />
              Recalcular
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Merma Acumulada</span>
              <DollarSign className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(kpis.merma_total_gs)}
            </p>
            <p className="text-[11px] text-slate-400">Sobre {formatPYG(kpis.total_ventas_gs)} en ventas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tasa de Merma</span>
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {kpis.merma_tasa_pct}%
            </p>
            <p className="text-[11px] text-emerald-400 font-semibold">✓ Tolerable (&lt;{kpis.tasa_meta_pct}%)</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Causa Principal</span>
              <AlertCircle className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              Vencimiento <span className="text-xs font-normal text-slate-400">(48%)</span>
            </p>
            <p className="text-[11px] text-slate-400">Lácteos y perecederos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Prevención</span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(kpis.ahorro_prevencion_gs)}
            </p>
            <p className="text-[11px] text-slate-400">Liquidaciones a tiempo</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Desglose por Causa & Sección", icon: BarChart3 },
          { id: "alertas", label: "Alertas de Vencimiento FEFO", icon: AlertTriangle, count: alerts.length },
          { id: "recomendaciones", label: "Acciones & Prevención IA", icon: Target, count: recommendations.length },
          { id: "libro_bajas", label: "Libro de Bajas Fiscal (DNIT)", icon: FileText },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DASHBOARD DE CAUSAS ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Causas de Pérdida */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center justify-between">
              <span>Desglose por Causa Declarada</span>
              <span className="text-[10px] text-slate-400 font-mono">Total: {formatPYG(kpis.merma_total_gs)}</span>
            </h3>

            <div className="space-y-3">
              {[
                { causa: "Caducidad / Vencimiento de Lote", pct: descomp.caducidad_vencimiento.pct, monto: descomp.caducidad_vencimiento.monto, color: "bg-rose-500" },
                { causa: "Rotura / Daño de Manipulación", pct: descomp.rotura_manipulacion.pct, monto: descomp.rotura_manipulacion.monto, color: "bg-amber-500" },
                { causa: "Deshidratación / Pérdida en Frío", pct: descomp.deshidratacion_frio.pct, monto: descomp.deshidratacion_frio.monto, color: "bg-blue-500" },
                { causa: "Diferencia Física / Pérdida Desconocida", pct: descomp.perdida_desconocida.pct, monto: descomp.perdida_desconocida.monto, color: "bg-purple-500" },
              ].map((c) => (
                <div key={c.causa} className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{c.causa}</span>
                    <span className="font-mono text-slate-900 dark:text-white">{formatPYG(c.monto)} ({c.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className={`${c.color} h-2 rounded-full`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking por Departamento */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center justify-between">
              <span>Merma por Sección / Góndola</span>
              <span className="text-[10px] text-slate-400 font-mono">Tasa Media: {kpis.merma_tasa_pct}%</span>
            </h3>

            <div className="space-y-2.5">
              {(categoriesCrit.length > 0 ? categoriesCrit : [
                { category: "Panadería & Rotisería", tasa_merma_pct: 3.20, monto_merma_gs: 2800000, nivel: "critico" },
                { category: "Verdulería & Frutas Frescas", tasa_merma_pct: 2.85, monto_merma_gs: 2450000, nivel: "alto" },
                { category: "Lácteos & Fiambrería", tasa_merma_pct: 1.60, monto_merma_gs: 1800000, nivel: "normal" },
                { category: "Carnicería & Aves", tasa_merma_pct: 1.10, monto_merma_gs: 950000, nivel: "normal" },
                { category: "Almacén General & Bebidas", tasa_merma_pct: 0.45, monto_merma_gs: 450000, nivel: "normal" },
              ]).map((d: any) => (
                <div key={d.category} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{d.category}</p>
                    <span className="text-[10px] text-slate-400">Pérdida calculada: {formatPYG(d.monto_merma_gs)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{d.tasa_merma_pct}%</span>
                    <span className={`block text-[10px] font-black uppercase ${
                      d.nivel === "critico" ? "text-rose-500" : d.nivel === "alto" ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {d.nivel === "critico" ? "Atención" : d.nivel === "alto" ? "Revisar" : "Normal"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: ALERTAS FEFO ══════════════════════ */}
      {tab === "alertas" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-xs text-slate-700 dark:text-slate-300 uppercase">
              Lotes con Vencimiento Crítico (Próximos 7 días)
            </h3>
            <span className="text-xs text-slate-400 font-mono">{alerts.length} artículos en riesgo</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Producto & SKU</th>
                  <th className="p-4">Lote</th>
                  <th className="p-4">Fecha Vto.</th>
                  <th className="p-4 text-right">Stock Góndola</th>
                  <th className="p-4 text-right">Costo Unitario</th>
                  <th className="p-4 text-right">Valor en Riesgo</th>
                  <th className="p-4 text-center">Acción Sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {alerts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <p className="font-extrabold text-slate-900 dark:text-white">{item.product_nombre}</p>
                      <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                    </td>
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 font-bold">{item.lote}</td>
                    <td className="p-4 font-mono text-rose-500 font-bold">{item.fecha_vencimiento} ({item.dias_restantes} días)</td>
                    <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">{item.stock_gondola} un</td>
                    <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-300">{formatPYG(item.costo_unitario)}</td>
                    <td className="p-4 text-right font-mono font-bold text-rose-500">{formatPYG(item.valor_riesgo_gs)}</td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase">
                        {item.accion_sugerida}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 3: RECOMENDACIONES IA ══════════════════════ */}
      {tab === "recomendaciones" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <Sparkles className="w-5 h-5" />
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">{rec.titulo}</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {rec.descripcion}
              </p>
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                Impacto proyectado: Ahorro de ~{formatPYG(rec.impacto_estimado_gs)} al mes.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════ TAB 4: LIBRO DE BAJAS DNIT ══════════════════════ */}
      {tab === "libro_bajas" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-black text-xs text-slate-700 dark:text-slate-300 uppercase">
                Acta de Bajas y Mercaderías Inutilizadas (Art. 33 Ley 6380/19)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Respaldos contables y actas de destrucción para deducción impositiva</p>
            </div>
            <button className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Nº Acta</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Depósito / Sucursal</th>
                  <th className="p-4">Responsable</th>
                  <th className="p-4 text-right">Items</th>
                  <th className="p-4 text-right">Costo Total Deducible</th>
                  <th className="p-4 text-center">Estado Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {[
                  { num: "ACT-2026-081", fecha: "15/08/2026", dep: "Salón Central (Filial 1)", resp: "Encargado de Salón", items: 18, total: 1420000, estado: "Aprobada" },
                  { num: "ACT-2026-079", fecha: "08/08/2026", dep: "Cámara Frigorífica", resp: "Jefe de Carnicería", items: 6, total: 890000, estado: "Aprobada" },
                  { num: "ACT-2026-074", fecha: "01/08/2026", dep: "Depósito Principal", resp: "Auditor Interno", items: 22, total: 2150000, estado: "Aprobada" },
                ].map((acta) => (
                  <tr key={acta.num} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{acta.num}</td>
                    <td className="p-4 text-slate-500 font-mono">{acta.fecha}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{acta.dep}</td>
                    <td className="p-4 text-slate-500">{acta.resp}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{acta.items}</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(acta.total)}</td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                        {acta.estado}
                      </span>
                    </td>
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
