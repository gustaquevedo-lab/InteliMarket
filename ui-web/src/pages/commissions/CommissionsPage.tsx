import { useState, useEffect, useMemo } from "react"
import {
  DollarSign, Plus, Search, Loader2, X, CheckCircle, Clock,
  Percent, Users, RefreshCw, Check, AlertCircle, Edit, Trash2,
  TrendingUp, Award, FileText, Zap, ChevronRight
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

  // Cálculo Masivo de Comisiones del Período
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
    const totalOperaciones = commissions.length
    const reglasActivas = rules.filter(r => r.activo !== false).length
    return { totalComisiones, pendientePago, totalOperaciones, reglasActivas }
  }, [commissions, rules])

  // Filtrado de Comisiones
  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const s = search.toLowerCase().trim()
      const matchSearch = !s ||
        (c.vendedor_nombre || "").toLowerCase().includes(s) ||
        (c.sale_numero || "").toLowerCase().includes(s) ||
        (c.rule_nombre || "").toLowerCase().includes(s)

      const matchStatus = statusFilter === "todos" || c.estado === statusFilter
      return matchSearch && matchStatus
    })
  }, [commissions, search, statusFilter])

  // Filtrado de Reglas
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const s = search.toLowerCase().trim()
      return !s ||
        (r.nombre || "").toLowerCase().includes(s) ||
        (r.vendedor_nombre || "").toLowerCase().includes(s) ||
        (r.tipo || "").toLowerCase().includes(s)
    })
  }, [rules, search])

  // Acciones Reglas
  const openNewRule = () => {
    setEditingRule(null)
    setRuleForm(emptyRuleForm)
    setShowRuleModal(true)
  }

  const openEditRule = (r: CommissionRule) => {
    setEditingRule(r)
    setRuleForm({
      nombre: r.nombre || "",
      tipo: r.tipo || "porcentaje",
      vendedor_id: r.vendedor_id || "",
      porcentaje: r.porcentaje !== undefined ? Number(r.porcentaje) : 1.5,
      aplica_a: r.aplica_a || "total",
      monto_minimo: r.monto_minimo ? Number(r.monto_minimo) : null,
      monto_maximo: r.monto_maximo ? Number(r.monto_maximo) : null,
      valido_desde: r.valido_desde || "",
      valido_hasta: r.valido_hasta || "",
    })
    setShowRuleModal(true)
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleForm.nombre.trim()) {
      toast.error("Error", "El nombre de la regla es obligatorio")
      return
    }
    setSavingRule(true)
    try {
      const payload: any = {
        nombre: ruleForm.nombre,
        tipo: ruleForm.tipo,
        porcentaje: Number(ruleForm.porcentaje || 0),
        aplica_a: ruleForm.aplica_a,
        vendedor_id: ruleForm.vendedor_id || undefined,
        monto_minimo: ruleForm.monto_minimo || undefined,
        monto_maximo: ruleForm.monto_maximo || undefined,
        valido_desde: ruleForm.valido_desde || undefined,
        valido_hasta: ruleForm.valido_hasta || undefined,
      }

      if (editingRule) {
        await api.commissions.rules.update(editingRule.id, payload)
        toast.success("Regla actualizada", "El esquema de comisión fue modificado")
      } else {
        await api.commissions.rules.create(payload)
        toast.success("Regla creada", "El nuevo esquema de comisión está activo")
      }
      setShowRuleModal(false)
      setEditingRule(null)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo guardar la regla")
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (r: CommissionRule) => {
    const ok = await confirm({
      title: "Eliminar Esquema de Comisión",
      message: `¿Estás seguro de que deseas eliminar la regla "${r.nombre}"?`,
      confirmText: "Eliminar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.commissions.rules.delete(r.id)
      toast.success("Regla eliminada", `La regla "${r.nombre}" fue eliminada`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar la regla de comisión")
    }
  }

  const handlePayCommission = async (c: SalesCommission) => {
    const ok = await confirm({
      title: "Pagar Comisión",
      message: `¿Confirmar el pago de ${formatPYG(Number(c.monto_comision))} al asesor "${c.vendedor_nombre || 'General'}" por la venta #${c.sale_numero || c.sale_id?.slice(0, 8)}?`,
      confirmText: "Confirmar Pago",
      variant: "info",
    })
    if (!ok) return
    setPayingId(c.id)
    try {
      await api.commissions.pay(c.id)
      toast.success("Comisión Pagada", `Comisión de ${formatPYG(Number(c.monto_comision))} liquidada con éxito`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo procesar el pago de la comisión")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-3">
              <Percent className="w-7 h-7 text-amber-600 dark:text-amber-400 shrink-0" />
              Gestión de Comisiones
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Rendimiento & Liquidación Comercial
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cálculo de incentivos de ventas, esquemas de comisiones por mostrador y control de pagos a la fuerza comercial.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleCalculateBatch}
            disabled={calculating}
            className="btn bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-slate-800"
            title="Calcular comisiones de ventas confirmadas"
          >
            {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
            <span>Calcular Período</span>
          </button>

          <button
            onClick={openNewRule}
            className="btn bg-primary text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Regla</span>
          </button>
        </div>
      </div>

      {/* ── HERO KPIS CONSOLIDADOS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-purple-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Total Comisiones
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
            {formatPYG(kpis.totalComisiones)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {kpis.totalOperaciones} ventas comisionadas
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-amber-500/30 border-l-4 border-l-amber-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pendientes de Liquidación
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 mt-2">
            {formatPYG(kpis.pendientePago)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Comisiones calculadas por pagar
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Asesores Comerciales
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 mt-2">
            {summary.length || 1}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Personal con comisiones asignadas
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Reglas Activas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
            {kpis.reglasActivas}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Esquemas de comisión vigentes
          </p>
        </div>
      </div>

      {/* ── PESTAÑAS OPERATIVAS ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "summary", label: "Resumen por Asesor", icon: Award, count: summary.length },
          { id: "commissions", label: "Libro de Comisiones", icon: FileText, count: commissions.length },
          { id: "rules", label: "Esquemas & Reglas", icon: Percent, count: rules.length },
        ].map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          PESTAÑA 1: RESUMEN POR ASESOR COMERCIAL (RANKING)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Asesor Comercial / Vendedor</th>
                    <th className="p-3.5 text-center">Operaciones</th>
                    <th className="p-3.5 text-right">Total Facturado</th>
                    <th className="p-3.5 text-right">Comisiones Totales</th>
                    <th className="p-3.5 text-right">Pendiente Liquidación</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando resumen de comisiones...</span>
                      </td>
                    </tr>
                  ) : summary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        No hay comisiones calculadas aún. Hacé clic en "Calcular Período" para liquidar las ventas confirmadas.
                      </td>
                    </tr>
                  ) : (
                    summary.map((s, idx) => (
                      <tr key={s.vendedor_id || idx} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold text-xs">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-extrabold text-xs">{s.vendedor_nombre || "Vendedor General"}</p>
                              <p className="text-[10px] text-gray-400 font-mono">Fuerza de Ventas</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                          {s.cantidad_operaciones}
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatPYG(s.total_ventas)}
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          {formatPYG(s.total_comisiones)}
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatPYG(s.pendiente_pago)}
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => {
                              setActiveTab("commissions")
                              setSearch(s.vendedor_nombre || "")
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-white transition-all flex items-center gap-1 mx-auto"
                          >
                            <span>Ver Detalle</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PESTAÑA 2: LIBRO DE COMISIONES (DETALLE DE VENTAS)
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "commissions" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Vendedor, Nº Comprobante de Venta o Regla..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="todos">Todos los Estados</option>
                <option value="calculada">Pendientes / Calculadas</option>
                <option value="pagada">Pagadas</option>
              </select>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Comprobante Venta</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Asesor Comercial</th>
                    <th className="p-3.5">Esquema / Regla</th>
                    <th className="p-3.5 text-right">Base Venta</th>
                    <th className="p-3.5 text-center">% Com.</th>
                    <th className="p-3.5 text-right">Comisión Ganada</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando libro de comisiones...</span>
                      </td>
                    </tr>
                  ) : filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        No se encontraron registros de comisiones coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((c) => {
                      const isPaid = c.estado === "pagada"
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{c.sale_numero || c.sale_id?.slice(0, 8) || "—"}
                          </td>

                          <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                            {c.created_at ? formatDate(c.created_at) : "—"}
                          </td>

                          <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                            {c.vendedor_nombre || "Vendedor General"}
                          </td>

                          <td className="p-3.5 text-gray-600 dark:text-gray-300 max-w-[160px] truncate">
                            {c.rule_nombre || "Comisión General"}
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {formatPYG(Number(c.base_calculo || 0))}
                          </td>

                          <td className="p-3.5 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                            {Number(c.porcentaje || 0).toFixed(1)}%
                          </td>

                          <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatPYG(Number(c.monto_comision || 0))}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isPaid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"}`}>
                              {isPaid ? "Pagada" : "Calculada"}
                            </span>
                          </td>

                          <td className="p-3.5 text-center">
                            {!isPaid && (
                              <button
                                onClick={() => handlePayCommission(c)}
                                disabled={payingId === c.id}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1 mx-auto"
                                title="Liquidar / Pagar comisión"
                              >
                                {payingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                <span>Pagar</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PESTAÑA 3: ESQUEMAS & REGLAS DE COMISIÓN
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre de regla o asesor..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nombre del Esquema</th>
                    <th className="p-3.5">Asesor Asignado</th>
                    <th className="p-3.5">Tipo de Cálculo</th>
                    <th className="p-3.5 text-center">% Comisión</th>
                    <th className="p-3.5">Rango de Montos</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando reglas de comisiones...</span>
                      </td>
                    </tr>
                  ) : filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No hay esquemas de comisión configurados. Creá uno con el botón "+ Nueva Regla".
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                            <span>{r.nombre}</span>
                          </div>
                        </td>

                        <td className="p-3.5 font-semibold text-gray-700 dark:text-gray-300">
                          {r.vendedor_nombre || "Aplica a Todos (General)"}
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {r.tipo === "porcentaje" ? "Porcentaje s/ Venta" : r.tipo}
                          </span>
                        </td>

                        <td className="p-3.5 text-center font-mono font-black text-purple-600 dark:text-purple-400 text-sm">
                          {Number(r.porcentaje || 0).toFixed(1)}%
                        </td>

                        <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                          {r.monto_minimo || r.monto_maximo ? (
                            <span>{r.monto_minimo ? formatPYG(Number(r.monto_minimo)) : "Gs. 0"} — {r.monto_maximo ? formatPYG(Number(r.monto_maximo)) : "Sin límite"}</span>
                          ) : (
                            <span>Sin límite de monto</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.activo !== false ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-gray-100 text-gray-500"}`}>
                            {r.activo !== false ? "Activo" : "Inactivo"}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditRule(r)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Editar Regla"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(r)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Eliminar Regla"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR REGLA DE COMISIÓN ────────────────────────── */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  {editingRule ? "Editar Esquema de Comisión" : "Nuevo Esquema de Comisión"}
                </h3>
                <p className="text-xs text-gray-400">Definí los criterios de incentivación comercial</p>
              </div>
              <button onClick={() => setShowRuleModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Nombre del Esquema / Regla *</label>
                <input
                  type="text"
                  required
                  value={ruleForm.nombre}
                  onChange={e => setRuleForm({ ...ruleForm, nombre: e.target.value })}
                  placeholder="Ej: Comisión Mostrador General (1.5%)"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Porcentaje de Comisión (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    required
                    value={ruleForm.porcentaje ?? ""}
                    onChange={e => setRuleForm({ ...ruleForm, porcentaje: parseFloat(e.target.value) || 0 })}
                    placeholder="1.5"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Asesor / Vendedor Específico</label>
                  <select
                    value={ruleForm.vendedor_id}
                    onChange={e => setRuleForm({ ...ruleForm, vendedor_id: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="">Aplica a Todos (General)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Monto Mínimo Venta (PYG)</label>
                  <input
                    type="number"
                    min={0}
                    value={ruleForm.monto_minimo ?? ""}
                    onChange={e => setRuleForm({ ...ruleForm, monto_minimo: parseFloat(e.target.value) || null })}
                    placeholder="Sin mínimo"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Monto Máximo Venta (PYG)</label>
                  <input
                    type="number"
                    min={0}
                    value={ruleForm.monto_maximo ?? ""}
                    onChange={e => setRuleForm({ ...ruleForm, monto_maximo: parseFloat(e.target.value) || null })}
                    placeholder="Sin límite"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Válido Desde</label>
                  <input
                    type="date"
                    value={ruleForm.valido_desde}
                    onChange={e => setRuleForm({ ...ruleForm, valido_desde: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Válido Hasta</label>
                  <input
                    type="date"
                    value={ruleForm.valido_hasta}
                    onChange={e => setRuleForm({ ...ruleForm, valido_hasta: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="btn bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:opacity-90"
                >
                  {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>{editingRule ? "Guardar Cambios" : "Crear Esquema"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
