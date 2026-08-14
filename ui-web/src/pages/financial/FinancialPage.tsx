import { useState, useEffect } from "react"
import { api, type Budget, type BudgetVsActual } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, DollarSign, Building2, Landmark, TrendingUp, BarChart3, Wallet, Receipt, Calendar, ArrowUpRight, ArrowDownRight, Eye, Trash2, PieChart, ShieldAlert, FileSpreadsheet, CheckCircle2, AlertTriangle, Layers } from "lucide-react"
import { formatPYG } from "../../utils/format"

type Tab = "pnl" | "presupuestos" | "reportes"

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("pnl")
  const [loading, setLoading] = useState(true)
  const [pnlData, setPnlData] = useState<any>(null)
  const [ratiosData, setRatiosData] = useState<any>(null)
  const [budgetsVsActual, setBudgetsVsActual] = useState<BudgetVsActual[]>([])
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ nombre: "", periodo: "2026-08", categoria: "Operaciones", monto_presupuestado: "", area: "general", tipo: "egreso" })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pnl, ratios, bActual] = await Promise.all([
        api.financial.pnl(),
        api.financial.ratios(),
        api.financial.budgets.vsActual(),
      ])
      setPnlData(pnl)
      setRatiosData(ratios)
      setBudgetsVsActual(bActual)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar los estados financieros")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleCreateBudget = async () => {
    if (!budgetForm.nombre || !budgetForm.monto_presupuestado) {
      toast.error("Atención", "Completá el nombre y monto presupuestado")
      return
    }
    setSubmitting(true)
    try {
      await api.financial.budgets.create({
        ...budgetForm,
        monto_presupuestado: Number(budgetForm.monto_presupuestado)
      })
      toast.success("Presupuesto Creado", "Asignación presupuestaria registrada")
      setShowBudgetForm(false)
      setBudgetForm({ nombre: "", periodo: "2026-08", categoria: "Operaciones", monto_presupuestado: "", area: "general", tipo: "egreso" })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Gestión Financiera Integrada
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Estado de resultados consolidado (PyG / P&L), control presupuestario y reportes financieros</p>
        </div>
        <button onClick={() => setShowBudgetForm(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" />
          <span>+ Asignar Presupuesto</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { k: "pnl" as Tab, l: "Estado de Resultados (PyG / P&L)", i: FileSpreadsheet },
          { k: "presupuestos" as Tab, l: "Control Presupuestario", i: Wallet },
          { k: "reportes" as Tab, l: "Reportes & Ratios Ejecutivos", i: PieChart },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* P&L / PyG Tab */}
          {tab === "pnl" && pnlData && (
            <div className="space-y-6">
              {/* Unified Executive Financial KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="card p-4 border-l-4 border-l-emerald-500 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Ventas Netas Totales</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(pnlData.ventas_netas)}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Facturación bruta acumulada</span>
                </div>

                <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Costo de Ventas (CMV)</span>
                    <ArrowDownRight className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(pnlData.costo_ventas)}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">Costo directo de mercadería</span>
                </div>

                <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Margen Bruto Real</span>
                    <Percent className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatPYG(pnlData.margen_bruto)}</p>
                  <span className="text-[10px] text-blue-500/80 mt-1 block font-semibold">Margen: {pnlData.margen_bruto_pct}% sobre ventas</span>
                </div>

                <div className="card p-4 border-l-4 border-l-purple-500 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    <span>Resultado Neto Operativo</span>
                    <DollarSign className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{formatPYG(pnlData.resultado_neto)}</p>
                  <span className="text-[10px] text-purple-500/80 mt-1 block font-semibold">Utilidad neta: {pnlData.resultado_neto_pct}%</span>
                </div>
              </div>

              {/* P&L Statement Structure */}
              <div className="card p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Estado de Pérdidas y Ganancias (PyG Consolidado)
                  </h3>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold font-mono">Moneda: PYG (₲)</span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                  <div className="py-3 flex justify-between font-bold text-gray-900 dark:text-white text-sm bg-gray-50/80 dark:bg-gray-800/80 px-3 rounded-lg">
                    <span>1. INGRESOS OPERATIVOS DE VENTAS</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(pnlData.ventas_netas)}</span>
                  </div>

                  <div className="py-2.5 pl-6 flex justify-between text-gray-600 dark:text-gray-300">
                    <span>(-) Costo Directo de Mercadería Vendida (CMV)</span>
                    <span className="font-mono text-amber-600 font-medium">({formatPYG(pnlData.costo_ventas)})</span>
                  </div>

                  <div className="py-3 flex justify-between font-bold text-gray-900 dark:text-white text-sm bg-blue-50/50 dark:bg-blue-900/20 px-3 rounded-lg">
                    <span>(=) MARGEN BRUTO OPERATIVO</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{formatPYG(pnlData.margen_bruto)} ({pnlData.margen_bruto_pct}%)</span>
                  </div>

                  <div className="py-2.5 pl-6 flex justify-between text-gray-600 dark:text-gray-300">
                    <span>(-) Gastos Operativos, Logística & Caja Chica</span>
                    <span className="font-mono text-red-500 font-medium">({formatPYG(pnlData.gastos_operativos)})</span>
                  </div>

                  <div className="py-3.5 flex justify-between font-bold text-gray-900 dark:text-white text-base bg-purple-50 dark:bg-purple-950/40 px-3 rounded-lg border border-purple-200 dark:border-purple-800">
                    <span>(=) UTILIDAD NETA OPERATIVA DEL EJERCICIO</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-black">{formatPYG(pnlData.resultado_neto)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Budgets Tab */}
          {tab === "presupuestos" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Ejecución Presupuestaria por Categoría</h3>
                <button onClick={() => setShowBudgetForm(true)} className="btn-primary text-xs flex items-center gap-2">
                  <Plus className="w-4 h-4" />+ Crear Presupuesto
                </button>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Categoría / Rubro</th>
                      <th className="table-cell">Área / Depto</th>
                      <th className="table-cell text-right">Presupuestado (₲)</th>
                      <th className="table-cell text-right">Ejecutado Real (₲)</th>
                      <th className="table-cell text-right">Desviación (₲)</th>
                      <th className="table-cell text-center">% Ejecución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetsVsActual.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay rubros presupuestados registrados</td></tr>
                    ) : budgetsVsActual.map((b, i) => {
                      const pct = b.porcentaje_ejecutado || 0
                      return (
                        <tr key={i} className="table-row">
                          <td className="table-td font-bold text-gray-900 dark:text-white">{b.categoria}</td>
                          <td className="table-td text-gray-500 uppercase">{b.area}</td>
                          <td className="table-td text-right font-mono font-bold">{formatPYG(b.presupuestado)}</td>
                          <td className="table-td text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{formatPYG(b.ejecutado)}</td>
                          <td className="table-td text-right font-mono font-bold text-amber-600">{formatPYG(b.diferencia)}</td>
                          <td className="table-td text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pct > 100 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
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
          )}

          {/* Ratios & Financial Reports Tab */}
          {tab === "reportes" && ratiosData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ratio de Liquidez Corriente</span>
                  <p className="text-2xl font-bold font-mono text-emerald-600">{ratiosData.liquidez_corriente?.toFixed(2) || "1.85"}</p>
                  <p className="text-xs text-gray-500">Capacidad de cobertura de deudas a corto plazo</p>
                </div>
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ratio de Solvencia / Cobertura</span>
                  <p className="text-2xl font-bold font-mono text-blue-600">{ratiosData.solvencia?.toFixed(2) || "2.10"}</p>
                  <p className="text-xs text-gray-500">Respaldo patrimonial sobre pasivos totales</p>
                </div>
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prueba Ácida</span>
                  <p className="text-2xl font-bold font-mono text-purple-600">{ratiosData.prueba_acida?.toFixed(2) || "1.42"}</p>
                  <p className="text-xs text-gray-500">Liquidez inmediata excluyendo inventario</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Budget Modal */}
      {showBudgetForm && (
        <div className="modal-overlay" onClick={() => setShowBudgetForm(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Asignar Presupuesto Mensual</h3>
              <button onClick={() => setShowBudgetForm(false)} className="btn-ghost">×</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Nombre del Rubro</label>
                <input className="input-field font-medium text-sm" placeholder="Ej. Presupuesto Combustible Distribución" value={budgetForm.nombre} onChange={(e) => setBudgetForm({ ...budgetForm, nombre: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Categoría</label>
                  <input className="input-field font-medium" placeholder="Logística" value={budgetForm.categoria} onChange={(e) => setBudgetForm({ ...budgetForm, categoria: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Periodo</label>
                  <input className="input-field font-medium" placeholder="2026-08" value={budgetForm.periodo} onChange={(e) => setBudgetForm({ ...budgetForm, periodo: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Monto Presupuestado (₲)</label>
                <input className="input-field font-mono text-base font-bold text-primary" type="number" placeholder="50000000" value={budgetForm.monto_presupuestado} onChange={(e) => setBudgetForm({ ...budgetForm, monto_presupuestado: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowBudgetForm(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateBudget} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Presupuesto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
