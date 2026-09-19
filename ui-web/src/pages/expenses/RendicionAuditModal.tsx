import React, { useState, useEffect } from "react"
import {
  XCircle, CheckCircle2, AlertTriangle, Loader2, Receipt,
  Building2, Landmark, Check, Ban, Download, FileText,
  DollarSign, ArrowRight, Eye, ShieldAlert, FileCheck, Tag, Sparkles, Unlink
} from "lucide-react"
import { api, type PettyCashRendicion, type Expense, type PettyCashFund, type BankAccount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface Props {
  rendicionId: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bankAccounts: BankAccount[]
  cashRegisters: any[]
}

export const RendicionAuditModal: React.FC<Props> = ({
  rendicionId,
  isOpen,
  onClose,
  onSuccess,
  bankAccounts,
  cashRegisters,
}) => {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [rendicion, setRendicion] = useState<PettyCashRendicion | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fund, setFund] = useState<PettyCashFund | null>(null)

  // Estados locales de auditoría por ítem: { [expenseId]: { estado: 'aprobado' | 'rechazado', motivo?: string } }
  const [auditItems, setAuditItems] = useState<Record<string, { estado: string; motivo?: string }>>({})
  const [rejectPromptId, setRejectPromptId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState("")

  // Reposición
  const [showReplenishSection, setShowReplenishSection] = useState(false)
  const [medioReposicion, setMedioReposicion] = useState<string>("EFECTIVO_BOVEDA")
  const [cajaBovedaId, setCajaBovedaId] = useState<string>("")
  const [bankAccountId, setBankAccountId] = useState<string>("")
  const [comprobantePagoRef, setComprobantePagoRef] = useState("")
  const [observacionesTesoreria, setObservacionesTesoreria] = useState("")
  const [submittingAudit, setSubmittingAudit] = useState(false)
  const [submittingReplenish, setSubmittingReplenish] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Cargar datos de la rendición
  const fetchDetail = async () => {
    if (!rendicionId) return
    setLoading(true)
    try {
      const data = await api.expenses.rendiciones.get(rendicionId)
      setRendicion(data.rendicion)
      setExpenses(data.expenses)
      setFund(data.fund)

      // Inicializar mapa de auditoría con los estados actuales
      const initialMap: Record<string, { estado: string; motivo?: string }> = {}
      data.expenses.forEach(e => {
        initialMap[e.id] = {
          estado: e.auditoria_estado === "rechazado" ? "rechazado" : "aprobado",
          motivo: e.auditoria_motivo || undefined,
        }
      })
      setAuditItems(initialMap)

      // Si ya hay cajas registradoras, seleccionar la primera activa
      if (cashRegisters.length > 0 && !cajaBovedaId) {
        const boveda = cashRegisters.find(c => c.activo) || cashRegisters[0]
        if (boveda) setCajaBovedaId(boveda.id)
      }
      if (bankAccounts.length > 0 && !bankAccountId) {
        const b = bankAccounts.find(x => x.activo) || bankAccounts[0]
        if (b) setBankAccountId(b.id)
      }
    } catch (err: any) {
      toast.error("Error al cargar rendición", err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && rendicionId) {
      fetchDetail()
    }
  }, [isOpen, rendicionId])

  if (!isOpen || !rendicionId) return null

  // Totales dinámicos según selección de auditoría
  const aprobadosCount = Object.values(auditItems).filter(a => a.estado === "aprobado").length
  const rechazadosCount = Object.values(auditItems).filter(a => a.estado === "rechazado").length
  const totalAprobado = expenses
    .filter(e => auditItems[e.id]?.estado === "aprobado")
    .reduce((acc, e) => acc + Number(e.monto || 0), 0)
  const totalRechazado = expenses
    .filter(e => auditItems[e.id]?.estado === "rechazado")
    .reduce((acc, e) => acc + Number(e.monto || 0), 0)

  const handleItemApprove = (expId: string) => {
    setAuditItems(prev => ({
      ...prev,
      [expId]: { estado: "aprobado" },
    }))
  }

  const handleOpenRejectPrompt = (expId: string) => {
    setRejectPromptId(expId)
    setRejectMotivo(auditItems[expId]?.motivo || "")
  }

  const handleConfirmReject = () => {
    if (!rejectPromptId) return
    setAuditItems(prev => ({
      ...prev,
      [rejectPromptId]: { estado: "rechazado", motivo: rejectMotivo || "Comprobante observado por Tesorería" },
    }))
    setRejectPromptId(null)
    setRejectMotivo("")
  }

  const handleUnlinkExpense = async (expId: string) => {
    if (!rendicionId) return
    if (!confirm("¿Desea desvincular este comprobante de la rendición? El gasto no se eliminará del sistema, pero saldrá de este expediente y se recalcularán los totales.")) return
    try {
      await api.expenses.rendiciones.unlinkExpense(rendicionId, expId)
      toast.success("Comprobante Desvinculado", "El gasto ha sido retirado de este expediente.")
      await fetchDetail()
      onSuccess()
    } catch (err: any) {
      toast.error("Error al desvincular comprobante", err.message)
    }
  }

  const handleSaveAudit = async () => {
    setSubmittingAudit(true)
    try {
      const itemsPayload = Object.entries(auditItems).map(([eid, val]) => ({
        expense_id: eid,
        estado: val.estado,
        motivo: val.motivo,
      }))
      await api.expenses.rendiciones.audit(rendicionId, {
        items: itemsPayload,
        observaciones: observacionesTesoreria || undefined,
      })
      toast.success("Auditoría Guardada", `Se auditaron ${itemsPayload.length} comprobantes con éxito.`)
      await fetchDetail()
      onSuccess()
    } catch (err: any) {
      toast.error("Error al guardar auditoría", err.message)
    } finally {
      setSubmittingAudit(false)
    }
  }

  const handleExecuteReplenish = async () => {
    if (totalAprobado <= 0) {
      toast.error("Sin Aprobados", "Debe existir al menos un comprobante aprobado para desembolsar reposición")
      return
    }
    if (medioReposicion === "EFECTIVO_BOVEDA" && !cajaBovedaId) {
      toast.error("Caja Requerida", "Seleccione la Caja Central / Bóveda para el desembolso")
      return
    }
    if (medioReposicion !== "EFECTIVO_BOVEDA" && !bankAccountId) {
      toast.error("Cuenta Requerida", "Seleccione la cuenta bancaria de salida")
      return
    }

    setSubmittingReplenish(true)
    try {
      // Primero asegurar que la auditoría está guardada
      const itemsPayload = Object.entries(auditItems).map(([eid, val]) => ({
        expense_id: eid,
        estado: val.estado,
        motivo: val.motivo,
      }))
      await api.expenses.rendiciones.audit(rendicionId, { items: itemsPayload })

      // Desembolsar reposición
      const res = await api.expenses.rendiciones.replenish(rendicionId, {
        medio_reposicion: medioReposicion,
        caja_boveda_id: medioReposicion === "EFECTIVO_BOVEDA" ? cajaBovedaId : undefined,
        bank_account_id: medioReposicion !== "EFECTIVO_BOVEDA" ? bankAccountId : undefined,
        comprobante_pago_ref: comprobantePagoRef || undefined,
        observaciones: observacionesTesoreria || undefined,
      })
      toast.success(
        "Reposición Efectuada",
        `Se desembolsaron ${formatPYG(res.monto_repuesto)} con salida formal registrada.`
      )
      await fetchDetail()
      onSuccess()
    } catch (err: any) {
      toast.error("Error al ejecutar reposición", err.message)
    } finally {
      setSubmittingReplenish(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!rendicion) return
    setDownloadingPdf(true)
    try {
      await api.expenses.rendiciones.downloadPdf(rendicion.id, rendicion.numero_rendicion)
      toast.success("PDF Descargado", "Acta oficial de rendición guardada.")
    } catch (err: any) {
      toast.error("Error al descargar PDF", err.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 my-6 max-h-[94vh] flex flex-col">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold">
                {rendicion?.numero_rendicion || "Cargando..."}
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                rendicion?.estado === "pagada"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : rendicion?.estado === "aprobada"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : rendicion?.estado === "rechazada"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {rendicion?.estado || "cargando"}
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
              Auditoría y Reposición: {rendicion?.fund_nombre || "Fondo Fijo"}
            </h2>
            <p className="text-[11px] text-slate-500">
              Custodio: <b>{rendicion?.custodio_nombre}</b> • Presentado: {rendicion?.fecha_presentacion?.slice(0, 16).replace("T", " ")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || loading}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Acta PDF</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col justify-center items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Cargando expediente de rendición...</span>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 text-xs flex-1">
            {/* Resumen del Arqueo y Conciliación */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">FONDO AUTORIZADO</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {formatPYG(rendicion?.monto_fondo_autorizado || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">EFECTIVO EN GAVETA</span>
                <span className="text-sm font-extrabold text-emerald-600 font-mono">
                  {formatPYG(rendicion?.efectivo_remanente_contado || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">TOTAL COMPROBANTES</span>
                <span className="text-sm font-extrabold text-blue-600 font-mono">
                  {formatPYG(rendicion?.total_comprobantes_presentados || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">DIFERENCIA ARQUEO</span>
                <span className={`text-sm font-extrabold font-mono ${
                  (rendicion?.diferencia_arqueo || 0) === 0 ? "text-emerald-600" : (rendicion?.diferencia_arqueo || 0) > 0 ? "text-amber-500" : "text-rose-600"
                }`}>
                  {(rendicion?.diferencia_arqueo || 0) === 0 ? "₲ 0 (Exacto)" : formatPYG(rendicion?.diferencia_arqueo || 0)}
                </span>
              </div>
            </div>

            {/* Cuadro Fiscal Consolidado */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[10px]">
              <div>
                <span className="text-slate-400 block">Gravado 10%</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatPYG(rendicion?.total_gravado_10 || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">IVA 10%</span>
                <span className="font-bold font-mono text-indigo-600">
                  {formatPYG(rendicion?.total_iva_10 || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Gravado 5%</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatPYG(rendicion?.total_gravado_5 || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Exentas</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatPYG(rendicion?.total_exentas || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Gasto Operativo</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatPYG(rendicion?.total_gasto_operativo || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Inversión (Activos)</span>
                <span className="font-bold font-mono text-purple-600">
                  {formatPYG(rendicion?.total_inversion_activos || 0)}
                </span>
              </div>
            </div>

            {/* Listado de Comprobantes con Auditoría Ítem por Ítem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  Comprobantes Presentados ({expenses.length})
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-600 font-bold">Aprobados: {aprobadosCount} ({formatPYG(totalAprobado)})</span>
                  {rechazadosCount > 0 && (
                    <span className="text-rose-600 font-bold">Rechazados: {rechazadosCount} ({formatPYG(totalRechazado)})</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {expenses.map((exp) => {
                  const auditState = auditItems[exp.id]?.estado || "aprobado"
                  const isExceeded = fund?.monto_maximo_por_gasto && Number(exp.monto) > Number(fund.monto_maximo_por_gasto)
                  return (
                    <div
                      key={exp.id}
                      className={`p-3 rounded-xl border transition-all ${
                        auditState === "aprobado"
                          ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          : "bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">{exp.descripcion}</span>
                            {exp.es_inversion && (
                              <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Activo Fijo: {exp.categoria_activo || "General"} ({exp.vida_util_meses || 60}m)
                              </span>
                            )}
                            {exp.numero_factura && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Fac: {exp.numero_factura}
                              </span>
                            )}
                            {isExceeded && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Excede Límite
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span>{exp.fecha_gasto}</span>
                            <span>•</span>
                            <span>Prov: <b>{exp.proveedor || "Sin Proveedor"}</b> {exp.ruc && `(RUC: ${exp.ruc})`}</span>
                            <span>•</span>
                            <span>Sector: <b>{exp.cost_center_nombre || "General"}</b></span>
                            {exp.iva_10 ? <span>• IVA 10%: {formatPYG(exp.iva_10)}</span> : null}
                          </div>

                          {auditState === "rechazado" && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              Motivo de rechazo: {auditItems[exp.id]?.motivo || "Observado"}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                            {formatPYG(exp.monto)}
                          </span>

                          {exp.comprobante_url && (
                            <a
                              href={exp.comprobante_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-200"
                              title="Ver foto/PDF comprobante"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {rendicion?.estado !== "pagada" && (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleItemApprove(exp.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  auditState === "aprobado"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-slate-600 hover:text-emerald-600"
                                }`}
                              >
                                <Check className="w-3 h-3" /> Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectPrompt(exp.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  auditState === "rechazado"
                                    ? "bg-rose-600 text-white shadow-sm"
                                    : "text-slate-600 hover:text-rose-600"
                                }`}
                              >
                                <Ban className="w-3 h-3" /> Rechazar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUnlinkExpense(exp.id)}
                                className="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title="Desvincular de esta rendición (el gasto no se borra)"
                              >
                                <Unlink className="w-3 h-3" /> Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Prompt modal para escribir motivo de rechazo */}
            {rejectPromptId && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900 space-y-2 animate-in fade-in">
                <span className="font-bold text-rose-800 dark:text-rose-300 block">
                  Motivo de Observación / Rechazo del Comprobante:
                </span>
                <input
                  type="text"
                  placeholder="ej: Factura ilegible / No emitida a nombre de Grupo Santa Teresa E.A.S."
                  className="input-field w-full text-xs"
                  value={rejectMotivo}
                  onChange={e => setRejectMotivo(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectPromptId(null)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white"
                  >
                    Confirmar Rechazo
                  </button>
                </div>
              </div>
            )}

            {/* Sección de Reposición y Desembolso (si aún no está pagada) */}
            {rendicion?.estado !== "pagada" && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" /> Desembolso y Reposición de Fondos
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Monto neto aprobado a desembolsar: <b className="text-emerald-600 font-mono">{formatPYG(totalAprobado)}</b>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReplenishSection(!showReplenishSection)}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <span>{showReplenishSection ? "Ocultar Opciones" : "Proceder al Desembolso"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showReplenishSection && (
                  <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Medio de Reposición *
                        </label>
                        <select
                          className="input-field w-full text-xs font-semibold"
                          value={medioReposicion}
                          onChange={e => setMedioReposicion(e.target.value)}
                        >
                          <option value="EFECTIVO_BOVEDA">Efectivo de Bóveda Central (Caja Fuerte)</option>
                          <option value="BANCO_TRANSFERENCIA">Transferencia Bancaria (Débito en Cuenta)</option>
                          <option value="CHEQUE">Emisión de Cheque</option>
                        </select>
                      </div>

                      {medioReposicion === "EFECTIVO_BOVEDA" ? (
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Caja Central / Bóveda de Salida *
                          </label>
                          <select
                            className="input-field w-full text-xs"
                            value={cajaBovedaId}
                            onChange={e => setCajaBovedaId(e.target.value)}
                          >
                            {cashRegisters.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.nombre} ({r.codigo})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Cuenta Bancaria de Salida *
                          </label>
                          <select
                            className="input-field w-full text-xs"
                            value={bankAccountId}
                            onChange={e => setBankAccountId(e.target.value)}
                          >
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.banco} — {b.alias || b.numero_cuenta} (Disp: {formatPYG(b.saldo_actual || 0)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Nro de Comprobante / Cheque / Transferencia
                        </label>
                        <input
                          type="text"
                          placeholder="ej: OP-2026-0045 / CHQ-10492"
                          className="input-field w-full text-xs font-mono"
                          value={comprobantePagoRef}
                          onChange={e => setComprobantePagoRef(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Notas de Entrega de Tesorería
                        </label>
                        <input
                          type="text"
                          placeholder="ej: Efectivo entregado en sobre cerrado con recibo"
                          className="input-field w-full text-xs"
                          value={observacionesTesoreria}
                          onChange={e => setObservacionesTesoreria(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveAudit}
                        disabled={submittingAudit || submittingReplenish}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200"
                      >
                        {submittingAudit ? "Guardando..." : "Solo Guardar Auditoría"}
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteReplenish}
                        disabled={submittingReplenish || submittingAudit || totalAprobado <= 0}
                        className="btn-primary text-xs px-5 py-2 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {submittingReplenish ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Confirmar Reposición y Emitir Salida</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
