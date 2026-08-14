import { useState, useEffect } from "react"
import { 
  Wallet, TrendingUp, DollarSign, CheckCircle2, XCircle, AlertTriangle, 
  CreditCard, Search, Plus, Eye, RefreshCw, Truck, Store, ShieldCheck, 
  History, Calendar, FileText, ArrowUpRight, ArrowDownRight, User, Building2,
  Clock, Lock, Check, Calculator, ChevronRight, X
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

const DENOMINATIONS = [
  { val: 100000, label: "₲ 100.000 (Billetes)" },
  { val: 50000, label: "₲ 50.000 (Billetes)" },
  { val: 20000, label: "₲ 20.000 (Billetes)" },
  { val: 10000, label: "₲ 10.000 (Billetes)" },
  { val: 5000, label: "₲ 5.000 (Billetes)" },
  { val: 2000, label: "₲ 2.000 (Billetes)" },
  { val: 1000, label: "₲ 1.000 (Monedas)" },
  { val: 500, label: "₲ 500 (Monedas)" },
  { val: 100, label: "₲ 100 (Monedas)" },
  { val: 50, label: "₲ 50 (Monedas)" },
]

export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<"salon" | "cobradores" | "tesoreria" | "historial">("cobradores")
  const [summary, setSummary] = useState<any>(null)
  const [settlements, setSettlements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // Modals state
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCountModal, setShowCountModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [targetSettlement, setTargetSettlement] = useState<any | null>(null)

  // Arqueo / Count state
  const [billCounts, setBillCounts] = useState<Record<number, number>>({})
  const [countPagares, setCountPagares] = useState<string>("0")
  const [countDescuentos, setCountDescuentos] = useState<string>("0")
  const [countOtroEgreso, setCountOtroEgreso] = useState<string>("0")
  const [countAnticipo, setCountAnticipo] = useState<string>("0")
  const [countObs, setCountObs] = useState<string>("")
  const [countUser, setCountUser] = useState<string>("Cajero Central")

  // Open session state
  const [newType, setNewType] = useState<"salon" | "cobrador">("cobrador")
  const [newCobrador, setNewCobrador] = useState<string>("")
  const [newFuncionario, setNewFuncionario] = useState<string>("1001")
  const [newARendir, setNewARendir] = useState<string>("0")
  const [newObs, setNewObs] = useState<string>("")

  // Treasury Auth state
  const [authTesorero, setAuthTesorero] = useState<string>("Joel - Tesorería")
  const [authObs, setAuthObs] = useState<string>("")

  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const [sumRes, settRes] = await Promise.allSettled([
        api.routeCashSettlements.summary(),
        api.routeCashSettlements.list({ limit: 100 }),
      ])
      if (sumRes.status === "fulfilled") setSummary(sumRes.value)
      if (settRes.status === "fulfilled") setSettlements(settRes.value || [])
    } catch {
      toast.error("Error", "No se pudo cargar la información de cajas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Calculate calculated cash from denominations
  const totalCashCounted = Object.entries(billCounts).reduce((acc, [denom, qty]) => {
    return acc + (Number(denom) * (Number(qty) || 0))
  }, 0)

  const totalOtherValuesCounted = 
    (Number(countPagares) || 0) + 
    (Number(countAnticipo) || 0)

  const totalDeductionsCounted = 
    (Number(countDescuentos) || 0) + 
    (Number(countOtroEgreso) || 0)

  const grandTotalDeclared = totalCashCounted + totalOtherValuesCounted + totalDeductionsCounted
  const currentARendir = targetSettlement ? Number(targetSettlement.a_rendir || 0) : 0
  const currentDifference = grandTotalDeclared - currentARendir

  const handleOpenCountModal = (settlement: any) => {
    setTargetSettlement(settlement)
    setBillCounts({})
    setCountPagares(String(settlement.pagares || 0))
    setCountDescuentos(String(settlement.descuentos || 0))
    setCountOtroEgreso(String(settlement.otro_egreso || 0))
    setCountAnticipo(String(settlement.anticipo || 0))
    setCountObs("")
    setShowCountModal(true)
  }

  const handleSubmitCount = async () => {
    if (!targetSettlement) return
    try {
      await api.routeCashSettlements.close(targetSettlement.id, {
        efectivo: totalCashCounted,
        pagares: Number(countPagares) || 0,
        descuentos: Number(countDescuentos) || 0,
        otro_egreso: Number(countOtroEgreso) || 0,
        anticipo: Number(countAnticipo) || 0,
        observaciones: countObs || `Arqueo físico declarado: Efectivo ₲ ${formatPYG(totalCashCounted)}`,
        usuario: countUser,
      })
      toast.success("Arqueo Registrado", "La sesión ha sido liquidada con éxito.")
      setShowCountModal(false)
      loadData()
    } catch {
      toast.error("Error", "No se pudo registrar el arqueo")
    }
  }

  const handleOpenAuthModal = (settlement: any) => {
    setTargetSettlement(settlement)
    setAuthTesorero("Joel - Tesorería Central")
    setAuthObs("Valores físicos recibidos y auditados en Bóveda Central")
    setShowAuthModal(true)
  }

  const handleSubmitAuth = async () => {
    if (!targetSettlement) return
    try {
      await api.routeCashSettlements.authorize(targetSettlement.id, {
        usuario_tesorero: authTesorero,
        observaciones: authObs,
      })
      toast.success("Liquidación Autorizada", "Los valores ingresaron formalmente a Bóveda Central.")
      setShowAuthModal(false)
      loadData()
    } catch {
      toast.error("Error", "No se pudo autorizar la liquidación")
    }
  }

  const handleOpenSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.routeCashSettlements.open({
        cobrador_codigo: newType === "salon" ? "0" : (newCobrador || "1001"),
        funcionario_codigo: newFuncionario || "1001",
        a_rendir: Number(newARendir) || 0,
        observaciones: newObs || (newType === "salon" ? "Caja de Salón de Ventas" : "Ruta de Cobranza Móvil"),
      })
      toast.success("Caja Habilitada", "Nueva sesión de caja/ruta abierta correctamente.")
      setShowOpenModal(false)
      loadData()
    } catch {
      toast.error("Error", "No se pudo abrir la caja")
    }
  }

  const handleInspectSettlement = async (settlementId: string) => {
    setLoadingDetail(true)
    try {
      const detail = await api.routeCashSettlements.getDetail(settlementId)
      setSelectedSettlement(detail)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la sesión")
    } finally {
      setLoadingDetail(false)
    }
  }

  // Filtered lists per tab
  const filteredSettlements = settlements.filter(s => {
    const term = search.toLowerCase()
    const matchSearch = !search || 
      (s.observaciones || "").toLowerCase().includes(term) ||
      (s.cobrador_nombre || "").toLowerCase().includes(term) ||
      (s.funcionario_nombre || "").toLowerCase().includes(term) ||
      (s.codigo_legacy || "").toLowerCase().includes(term) ||
      (s.cobrador_codigo || "").toLowerCase().includes(term)
    
    if (!matchSearch) return false

    if (activeTab === "salon") {
      return s.cobrador_codigo === "0" || (s.observaciones || "").toLowerCase().includes("maxi") || (s.observaciones || "").toLowerCase().includes("salon") || (s.observaciones || "").toLowerCase().includes("caja")
    }
    if (activeTab === "cobradores") {
      return s.cobrador_codigo !== "0" && !s.cerrado
    }
    if (activeTab === "tesoreria") {
      return s.cerrado && !s.usuario_cierre
    }
    return true // historial
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary text-[10px] font-black uppercase tracking-widest">
              Tesorería & Cajas Operativas
            </span>
            <span className="text-xs text-gray-400 font-mono">262.871 Sesiones Reales Legacy</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            Arqueo de Caja & Liquidación de Cobradores
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Control integral de aperturas, arqueos ciegos, rendición de cobradores en ruta y auditoría de Tesorería Central
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-ghost p-2" title="Recargar datos">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setShowOpenModal(true)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus className="w-4 h-4" />
            <span>Apertura de Caja / Ruta</span>
          </button>
        </div>
      </div>

      {/* Top Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3.5 border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Activas Hoy</span>
            <Store className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black font-mono text-blue-900 dark:text-blue-200 mt-1">
            {summary ? (summary.activas_hoy || 0).toLocaleString() : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Cajas & Rutas abiertas</span>
        </div>

        <div className="card p-3.5 border-l-4 border-l-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Carga Teórica</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-base font-black font-mono text-indigo-900 dark:text-indigo-200 mt-1">
            {summary ? formatPYG(summary.total_a_rendir) : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Monto a rendir</span>
        </div>

        <div className="card p-3.5 border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Total Liquidado</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {summary ? formatPYG(summary.total_liquidado) : "—"}
          </p>
          <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold">Valores entregados</span>
        </div>

        <div className="card p-3.5 border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Efectivo Físico</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {summary ? formatPYG(summary.efectivo) : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Billetaje en caja</span>
        </div>

        <div className="card p-3.5 border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Pagarés & Cheques</span>
            <CreditCard className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base font-black font-mono text-purple-900 dark:text-purple-200 mt-1">
            {summary ? formatPYG(summary.pagares) : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Documentos crédito</span>
        </div>

        <div className="card p-3.5 border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Pend. Auditoría</span>
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            {summary ? (summary.pendientes_autorizacion || 0).toLocaleString() : "—"}
          </p>
          <span className="text-[10px] text-rose-600/80 mt-0.5 block font-bold">Por validar Tesorería</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "cobradores", label: "🚚 Liquidación de Cobradores & Rutas", count: settlements.filter(s => s.cobrador_codigo !== "0" && !s.cerrado).length },
            { id: "salon", label: "🖥️ Cajas de Salón y Terminales POS", count: settlements.filter(s => s.cobrador_codigo === "0").length },
            { id: "tesoreria", label: "🏛️ Auditoría & Tesorería Central", count: settlements.filter(s => s.cerrado && !s.usuario_cierre).length },
            { id: "historial", label: "📜 Historial de Rendiciones (262k)", count: settlements.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9 text-xs font-medium w-full"
            placeholder="Buscar por caja, cobrador, chofer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Código / Sesión</th>
                <th className="table-cell">Caja / Terminal / Ruta</th>
                <th className="table-cell">Cobrador / Responsable</th>
                <th className="table-cell">Fecha</th>
                <th className="table-cell text-right">A Rendir (Carga)</th>
                <th className="table-cell text-right">Total Liquidado</th>
                <th className="table-cell text-right">Efectivo Físico</th>
                <th className="table-cell text-right">Diferencia</th>
                <th className="table-cell text-center">Estado</th>
                <th className="table-cell text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">Cargando sesiones de caja...</td></tr>
              ) : filteredSettlements.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">No se encontraron liquidaciones para esta vista</td></tr>
              ) : (
                filteredSettlements.map((s) => {
                  const dif = Number(s.diferencia || 0)
                  const isClosed = s.cerrado
                  const isAuthorized = Boolean(s.usuario_cierre)

                  return (
                    <tr key={s.id} className="table-row hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="table-td font-mono font-bold text-primary">
                        {s.codigo_legacy || `CJ-${s.id.slice(0, 5)}`}
                      </td>
                      <td className="table-td font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {s.cobrador_codigo === "0" ? (
                            <Store className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          )}
                          <span>{s.observaciones || (s.cobrador_codigo === "0" ? "Caja Salón" : `Ruta Cobrador #${s.cobrador_codigo}`)}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {s.cobrador_nombre}
                        </div>
                        {s.cobrador_rama && (
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Rama: {s.cobrador_rama}</span>
                        )}
                      </td>
                      <td className="table-td font-mono text-gray-500">
                        {formatDate(s.fecha)}
                      </td>
                      <td className="table-td text-right font-mono text-gray-600 dark:text-gray-300">
                        {formatPYG(s.a_rendir)}
                      </td>
                      <td className="table-td text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(s.total)}
                      </td>
                      <td className="table-td text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        {formatPYG(s.efectivo)}
                      </td>
                      <td className={`table-td text-right font-mono font-bold ${
                        dif === 0 ? "text-gray-400" : dif > 0 ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {dif > 0 ? `+${formatPYG(dif)}` : dif < 0 ? formatPYG(dif) : "Exacto"}
                      </td>
                      <td className="table-td text-center">
                        {isAuthorized ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300/40">
                            Autorizada Tesorería
                          </span>
                        ) : isClosed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/40">
                            Liquidada (Auditoría Pend.)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300/40">
                            Caja Abierta
                          </span>
                        )}
                      </td>
                      <td className="table-td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleInspectSettlement(s.id)}
                            className="btn-ghost p-1.5 text-primary hover:bg-primary/10 rounded"
                            title="Ver expediente 360°"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {!isClosed && (
                            <button
                              onClick={() => handleOpenCountModal(s)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                              title="Realizar Arqueo y Cierre"
                            >
                              <Calculator className="w-3 h-3" />
                              <span>Arqueo</span>
                            </button>
                          )}

                          {isClosed && !isAuthorized && (
                            <button
                              onClick={() => handleOpenAuthModal(s)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                              title="Auditar y Autorizar Tesorería"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Aprobar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Arqueo Físico & Declaración de Valores */}
      {showCountModal && targetSettlement && (
        <div className="modal-overlay" onClick={() => setShowCountModal(false)}>
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-900 via-slate-900 to-amber-950 text-white rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                    Arqueo de Caja & Liquidación Física
                  </span>
                  <h3 className="text-xl font-bold font-mono text-white mt-1">
                    Sesión {targetSettlement.codigo_legacy || "Legacy"} — {targetSettlement.observaciones || "Ruta"}
                  </h3>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Responsable: <strong>{targetSettlement.cobrador_nombre}</strong> · Teórico a Rendir: <strong>{formatPYG(targetSettlement.a_rendir)}</strong>
                  </p>
                </div>
                <button onClick={() => setShowCountModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* Denominations Counter */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5 mb-3">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  Billetaje & Conteo Físico de Moneda (PYG)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  {DENOMINATIONS.map(d => (
                    <div key={d.val} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-gray-800">
                      <span className="font-bold text-gray-700 dark:text-gray-300 text-[11px]">{d.label}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="input-field text-right font-mono font-bold w-16 text-xs p-1"
                        value={billCounts[d.val] || ""}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0)
                          setBillCounts(prev => ({ ...prev, [d.val]: val }))
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/40 mt-2">
                  <span className="font-black text-amber-900 dark:text-amber-300">TOTAL EFECTIVO CONTADO:</span>
                  <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">{formatPYG(totalCashCounted)}</span>
                </div>
              </div>

              {/* Other Values & Deductions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    Documentos de Crédito & Anticipos
                  </h4>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Pagarés / Cheques en Mano (₲)</label>
                    <input
                      type="number"
                      className="input-field font-mono text-xs w-full"
                      value={countPagares}
                      onChange={(e) => setCountPagares(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Anticipos Recibidos (₲)</label>
                    <input
                      type="number"
                      className="input-field font-mono text-xs w-full"
                      value={countAnticipo}
                      onChange={(e) => setCountAnticipo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                    Gastos en Ruta & Descuentos
                  </h4>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Gastos Ruta (Combustible/Viáticos) (₲)</label>
                    <input
                      type="number"
                      className="input-field font-mono text-xs w-full"
                      value={countOtroEgreso}
                      onChange={(e) => setCountOtroEgreso(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Descuentos Financieros Aplicados (₲)</label>
                    <input
                      type="number"
                      className="input-field font-mono text-xs w-full"
                      value={countDescuentos}
                      onChange={(e) => setCountDescuentos(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Summary of Balance Difference */}
              <div className={`p-4 rounded-xl border ${
                currentDifference === 0 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 text-emerald-900 dark:text-emerald-300"
                  : currentDifference > 0
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 text-blue-900 dark:text-blue-300"
                  : "bg-red-50 dark:bg-red-950/20 border-red-300 text-red-900 dark:text-red-300"
              }`}>
                <div className="grid grid-cols-3 gap-4 text-center font-mono">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">A Rendir (Teórico)</span>
                    <span className="font-black text-sm">{formatPYG(currentARendir)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Declarado</span>
                    <span className="font-black text-sm">{formatPYG(grandTotalDeclared)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Diferencia de Caja</span>
                    <span className="font-black text-base">
                      {currentDifference > 0 ? `+${formatPYG(currentDifference)} (Sobrante)` : currentDifference < 0 ? `${formatPYG(currentDifference)} (Faltante)` : "₲ 0 (Exacto)"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Observaciones / Justificación de Cierre</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  placeholder="Observación del cajero sobre la rendición..."
                  value={countObs}
                  onChange={(e) => setCountObs(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowCountModal(false)} className="btn-ghost">Cancelar</button>
                <button onClick={handleSubmitCount} className="btn-primary flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Confirmar & Sellar Arqueo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Auditoría & Autorización de Tesorería */}
      {showAuthModal && targetSettlement && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-900 to-emerald-950 text-white rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                    Tesorería Central & Bóveda
                  </span>
                  <h3 className="text-xl font-bold font-mono text-white mt-1">
                    Aprobar Liquidación {targetSettlement.codigo_legacy}
                  </h3>
                </div>
                <button onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cobrador / Responsable:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{targetSettlement.cobrador_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Efectivo a Ingresar a Bóveda:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatPYG(targetSettlement.efectivo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pagarés / Cheques en Cartera:</span>
                  <span className="font-mono font-bold text-purple-600">{formatPYG(targetSettlement.pagares)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold">
                  <span>Total Liquidación:</span>
                  <span className="font-mono text-primary">{formatPYG(targetSettlement.total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Nombre / Firma del Tesorero Auditor</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  value={authTesorero}
                  onChange={(e) => setAuthTesorero(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Observaciones de Auditoría</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  value={authObs}
                  onChange={(e) => setAuthObs(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowAuthModal(false)} className="btn-ghost">Cancelar</button>
                <button onClick={handleSubmitAuth} className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sellar Aprobación Tesorería</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Expediente 360° de Sesión de Caja */}
      {selectedSettlement && (
        <div className="modal-overlay" onClick={() => setSelectedSettlement(null)}>
          <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-900 via-slate-900 to-indigo-950 text-white rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/30">
                    Expediente 360° de Sesión de Caja & Rendición
                  </span>
                  <h3 className="text-2xl font-black font-mono text-white mt-1">
                    Sesión {selectedSettlement.codigo_legacy || "Legacy"} — {selectedSettlement.observaciones}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300 mt-1.5">
                    <span>Responsable: <strong>{selectedSettlement.cobrador_nombre}</strong></span>
                    <span>·</span>
                    <span>Fecha: <strong>{formatDate(selectedSettlement.fecha)}</strong></span>
                    {selectedSettlement.usuario_cierre && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">Auditor: <strong>{selectedSettlement.usuario_cierre}</strong></span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedSettlement(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* 4 Financial Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-3 bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-500">
                  <span className="text-[10px] text-gray-400 uppercase font-black">A Rendir (Carga)</span>
                  <p className="text-base font-black font-mono text-blue-900 dark:text-blue-200 mt-0.5">{formatPYG(selectedSettlement.a_rendir)}</p>
                </div>
                <div className="card p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500">
                  <span className="text-[10px] text-gray-400 uppercase font-black">Total Liquidado</span>
                  <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPYG(selectedSettlement.total)}</p>
                </div>
                <div className="card p-3 bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-500">
                  <span className="text-[10px] text-gray-400 uppercase font-black">Efectivo Físico</span>
                  <p className="text-base font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">{formatPYG(selectedSettlement.efectivo)}</p>
                </div>
                <div className="card p-3 bg-purple-50/50 dark:bg-purple-950/20 border-l-4 border-l-purple-500">
                  <span className="text-[10px] text-gray-400 uppercase font-black">Pagarés / Crédito</span>
                  <p className="text-base font-black font-mono text-purple-900 dark:text-purple-200 mt-0.5">{formatPYG(selectedSettlement.pagares)}</p>
                </div>
              </div>

              {/* Movements List from route_cash_settlement_movements */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-primary" />
                    Movimientos & Cobranzas Registradas ({selectedSettlement.movimientos?.length || 0})
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">1.5M movimientos migrados</span>
                </div>

                {selectedSettlement.movimientos && selectedSettlement.movimientos.length > 0 ? (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800">
                        <tr className="table-header">
                          <th className="table-cell">Fecha</th>
                          <th className="table-cell">Recibo / Ref.</th>
                          <th className="table-cell">Concepto / Observaciones</th>
                          <th className="table-cell text-right">Monto (₲)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {selectedSettlement.movimientos.map((m: any) => (
                          <tr key={m.id} className="table-row">
                            <td className="table-td font-mono text-gray-500">{formatDate(m.fecha)}</td>
                            <td className="table-td font-mono font-bold text-primary">{m.recibo || "S/Recibo"}</td>
                            <td className="table-td text-gray-800 dark:text-gray-200">{m.observaciones || "Movimiento de recaudación"}</td>
                            <td className={`table-td text-right font-mono font-bold ${m.monto >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {formatPYG(m.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-400">Sin movimientos individuales discriminados</p>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setSelectedSettlement(null)} className="btn-ghost">Cerrar Expediente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Nueva Apertura de Caja */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <h3 className="text-xl font-bold text-white">Nueva Apertura de Caja / Ruta</h3>
              <p className="text-xs text-gray-400 mt-1">Habilita una sesión para salón o un móvil de reparto</p>
            </div>

            <form onSubmit={handleOpenSessionSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Tipo de Caja</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType("cobrador")}
                    className={`p-2.5 rounded-lg font-bold text-center border transition-all ${
                      newType === "cobrador"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-gray-200 dark:border-gray-700 text-gray-500"
                    }`}
                  >
                    🚚 Ruta / Cobrador
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType("salon")}
                    className={`p-2.5 rounded-lg font-bold text-center border transition-all ${
                      newType === "salon"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-gray-200 dark:border-gray-700 text-gray-500"
                    }`}
                  >
                    🖥️ Salón / POS
                  </button>
                </div>
              </div>

              {newType === "cobrador" && (
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1">Código de Cobrador / Chofer</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 4964, 4059, 7876"
                    className="input-field text-xs w-full"
                    value={newCobrador}
                    onChange={(e) => setNewCobrador(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">
                  {newType === "salon" ? "Fondo Fijo Inicial (₲)" : "Carga Teórica a Rendir en Facturas (₲)"}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="input-field font-mono text-xs w-full"
                  value={newARendir}
                  onChange={(e) => setNewARendir(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Denominación / Nombre de Caja</label>
                <input
                  type="text"
                  placeholder={newType === "salon" ? "Ej: maxi 1, Salón Ventas" : "Ej: Reparto Móvil 19"}
                  className="input-field text-xs w-full"
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowOpenModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Abrir Sesión</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
