import React, { useState, useEffect } from "react"
import {
  XCircle, CheckCircle2, AlertCircle, Loader2, Receipt,
  PiggyBank, CheckSquare, Square, Calculator, ArrowRight, FileCheck
} from "lucide-react"
import { api, type PettyCashFund, type Expense } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  funds: PettyCashFund[]
  initialFundId?: string
}

export const RendicionCreateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  funds,
  initialFundId,
}) => {
  const toast = useToast()
  const [fundId, setFundId] = useState(initialFundId || (funds[0]?.id || ""))
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [availableExpenses, setAvailableExpenses] = useState<Expense[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [efectivoContado, setEfectivoContado] = useState<string>("")
  const [observaciones, setObservaciones] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Cargar comprobantes pendientes cuando cambia el fondo
  useEffect(() => {
    if (!fundId || !isOpen) return
    const fetchPending = async () => {
      setLoadingExpenses(true)
      try {
        const res = await api.expenses.list({
          fund_id: fundId,
          sin_rendicion: true,
          limit: 200,
        })
        const valid = res.filter(e => !e.anulado && e.estado !== "rechazado")
        setAvailableExpenses(valid)
        // Por defecto preseleccionar todos
        setSelectedIds(valid.map(e => e.id))
      } catch (err: any) {
        toast.error("Error al cargar comprobantes", err.message)
      } finally {
        setLoadingExpenses(false)
      }
    }
    fetchPending()
  }, [fundId, isOpen])

  if (!isOpen) return null

  const currentFund = funds.find(f => f.id === fundId)
  const montoAutorizado = currentFund ? currentFund.monto_autorizado : 0

  const selectedExpenses = availableExpenses.filter(e => selectedIds.includes(e.id))
  const totalComprobantes = selectedExpenses.reduce((acc, e) => acc + Number(e.monto || 0), 0)
  const efectivoNum = Number(efectivoContado || 0)
  const totalJustificado = totalComprobantes + efectivoNum
  const diferencia = totalJustificado - montoAutorizado

  const toggleSelectAll = () => {
    if (selectedIds.length === availableExpenses.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(availableExpenses.map(e => e.id))
    }
  }

  const toggleExpense = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundId) {
      toast.error("Fondo Requerido", "Seleccione un fondo fijo")
      return
    }
    if (selectedIds.length === 0) {
      toast.error("Sin Comprobantes", "Debe seleccionar al menos un comprobante para rendir cuentas")
      return
    }
    if (!efectivoContado && efectivoContado !== "0") {
      toast.error("Arqueo Requerido", "Ingrese el efectivo físico remanente en gaveta (puede ser 0)")
      return
    }

    setSubmitting(true)
    try {
      const res = await api.expenses.rendiciones.create({
        fund_id: fundId,
        expense_ids: selectedIds,
        efectivo_remanente_contado: efectivoNum,
        observaciones: observaciones || undefined,
      })
      toast.success(
        "Rendición Presentada",
        `Expediente ${res.numero_rendicion} generado con éxito por ${formatPYG(res.total_presentado)}.`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Error al presentar rendición", err.message || "Verifique los datos ingresados")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 my-8 max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nueva Rendición de Cuentas y Solicitud de Reposición
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Agrupe los comprobantes de compras menores y declare el efectivo físico en gaveta.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 text-xs flex-1">
          {/* Selector de Fondo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Fondo Fijo a Rendir *
              </label>
              <select
                className="input-field w-full text-xs font-semibold"
                value={fundId}
                onChange={e => setFundId(e.target.value)}
              >
                {funds.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.nombre} — Límite: {formatPYG(f.monto_autorizado)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Custodio Responsable
              </label>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                {currentFund?.custodio_nombre || "Sin custodio asignado"}
              </div>
            </div>
          </div>

          {/* Conciliación en Vivo de Arqueo */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 to-slate-50 dark:from-slate-800/80 dark:to-slate-900 border border-indigo-100 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-600" /> Conciliación y Arqueo Físico del Fondo
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Fondo Autorizado: <b>{formatPYG(montoAutorizado)}</b>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-semibold">1. TOTAL COMPROBANTES</span>
                <span className="text-sm font-extrabold text-blue-600 font-mono">
                  {formatPYG(totalComprobantes)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">{selectedIds.length} facturas/recibos</span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] text-slate-400 block font-bold mb-1">
                  2. EFECTIVO FÍSICO EN GAVETA *
                </label>
                <CurrencyInput
                  required
                  currency="PYG"
                  placeholder="Ingrese monto contado"
                  className="input-field w-full text-xs font-mono font-extrabold text-emerald-600 text-right"
                  value={efectivoContado}
                  onChangeValue={(num, formatted) => setEfectivoContado(String(num))}
                />
              </div>

              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-semibold">3. CUADRE / DIFERENCIA</span>
                <span className={`text-sm font-extrabold font-mono ${
                  diferencia === 0 ? "text-emerald-600" : diferencia > 0 ? "text-amber-500" : "text-rose-600"
                }`}>
                  {diferencia === 0 ? "₲ 0 (Cuadre Exacto)" : formatPYG(diferencia)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {diferencia === 0 ? "Sin diferencias" : diferencia > 0 ? "Sobrante en caja" : "Faltante en caja"}
                </span>
              </div>
            </div>
          </div>

          {/* Listado de Comprobantes Disponibles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Comprobantes sin rendir ({availableExpenses.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {selectedIds.length === availableExpenses.length ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selectedIds.length === availableExpenses.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>

            {loadingExpenses ? (
              <div className="py-8 flex justify-center items-center text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Cargando comprobantes pendientes...
              </div>
            ) : availableExpenses.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                No hay comprobantes pendientes de rendición para este fondo.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/40">
                {availableExpenses.map(exp => {
                  const isSelected = selectedIds.includes(exp.id)
                  return (
                    <div
                      key={exp.id}
                      onClick={() => toggleExpense(exp.id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-all text-xs ${
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                          : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1 rounded ${isSelected ? "text-indigo-600" : "text-slate-400"}`}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{exp.descripcion}</span>
                            {exp.es_inversion && (
                              <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                Activo Fijo
                              </span>
                            )}
                            {exp.es_anticipo_sueldo && (
                              <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                Anticipo Sueldo
                              </span>
                            )}
                            {exp.numero_factura && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Fac: {exp.numero_factura}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {exp.fecha_gasto} • Prov: {exp.proveedor || "Sin prov"} • Sector: {exp.cost_center_nombre || "General"}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatPYG(exp.monto)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Observaciones / Notas del Custodio
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre compras urgentes, justificativos de gastos o diferencias de arqueo..."
              className="input-field w-full text-xs"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="text-[11px] text-slate-500">
              Monto a Reponer Solicitado: <b className="text-slate-900 dark:text-white font-mono">{formatPYG(totalComprobantes)}</b>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || selectedIds.length === 0}
                className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {submitting ? "Presentando..." : "Presentar a Tesorería"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
