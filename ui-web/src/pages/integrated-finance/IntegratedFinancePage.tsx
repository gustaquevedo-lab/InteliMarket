import { useState, useEffect } from "react"
import {
  BarChart3, Coins, ReceiptText, CalendarDays, Handshake, Percent, FileSpreadsheet,
  Landmark, HandCoins, Banknote, RefreshCcw, ClipboardCheck, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Plus, Search, Loader2, ChevronDown, DollarSign, ArrowUpDown, Download,
  Package, Ban,
} from "lucide-react"
import { api } from "../../api/index"
import { formatPYG } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

function downloadPdf(path: string) {
  window.open(`${API_BASE}${path}${path.includes("?") ? "&" : "?"}company_id=${COMPANY_ID}`, "_blank")
}

export default function IntegratedFinancePage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión Financiera Integrada</h1>
          <p className="text-sm text-gray-500 mt-1">Retenciones, Cierre Contable, EBITDA, Conciliación, Cobranzas</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",    label: "Dashboard",       icon: BarChart3 },
            { key: "retenciones",  label: "Retenciones",     icon: ReceiptText },
            { key: "ctacte",       label: "Cierre Contable", icon: CalendarDays },
            { key: "activosfijos", label: "Activos Fijos",   icon: Package },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"    && <DashboardTab />}
      {tab === "retenciones"  && <RetencionesTab />}
      {tab === "ctacte"       && <CierreContableTab />}
      {tab === "activosfijos" && <ActivosFijosTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
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

// ═══════════════════════ DASHBOARD ═══════════════════════

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.integratedFinance.getDashboard(COMPANY_ID).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">No se pudo cargar el dashboard</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Banknote} label="Liquidez" value={data.liquidez?.toFixed(2)} sub="Activo / Pasivo" color="blue" />
        <KpiCard icon={TrendingUp} label="EBITDA" value={formatPYG(data.ebitda || 0)} sub={`Margen ${data.margen_ebitda}%`} color="green" />
        <KpiCard icon={HandCoins} label="Por Cobrar" value={formatPYG(data.total_por_cobrar || 0)} color="red" />
        <KpiCard icon={Landmark} label="Por Pagar" value={formatPYG(data.total_por_pagar || 0)} color="yellow" />
        <KpiCard icon={Banknote} label="Saldo Bancario" value={formatPYG(data.saldo_bancario || 0)} color="indigo" />
        <KpiCard icon={TrendingUp} label="Rot. Cartera" value={`${data.rotacion_cartera_dias}d`} color="purple" />
        <KpiCard icon={TrendingUp} label="Rot. Proveed." value={`${data.rotacion_proveedores_dias}d`} color="purple" />
        <KpiCard icon={AlertTriangle} label="Ciclo Efectivo" value={`${data.ciclo_efectivo_dias}d`} sub={data.ciclo_efectivo_dias > 0 ? "Necesita capital" : "Autofinanciado"} color={data.ciclo_efectivo_dias > 0 ? "red" : "green"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Proyección Flujo de Caja</h3>
          <div className="space-y-2">
            {[
              { label: "30 días", value: data.proyeccion_30d },
              { label: "60 días", value: data.proyeccion_60d },
              { label: "90 días", value: data.proyeccion_90d },
            ].map((p) => (
              <div key={p.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{p.label}</span>
                <span className={`font-medium ${(p.value || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatPYG(p.value || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Resumen del Mes</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Ingresos</span><span className="font-medium text-green-600">{formatPYG(data.ingresos_del_mes || 0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Gastos</span><span className="font-medium text-red-600">{formatPYG(data.gastos_del_mes || 0)}</span></div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Resultado Neto</span>
              <span className={(data.resultado_neto || 0) >= 0 ? "text-green-600" : "text-red-600"}>
                {formatPYG(data.resultado_neto || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Indicadores</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Retenciones Pend.</span><span>{data.retenciones_pendientes}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cobranzas Activas</span><span>{data.colecciones_pendientes}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Scoring Promedio</span><span className="font-medium">{data.scoring_promedio}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Períodos Abiertos</span><span>{data.accounting_weeks}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ RETENCIONES ═══════════════════════

function RetencionesTab() {
  const [documents, setDocuments] = useState<any[]>([])
  const [configs, setConfigs] = useState<any[]>([])
  const [dash, setDash] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNewDoc, setShowNewDoc] = useState(false)

  const load = async () => {
    setLoading(true)
    const [docs, cfgs, d] = await Promise.all([
      api.integratedFinance.listWithholdingDocuments(COMPANY_ID).catch(() => []),
      api.integratedFinance.listWithholdingConfigs(COMPANY_ID).catch(() => []),
      api.integratedFinance.getWithholdingDashboard(COMPANY_ID).catch(() => null),
    ])
    setDocuments(docs)
    setConfigs(cfgs)
    setDash(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approveDoc = async (id: string) => {
    await api.integratedFinance.approveWithholdingDocument(id)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-400">
        Este módulo registra y calcula retenciones para uso interno — no envía nada a la SET/SIFEN de forma automática. La presentación real ante la SET se hace fuera de InteliMarket.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={ReceiptText} label="Pendientes" value={dash?.total_retenciones_pendientes ?? 0} color="yellow" />
        <KpiCard icon={CheckCircle} label="Aprobadas" value={dash?.total_retenciones_enviadas ?? 0} color="green" />
        <KpiCard icon={Banknote} label="Monto Pend." value={formatPYG(dash?.monto_total_pendiente || 0)} color="red" />
        <KpiCard icon={Banknote} label="Monto Aprobado" value={formatPYG(dash?.monto_total_enviado || 0)} color="indigo" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Documentos de Retención</h3>
          <button onClick={() => setShowNewDoc(!showNewDoc)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />Nueva Retención
          </button>
        </div>

        {showNewDoc && <NewWithholdingDocForm configs={configs} onDone={() => { setShowNewDoc(false); load() }} />}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Número</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Período</th>
                <th className="text-right px-4 py-3 font-medium">Base Imponible</th>
                <th className="text-right px-4 py-3 font-medium">Monto Ret.</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-center px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d: any) => (
                <tr key={d.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{d.numero_documento || "—"}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">{d.tipo}</span></td>
                  <td className="px-4 py-3">{d.periodo_fiscal}</td>
                  <td className="px-4 py-3 text-right">{formatPYG(d.base_imponible)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPYG(d.monto_retenido)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium
                      ${d.estado === "pendiente" ? "bg-yellow-50 text-yellow-600" : ""}
                      ${d.estado === "aprobado" ? "bg-green-50 text-green-600" : ""}
                    `}>{d.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      {d.estado === "pendiente" && (
                        <button onClick={() => approveDoc(d.id)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Aprobar</button>
                      )}
                      {d.estado === "aprobado" && <span className="text-xs text-green-500"><CheckCircle className="w-4 h-4 inline" /> Aprobada</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin documentos de retención</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function NewWithholdingDocForm({ configs, onDone }: { configs: any[]; onDone: () => void }) {
  const [form, setForm] = useState({ supplier_id: "", invoice_id: "", tipo: "IVA", periodo_fiscal: "", base_imponible: 0, moneda: "PYG" })

  const submit = async () => {
    await api.integratedFinance.createWithholdingDocument({ ...form, company_id: COMPANY_ID, tasa: 0, monto_retenido: 0 })
    onDone()
  }

  return (
    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">Proveedor</label>
          <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="">Seleccionar...</option>
            {configs.map((c: any) => <option key={c.id} value={c.supplier_id}>{c.supplier_id?.slice(0, 8)}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="IVA">IVA</option>
            <option value="IRP">IRP</option>
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Período Fiscal</label>
          <input value={form.periodo_fiscal} onChange={(e) => setForm({ ...form, periodo_fiscal: e.target.value })} placeholder="YYYY-MM" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Base Imponible</label>
          <input type="number" value={form.base_imponible} onChange={(e) => setForm({ ...form, base_imponible: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generar Retención</button>
        <button onClick={onDone} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════════ CIERRE CONTABLE ═══════════════════════

function CierreContableTab() {
  const [periods, setPeriods] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [trialBalance, setTrialBalance] = useState<any>(null)
  const [pnl, setPnl] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [cashRecon, setCashRecon] = useState<any>(null)
  const [pnlRecon, setPnlRecon] = useState<any>(null)
  const [showIntegracion, setShowIntegracion] = useState(false)

  const load = async () => {
    setLoading(true)
    const [ps, accts, cr] = await Promise.all([
      api.integratedFinance.listAccountingPeriods(COMPANY_ID).catch(() => []),
      api.integratedFinance.listAccountPlan(COMPANY_ID).catch(() => []),
      api.integratedFinance.getCashReconciliation(COMPANY_ID).catch(() => null),
    ])
    setPeriods(ps)
    setAccounts(accts)
    setCashRecon(cr)
    if (ps.length > 0 && !selectedPeriod) setSelectedPeriod(ps[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadPeriodData = () => {
    if (!selectedPeriod) return
    api.integratedFinance.listAccountingEntries(COMPANY_ID, selectedPeriod).then(setEntries).catch(() => setEntries([]))
    api.integratedFinance.getTrialBalance(COMPANY_ID, selectedPeriod).then(setTrialBalance).catch(() => setTrialBalance(null))
    api.integratedFinance.getPnl(COMPANY_ID, selectedPeriod).then(setPnl).catch(() => setPnl(null))
    api.integratedFinance.getPnlReconciliation(COMPANY_ID, selectedPeriod).then(setPnlRecon).catch(() => setPnlRecon(null))
  }

  useEffect(loadPeriodData, [selectedPeriod])

  const [reopenError, setReopenError] = useState("")

  const closePeriod = async (id: string) => {
    await api.integratedFinance.closeAccountingPeriod(id)
    load()
  }

  const reopenPeriod = async (id: string) => {
    const motivo = window.prompt("Motivo de la reapertura (obligatorio):")
    if (!motivo) return
    setReopenError("")
    try {
      await api.integratedFinance.reopenAccountingPeriod(id, motivo)
      load()
    } catch (e: any) {
      setReopenError(e.message || "No se pudo reabrir (se requiere rol Gerente)")
    }
  }

  const reverseEntry = async (asientoNumero: string) => {
    const motivo = window.prompt(`Motivo del reverso de ${asientoNumero}:`)
    if (!motivo) return
    try {
      await api.integratedFinance.reverseAccountingEntry(COMPANY_ID, asientoNumero, motivo)
      loadPeriodData()
    } catch (e: any) {
      alert(e.message || "No se pudo reversar el asiento")
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const currentPeriod = periods.find((p: any) => p.id === selectedPeriod)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            {periods.map((p: any) => (
              <option key={p.id} value={p.id}>{p.anio}-{String(p.mes).padStart(2, "0")} — {p.estado}</option>
            ))}
          </select>
          <button onClick={() => setShowNewPeriod(!showNewPeriod)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />Nuevo Período
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowIntegracion(!showIntegracion)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
            <ArrowUpDown className="w-4 h-4" />Integración
          </button>
          {currentPeriod?.estado === "abierto" && (
            <button onClick={() => setShowNewEntry(!showNewEntry)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4" />Nuevo Asiento
            </button>
          )}
          {currentPeriod?.estado === "abierto" && (
            <button onClick={() => closePeriod(currentPeriod.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600">
              <ClipboardCheck className="w-4 h-4" />Cerrar Período
            </button>
          )}
          {currentPeriod?.estado === "cerrado" && (
            <button onClick={() => reopenPeriod(currentPeriod.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
              <RefreshCcw className="w-4 h-4" />Reabrir Período
            </button>
          )}
        </div>
      </div>

      {reopenError && <p className="text-red-600 text-sm">{reopenError}</p>}

      {currentPeriod?.motivo_reapertura && (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg p-3 text-xs">
          Este período fue reabierto el {new Date(currentPeriod.fecha_reapertura).toLocaleString("es-PY")} — motivo: {currentPeriod.motivo_reapertura}
        </div>
      )}

      {showIntegracion && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Caja del Mayor vs. Bancos Reales</h3>
            {cashRecon ? (
              <>
                <div className="space-y-1.5 text-sm mt-3">
                  <div className="flex justify-between"><span className="text-gray-500">Saldo "Caja y Bancos" (mayor)</span><span className="font-semibold">{formatPYG(cashRecon.saldo_ledger_caja_y_bancos)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Saldo real en cuentas (PYG)</span><span className="font-semibold">{formatPYG(cashRecon.saldo_real_bancos_pyg)}</span></div>
                  <div className={`flex justify-between font-bold border-t pt-1.5 ${Math.abs(cashRecon.diferencia) > 1 ? "text-red-600" : "text-green-600"}`}>
                    <span>Diferencia</span><span>{formatPYG(cashRecon.diferencia)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">{cashRecon.nota}</p>
              </>
            ) : <p className="text-gray-400 text-sm">Sin datos</p>}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Estado de Resultados: Mayor vs. Gerencial</h3>
            {pnlRecon && !pnlRecon.error ? (
              <>
                <div className="space-y-1.5 text-sm mt-3">
                  <div className="flex justify-between"><span className="text-gray-500">Ingresos (mayor vs gerencial)</span><span className="font-semibold">{formatPYG(pnlRecon.ledger?.total_ingresos)} / {formatPYG(pnlRecon.gerencial?.total_ingresos)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Costos (mayor vs gerencial)</span><span className="font-semibold">{formatPYG(pnlRecon.ledger?.total_costos)} / {formatPYG(pnlRecon.gerencial?.total_costos)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Gastos (mayor vs gerencial)</span><span className="font-semibold">{formatPYG(pnlRecon.ledger?.total_gastos)} / {formatPYG(pnlRecon.gerencial?.total_gastos)}</span></div>
                  <div className={`flex justify-between font-bold border-t pt-1.5 ${Math.abs(pnlRecon.diferencia_resultado_neto) > 1 ? "text-red-600" : "text-green-600"}`}>
                    <span>Diferencia resultado neto</span><span>{formatPYG(pnlRecon.diferencia_resultado_neto)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">{pnlRecon.nota}</p>
              </>
            ) : <p className="text-gray-400 text-sm">Sin datos para este período</p>}
          </div>
        </div>
      )}

      {showNewPeriod && <NewPeriodForm onDone={() => { setShowNewPeriod(false); load() }} />}

      {showNewEntry && currentPeriod && (
        <NewManualEntryForm
          accounts={accounts.filter((a: any) => a.acepta_asientos)}
          defaultFecha={new Date().toISOString().slice(0, 10)}
          onDone={() => { setShowNewEntry(false); loadPeriodData() }}
          onCancel={() => setShowNewEntry(false)}
        />
      )}

      {currentPeriod && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Balance de Comprobación</h3>
              {trialBalance && (
                <button onClick={() => downloadPdf(`/v1/integrated-finance/accounting/trial-balance/${selectedPeriod}/pdf`)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <Download className="w-3.5 h-3.5" />PDF
                </button>
              )}
            </div>
            {trialBalance ? (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 border-b"><th className="text-left py-2">Cuenta</th><th className="text-right py-2">Debe</th><th className="text-right py-2">Haber</th><th className="text-right py-2">Saldo</th></tr></thead>
                  <tbody>
                    {trialBalance.items?.map((i: any) => (
                      <tr key={i.account_id} className="border-b border-gray-50">
                        <td className="py-1.5"><span className="font-mono">{i.codigo}</span> {i.nombre}</td>
                        <td className="py-1.5 text-right">{formatPYG(i.debe)}</td>
                        <td className="py-1.5 text-right">{formatPYG(i.haber)}</td>
                        <td className={`py-1.5 text-right font-medium ${i.saldo < 0 ? "text-red-600" : ""}`}>{formatPYG(i.saldo)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold border-t">
                      <td className="py-2">TOTALES</td>
                      <td className="py-2 text-right">{formatPYG(trialBalance.total_debe)}</td>
                      <td className="py-2 text-right">{formatPYG(trialBalance.total_haber)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-sm">Sin datos</p>}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Estado de Resultados (PyG)</h3>
              {pnl && (
                <button onClick={() => downloadPdf(`/v1/integrated-finance/accounting/pnl/${selectedPeriod}/pdf`)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <Download className="w-3.5 h-3.5" />PDF
                </button>
              )}
            </div>
            {pnl ? (
              <div className="space-y-3 text-sm">
                <div><p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Ingresos</p>
                  {pnl.ingresos?.map((i: any) => (
                    <div key={i.account_id} className="flex justify-between py-0.5"><span>{i.codigo} {i.nombre}</span><span className="text-green-600">{formatPYG(i.monto)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Total Ingresos</span><span className="text-green-600">{formatPYG(pnl.total_ingresos)}</span></div>
                </div>
                <div><p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Costos</p>
                  {pnl.costos?.map((c: any) => (
                    <div key={c.account_id} className="flex justify-between py-0.5"><span>{c.codigo} {c.nombre}</span><span className="text-red-600">{formatPYG(c.monto)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Total Costos</span><span className="text-red-600">{formatPYG(pnl.total_costos)}</span></div>
                </div>
                <div><p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Gastos</p>
                  {pnl.gastos?.map((g: any) => (
                    <div key={g.account_id} className="flex justify-between py-0.5"><span>{g.codigo} {g.nombre}</span><span className="text-red-600">{formatPYG(g.monto)}</span></div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Total Gastos</span><span className="text-red-600">{formatPYG(pnl.total_gastos)}</span></div>
                </div>
                <div className={`flex justify-between font-bold text-base border-t-2 pt-2 ${pnl.resultado_neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <span>Resultado Neto</span><span>{formatPYG(pnl.resultado_neto)}</span>
                </div>
              </div>
            ) : <p className="text-gray-400 text-sm">Sin datos</p>}
          </div>
        </div>
      )}

      {currentPeriod && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Asientos del Período</h3>
          <p className="text-xs text-gray-400 mb-3">"Reversado" solo se detecta si el reverso cayó dentro de este mismo período — un reverso de un asiento de otro período no se marca acá.</p>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 border-b sticky top-0 bg-white dark:bg-gray-800">
                <th className="text-left py-2 px-2">Asiento</th>
                <th className="text-left py-2 px-2">Fecha</th>
                <th className="text-left py-2 px-2">Cuenta</th>
                <th className="text-left py-2 px-2">Concepto</th>
                <th className="text-right py-2 px-2">Debe</th>
                <th className="text-right py-2 px-2">Haber</th>
                <th className="text-left py-2 px-2">Origen</th>
                <th className="text-center py-2 px-2">Acción</th>
              </tr></thead>
              <tbody>
                {entries.map((e: any) => {
                  const acc = accounts.find((a: any) => a.id === e.account_id)
                  const esReversa = !!e.reversa_de_asiento
                  const yaReversado = entries.some((other: any) => other.reversa_de_asiento === e.asiento_numero)
                  return (
                    <tr key={e.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-1.5 px-2 font-mono">{e.asiento_numero}</td>
                      <td className="py-1.5 px-2">{e.fecha}</td>
                      <td className="py-1.5 px-2"><span className="font-mono">{acc?.codigo}</span> {acc?.nombre || e.account_id?.slice(0, 8)}</td>
                      <td className="py-1.5 px-2">{e.concepto || "—"}</td>
                      <td className="py-1.5 px-2 text-right">{e.tipo === "debe" ? formatPYG(e.monto) : ""}</td>
                      <td className="py-1.5 px-2 text-right">{e.tipo === "haber" ? formatPYG(e.monto) : ""}</td>
                      <td className="py-1.5 px-2">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${esReversa ? "bg-red-50 text-red-600" : e.asiento_numero?.startsWith("M") ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                            {esReversa ? `reverso de ${e.reversa_de_asiento}` : e.asiento_numero?.startsWith("M") ? "manual" : "automático"}
                          </span>
                          {yaReversado && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium w-fit bg-amber-50 text-amber-600">reversado</span>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {!esReversa && !yaReversado && (
                          <button onClick={() => reverseEntry(e.asiento_numero)} className="text-red-500 hover:text-red-700 text-[10px] font-medium">Reversar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {entries.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin asientos en este período</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function NewManualEntryForm({ accounts, defaultFecha, onDone, onCancel }: { accounts: any[]; defaultFecha: string; onDone: () => void; onCancel: () => void }) {
  const [fecha, setFecha] = useState(defaultFecha)
  const [concepto, setConcepto] = useState("")
  const [lines, setLines] = useState([
    { account_id: "", tipo: "debe", monto: "" },
    { account_id: "", tipo: "haber", monto: "" },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const totalDebe = lines.filter(l => l.tipo === "debe").reduce((a, l) => a + (Number(l.monto) || 0), 0)
  const totalHaber = lines.filter(l => l.tipo === "haber").reduce((a, l) => a + (Number(l.monto) || 0), 0)
  const balanced = totalDebe === totalHaber && totalDebe > 0

  const updateLine = (i: number, field: string, value: string) => {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }
  const addLine = () => setLines(ls => [...ls, { account_id: "", tipo: "debe", monto: "" }])
  const removeLine = (i: number) => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls)

  const submit = async () => {
    setError("")
    if (!concepto.trim()) { setError("Ingresá un concepto para el asiento"); return }
    if (lines.some(l => !l.account_id || !l.monto)) { setError("Completá cuenta y monto en todas las líneas"); return }
    setSubmitting(true)
    try {
      await api.integratedFinance.createManualEntry(COMPANY_ID, {
        fecha, concepto,
        lines: lines.map(l => ({ account_id: l.account_id, tipo: l.tipo, monto: Number(l.monto) })),
      })
      onDone()
    } catch (e: any) {
      setError(e.message || "No se pudo registrar el asiento")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Nuevo Asiento Manual</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div><label className="block text-xs text-gray-500 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">Concepto del asiento</label>
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Pago de alquiler agosto" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_110px_150px_36px] gap-2 items-center">
            <select value={line.account_id} onChange={(e) => updateLine(i, "account_id", e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
              <option value="">Cuenta...</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
            </select>
            <select value={line.tipo} onChange={(e) => updateLine(i, "tipo", e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
              <option value="debe">Debe</option>
              <option value="haber">Haber</option>
            </select>
            <input type="number" placeholder="Monto" value={line.monto} onChange={(e) => updateLine(i, "monto", e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <button onClick={() => removeLine(i)} disabled={lines.length <= 2}
              className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm">✕</button>
          </div>
        ))}
      </div>

      <button onClick={addLine} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Agregar línea</button>

      <div className="flex items-center gap-4 mt-4 text-sm">
        <span>Debe: <span className="font-semibold">{formatPYG(totalDebe)}</span></span>
        <span>Haber: <span className="font-semibold">{formatPYG(totalHaber)}</span></span>
        <span className={`font-semibold ${balanced ? "text-green-600" : "text-red-600"}`}>
          {balanced ? "✓ Balanceado" : "Desbalanceado"}
        </span>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={submit} disabled={submitting || !balanced}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
          {submitting && <Spinner />}Registrar Asiento
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
      </div>
    </div>
  )
}

function NewPeriodForm({ onDone }: { onDone: () => void }) {
  const now = new Date()
  const [form, setForm] = useState({ anio: now.getFullYear(), mes: now.getMonth() + 1 })
  const submit = async () => {
    await api.integratedFinance.openAccountingPeriod({ ...form, company_id: COMPANY_ID })
    onDone()
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div><label className="block text-xs text-gray-500 mb-1">Año</label>
          <input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Mes</label>
          <input type="number" min={1} max={12} value={form.mes} onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Abrir Período</button>
        <button onClick={onDone} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════════ COBRANZAS ═══════════════════════

function CobranzasTab() {
  const [actions, setActions] = useState<any[]>([])
  const [dash, setDash] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const [acts, d] = await Promise.all([
      api.integratedFinance.listCollectionActions(COMPANY_ID).catch(() => []),
      api.integratedFinance.getCollectionDashboard(COMPANY_ID).catch(() => null),
    ])
    setActions(acts)
    setDash(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={HandCoins} label="Total Acciones" value={dash?.total_acciones ?? 0} color="blue" />
        <KpiCard icon={CalendarDays} label="Últimos 30d" value={dash?.acciones_30d ?? 0} color="indigo" />
        <KpiCard icon={CheckCircle} label="Promesas Activas" value={dash?.promesas_pago_activas ?? 0} color="green" />
        <KpiCard icon={Banknote} label="Monto Comprometido" value={formatPYG(dash?.monto_comprometido || 0)} color="yellow" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Acciones de Cobranza</h3>
          <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />Nueva Acción
          </button>
        </div>

        {showNew && <NewCollectionForm onDone={() => { setShowNew(false); load() }} />}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500">
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Resultado</th>
              <th className="text-left px-4 py-3 font-medium">Contacto</th>
              <th className="text-left px-4 py-3 font-medium">Próx. Contacto</th>
              <th className="text-right px-4 py-3 font-medium">Compromiso</th>
            </tr></thead>
            <tbody>
              {actions.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">{a.fecha}</td>
                  <td className="px-4 py-3">{a.customer_id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">{a.tipo}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs ${a.resultado === "exitoso" ? "text-green-600" : a.resultado === "pendiente" ? "text-yellow-600" : "text-gray-500"}`}>{a.resultado || "—"}</span></td>
                  <td className="px-4 py-3">{a.contacto || "—"}</td>
                  <td className="px-4 py-3">{a.proximo_contacto || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{a.monto_comprometido ? formatPYG(a.monto_comprometido) : "—"}</td>
                </tr>
              ))}
              {actions.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin acciones de cobranza</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function NewCollectionForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ customer_id: "", tipo: "llamada", resultado: "pendiente", notas: "", contacto: "" })
  const submit = async () => {
    await api.integratedFinance.createCollectionAction({ ...form, company_id: COMPANY_ID })
    onDone()
  }
  return (
    <div className="p-4 border-b bg-gray-50 dark:bg-gray-800/50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">Cliente</label>
          <input value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} placeholder="ID del cliente" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="llamada">Llamada</option>
            <option value="email">Email</option>
            <option value="visita">Visita</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="notificacion">Notificación</option>
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Resultado</label>
          <select value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="pendiente">Pendiente</option>
            <option value="exitoso">Exitoso</option>
            <option value="sin_respuesta">Sin Respuesta</option>
            <option value="promesa_pago">Promesa de Pago</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">Notas</label>
          <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Registrar</button>
        <button onClick={onDone} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════════ CONCILIACIÓN ═══════════════════════

function ConciliacionTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [bankAccountId, setBankAccountId] = useState("")

  const run = async () => {
    if (!bankAccountId) return
    setLoading(true)
    try {
      const res = await api.integratedFinance.autoReconcile(COMPANY_ID, bankAccountId)
      setResult(res)
    } catch { setResult({ conciliadas: 0, monto_conciliado: 0, no_conciliadas: 0, monto_no_conciliado: 0, detalle: [] }) }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">Conciliación Bancaria Automática</h3>
        <div className="flex items-end gap-3 max-w-lg">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Cuenta Bancaria (ID)</label>
            <input value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} placeholder="ID de cuenta bancaria" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <button onClick={run} disabled={loading || !bankAccountId}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Spinner /> : <RefreshCcw className="w-4 h-4" />}
            Conciliar
          </button>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={CheckCircle} label="Conciliadas" value={result.conciliadas} color="green" />
              <KpiCard icon={XCircle} label="No Conciliadas" value={result.no_conciliadas} color="red" />
              <KpiCard icon={Banknote} label="Monto Conciliado" value={formatPYG(result.monto_conciliado)} color="green" />
              <KpiCard icon={Banknote} label="Monto No Conciliado" value={formatPYG(result.monto_no_conciliado)} color="red" />
            </div>

            {result.detalle?.length > 0 && (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 border-b">
                    <th className="text-left px-4 py-2 font-medium">Transacción</th>
                    <th className="text-right px-4 py-2 font-medium">Monto</th>
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium">Match</th>
                  </tr></thead>
                  <tbody>
                    {result.detalle.map((d: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{d.referencia || d.transaction_id?.slice(0, 8)}</td>
                        <td className="px-4 py-2 text-right">{formatPYG(d.monto)}</td>
                        <td className="px-4 py-2">{d.tipo}</td>
                        <td className="px-4 py-2">
                          {d.tipo === "no_conciliado"
                            ? <span className="text-red-500 text-xs">Sin match</span>
                            : <span className="text-green-600 text-xs">Match: {d.matched_with?.slice(0, 8)}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════ ACTIVOS FIJOS ═══════════════════════
//
// Depreciación en línea recta, posteada como asiento contable real (débito
// Depreciaciones / crédito Depreciación Acumulada) — mismo motor de asientos
// manuales que ya usa Cierre Contable. El posteo mensual corre solo via
// scheduler; el botón acá es para forzarlo manualmente si hace falta.

function ActivosFijosTab() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [posting, setPosting] = useState(false)
  const [form, setForm] = useState({ nombre: "", categoria: "", fecha_adquisicion: "", valor_adquisicion: "", valor_residual: "0", vida_util_meses: "60" })

  const load = () => {
    setLoading(true)
    api.fixedAssets.list().then(setAssets).catch(() => setAssets([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    try {
      await api.fixedAssets.create({
        nombre: form.nombre, categoria: form.categoria || undefined,
        fecha_adquisicion: form.fecha_adquisicion,
        valor_adquisicion: Number(form.valor_adquisicion),
        valor_residual: Number(form.valor_residual || 0),
        vida_util_meses: Number(form.vida_util_meses),
      })
      setShowNew(false)
      setForm({ nombre: "", categoria: "", fecha_adquisicion: "", valor_adquisicion: "", valor_residual: "0", vida_util_meses: "60" })
      load()
    } catch (e: any) { alert(e.message || "Error al crear el activo") }
  }

  const retire = async (id: string) => {
    const motivo = window.prompt("Motivo de la baja:")
    if (!motivo) return
    try { await api.fixedAssets.retire(id, motivo); load() }
    catch (e: any) { alert(e.message || "Error al dar de baja") }
  }

  const postDepreciation = async () => {
    setPosting(true)
    try {
      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const result = await api.fixedAssets.postDepreciation(periodo)
      alert(`Período ${result.periodo}: ${result.posteados} activos posteados, ${result.omitidos} omitidos (ya depreciados o vida útil completa)`)
      load()
    } catch (e: any) { alert(e.message || "Error al postear depreciación") }
    finally { setPosting(false) }
  }

  const activos = assets.filter(a => a.estado === "activo")
  const valorLibrosTotal = activos.reduce((s, a) => s + a.valor_libros, 0)
  const depreciacionAcumTotal = activos.reduce((s, a) => s + a.depreciacion_acumulada, 0)

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Activos Registrados" value={activos.length} color="blue" />
        <KpiCard icon={DollarSign} label="Valor en Libros" value={formatPYG(valorLibrosTotal)} color="green" />
        <KpiCard icon={TrendingUp} label="Depreciación Acumulada" value={formatPYG(depreciacionAcumTotal)} color="purple" />
      </div>

      <div className="flex justify-between items-center">
        <button onClick={postDepreciation} disabled={posting} className="px-3 py-2 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 flex items-center gap-1.5 disabled:opacity-50">
          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Postear depreciación del mes
        </button>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo activo
        </button>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Nuevo activo fijo</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            <input className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" placeholder="Categoría (opcional)" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <input type="date" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" value={form.fecha_adquisicion} onChange={e => setForm({ ...form, fecha_adquisicion: e.target.value })} />
            <input type="number" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" placeholder="Valor de adquisición (Gs.)" value={form.valor_adquisicion} onChange={e => setForm({ ...form, valor_adquisicion: e.target.value })} />
            <input type="number" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" placeholder="Valor residual (Gs., opcional)" value={form.valor_residual} onChange={e => setForm({ ...form, valor_residual: e.target.value })} />
            <input type="number" className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent" placeholder="Vida útil (meses)" value={form.vida_util_meses} onChange={e => setForm({ ...form, vida_util_meses: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500">
              <th className="text-left px-4 py-3 font-medium">Activo</th>
              <th className="text-left px-4 py-3 font-medium">Adquisición</th>
              <th className="text-right px-4 py-3 font-medium">Valor Original</th>
              <th className="text-right px-4 py-3 font-medium">Deprec. Acumulada</th>
              <th className="text-right px-4 py-3 font-medium">Valor en Libros</th>
              <th className="text-center px-4 py-3 font-medium">Vida Útil</th>
              <th className="text-center px-4 py-3 font-medium">Estado</th>
              <th className="text-center px-4 py-3 font-medium">Acción</th>
            </tr></thead>
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="px-4 py-3">{a.nombre}{a.categoria && <span className="text-xs text-gray-400 block">{a.categoria}</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.fecha_adquisicion}</td>
                  <td className="px-4 py-3 text-right">{formatPYG(a.valor_adquisicion)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatPYG(a.depreciacion_acumulada)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatPYG(a.valor_libros)}</td>
                  <td className="px-4 py-3 text-center text-xs">{a.meses_depreciados}/{a.vida_util_meses} m</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${a.estado === "activo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.estado === "activo" ? "Activo" : "Dado de baja"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.estado === "activo" && (
                      <button onClick={() => retire(a.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto"><Ban className="w-3 h-3" /> Dar de baja</button>
                    )}
                  </td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin activos fijos registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
