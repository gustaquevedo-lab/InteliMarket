import { useState, useEffect, useMemo } from "react"
import {
  DollarSign, Plus, Search, Loader2, X, CheckCircle, Clock,
  Percent, Users, RefreshCw, Check, AlertCircle, Edit, Trash2,
  TrendingUp, Award, FileText, Zap, ChevronRight, Sparkles, Filter
} from "lucide-react"
import { api, type CommissionRule, type SalesCommission, type TenantUser } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

type RuleForm = {
  nombre: string
  tipo: string
  vendedor_id: string
  porcentaje: number | null
  aplica_a: string
  monto_minimo: number | null
  monto_maximo: number | null
  valido_desde: string
  valido_hasta: string
}

type CommissionSummary = {
  vendedor_id: string | null
  vendedor_nombre: string
  total_ventas: number
  total_comisiones: number
  cantidad_operaciones: number
  pendiente_pago: number
}

const emptyRuleForm: RuleForm = {
  nombre: "",
  tipo: "porcentaje",
  vendedor_id: "",
  porcentaje: 1.5,
  aplica_a: "total",
  monto_minimo: null,
  monto_maximo: null,
  valido_desde: "",
  valido_hasta: "",
}

export default function CommissionsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [activeTab, setActiveTab] = useState<"summary" | "commissions" | "rules">("summary")
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [commissions, setCommissions] = useState<SalesCommission[]>([])
  const [summary, setSummary] = useState<CommissionSummary[]>([])
  const [users, setUsers] = useState<TenantUser[]>([])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // Modales
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm)
  const [savingRule, setSavingRule] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rulesData, commsData, summaryData, usersData] = await Promise.allSettled([
        api.commissions.rules.list(),
        api.commissions.list({} as any),
        api.commissions.summary(),
        api.auth.users.list(),
      ])

      if (rulesData.status === "fulfilled") setRules(rulesData.value || [])
      if (commsData.status === "fulfilled") setCommissions(commsData.value || [])
      if (summaryData.status === "fulfilled") setSummary(summaryData.value || [])
      if (usersData.status === "fulfilled") setUsers(usersData.value || [])
    } catch {
      toast.error("Error", "No se pudieron cargar los datos de comisiones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleCalculateBatch = async () => {
    setCalculating(true)
    try {
      const res: any = await (api as any).client.post("/v1/companies/00000000-0000-0000-0000-000000000010/commissions/calculate-batch")
      if (res?.calculadas > 0) {
        toast.success("Cálculo Completado", `Se liquidaron ${res.calculadas} comisiones por ${formatPYG(res.monto_total_comisiones)}`)
      } else {
        toast.info("Al Día", "Todas las ventas confirmadas ya tienen sus comisiones calculadas")
      }
      fetchData()
    } catch {
      toast.error("Error", "No se pudo ejecutar el cálculo de comisiones")
    } finally {
      setCalculating(false)
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalComisiones = commissions.reduce((sum, c) => sum + Number(c.monto_comision || 0), 0)
    const pendientePago = commissions.filter(c => c.estado !== "pagada").reduce((sum, c) => sum + Number(c.monto_comision || 0), 0)
    const pagadas = commissions.filter(c => c.estado === "pagada").reduce((sum, c) => sum + Number(c.monto_comision || 0), 0)
    const vendedoresActivos = summary.filter(s => s.total_comisiones > 0).length

    return { totalComisiones, pendientePago, pagadas, vendedoresActivos }
  }, [commissions, summary])

  const handlePayCommission = async (id: string) => {
    setPayingId(id)
    try {
      await api.commissions.pay(id)
      toast.success("Comisión Pagada", "Se registró el pago de la comisión")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el pago")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-7 border border-amber-500/20 shadow-2xl shadow-amber-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 border border-amber-400/30 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Award className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    INCENTIVOS & METAS · COMISIONES DE VENTA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {kpis.vendedoresActivos} Vendedores / Cajeros con Comisión
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Comisiones por Ventas & Rendimiento
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Reglas de incentivos, liquidación automática por ticket y control de comisiones pendientes de pago
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-400">
                💰 Pendiente: {formatPYG(kpis.pendientePago)}
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ✅ Pagadas: {formatPYG(kpis.pagadas)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>

            <button
              onClick={handleCalculateBatch}
              disabled={calculating}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Liquidar Período
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Comisiones</span>
              <span className="text-[10px] font-bold text-amber-400">Generado</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(kpis.totalComisiones)}
            </p>
            <p className="text-[11px] text-slate-400">Histórico de incentivos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pendiente de Pago</span>
              <span className="text-[10px] font-bold text-rose-400">A liquidar</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(kpis.pendientePago)}
            </p>
            <p className="text-[11px] text-slate-400">A liquidar a vendedores</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comisiones Pagadas</span>
              <span className="text-[10px] font-bold text-emerald-400">Cancelado</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(kpis.pagadas)}
            </p>
            <p className="text-[11px] text-slate-400">Pagos completados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vendedores Activos</span>
              <span className="text-[10px] font-mono text-blue-400">Equipo</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {kpis.vendedoresActivos}
            </p>
            <p className="text-[11px] text-slate-400">Cajeros y comisionistas</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "summary", label: "Resumen por Vendedor / Cajero", icon: Users, count: summary.length },
          { id: "commissions", label: "Historial de Comisiones", icon: FileText, count: commissions.length },
          { id: "rules", label: "Reglas de Comisión", icon: Percent, count: rules.length },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                active ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: RESUMEN POR VENDEDOR ══════════════════════ */}
      {activeTab === "summary" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Vendedor / Cajero</th>
                  <th className="p-4 text-center">Operaciones</th>
                  <th className="p-4 text-right">Total Ventas (₲)</th>
                  <th className="p-4 text-right">Comisión Acumulada</th>
                  <th className="p-4 text-right">Pendiente Pago</th>
                  <th className="p-4 text-center">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                      <span>Cargando comisiones por vendedor...</span>
                    </td>
                  </tr>
                ) : summary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      No hay datos de comisiones acumuladas.
                    </td>
                  </tr>
                ) : (
                  summary.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {s.vendedor_nombre || "Vendedor General"}
                      </td>
                      <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-300">
                        {s.cantidad_operaciones}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatPYG(s.total_ventas)}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatPYG(s.total_comisiones)}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        {formatPYG(s.pendiente_pago)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {s.total_ventas > 0 ? `${((s.total_comisiones / s.total_ventas) * 100).toFixed(1)}% tasa efec.` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: HISTORIAL DE COMISIONES ══════════════════════ */}
      {activeTab === "commissions" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Comprobante</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4 text-right">Venta Base</th>
                  <th className="p-4 text-center">Tasa</th>
                  <th className="p-4 text-right">Comisión</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                      <span>Cargando historial de comisiones...</span>
                    </td>
                  </tr>
                ) : commissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      No hay comisiones registradas.
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 text-slate-500 font-mono text-[11px]">{formatDate((c as any).created_at || (c as any).fecha)}</td>
                      <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">#{(c as any).sale?.numero || c.sale_id?.slice(0, 8)}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{(c as any).vendedor?.nombre || (c as any).vendedor_nombre || "Vendedor"}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{formatPYG(Number((c as any).monto_base || 0))}</td>
                      <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{(c as any).porcentaje_aplicado || 1.5}%</td>
                      <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">{formatPYG(Number(c.monto_comision || 0))}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.estado === "pagada"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}>
                          {c.estado === "pagada" ? "Pagada" : "Pendiente"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {c.estado !== "pagada" && (
                          <button
                            onClick={() => handlePayCommission(c.id)}
                            disabled={payingId === c.id}
                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition"
                          >
                            {payingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pagar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 3: REGLAS DE COMISIÓN ══════════════════════ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <button
              onClick={() => { setEditingRule(null); setRuleForm(emptyRuleForm); setShowRuleModal(true) }}
              className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              Nueva Regla de Comisión
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Regla</th>
                    <th className="p-4">Vendedor / Alcance</th>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4 text-right">Porcentaje</th>
                    <th className="p-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{r.nombre}</td>
                      <td className="p-4 text-slate-500">{r.vendedor_id ? "Vendedor Asignado" : "General (Todos los cajeros)"}</td>
                      <td className="p-4 text-center uppercase text-[10px] font-mono">{r.tipo}</td>
                      <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">{r.porcentaje}%</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">Activa</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
