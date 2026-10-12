import React, { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Briefcase,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Building,
  Landmark,
  CreditCard,
  Users,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Printer,
  ChevronRight,
  Coins,
  Send,
  HelpCircle,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface Phase {
  id: string
  phase_type: string
  phase_label: string
  monto: number
  estado: string
  payment_order_id?: string
  collection_receipt_id?: string
  fecha_vencimiento?: string
  pdf_storage_key?: string
  executed_at?: string
  metadata?: any
}

interface Dossier {
  id: string
  company_id: string
  periodo: string
  sueldok_run_id?: string
  masa_salarial_bruta: number
  total_neto: number
  total_ips_obrero: number
  total_ips_patronal: number
  total_anticipos: number
  total_extra_club: number
  total_uniformes: number
  total_convenios_terceros: number
  total_judiciales: number
  estado: string
  observaciones?: string
  created_at?: string
  phases: Phase[]
}

interface PayrollDossierViewProps {
  initialPeriodo?: string
  onBackToPayroll?: () => void
  embedded?: boolean
}

export default function PayrollDossierView({
  initialPeriodo,
  onBackToPayroll,
  embedded = false,
}: PayrollDossierViewProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Third party cheque inputs
  const [chequeInputs, setChequeInputs] = useState<Record<string, { num: string; banco: string }>>({})

  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true)
      const list = await api.sueldok.listDossiers()
      setDossiers(list || [])
      if (list && list.length > 0) {
        if (id) {
          const match = list.find((d: Dossier) => d.id === id)
          setSelectedDossier(match || list[0])
        } else if (initialPeriodo) {
          const match = list.find((d: Dossier) => d.periodo === initialPeriodo)
          setSelectedDossier(match || list[0])
        } else {
          setSelectedDossier(list[0])
        }
      }
    } catch (err: any) {
      toast.error("Error al cargar expedientes de nómina")
    } finally {
      setLoading(false)
    }
  }, [id, initialPeriodo, toast])

  useEffect(() => {
    loadDossiers()
  }, [loadDossiers])

  const reloadSelected = async (dossierId: string) => {
    try {
      const refreshed = await api.sueldok.getDossier(dossierId)
      setSelectedDossier(refreshed)
      setDossiers(prev => prev.map(d => d.id === dossierId ? refreshed : d))
    } catch (e) {
      console.error(e)
    }
  }

  // Handle Compensations Execution
  const handleExecuteCompensations = async () => {
    if (!selectedDossier) return
    try {
      setActionLoading("compensations")
      const res = await api.sueldok.executeCompensations(selectedDossier.id)
      toast.success(
        "Compensaciones ejecutadas exitosamente",
        `${res.recibos_count} recibos RC-NOMINA generados.`
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error ejecutando compensaciones", err.response?.data?.detail)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle Third Party Execution
  const handleExecuteThirdParty = async (phaseId: string) => {
    if (!selectedDossier) return
    const input = chequeInputs[phaseId] || { num: "", banco: "" }
    try {
      setActionLoading(phaseId)
      const res = await api.sueldok.executeThirdPartyPhase(
        selectedDossier.id,
        phaseId,
        input.num || undefined,
        input.banco || undefined
      )
      toast.success(
        "OP de convenio generada",
        `Orden ${res.payment_order_numero} para ${res.beneficiario}. Planilla Anexa PDF lista.`
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error procesando convenio", err.response?.data?.detail)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle IPS Execution
  const handleExecuteIps = async (phaseId: string) => {
    if (!selectedDossier) return
    try {
      setActionLoading("ips")
      const res = await api.sueldok.executeIpsPhase(selectedDossier.id, phaseId)
      toast.success(
        "OP Previsional IPS emitida",
        `Orden ${res.payment_order_numero} por ${formatPYG(res.monto)}.`
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error procesando IPS", err.response?.data?.detail)
    } finally {
      setActionLoading(null)
    }
  }

  // Filter Phases by Type
  const netPhases = selectedDossier?.phases.filter(p =>
    p.phase_type.startsWith("salario_neto_")
  ) || []
  const compPhases = selectedDossier?.phases.filter(p =>
    p.phase_type === "compensacion_no_cash"
  ) || []
  const thirdPartyPhases = selectedDossier?.phases.filter(p =>
    p.phase_type.startsWith("convenio_tercero_") || p.phase_type === "judiciales"
  ) || []
  const ipsPhases = selectedDossier?.phases.filter(p =>
    p.phase_type === "prevision_ips"
  ) || []

  return (
    <div className={`space-y-6 ${embedded ? "" : "p-6 max-w-7xl mx-auto"}`}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            {onBackToPayroll && (
              <button
                onClick={onBackToPayroll}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
                title="Volver a Nómina General"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Expediente de Desembolso Multi-Fase
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Control financiero de nóminas SueldOK: lotes bancarios SIPAP, compensaciones no-cash, acreedores y previsión IPS.
              </p>
            </div>
          </div>
        </div>

        {/* Dossier Selector */}
        <div className="flex items-center gap-3">
          {onBackToPayroll && (
            <button
              onClick={onBackToPayroll}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Planilla</span>
            </button>
          )}

          <select
            value={selectedDossier?.id || ""}
            onChange={(e) => {
              const d = dossiers.find(x => x.id === e.target.value)
              if (d) {
                setSelectedDossier(d)
                if (!embedded) {
                  navigate(`/sueldok/expediente-nomina/${d.id}`)
                }
              }
            }}
            className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
          >
            {dossiers.map(d => (
              <option key={d.id} value={d.id}>
                Período {d.periodo} ({d.estado.toUpperCase()})
              </option>
            ))}
          </select>

          <button
            onClick={() => selectedDossier && reloadSelected(selectedDossier.id)}
            disabled={loading}
            className="p-2 border rounded-lg border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!selectedDossier && !loading && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sin Expedientes Registrados</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
            Cuando apruebes una corrida salarial mensual en SueldOK, el expediente se creará automáticamente aquí para su desembolso y conciliación.
          </p>
        </div>
      )}

      {selectedDossier && (
        <>
          {/* ── KPI Banner ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
                Masa Bruta
              </span>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatPYG(selectedDossier.masa_salarial_bruta)}
              </div>
              <span className="text-[11px] text-gray-500">Salario devengado</span>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                Neto a Desembolsar
              </span>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                {formatPYG(selectedDossier.total_neto)}
              </div>
              <span className="text-[11px] text-indigo-600/80">Salarios netos físicos</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Compensaciones No-Cash
              </span>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {formatPYG(selectedDossier.total_extra_club + selectedDossier.total_uniformes)}
              </div>
              <span className="text-[11px] text-emerald-600/80">Extra Club + Uniformes</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                Convenios a Terceros
              </span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {formatPYG(selectedDossier.total_convenios_terceros + selectedDossier.total_judiciales)}
              </div>
              <span className="text-[11px] text-amber-600/80">Comercial Malou / Judicial</span>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
                Previsión IPS (25.5%)
              </span>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {formatPYG(selectedDossier.total_ips_obrero + selectedDossier.total_ips_patronal)}
              </div>
              <span className="text-[11px] text-purple-600/80">Vence día 12 subsiguiente</span>
            </div>
          </div>

          {/* ── 4 FASES DE EJECUCIÓN ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ══ FASE 1: SALARIOS NETOS ══════════════════════════ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Fase 1: Salarios Netos (Canales de Pago)
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold">
                  {formatPYG(selectedDossier.total_neto)}
                </span>
              </div>

              <div className="space-y-3">
                {netPhases.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No hay lotes de desembolso configurados.</p>
                ) : (
                  netPhases.map(phase => (
                    <div
                      key={phase.id}
                      className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                          {phase.phase_type.includes("banco") ? (
                            <Landmark className="w-4 h-4 text-indigo-600" />
                          ) : phase.phase_type.includes("cheque") ? (
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Coins className="w-4 h-4 text-amber-600" />
                          )}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {phase.phase_label}
                          </div>
                          <div className="text-xs text-gray-500">
                            Monto: <span className="font-medium text-gray-700 dark:text-gray-300">{formatPYG(phase.monto)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {phase.estado === "ejecutado" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                            <Clock className="w-3.5 h-3.5" /> Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ══ FASE 2: COMPENSACIONES NO-CASH ══════════════════ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Fase 2: Compensaciones No-Cash
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold">
                  {formatPYG(selectedDossier.total_extra_club + selectedDossier.total_uniformes)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  <b>Blindaje de Tesorería Activo:</b> Este neteo cancela las cuentas por cobrar internas (Extra Club y Uniformes) y genera recibos oficiales <code>RC-NOMINA</code> sin tocar fondos de caja ni bancos.
                </span>
              </div>

              {compPhases.map(phase => (
                <div key={phase.id} className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Desglose: Extra Club ({formatPYG(selectedDossier.total_extra_club)}) + Uniformes ({formatPYG(selectedDossier.total_uniformes)})</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Total: {formatPYG(phase.monto)}
                    </span>
                  </div>

                  {phase.estado === "ejecutado" ? (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle className="w-4 h-4" /> Neteo ejecutado correctamente
                      </div>
                      <span className="text-[11px] text-gray-500">
                        {phase.executed_at ? new Date(phase.executed_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={handleExecuteCompensations}
                      disabled={actionLoading === "compensations"}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {actionLoading === "compensations" ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      Ejecutar Compensaciones Internas (Generar RC-NOMINA)
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ══ FASE 3: CONVENIOS TERCEROS ══════════════════════ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Fase 3: Convenios a Terceros & Judiciales
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-semibold">
                  {formatPYG(selectedDossier.total_convenios_terceros + selectedDossier.total_judiciales)}
                </span>
              </div>

              <div className="space-y-4">
                {thirdPartyPhases.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No hay retenciones a terceros en este período.</p>
                ) : (
                  thirdPartyPhases.map(phase => {
                    const isJudicial = phase.phase_type === "judiciales"
                    const inputs = chequeInputs[phase.id] || { num: "", banco: "" }

                    return (
                      <div
                        key={phase.id}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                              {phase.phase_label}
                            </span>
                            <div className="text-xs text-gray-500">
                              Monto Retenido: <b className="text-gray-900 dark:text-white">{formatPYG(phase.monto)}</b>
                            </div>
                          </div>

                          {phase.estado === "ejecutado" ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" /> OP Emitida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
                              <Clock className="w-3.5 h-3.5" /> Pendiente OP
                            </span>
                          )}
                        </div>

                        {phase.estado !== "ejecutado" && !isJudicial && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="N° de Cheque"
                              value={inputs.num}
                              onChange={(e) =>
                                setChequeInputs(prev => ({
                                  ...prev,
                                  [phase.id]: { ...inputs, num: e.target.value }
                                }))
                              }
                              className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                            />
                            <input
                              type="text"
                              placeholder="Banco (ej. Continental)"
                              value={inputs.banco}
                              onChange={(e) =>
                                setChequeInputs(prev => ({
                                  ...prev,
                                  [phase.id]: { ...inputs, banco: e.target.value }
                                }))
                              }
                              className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {phase.estado === "ejecutado" ? (
                            <a
                              href={`/api/v1/sueldok/dossiers/${selectedDossier.id}/phases/${phase.id}/annex-pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition"
                            >
                              <Download className="w-3.5 h-3.5" /> Descargar Planilla Anexa PDF
                            </a>
                          ) : (
                            <button
                              onClick={() => handleExecuteThirdParty(phase.id)}
                              disabled={actionLoading === phase.id}
                              className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                              {actionLoading === phase.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              Emitir OP Consolidada + Planilla Anexa
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ══ FASE 4: PREVISIÓN IPS ═══════════════════════════ */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                    4
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Fase 4: Previsión Previsional IPS
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-semibold">
                  {formatPYG(selectedDossier.total_ips_obrero + selectedDossier.total_ips_patronal)}
                </span>
              </div>

              {ipsPhases.map(phase => (
                <div key={phase.id} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                      <span className="text-gray-400 block mb-0.5">Aporte Obrero (9%)</span>
                      <b className="text-purple-700 dark:text-purple-300 text-sm">
                        {formatPYG(selectedDossier.total_ips_obrero)}
                      </b>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                      <span className="text-gray-400 block mb-0.5">Aporte Patronal (16.5%)</span>
                      <b className="text-purple-700 dark:text-purple-300 text-sm">
                        {formatPYG(selectedDossier.total_ips_patronal)}
                      </b>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 block">Vencimiento Legal:</span>
                      <b className="text-gray-900 dark:text-white">
                        {phase.fecha_vencimiento || "Día 12 del mes subsiguiente"}
                      </b>
                    </div>
                    {phase.estado === "ejecutado" ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> OP Programada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        <Clock className="w-3.5 h-3.5" /> Pendiente Emisión
                      </span>
                    )}
                  </div>

                  {phase.estado !== "ejecutado" && (
                    <button
                      onClick={() => handleExecuteIps(phase.id)}
                      disabled={actionLoading === "ips"}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {actionLoading === "ips" ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Emitir OP Previsional IPS (25.5% Legal)
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
