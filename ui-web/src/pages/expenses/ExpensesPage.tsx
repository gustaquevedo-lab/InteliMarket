import { useState, useEffect } from "react"
import { api, API_ORIGIN, type Expense, type ExpenseCategory, type CostCenter, type ExpenseDashboard, type FinanceRecommendation, type PettyCashFund, type BankAccount, type PettyCashFundCount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { useAuth } from "../../context/AuthContext"
import {
  Search, Plus, Loader2, DollarSign, CheckCircle, XCircle, Wallet, TrendingUp, TrendingDown, BarChart3,
  Ban, Receipt as ReceiptIcon, Building2, Sparkles, AlertTriangle, ThumbsUp, ThumbsDown, Layers, PiggyBank, UserCircle2, Landmark, Paperclip, ClipboardCheck, Scale,
} from "lucide-react"

type Tab = "dashboard" | "list" | "sectores" | "categories" | "fondos"

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [dashboard, setDashboard] = useState<ExpenseDashboard | null>(null)
  const [recommendations, setRecommendations] = useState<FinanceRecommendation[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showSectorForm, setShowSectorForm] = useState(false)
  const [showFundForm, setShowFundForm] = useState(false)
  const [funds, setFunds] = useState<PettyCashFund[]>([])
  const [filterEstado, setFilterEstado] = useState("")
  const [form, setForm] = useState<any>({ monto: "", descripcion: "", fund_id: "", category_id: "", cost_center_id: "", proveedor: "", tipo_pago: "efectivo", fecha_gasto: new Date().toISOString().split("T")[0] })
  const [catForm, setCatForm] = useState({ nombre: "", descripcion: "", presupuesto_mensual: "" })
  const [sectorForm, setSectorForm] = useState({ nombre: "", tipo: "sector", peso_prorateo: "1" })
  const [fundForm, setFundForm] = useState({ nombre: "", monto_autorizado: "", custodio_id: "" })
  const [showThresholdForm, setShowThresholdForm] = useState(false)
  const [approvalThreshold, setApprovalThreshold] = useState<number | null>(null)
  const [approvalThresholdForm, setApprovalThresholdForm] = useState("")
  const [showReplenishForm, setShowReplenishForm] = useState(false)
  const [replenishFund, setReplenishFund] = useState<PettyCashFund | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [replenishForm, setReplenishForm] = useState({ monto: "", bank_account_id: "", referencia: "" })
  const [submittingReplenish, setSubmittingReplenish] = useState(false)
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [uploadingComprobante, setUploadingComprobante] = useState(false)
  const [toleranciaArqueoForm, setToleranciaArqueoForm] = useState("")
  const [pendingCounts, setPendingCounts] = useState<PettyCashFundCount[]>([])
  const [showCountForm, setShowCountForm] = useState(false)
  const [countingFund, setCountingFund] = useState<PettyCashFund | null>(null)
  const [countForm, setCountForm] = useState({ monto_contado: "", observaciones: "" })
  const [submittingCount, setSubmittingCount] = useState(false)
  const [countResult, setCountResult] = useState<PettyCashFundCount | null>(null)
  const toast = useToast()
  const { user } = useAuth()

  const catName = (id?: string) => categories.find(c => c.id === id)?.nombre || "Sin categoría"
  const sectorName = (id?: string) => costCenters.find(c => c.id === id)?.nombre || "Sin sector"
  const fundName = (id?: string) => funds.find(f => f.id === id)?.nombre

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [c, cc, f, ac, pc] = await Promise.all([api.expenses.categories.list(), api.expenses.costCenters.list(), api.expenses.funds.list(), api.expenses.approvalConfig.get().catch(() => null), api.expenses.funds.counts.pendingAll().catch(() => [])])
      setCategories(c); setCostCenters(cc); setFunds(f)
      setPendingCounts(pc)
      if (ac) { setApprovalThreshold(ac.umbral_aprobacion); setApprovalThresholdForm(String(ac.umbral_aprobacion)); setToleranciaArqueoForm(String(ac.tolerancia_arqueo)) }
      if (tab === "dashboard") {
        const [d, recs] = await Promise.all([
          api.expenses.dashboard(),
          api.financeAgent.recommendations().catch(() => []),
        ])
        setDashboard(d)
        setRecommendations(recs.filter(r => r.tipo === "reduccion_gasto"))
      }
      if (tab === "list") {
        const e = await api.expenses.list({ estado: filterEstado || undefined })
        setExpenses(e)
      }
    } catch (e: any) { toast.error("Error", e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab, filterEstado])

  const handleCreateExpense = async () => {
    try {
      let comprobante_url: string | undefined
      if (comprobanteFile) {
        setUploadingComprobante(true)
        try {
          const res = await api.expenses.uploadComprobante(comprobanteFile)
          comprobante_url = res.url
        } catch (e: any) {
          toast.error("Error al subir comprobante", e.message)
          setUploadingComprobante(false)
          return
        }
        setUploadingComprobante(false)
      }
      await api.expenses.create({ ...form, fund_id: form.fund_id || undefined, category_id: form.category_id || undefined, cost_center_id: form.cost_center_id || undefined, monto: Number(form.monto), comprobante_url })
      toast.success("Gasto registrado")
      setShowForm(false)
      setForm({ monto: "", descripcion: "", fund_id: "", category_id: "", cost_center_id: "", proveedor: "", tipo_pago: "efectivo", fecha_gasto: new Date().toISOString().split("T")[0] })
      setComprobanteFile(null)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateFund = async () => {
    try {
      await api.expenses.funds.create({
        nombre: fundForm.nombre,
        monto_autorizado: Number(fundForm.monto_autorizado),
        custodio_id: fundForm.custodio_id || undefined,
      })
      toast.success("Fondo creado", "Ya está disponible para registrar gastos contra él")
      setShowFundForm(false)
      setFundForm({ nombre: "", monto_autorizado: "", custodio_id: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateCategory = async () => {
    try {
      await api.expenses.categories.create({ ...catForm, presupuesto_mensual: catForm.presupuesto_mensual ? Number(catForm.presupuesto_mensual) : undefined })
      toast.success("Categoría creada")
      setShowCategoryForm(false)
      setCatForm({ nombre: "", descripcion: "", presupuesto_mensual: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateSector = async () => {
    try {
      await api.expenses.costCenters.create({ ...sectorForm, peso_prorateo: Number(sectorForm.peso_prorateo) })
      toast.success(sectorForm.tipo === "global" ? "Centro de costo global creado" : "Sector creado")
      setShowSectorForm(false)
      setSectorForm({ nombre: "", tipo: "sector", peso_prorateo: "1" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleApprove = async (id: string) => {
    try { await api.expenses.approve(id); toast.success("Aprobado") ; fetchAll() }
    catch (e: any) { toast.error("Error", e.message || "No se pudo aprobar (se requiere rol Supervisor o Gerente)") }
  }

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo:")
    if (!motivo) return
    try { await api.expenses.reject(id, motivo); toast.success("Rechazado", "El gasto quedó marcado como rechazado"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message || "No se pudo rechazar (se requiere rol Supervisor o Gerente)") }
  }

  const handleSaveApprovalThreshold = async () => {
    try {
      await api.expenses.approvalConfig.update({ umbral_aprobacion: Number(approvalThresholdForm), tolerancia_arqueo: Number(toleranciaArqueoForm) })
      toast.success("Guardado", "Configuración actualizada")
      setShowThresholdForm(false)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message || "No se pudo guardar (se requiere rol Gerente o Finanzas)") }
  }

  const handleOpenCount = (fund: PettyCashFund) => {
    setCountingFund(fund)
    setCountForm({ monto_contado: "", observaciones: "" })
    setCountResult(null)
    setShowCountForm(true)
  }

  const handleSubmitCount = async () => {
    if (!countingFund || !countForm.monto_contado) return
    setSubmittingCount(true)
    try {
      const result = await api.expenses.funds.counts.create(countingFund.id, {
        monto_contado: Number(countForm.monto_contado),
        observaciones: countForm.observaciones || undefined,
      })
      setCountResult(result)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setSubmittingCount(false) }
  }

  const handleConfirmCount = async (count: PettyCashFundCount, ajustar: boolean) => {
    const label = ajustar ? "ajustar el saldo del fondo al monto contado" : "confirmar sin ajustar el saldo"
    if (!confirm(`¿Confirmar este arqueo y ${label}?`)) return
    try {
      await api.expenses.funds.counts.confirm(count.id, { ajustar })
      toast.success("Arqueo confirmado", ajustar ? "El saldo del fondo se ajustó al monto contado" : "Se confirmó sin modificar el saldo")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message || "No se pudo confirmar (se requiere rol Supervisor o Gerente)") }
  }

  const handleVoid = async (id: string) => {
    const motivo = window.prompt("Motivo de la anulación:")
    if (!motivo) return
    try { await api.expenses.void(id, motivo); toast.success("Gasto anulado", "Queda excluido de los totales pero se conserva el historial"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message || "No se pudo anular (se requiere rol Supervisor o Gerente)") }
  }

  const handleOpenReplenish = async (fund: PettyCashFund) => {
    setReplenishFund(fund)
    const sugerido = Math.max(0, fund.monto_autorizado - fund.saldo_actual)
    setReplenishForm({ monto: sugerido > 0 ? String(sugerido) : "", bank_account_id: "", referencia: "" })
    setShowReplenishForm(true)
    try {
      const banks = await api.financial.banks.list()
      setBankAccounts(banks.filter(b => b.activo))
    } catch { setBankAccounts([]) }
  }

  const handleReplenish = async () => {
    if (!replenishFund || !replenishForm.monto) return
    setSubmittingReplenish(true)
    try {
      await api.expenses.funds.replenish(replenishFund.id, {
        monto: Number(replenishForm.monto),
        bank_account_id: replenishForm.bank_account_id || undefined,
        referencia: replenishForm.referencia || undefined,
      })
      toast.success("Fondo repuesto", replenishForm.bank_account_id ? "Se descontó de la cuenta bancaria seleccionada" : "Reposición registrada sin respaldo bancario")
      setShowReplenishForm(false)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message || "No se pudo reponer (se requiere rol Gerente o Finanzas)") }
    finally { setSubmittingReplenish(false) }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await api.financeAgent.run()
      toast.success("Análisis completo", "El Gerente Financiero IA revisó los gastos")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) } finally { setAnalyzing(false) }
  }

  const handleDecideRecommendation = async (id: string, approve: boolean) => {
    try {
      const fn = approve ? api.financeAgent.approve : api.financeAgent.reject
      await fn(id, user?.id || "", undefined)
      toast.success(approve ? "Recomendación aprobada" : "Recomendación rechazada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const maxTendencia = dashboard ? Math.max(...dashboard.tendencia_mensual.map(t => t.total), 1) : 1
  const maxSector = dashboard ? Math.max(...dashboard.por_sector.map(s => s.total), 1) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gastos</h1><p className="text-sm text-gray-500">Caja chica, centros de costo y optimización con IA</p></div>
        <div className="flex items-center gap-2">
          {approvalThreshold !== null && (
            <button onClick={() => setShowThresholdForm(true)} className="btn-outline flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />Aprobación automática hasta {formatPYG(approvalThreshold)}
            </button>
          )}
          <button onClick={() => { setForm((f: any) => ({ ...f, fund_id: funds[0]?.id || "" })); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo gasto</button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { k: "dashboard" as Tab, l: "Dashboard", i: BarChart3 },
          { k: "fondos" as Tab, l: "Fondos", i: PiggyBank },
          { k: "list" as Tab, l: "Gastos", i: ReceiptIcon },
          { k: "sectores" as Tab, l: "Sectores", i: Layers },
          { k: "categories" as Tab, l: "Categorías", i: Wallet },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500 font-medium">Gasto del período (30 días)</span>
                    <DollarSign className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{formatPYG(dashboard.total_periodo)}</div>
                  {dashboard.variacion_pct !== null && (
                    <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${dashboard.variacion_pct > 0 ? "text-red-500" : "text-green-500"}`}>
                      {dashboard.variacion_pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(dashboard.variacion_pct).toFixed(1)}% vs. período anterior
                    </div>
                  )}
                </div>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500 font-medium">Sin sector asignado</span>
                    <AlertTriangle className={`w-5 h-5 ${dashboard.sin_asignar / (dashboard.total_periodo || 1) > 0.1 ? "text-amber-600" : "text-gray-400"}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(dashboard.sin_asignar)}</div>
                  <div className="text-xs text-gray-500 mt-1">{dashboard.total_periodo > 0 ? ((dashboard.sin_asignar / dashboard.total_periodo) * 100).toFixed(0) : 0}% del gasto total</div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500 font-medium">Categorías sobre presupuesto</span>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{dashboard.por_categoria.filter(c => c.sobre_presupuesto).length}</div>
                  <div className="text-xs text-gray-500 mt-1">de {dashboard.por_categoria.length} categorías con gasto</div>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Sugerencias del sistema</h3>
                <p className="text-xs text-gray-500 mb-4">Detectadas automáticamente por reglas sobre los datos reales — sin costo de IA</p>
                <div className="space-y-2">
                  {dashboard.sugerencias.map((s, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.detalle}</p>
                      </div>
                    </div>
                  ))}
                  {dashboard.sugerencias.length === 0 && <p className="text-sm text-gray-400">Sin alertas — los gastos están dentro de lo esperado.</p>}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" /> Sugerencias del Gerente Financiero IA</h3>
                  <button onClick={handleAnalyze} disabled={analyzing} className="btn-outline text-xs flex items-center gap-1.5 disabled:opacity-50">
                    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {analyzing ? "Analizando..." : "Analizar con IA"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">Análisis con IA de reducción de gastos — requiere aprobación humana antes de accionar</p>
                <div className="space-y-2">
                  {recommendations.map(r => (
                    <div key={r.id} className="flex gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                      <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.descripcion}</p>
                        {r.monto_relacionado && <p className="text-xs font-semibold text-purple-600 mt-1">{r.monto_relacionado}</p>}
                        {r.status === "pending" ? (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleDecideRecommendation(r.id, true)} className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded"><ThumbsUp className="w-3 h-3" />Aprobar</button>
                            <button onClick={() => handleDecideRecommendation(r.id, false)} className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"><ThumbsDown className="w-3 h-3" />Rechazar</button>
                          </div>
                        ) : (
                          <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>{r.status === "approved" ? "Aprobada" : "Rechazada"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {recommendations.length === 0 && <p className="text-sm text-gray-400">Sin recomendaciones de reducción de gastos todavía — usá "Analizar con IA" para generar el diagnóstico.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Layers className="w-4 h-4" /> Por sector (directo + prorrateo)</h3>
                  <div className="space-y-3">
                    {dashboard.por_sector.map((s, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{s.nombre}</span>
                          <span className="font-semibold">{formatPYG(s.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                          <div className="h-full bg-primary" style={{ width: `${(s.directo / maxSector) * 100}%` }} title="Directo" />
                          <div className="h-full bg-primary/30" style={{ width: `${(s.prorrateado / maxSector) * 100}%` }} title="Prorrateado" />
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">Directo {formatPYG(s.directo)} · Prorrateado {formatPYG(s.prorrateado)}</div>
                      </div>
                    ))}
                    {dashboard.por_sector.length === 0 && <p className="text-sm text-gray-400">Sin sectores configurados</p>}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4" /> Por categoría</h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {dashboard.por_categoria.slice(0, 10).map((c, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-medium ${c.sobre_presupuesto ? "text-red-600" : "text-gray-700 dark:text-gray-300"}`}>{c.nombre}</span>
                          <span className="font-semibold">{formatPYG(c.total)}</span>
                        </div>
                        {c.presupuesto_prorateado !== null && (
                          <>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full ${c.sobre_presupuesto ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.min(c.pct_usado || 0, 100)}%` }} />
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{c.pct_usado?.toFixed(0)}% de {formatPYG(c.presupuesto_prorateado)} presupuestado</div>
                          </>
                        )}
                      </div>
                    ))}
                    {dashboard.por_categoria.length === 0 && <p className="text-sm text-gray-400">Sin gastos en el período</p>}
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Tendencia mensual</h3>
                <div className="flex items-end gap-3 h-32">
                  {dashboard.tendencia_mensual.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-primary/20 hover:bg-primary/30 rounded-t transition-colors relative group" style={{ height: `${(t.total / maxTendencia) * 100}%`, minHeight: "4px" }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">{formatPYG(t.total)}</div>
                      </div>
                      <span className="text-[10px] text-gray-400">{t.mes.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {dashboard.top_proveedores.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Top proveedores</h3>
                  <div className="space-y-2">
                    {dashboard.top_proveedores.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-500">{p.proveedor}</span>
                        <span className="font-semibold">{formatPYG(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "list" && (
            <div>
              <div className="flex gap-3 items-center mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Buscar gasto..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input-field w-40" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                  <option value="">Todos</option><option value="pendiente">Pendientes</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option>
                </select>
              </div>
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Descripción</th><th className="p-3">Monto</th><th className="p-3">Fondo</th><th className="p-3">Categoría</th><th className="p-3">Sector</th><th className="p-3">Pago</th><th className="p-3">Proveedor</th><th className="p-3">Fecha</th><th className="p-3">Estado</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {expenses.filter(e => !search || e.descripcion.toLowerCase().includes(search.toLowerCase())).map(e => (
                      <tr key={e.id} className="table-row">
                        <td className="p-3 font-medium">{e.descripcion}</td>
                        <td className="p-3 font-semibold">{formatPYG(e.monto)}</td>
                        <td className="p-3 text-sm text-gray-500">{fundName(e.fund_id) || "—"}</td>
                        <td className="p-3 text-sm text-gray-500">{catName(e.category_id)}</td>
                        <td className="p-3 text-sm text-gray-500">{sectorName(e.cost_center_id)}</td>
                        <td className="p-3 capitalize text-sm">{e.tipo_pago || "efectivo"}</td>
                        <td className="p-3 text-sm">{e.proveedor || "-"}</td>
                        <td className="p-3 text-sm">{e.fecha_gasto ? new Date(e.fecha_gasto).toLocaleDateString("es-PY") : "-"}</td>
                        <td className="p-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            e.estado === "aprobado" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                            e.estado === "rechazado" ? "bg-red-50 dark:bg-red-900/20 text-red-600" :
                            "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                          }`}>{e.estado}</span>
                          {e.estado === "rechazado" && e.rechazado_motivo && <p className="text-[10px] text-gray-400 mt-1 max-w-[160px]">{e.rechazado_motivo}</p>}
                          {e.comprobante_url && (
                            <a href={e.comprobante_url.startsWith("http") ? e.comprobante_url : `${API_ORIGIN}${e.comprobante_url}`} target="_blank" rel="noreferrer" title="Ver comprobante" className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-1">
                              <Paperclip className="w-3 h-3" />comprobante
                            </a>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {e.estado === "pendiente" && <button onClick={() => handleApprove(e.id)} title="Aprobar" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><CheckCircle className="w-4 h-4 text-green-500" /></button>}
                            {e.estado === "pendiente" && <button onClick={() => handleReject(e.id)} title="Rechazar" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><XCircle className="w-4 h-4 text-red-500" /></button>}
                            <button onClick={() => handleVoid(e.id)} title="Anular" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Ban className="w-4 h-4 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-gray-500">Sin gastos registrados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "fondos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Fondos fijos de caja chica</h3>
                  <p className="text-sm text-gray-500">Cada fondo tiene un monto autorizado y un saldo real que baja con cada gasto. Los gastos se registran contra un fondo — sin fondo, no hay contra qué descontar.</p>
                </div>
                <button onClick={() => { setFundForm({ nombre: "", monto_autorizado: "", custodio_id: user?.id || "" }); setShowFundForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo fondo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {funds.map(f => {
                  const pctUsado = f.monto_autorizado > 0 ? ((f.monto_autorizado - f.saldo_actual) / f.monto_autorizado) * 100 : 0
                  const bajo = f.monto_autorizado > 0 && f.saldo_actual / f.monto_autorizado < 0.2
                  return (
                    <div key={f.id} className="card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold flex items-center gap-2"><PiggyBank className="w-4 h-4 text-primary" />{f.nombre}</h4>
                        {!f.activo && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactivo</span>}
                      </div>
                      {f.custodio_nombre && <p className="text-xs text-gray-500 flex items-center gap-1 mb-3"><UserCircle2 className="w-3.5 h-3.5" />{f.custodio_nombre}</p>}
                      <div className="flex items-baseline justify-between mb-1">
                        <span className={`text-xl font-bold ${bajo ? "text-red-600" : "text-gray-900 dark:text-white"}`}>{formatPYG(f.saldo_actual)}</span>
                        <span className="text-xs text-gray-400">de {formatPYG(f.monto_autorizado)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${bajo ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.min(pctUsado, 100)}%` }} />
                      </div>
                      {bajo && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Saldo bajo — considerar reposición</p>}
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleOpenReplenish(f)} className="btn-outline text-xs flex-1 flex items-center justify-center gap-2">
                          <Landmark className="w-3.5 h-3.5" />Reponer
                        </button>
                        <button onClick={() => handleOpenCount(f)} className="btn-outline text-xs flex-1 flex items-center justify-center gap-2">
                          <ClipboardCheck className="w-3.5 h-3.5" />Arqueo
                        </button>
                      </div>
                    </div>
                  )
                })}
                {funds.length === 0 && (
                  <div className="col-span-full card p-8 text-center text-gray-500">
                    Sin fondos configurados todavía. Sin un fondo, los gastos no tienen contra qué descontarse — creá el primero para empezar.
                  </div>
                )}
              </div>
              {pendingCounts.length > 0 && (
                <div className="card p-4 mt-4 border-l-4 border-amber-400">
                  <h4 className="font-bold flex items-center gap-2 mb-3"><Scale className="w-4 h-4 text-amber-500" />Arqueos pendientes de confirmación</h4>
                  <div className="space-y-2">
                    {pendingCounts.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <div>
                          <p className="font-medium">{fundName(c.fund_id) || "Fondo"} — contado por {c.contado_por_nombre || "—"}</p>
                          <p className="text-xs text-gray-500">
                            Esperado {formatPYG(c.saldo_esperado)} · Contado {formatPYG(c.monto_contado)} ·{" "}
                            <span className={c.diferencia === 0 ? "text-gray-500" : c.diferencia > 0 ? "text-green-600" : "text-red-600"}>
                              {c.diferencia === 0 ? "sin diferencia" : `diferencia ${c.diferencia > 0 ? "+" : ""}${formatPYG(c.diferencia)}`}
                            </span>
                            {c.requiere_revision && <span className="text-amber-600 font-semibold"> · requiere revisión</span>}
                          </p>
                          {c.observaciones && <p className="text-xs text-gray-400 mt-0.5">{c.observaciones}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleConfirmCount(c, true)} className="btn-primary text-xs px-3 py-1.5">Confirmar y ajustar</button>
                          <button onClick={() => handleConfirmCount(c, false)} className="btn-ghost text-xs px-3 py-1.5">Confirmar sin ajustar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "sectores" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Sectores y centros de costo</h3>
                  <p className="text-sm text-gray-500">Imputá cada gasto a un sector para medir su rentabilidad real. El centro "global" se prorratea entre los sectores según su peso.</p>
                </div>
                <button onClick={() => setShowSectorForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo sector</button>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Nombre</th><th className="p-3">Tipo</th><th className="p-3">Peso de prorrateo</th><th className="p-3">Activo</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {costCenters.map(c => (
                      <tr key={c.id} className="table-row">
                        <td className="p-3 font-medium">{c.nombre}</td>
                        <td className="p-3 text-sm">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.tipo === "global" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600"}`}>{c.tipo === "global" ? "Global (prorratea)" : "Sector"}</span>
                        </td>
                        <td className="p-3 text-sm text-gray-500">{c.tipo === "sector" ? c.peso_prorateo : "-"}</td>
                        <td className="p-3">{c.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                      </tr>
                    ))}
                    {costCenters.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Sin sectores configurados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Categorías de gasto</h3>
                <button onClick={() => setShowCategoryForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva categoría</button>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Nombre</th><th className="p-3">Descripción</th><th className="p-3">Presupuesto mensual</th><th className="p-3">Activo</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {categories.map(c => (
                      <tr key={c.id} className="table-row">
                        <td className="p-3 font-medium">{c.nombre}</td>
                        <td className="p-3 text-sm text-gray-500">{c.descripcion || "-"}</td>
                        <td className="p-3">{c.presupuesto_mensual ? formatPYG(c.presupuesto_mensual) : "-"}</td>
                        <td className="p-3">{c.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                      </tr>
                    ))}
                    {categories.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Sin categorías</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nuevo gasto</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Descripción</label><input className="input-field" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></div>
              <div><label className="label-field">Monto (Gs)</label><input className="input-field" type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} /></div>
              <div>
                <label className="label-field">Fondo de caja chica</label>
                <select className="input-field" value={form.fund_id} onChange={e => setForm({ ...form, fund_id: e.target.value })}>
                  <option value="">Sin fondo (no descuenta ninguna caja)</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.nombre} — disponible {formatPYG(f.saldo_actual)}</option>)}
                </select>
                {funds.length === 0 && <p className="text-xs text-amber-500 mt-1">No hay fondos creados — este gasto va a quedar sin caja de la cual descontarse. Creá un fondo primero en la pestaña "Fondos".</p>}
              </div>
              <div><label className="label-field">Categoría</label><select className="input-field" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
              <div>
                <label className="label-field">Sector / centro de costo</label>
                <select className="input-field" value={form.cost_center_id} onChange={e => setForm({ ...form, cost_center_id: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {costCenters.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.tipo === "global" ? " (se prorratea)" : ""}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Imputá el gasto a un sector para medir su rentabilidad real, o al centro "global" si aplica a todo el supermercado.</p>
              </div>
              <div><label className="label-field">Tipo pago</label><select className="input-field" value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value })}>
                <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
              </select></div>
              <div><label className="label-field">Proveedor (opcional)</label><input className="input-field" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /></div>
              <div><label className="label-field">Fecha</label><input className="input-field" type="date" value={form.fecha_gasto} onChange={e => setForm({ ...form, fecha_gasto: e.target.value })} /></div>
              <div>
                <label className="label-field">Comprobante (foto o PDF, opcional)</label>
                <input className="input-field" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e => setComprobanteFile(e.target.files?.[0] || null)} />
                {comprobanteFile && <p className="text-xs text-gray-400 mt-1">{comprobanteFile.name}</p>}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setComprobanteFile(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateExpense} disabled={!form.descripcion || !form.monto || uploadingComprobante} className="btn-primary disabled:opacity-50">
                {uploadingComprobante ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReplenishForm && replenishFund && (
        <div className="modal-overlay" onClick={() => setShowReplenishForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><Landmark className="w-5 h-5" />Reponer fondo</h3></div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-500">Fondo</p>
                <p className="font-bold">{replenishFund.nombre}</p>
                <p className="text-sm text-gray-500 mt-2">Saldo actual</p>
                <p className="text-xl font-bold text-amber-500">{formatPYG(replenishFund.saldo_actual)} <span className="text-xs text-gray-400 font-normal">de {formatPYG(replenishFund.monto_autorizado)}</span></p>
              </div>
              <div>
                <label className="label-field">Monto a reponer (Gs)</label>
                <input className="input-field" type="number" value={replenishForm.monto} onChange={e => setReplenishForm({ ...replenishForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Cuenta bancaria de origen (opcional)</label>
                <select className="input-field" value={replenishForm.bank_account_id} onChange={e => setReplenishForm({ ...replenishForm, bank_account_id: e.target.value })}>
                  <option value="">Sin cuenta (reposición manual, sin respaldo bancario)</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.banco} — {b.numero_cuenta} (disponible {formatPYG(Number(b.saldo_actual) || 0)})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Si elegís una cuenta, se descuenta de verdad de su saldo y queda registrado como movimiento bancario.</p>
              </div>
              <div>
                <label className="label-field">Referencia</label>
                <input className="input-field" placeholder="Nro. de transferencia, recibo..." value={replenishForm.referencia} onChange={e => setReplenishForm({ ...replenishForm, referencia: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowReplenishForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleReplenish} disabled={submittingReplenish || !replenishForm.monto} className="btn-primary disabled:opacity-50">
                {submittingReplenish ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reponer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showThresholdForm && (
        <div className="modal-overlay" onClick={() => setShowThresholdForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><CheckCircle className="w-5 h-5" />Umbral de aprobación automática</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field">Monto (Gs)</label>
                <input className="input-field" type="number" value={approvalThresholdForm} onChange={e => setApprovalThresholdForm(e.target.value)} />
              </div>
              <p className="text-xs text-gray-400">
                Gastos por debajo de este monto se aprueban automáticamente al registrarse. Por encima, quedan pendientes hasta que un Supervisor o Gerente los apruebe o rechace explícitamente.
              </p>
              <div>
                <label className="label-field">Tolerancia de arqueo (Gs)</label>
                <input className="input-field" type="number" value={toleranciaArqueoForm} onChange={e => setToleranciaArqueoForm(e.target.value)} />
              </div>
              <p className="text-xs text-gray-400">
                Diferencias de arqueo por debajo de este monto se consideran normales (redondeo). Por encima, el arqueo queda marcado para revisión de un Supervisor o Gerente.
              </p>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowThresholdForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleSaveApprovalThreshold} className="btn-primary">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showFundForm && (
        <div className="modal-overlay" onClick={() => setShowFundForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5" />Nuevo fondo de caja chica</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" placeholder="Caja Chica Central" value={fundForm.nombre} onChange={e => setFundForm({ ...fundForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Monto autorizado (Gs)</label><input className="input-field" type="number" placeholder="2000000" value={fundForm.monto_autorizado} onChange={e => setFundForm({ ...fundForm, monto_autorizado: e.target.value })} /></div>
              <p className="text-xs text-gray-400">El saldo inicial arranca igual al monto autorizado. Cada gasto que se registre contra este fondo va a ir bajando el saldo real.</p>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowFundForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateFund} disabled={!fundForm.nombre || !fundForm.monto_autorizado} className="btn-primary disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Arqueo — conteo ciego: no se muestra el saldo del sistema hasta
          despues de guardado el conteo (mismo patron que el cierre de caja
          en el modulo Caja). */}
      {showCountForm && countingFund && !countResult && (
        <div className="modal-overlay" onClick={() => setShowCountForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" />Arqueo de {countingFund.nombre}</h3></div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg p-3 text-sm">
                <strong>Conteo ciego</strong>: contá el efectivo físico del fondo antes de continuar. El sistema te muestra la diferencia recién después de guardar tu conteo.
              </div>
              <div>
                <label className="label-field">Monto contado (Gs)</label>
                <input className="input-field" type="number" value={countForm.monto_contado} onChange={e => setCountForm({ ...countForm, monto_contado: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="label-field">Observaciones (opcional)</label>
                <input className="input-field" value={countForm.observaciones} onChange={e => setCountForm({ ...countForm, observaciones: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCountForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleSubmitCount} disabled={submittingCount || !countForm.monto_contado} className="btn-primary disabled:opacity-50">
                {submittingCount ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar conteo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCountForm && countResult && (
        <div className="modal-overlay" onClick={() => { setShowCountForm(false); setCountResult(null) }}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><Scale className="w-5 h-5" />Resultado del arqueo</h3></div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Saldo esperado (sistema)</span><span className="font-semibold">{formatPYG(countResult.saldo_esperado)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Monto contado</span><span className="font-semibold">{formatPYG(countResult.monto_contado)}</span></div>
              <div className={`flex justify-between text-base font-bold ${countResult.diferencia === 0 ? "text-gray-700 dark:text-gray-300" : countResult.diferencia > 0 ? "text-green-600" : "text-red-600"}`}>
                <span>Diferencia</span><span>{countResult.diferencia > 0 ? "+" : ""}{formatPYG(countResult.diferencia)}</span>
              </div>
              <p className="text-xs text-gray-400">
                {countResult.diferencia === 0 ? "El conteo coincide exactamente con lo esperado." : countResult.diferencia > 0 ? "Sobrante detectado." : "Faltante detectado."}
              </p>
              {countResult.requiere_revision && (
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg p-3 text-xs">
                  La diferencia supera la tolerancia configurada — este arqueo quedó pendiente hasta que un Supervisor o Gerente lo confirme.
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowCountForm(false); setCountResult(null) }} className="btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="modal-overlay" onClick={() => setShowCategoryForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nueva categoría</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={catForm.nombre} onChange={e => setCatForm({ ...catForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Descripción</label><input className="input-field" value={catForm.descripcion} onChange={e => setCatForm({ ...catForm, descripcion: e.target.value })} /></div>
              <div><label className="label-field">Presupuesto mensual</label><input className="input-field" type="number" value={catForm.presupuesto_mensual} onChange={e => setCatForm({ ...catForm, presupuesto_mensual: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCategoryForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateCategory} disabled={!catForm.nombre} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showSectorForm && (
        <div className="modal-overlay" onClick={() => setShowSectorForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nuevo sector</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={sectorForm.nombre} onChange={e => setSectorForm({ ...sectorForm, nombre: e.target.value })} /></div>
              <div>
                <label className="label-field">Tipo</label>
                <select className="input-field" value={sectorForm.tipo} onChange={e => setSectorForm({ ...sectorForm, tipo: e.target.value })}>
                  <option value="sector">Sector (área del supermercado)</option>
                  <option value="global">Global (se prorratea entre los sectores)</option>
                </select>
              </div>
              {sectorForm.tipo === "sector" && (
                <div>
                  <label className="label-field">Peso de prorrateo</label>
                  <input className="input-field" type="number" step="0.1" value={sectorForm.peso_prorateo} onChange={e => setSectorForm({ ...sectorForm, peso_prorateo: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">A mayor peso, mayor proporción de los gastos globales recibe este sector.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowSectorForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateSector} disabled={!sectorForm.nombre} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
