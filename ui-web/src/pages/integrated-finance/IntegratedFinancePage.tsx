import { useState, useEffect } from "react"
import {
  BarChart3, ReceiptText, CalendarDays, Percent, FileSpreadsheet,
  Landmark, HandCoins, RefreshCcw, ClipboardCheck, TrendingUp,
  Plus, Search, Loader2, DollarSign, Download, Wallet, BookOpen, Scale, CheckCircle2, ShieldCheck
} from "lucide-react"
import { api } from "../../api/index"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const API_BASE = import.meta.env.VITE_API_URL || "/api"

function downloadPdf(path: string) {
  window.open(`${API_BASE}${path}${path.includes("?") ? "&" : "?"}company_id=${COMPANY_ID}`, "_blank")
}

type Tab = "cierre" | "cuentas" | "retenciones" | "presupuestos"

export default function IntegratedFinancePage() {
  const [tab, setTab] = useState<Tab>("cierre")

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Contabilidad Integrada
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Balance de comprobación, Estado de Resultados (PyG), Plan de Cuentas y Normativa DNIT
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {[
          { k: "cierre" as Tab, l: "Balance & Estado de Resultados", i: FileSpreadsheet },
          { k: "cuentas" as Tab, l: "Plan de Cuentas", i: BookOpen },
          { k: "retenciones" as Tab, l: "Retenciones DNIT", i: ReceiptText },
          { k: "presupuestos" as Tab, l: "Control Presupuestario", i: Wallet },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {tab === "cierre" && <CierreContableTab />}
      {tab === "cuentas" && <PlanCuentasTab />}
      {tab === "retenciones" && <RetencionesTab />}
      {tab === "presupuestos" && <PresupuestosTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-5 h-5 animate-spin text-primary" /> }

// ═══════════════════════ TAB 1: CIERRE & BALANCE ═══════════════════════

function CierreContableTab() {
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [trialBalance, setTrialBalance] = useState<any>(null)
  const [pnl, setPnl] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const loadPeriods = async () => {
    setLoading(true)
    try {
      const ps = await api.integratedFinance.listAccountingPeriods(COMPANY_ID)
      setPeriods(ps)
      if (ps.length > 0) {
        // Default to August 2026 (current active month) or first open
        const aug2026 = ps.find((p: any) => p.anio === 2026 && p.mes === 8)
        setSelectedPeriod(aug2026 ? aug2026.id : ps[0].id)
      }
    } catch (e: any) {
      toast.error("Error", "No se pudieron cargar los períodos contables")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPeriods() }, [])

  useEffect(() => {
    if (!selectedPeriod) return
    api.integratedFinance.getTrialBalance(COMPANY_ID, selectedPeriod).then(setTrialBalance).catch(() => setTrialBalance(null))
    api.integratedFinance.getPnl(COMPANY_ID, selectedPeriod).then(setPnl).catch(() => setPnl(null))
  }, [selectedPeriod])

  const closePeriod = async (id: string) => {
    try {
      await api.integratedFinance.closeAccountingPeriod(id)
      toast.success("Período Cerrado", "Ejercicio fiscal cerrado correctamente")
      loadPeriods()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const currentPeriod = periods.find((p: any) => p.id === selectedPeriod)

  return (
    <div className="space-y-6">
      {/* Period selector and actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Período Contable:</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 font-mono">
            {periods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.anio}-{String(p.mes).padStart(2, "0")} — {p.estado.toUpperCase()}
              </option>
            ))}
          </select>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${currentPeriod?.estado === "abierto" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
            {currentPeriod?.estado || "—"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentPeriod?.estado === "abierto" && (
            <button onClick={() => closePeriod(currentPeriod.id)} className="btn-secondary text-xs flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Cerrar Período Fiscal</span>
            </button>
          )}
        </div>
      </div>

      {currentPeriod && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance de Comprobacion */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Balance de Comprobación (Sumas y Saldos)
                </h3>
                <span className="text-[10px] text-gray-400">Ejercicio {currentPeriod.anio}-{String(currentPeriod.mes).padStart(2, "0")}</span>
              </div>
              {trialBalance && (
                <button onClick={() => downloadPdf(`/v1/integrated-finance/accounting/trial-balance/${selectedPeriod}/pdf`)}
                  className="btn-secondary text-xs flex items-center gap-1.5 font-bold text-primary">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              )}
            </div>

            {trialBalance && trialBalance.items?.length > 0 ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Cuenta</th>
                      <th className="table-cell text-right">Debe (₲)</th>
                      <th className="table-cell text-right">Haber (₲)</th>
                      <th className="table-cell text-right">Saldo (₲)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.items?.map((i: any, idx: number) => (
                      <tr key={idx} className="table-row">
                        <td className="table-td">
                          <span className="font-mono font-bold text-primary mr-1.5">{i.codigo}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{i.nombre}</span>
                        </td>
                        <td className="table-td text-right font-mono">{formatPYG(i.debe)}</td>
                        <td className="table-td text-right font-mono">{formatPYG(i.haber)}</td>
                        <td className={`table-td text-right font-mono font-bold ${i.saldo < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
                          {formatPYG(i.saldo)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs">
                      <td className="py-2.5 px-3">TOTALES CONSOLIDADOS</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatPYG(trialBalance.total_debe)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-600">{formatPYG(trialBalance.total_haber)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-xs py-8 text-center">Sin movimientos contables registrados en este período</p>}
          </div>

          {/* Estado de Resultados (PyG) */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Estado de Resultados (PyG)
                </h3>
                <span className="text-[10px] text-gray-400">Pérdidas y Ganancias por rubro contable</span>
              </div>
              {pnl && (
                <button onClick={() => downloadPdf(`/v1/integrated-finance/accounting/pnl/${selectedPeriod}/pdf`)}
                  className="btn-secondary text-xs flex items-center gap-1.5 font-bold text-emerald-600">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              )}
            </div>

            {pnl ? (
              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">1. Ingresos Operativos</p>
                  <div className="space-y-1 pl-2">
                    {pnl.ingresos?.map((i: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-300"><span className="font-mono font-bold mr-1">{i.codigo}</span> {i.nombre}</span>
                        <span className="font-mono font-bold text-emerald-600">{formatPYG(i.monto)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1.5 text-gray-900 dark:text-white">
                      <span>Total Ingresos</span>
                      <span className="font-mono text-emerald-600">{formatPYG(pnl.total_ingresos)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">2. Costo Directo de Ventas</p>
                  <div className="space-y-1 pl-2">
                    {pnl.costos?.map((c: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-300"><span className="font-mono font-bold mr-1">{c.codigo}</span> {c.nombre}</span>
                        <span className="font-mono text-amber-600">({formatPYG(c.monto)})</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1.5 text-gray-900 dark:text-white">
                      <span>Total Costos</span>
                      <span className="font-mono text-amber-600">({formatPYG(pnl.total_costos)})</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5 font-bold uppercase tracking-wider">3. Gastos Operativos & Administrativos</p>
                  <div className="space-y-1 pl-2 max-h-36 overflow-y-auto">
                    {pnl.gastos?.map((g: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-300"><span className="font-mono font-bold mr-1">{g.codigo}</span> {g.nombre}</span>
                        <span className="font-mono text-red-500">({formatPYG(g.monto)})</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1.5 text-gray-900 dark:text-white">
                      <span>Total Gastos</span>
                      <span className="font-mono text-red-500">({formatPYG(pnl.total_gastos)})</span>
                    </div>
                  </div>
                </div>

                <div className={`flex justify-between font-black text-sm p-3 rounded-lg border ${pnl.resultado_neto >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700 dark:text-red-400"}`}>
                  <span>(=) RESULTADO NETO DEL EJERCICIO</span>
                  <span className="font-mono">{formatPYG(pnl.resultado_neto)}</span>
                </div>
              </div>
            ) : <p className="text-gray-400 text-xs py-8 text-center">Sin datos de PyG en este período</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ TAB 2: PLAN DE CUENTAS ═══════════════════════

function PlanCuentasTab() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [filterLevel, setFilterLevel] = useState<number | 0>(0)
  const [filterType, setFilterType] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    api.integratedFinance.listAccountPlan(COMPANY_ID)
      .then(res => setAccounts(Array.isArray(res) ? res : []))
      .catch(() => toast.error("Error", "No se pudo cargar el plan de cuentas"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = accounts.filter(a => {
    const term = search.toLowerCase()
    const matchSearch = !search || (a.codigo || "").toLowerCase().includes(term) || (a.nombre || "").toLowerCase().includes(term) || (a.tipo || "").toLowerCase().includes(term)
    const matchLevel = filterLevel === 0 || a.nivel === filterLevel
    const matchType = filterType === "all" || (a.tipo || "").toLowerCase() === filterType.toLowerCase()
    return matchSearch && matchLevel && matchType
  })

  const getLevelBadge = (nivel: number, acepta: boolean) => {
    switch (nivel) {
      case 1:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-900 text-white dark:bg-slate-700">N1 · Grupo</span>
      case 2:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-700 text-white dark:bg-blue-600">N2 · Rubro</span>
      case 3:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">N3 · Subrubro</span>
      case 4:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">N4 · Mayor</span>
      case 5:
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">N5 · Imputable</span>
    }
  }

  const getTypeBadge = (tipo: string) => {
    const t = (tipo || "").toLowerCase()
    if (t === "activo") return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">Activo</span>
    if (t === "pasivo") return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Pasivo</span>
    if (t === "patrimonio") return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">Patrimonio</span>
    if (t === "ingreso") return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Ingreso</span>
    if (t === "gasto") return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">Gasto / Costo</span>
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">{tipo}</span>
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-10 text-xs font-medium w-full"
            placeholder="Buscar por código (ej: 11110) o nombre de cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Level Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">Nivel:</span>
          {[
            { l: "Todos", v: 0 },
            { l: "N1 Grupo", v: 1 },
            { l: "N2 Rubro", v: 2 },
            { l: "N3 Subrubro", v: 3 },
            { l: "N4 Mayor", v: 4 },
            { l: "N5 Imputable", v: 5 },
          ].map(lvl => (
            <button
              key={lvl.v}
              onClick={() => setFilterLevel(lvl.v)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                filterLevel === lvl.v
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {lvl.l}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-field text-xs font-medium w-36"
        >
          <option value="all">Todos los Tipos</option>
          <option value="activo">Solo Activo</option>
          <option value="pasivo">Solo Pasivo</option>
          <option value="ingreso">Solo Ingresos</option>
          <option value="gasto">Solo Egresos</option>
        </select>
      </div>

      <div className="flex justify-between items-center px-1 text-xs text-gray-400">
        <span>Mostrando <strong>{filtered.length}</strong> de <strong>{accounts.length}</strong> cuentas contables</span>
        <span className="font-mono text-[11px]">Estructura Contable Jerárquica N1 ➔ N5</span>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
              <tr className="table-header">
                <th className="table-cell w-32">Código</th>
                <th className="table-cell">Nomenclatura / Descripción de la Cuenta</th>
                <th className="table-cell text-center w-28">Clasificación</th>
                <th className="table-cell text-center w-28">Jerarquía</th>
                <th className="table-cell text-center w-24">Imputable</th>
                <th className="table-cell text-center w-20">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No se encontraron cuentas con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => {
                  const isHeader = a.nivel <= 3
                  const isMayor = a.nivel === 4
                  const indentClass =
                    a.nivel === 1 ? "pl-2 font-black text-sm text-gray-900 dark:text-white uppercase" :
                    a.nivel === 2 ? "pl-6 font-bold text-xs text-gray-800 dark:text-gray-200 uppercase" :
                    a.nivel === 3 ? "pl-10 font-bold text-xs text-blue-900 dark:text-blue-300" :
                    a.nivel === 4 ? "pl-14 font-semibold text-xs text-gray-700 dark:text-gray-300" :
                    "pl-18 font-normal text-xs text-gray-600 dark:text-gray-400"

                  const rowBg =
                    a.nivel === 1 ? "bg-slate-100/80 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700" :
                    a.nivel === 2 ? "bg-blue-50/40 dark:bg-blue-950/20" :
                    a.nivel === 3 ? "bg-slate-50/60 dark:bg-slate-900/30" :
                    "hover:bg-gray-50/60 dark:hover:bg-slate-800/40"

                  return (
                    <tr key={a.id || i} className={`table-row transition-colors ${rowBg}`}>
                      <td className="table-td font-mono font-bold text-primary whitespace-nowrap">
                        {a.codigo}
                      </td>
                      <td className={`table-td ${indentClass}`}>
                        <div className="flex items-center gap-1.5">
                          {a.nivel === 1 && <span className="w-2 h-2 rounded-full bg-slate-800 dark:bg-white inline-block mr-1"></span>}
                          {a.nivel === 2 && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block mr-1"></span>}
                          {a.nivel >= 3 && a.nivel < 5 && <span className="text-gray-300 dark:text-gray-600 mr-1 font-mono">├─</span>}
                          {a.nivel === 5 && <span className="text-gray-400 dark:text-gray-600 mr-1 font-mono pl-2">└─</span>}
                          <span>{a.nombre}</span>
                        </div>
                      </td>
                      <td className="table-td text-center whitespace-nowrap">
                        {getTypeBadge(a.tipo)}
                      </td>
                      <td className="table-td text-center whitespace-nowrap">
                        {getLevelBadge(a.nivel, a.acepta_asientos)}
                      </td>
                      <td className="table-td text-center whitespace-nowrap font-mono text-[11px]">
                        {a.acepta_asientos ? (
                          <span className="text-emerald-600 font-bold">Sí (Asientos)</span>
                        ) : (
                          <span className="text-gray-400 font-medium">No (Título)</span>
                        )}
                      </td>
                      <td className="table-td text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Activa
                        </span>
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
  )
}

// ═══════════════════════ TAB 3: RETENCIONES DNIT ═══════════════════════

function RetencionesTab() {
  const [configs, setConfigs] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      api.integratedFinance.listWithholdingConfigs(COMPANY_ID).catch(() => []),
      api.integratedFinance.listWithholdingDocuments(COMPANY_ID).catch(() => []),
    ]).then(([c, d]) => {
      setConfigs(c)
      setDocs(d)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Retenciones Impositivas — Normativa DNIT
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Control y emisión de retenciones tributarias (IVA, IRE / Renta) según regulaciones de la Dirección Nacional de Ingresos Tributarios</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {configs.map((cfg, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{cfg.categoria || cfg.tipo?.toUpperCase()}</span>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{cfg.regimen?.toUpperCase()} • Tasa {cfg.tasa}%</p>
              <span className="text-[10px] text-emerald-600 font-bold">Activo • DNIT</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Comprobantes de Retención Emitidos ({docs.length})</h4>
        </div>
        {docs.length === 0 ? (
          <p className="text-gray-400 text-xs py-8 text-center">No hay comprobantes de retención emitidos en el período fiscal actual</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell">Tipo</th>
                  <th className="table-cell">Comprobante DNIT</th>
                  <th className="table-cell">CDC Electrónico</th>
                  <th className="table-cell text-right">Base Imponible</th>
                  <th className="table-cell text-right">Retenido (₲)</th>
                  <th className="table-cell text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-td">{d.fecha_emision}</td>
                    <td className="table-td uppercase font-bold text-primary">{d.tipo}</td>
                    <td className="table-td font-mono font-bold">{d.numero_documento || "—"}</td>
                    <td className="table-td font-mono text-[10px] text-gray-400">{d.cdc ? `${d.cdc.slice(0, 16)}...` : "—"}</td>
                    <td className="table-td text-right font-mono">{formatPYG(d.base_imponible)}</td>
                    <td className="table-td text-right font-mono font-bold text-emerald-600">{formatPYG(d.monto_retenido)}</td>
                    <td className="table-td text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">{d.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════ TAB 4: PRESUPUESTOS ═══════════════════════

function PresupuestosTab() {
  const [budgetsVsActual, setBudgetsVsActual] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    api.financial.budgets.vsActual("2026-08")
      .then(setBudgetsVsActual)
      .catch(() => toast.error("Error", "No se pudo cargar la ejecución presupuestaria"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Ejecución Presupuestaria por Categoría y Centro de Costos (Agosto 2026)</h3>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Rubro / Partida Presupuestaria</th>
              <th className="table-cell">Área / Centro de Costos</th>
              <th className="table-cell text-right">Presupuestado (₲)</th>
              <th className="table-cell text-right">Ejecutado Real (₲)</th>
              <th className="table-cell text-right">Saldo Disponible (₲)</th>
              <th className="table-cell text-center">% Ejecución</th>
            </tr>
          </thead>
          <tbody>
            {budgetsVsActual.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay rubros presupuestados registrados</td></tr>
            ) : budgetsVsActual.map((b, i) => {
              const pct = parseFloat(b.porcentaje_ejecutado) || 0
              const pres = parseFloat(b.monto_presupuestado) || 0
              const ejec = parseFloat(b.monto_ejecutado) || 0
              const disp = parseFloat(b.monto_disponible) || 0
              return (
                <tr key={i} className="table-row">
                  <td className="table-td font-bold text-gray-900 dark:text-white">{b.nombre || b.categoria}</td>
                  <td className="table-td text-gray-500 uppercase font-medium">{b.area}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(pres)}</td>
                  <td className="table-td text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{formatPYG(ejec)}</td>
                  <td className={`table-td text-right font-mono font-bold ${disp < 0 ? "text-red-500" : "text-emerald-600"}`}>{formatPYG(disp)}</td>
                  <td className="table-td text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pct > 100 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {pct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
