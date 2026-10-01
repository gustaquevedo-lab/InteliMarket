import React, { useState, useEffect, useMemo } from "react"
import {
  XCircle, PiggyBank, Search, CheckSquare, Square, FileCheck,
  Receipt, ArrowUpRight, ArrowDownLeft, RefreshCw, UserCircle2,
  Layers, ExternalLink, Calendar, Building2, AlertTriangle,
  CheckCircle2, Clock, FileText, Loader2, Sparkles, Filter
} from "lucide-react"
import { api, API_ORIGIN, type PettyCashFund, type Expense, type PettyCashFundMovement } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface Props {
  fund: PettyCashFund | null
  isOpen: boolean
  onClose: () => void
  onRendir: (fundId: string, selectedExpenseIds: string[]) => void
}

export const FundDetailModal: React.FC<Props> = ({
  fund,
  isOpen,
  onClose,
  onRendir,
}) => {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<"gastos" | "movimientos">("gastos")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [movements, setMovements] = useState<PettyCashFundMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [filterRendicion, setFilterRendicion] = useState<"pendientes" | "rendidos" | "todos">("pendientes")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Cargar datos cuando se abre el modal para el fondo seleccionado
  const fetchData = async () => {
    if (!fund || !isOpen) return
    setLoading(true)
    try {
      const [expRes, movRes] = await Promise.all([
        api.expenses.list({ fund_id: fund.id, limit: 300 }),
        api.expenses.funds.movements(fund.id, 100),
      ])
      const activeExpenses = (expRes || []).filter(e => !e.anulado && e.estado !== "rechazado")
      setExpenses(activeExpenses)
      setMovements(movRes || [])
      // Por defecto seleccionar todos los pendientes si no había selección previa
      const pendingIds = activeExpenses.filter(e => !e.rendicion_id).map(e => e.id)
      setSelectedIds(pendingIds)
    } catch (err: any) {
      toast.error("Error al cargar detalle del fondo", err.message || "No se pudieron obtener los comprobantes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && fund) {
      fetchData()
      setSearch("")
      setFilterRendicion("pendientes")
      setActiveTab("gastos")
    } else {
      setExpenses([])
      setMovements([])
      setSelectedIds([])
    }
  }, [isOpen, fund?.id])

  if (!isOpen || !fund) return null

  // Métricas del Fondo
  const montoAutorizado = Number(fund.monto_autorizado || 0)
  const saldoActual = Number(fund.saldo_actual || 0)
  const pctUsado = montoAutorizado > 0 ? ((montoAutorizado - saldoActual) / montoAutorizado) * 100 : 0
  const isCritico = montoAutorizado > 0 && saldoActual / montoAutorizado < 0.2

  // Filtrado de Gastos
  const filteredExpenses = expenses.filter(e => {
    // Filtro por estado de rendición
    if (filterRendicion === "pendientes" && e.rendicion_id) return false
    if (filterRendicion === "rendidos" && !e.rendicion_id) return false

    // Búsqueda por texto
    if (search.trim()) {
      const term = search.toLowerCase().trim()
      const matchDesc = (e.descripcion || "").toLowerCase().includes(term)
      const matchProv = (e.proveedor || "").toLowerCase().includes(term)
      const matchFactura = (e.numero_factura || "").toLowerCase().includes(term)
      const matchRuc = (e.ruc || "").toLowerCase().includes(term)
      const matchTimbrado = (e.timbrado || "").toLowerCase().includes(term)
      const matchRendNro = (e.rendicion_numero || "").toLowerCase().includes(term)
      if (!matchDesc && !matchProv && !matchFactura && !matchRuc && !matchTimbrado && !matchRendNro) {
        return false
      }
    }

    return true
  })

  // Comprobantes pendientes visibles (que pueden ser seleccionados)
  const visibleSelectableExpenses = filteredExpenses.filter(e => !e.rendicion_id)
  const allSelectableChecked =
    visibleSelectableExpenses.length > 0 &&
    visibleSelectableExpenses.every(e => selectedIds.includes(e.id))

  const toggleSelectAllVisible = () => {
    if (allSelectableChecked) {
      // Deseleccionar los visibles
      const visibleIds = new Set(visibleSelectableExpenses.map(e => e.id))
      setSelectedIds(selectedIds.filter(id => !visibleIds.has(id)))
    } else {
      // Agregar los visibles a la selección
      const newIds = new Set([...selectedIds, ...visibleSelectableExpenses.map(e => e.id)])
      setSelectedIds(Array.from(newIds))
    }
  }

  const toggleExpense = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  // Suma acumulada de comprobantes seleccionados
  const selectedExpenses = expenses.filter(e => selectedIds.includes(e.id))
  const totalMontoSeleccionado = selectedExpenses.reduce((acc, e) => acc + Number(e.monto || 0), 0)

  const handleRendirClick = () => {
    if (selectedIds.length === 0) {
      toast.warning("Sin selección", "Seleccione al menos un comprobante pendiente para rendir.")
      return
    }
    onRendir(fund.id, selectedIds)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-auto max-h-[94vh] flex flex-col">
        
        {/* CABECERA: INFORMACIÓN DEL FONDO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <PiggyBank className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {fund.nombre}
                </h3>
                {!fund.activo && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Inactivo
                  </span>
                )}
                {fund.cost_center_nombre && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    <Layers className="w-3 h-3" /> {fund.cost_center_nombre}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <UserCircle2 className="w-3.5 h-3.5 text-slate-400" />
                Custodio Responsable: <span className="font-semibold text-slate-700 dark:text-slate-200">{fund.custodio_nombre || "No asignado"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TARJETAS KPI DE SALDO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0 text-xs">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Límite Autorizado</span>
            <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">
              {formatPYG(montoAutorizado)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Saldo en Gaveta</span>
            <span className={`text-sm font-black font-mono ${isCritico ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
              {formatPYG(saldoActual)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Pendiente de Rendición</span>
            <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
              {formatPYG(expenses.filter(e => !e.rendicion_id).reduce((acc, e) => acc + Number(e.monto || 0), 0))}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Disponibilidad</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isCritico ? "bg-red-500" : "bg-indigo-600"}`}
                  style={{ width: `${Math.min(100 - pctUsado, 100)}%` }}
                />
              </div>
              <span className="font-mono font-bold text-[11px] text-slate-600 dark:text-slate-300">
                {Math.max(0, 100 - pctUsado).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS INTERNAS */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("gastos")}
              className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "gastos"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Comprobantes y Gastos
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {expenses.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("movimientos")}
              className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "movimientos"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <FileText className="w-4 h-4" />
              Libro Mayor de Movimientos
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {movements.length}
              </span>
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: GASTOS O MOVIMIENTOS */}
        <div className="flex-1 overflow-y-auto min-h-[300px] flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center my-auto py-12 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Cargando comprobantes del fondo fijo...</p>
            </div>
          ) : activeTab === "gastos" ? (
            <div className="space-y-3 flex-1 flex flex-col">
              {/* FILTROS Y BÚSQUEDA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setFilterRendicion("pendientes")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterRendicion === "pendientes"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Pendientes de Rendir ({expenses.filter(e => !e.rendicion_id).length})
                  </button>
                  <button
                    onClick={() => setFilterRendicion("rendidos")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterRendicion === "rendidos"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Ya Rendidos ({expenses.filter(e => !!e.rendicion_id).length})
                  </button>
                  <button
                    onClick={() => setFilterRendicion("todos")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterRendicion === "todos"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Todos ({expenses.length})
                  </button>
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar proveedor, factura, RUC..."
                    className="input-field pl-8 pr-3 py-1.5 text-xs w-full"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* TABLA DE COMPROBANTES */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col bg-white dark:bg-slate-900 shadow-sm">
                <div className="overflow-x-auto flex-1 max-h-[46vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          {visibleSelectableExpenses.length > 0 && (
                            <button
                              type="button"
                              onClick={toggleSelectAllVisible}
                              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                              title={allSelectableChecked ? "Deseleccionar todos" : "Seleccionar todos los pendientes visibles"}
                            >
                              {allSelectableChecked ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Comprobante</th>
                        <th className="py-2.5 px-3">Proveedor / RUC</th>
                        <th className="py-2.5 px-3">Concepto</th>
                        <th className="py-2.5 px-3">Sector</th>
                        <th className="py-2.5 px-3">Estado Rendición</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                        <th className="py-2.5 px-3 text-center w-10">Doc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredExpenses.map(e => {
                        const isRendido = !!e.rendicion_id
                        const isSelected = selectedIds.includes(e.id)
                        return (
                          <tr
                            key={e.id}
                            className={`transition-colors ${
                              isRendido
                                ? "bg-slate-50/50 dark:bg-slate-800/30 text-slate-500"
                                : isSelected
                                ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              {isRendido ? (
                                <span
                                  className="inline-block p-1 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                  title={`Comprobante ya rendido en expediente ${e.rendicion_numero || ""}`}
                                >
                                  <CheckSquare className="w-4 h-4 opacity-40" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleExpense(e.id)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                              {e.fecha_gasto
                                ? new Date(e.fecha_gasto).toLocaleDateString("es-PY", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    timeZone: "UTC",
                                  })
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {e.numero_factura || "Sin N°"}
                              </span>
                              {e.tipo_comprobante && (
                                <span className="block text-[10px] text-slate-400">
                                  {e.tipo_comprobante.replace("_", " ")}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                                {e.proveedor || "Sin Proveedor"}
                              </div>
                              {e.ruc && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  RUC: {e.ruc}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="line-clamp-2 text-slate-700 dark:text-slate-300">
                                {e.descripcion}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {e.es_inversion && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                    Inversión / Activo
                                  </span>
                                )}
                                {e.es_anticipo_sueldo && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                    Anticipo: {e.employee_nombre || "Nómina"}
                                  </span>
                                )}
                                {e.es_pago_proveedor && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    Pago Proveedor
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                              {e.cost_center_nombre || "—"}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isRendido ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {e.rendicion_numero || "Rendido"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <Clock className="w-3 h-3" />
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatPYG(e.monto)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {e.comprobante_url ? (
                                <a
                                  href={
                                    e.comprobante_url.startsWith("http")
                                      ? e.comprobante_url
                                      : `${API_ORIGIN}${e.comprobante_url}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex p-1 rounded-md text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                                  title="Ver comprobante adjunto"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filteredExpenses.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                            <p className="font-semibold">No se encontraron comprobantes con los filtros seleccionados.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: LIBRO MAYOR DE MOVIMIENTOS */
            <div className="space-y-2 flex-1 max-h-[50vh] overflow-y-auto pr-1">
              {movements.map((m: any) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs transition-colors hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-2 rounded-xl mt-0.5 ${
                        m.monto < 0
                          ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                      }`}
                    >
                      {m.monto < 0 ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {m.descripcion || m.tipo}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {m.created_at ? new Date(m.created_at).toLocaleString("es-PY") : "—"} ·{" "}
                        <span className="uppercase font-semibold text-[10px] text-slate-500">
                          {m.tipo}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span
                      className={`font-black text-sm ${
                        m.monto < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {m.monto < 0 ? "-" : "+"}
                      {formatPYG(Math.abs(m.monto))}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Saldo posterior: <span className="font-semibold">{formatPYG(m.saldo_nuevo || m.saldo_posterior)}</span>
                    </p>
                  </div>
                </div>
              ))}
              {movements.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                  <p className="font-semibold">Sin movimientos registrados en este fondo.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BARRA INFERIOR STICKY: ACCIONES Y RENDICIÓN */}
        {activeTab === "gastos" && (
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {selectedIds.length === 0 ? (
                    "Ningún comprobante seleccionado"
                  ) : (
                    <span>
                      <strong className="text-indigo-600 dark:text-indigo-400">{selectedIds.length}</strong> comprobante(s) seleccionado(s)
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-500">
                  Total a Rendir:{" "}
                  <strong className="text-slate-900 dark:text-white font-mono font-bold text-xs">
                    {formatPYG(totalMontoSeleccionado)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-4 py-2 flex-1 sm:flex-initial"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleRendirClick}
                disabled={selectedIds.length === 0}
                className="btn-primary text-xs px-5 py-2 flex items-center justify-center gap-2 font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
              >
                <FileCheck className="w-4 h-4" />
                Rendir Seleccionados ({formatPYG(totalMontoSeleccionado)})
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
