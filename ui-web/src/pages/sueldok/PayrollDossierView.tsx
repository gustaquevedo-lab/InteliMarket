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
  SlidersHorizontal,
  Save,
  Edit3,
  X,
  RotateCcw,
  Eye,
  CheckSquare,
  Square,
  Search,
  Wallet,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"

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

  // Net payment inputs (Fase 1)
  const [netInputs, setNetInputs] = useState<Record<string, { banco: string; referencia: string }>>({})

  // Third party cheque inputs
  const [chequeInputs, setChequeInputs] = useState<Record<string, { num: string; banco: string }>>({})

  // Third party punteo modal state
  const [punteoModal, setPunteoModal] = useState<{
    isOpen: boolean
    loading: boolean
    phaseId: string | null
    phaseTitle: string
    data: any | null
  }>({
    isOpen: false,
    loading: false,
    phaseId: null,
    phaseTitle: "",
    data: null,
  })
  const [checkedPunteo, setCheckedPunteo] = useState<Record<string, boolean>>({})
  const [punteoSearch, setPunteoSearch] = useState<string>("")
  const [downloadingAnnex, setDownloadingAnnex] = useState<string | null>(null)

  // IPS Adjustment states
  const [ipsAdjustmentOpen, setIpsAdjustmentOpen] = useState<Record<string, boolean>>({})
  const [ipsCustomAmounts, setIpsCustomAmounts] = useState<Record<string, number>>({})
  const [ipsMotivos, setIpsMotivos] = useState<Record<string, string>>({})
  const [savingIpsAdjustment, setSavingIpsAdjustment] = useState<string | null>(null)

  const handleSyncFromSueldok = useCallback(async (targetPeriodo = initialPeriodo || "2026-09", force = false) => {
    try {
      setActionLoading("sync")
      const res = await api.sueldok.syncFromSueldok(targetPeriodo, undefined, force)
      toast.success(
        "Expediente Sincronizado",
        `Nómina ${res.periodo} importada exitosamente (${res.phases?.length || 0} fases de desembolso generadas).`
      )
      const list = await api.sueldok.listDossiers()
      setDossiers(list || [])
      setSelectedDossier(res)
      return res
    } catch (err: any) {
      toast.error("Error al sincronizar nómina de SueldOK", err.message || err.response?.data?.detail)
      return null
    } finally {
      setActionLoading(null)
    }
  }, [initialPeriodo, toast])

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
      } else {
        // Si no hay expedientes, auto-sincronizar el período activo desde SueldOK
        await handleSyncFromSueldok(initialPeriodo || "2026-09", false)
      }
    } catch (err: any) {
      toast.error("Error al cargar expedientes de nómina")
    } finally {
      setLoading(false)
    }
  }, [id, initialPeriodo, toast, handleSyncFromSueldok])

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

  // Handle Net Phase Execution (Fase 1)
  const handleExecuteNetPhase = async (phaseId: string) => {
    if (!selectedDossier) return
    const input = netInputs[phaseId] || { banco: "", referencia: "" }
    try {
      setActionLoading(phaseId)
      await api.sueldok.executeNetPhase(
        selectedDossier.id,
        phaseId,
        input.banco || undefined,
        input.referencia || undefined
      )
      toast.success(
        "Lote de Salario Confirmado",
        "El desembolso fue marcado como pagado exitosamente."
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error al confirmar pago", err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle Compensations Execution (Fase 2)
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

  // Handle Compensations PDF Download (Fase 2)
  const handleDownloadCompensationsPdf = async () => {
    if (!selectedDossier) return
    try {
      setActionLoading("download-comp")
      await api.sueldok.downloadCompensationsPdf(
        selectedDossier.id,
        `comprobante_compensaciones_${selectedDossier.periodo}.pdf`
      )
      toast.success("Comprobante Descargado", "El reporte oficial RC-NOMINA se generó correctamente.")
    } catch (err: any) {
      toast.error("Error al descargar comprobante", err.response?.data?.detail || err.message)
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

  // Handle Download Annex PDF
  const handleDownloadAnnex = async (phaseId: string, phaseTitle: string) => {
    if (!selectedDossier) return
    try {
      setDownloadingAnnex(phaseId)
      const safeTitle = phaseTitle.replace(/[^a-zA-Z0-9_\-]/g, "_")
      const filename = `Planilla_Anexa_${safeTitle}_${selectedDossier.periodo}.pdf`
      await api.sueldok.downloadAnnexPdf(selectedDossier.id, phaseId, filename)
      toast.success("Planilla Anexa Generada", "El documento PDF consolidado se descargó correctamente.")
    } catch (err: any) {
      toast.error("Error descargando planilla anexa", err.response?.data?.detail || err.message)
    } finally {
      setDownloadingAnnex(null)
    }
  }

  // Handle Open Punteo Modal
  const handleOpenPunteo = async (phaseId: string, phaseTitle: string) => {
    if (!selectedDossier) return
    try {
      setPunteoModal({
        isOpen: true,
        loading: true,
        phaseId,
        phaseTitle,
        data: null,
      })
      setPunteoSearch("")
      const data = await api.sueldok.getThirdPartyPunteo(selectedDossier.id, phaseId)
      setPunteoModal(prev => ({
        ...prev,
        loading: false,
        data,
      }))
    } catch (err: any) {
      toast.error("Error cargando punteo de convenio", err.response?.data?.detail || err.message)
      setPunteoModal(prev => ({ ...prev, isOpen: false, loading: false }))
    }
  }

  // Handle Revert Third Party Phase
  const handleRevertThirdParty = async (phaseId: string, phaseTitle: string) => {
    if (!selectedDossier) return
    const confirmed = window.confirm(
      `¿Está seguro de revertir la Orden de Pago para "${phaseTitle}"?\n\n` +
      `La OP emitida se anulará/eliminará y la fase volverá al estado PENDIENTE, permitiendo volver a puntear y reemitir la orden.`
    )
    if (!confirmed) return

    try {
      setActionLoading(phaseId)
      const res = await api.sueldok.revertPhase(selectedDossier.id, phaseId)
      toast.success(
        "Fase Revertida",
        res.message || "La Orden de Pago ha sido revertida y la fase vuelve a estado pendiente."
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error al revertir fase", err.response?.data?.detail || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle IPS Adjustment Save
  const handleSaveIpsAdjustment = async (phaseId: string) => {
    if (!selectedDossier) return
    const customAmount = ipsCustomAmounts[phaseId]
    if (!customAmount || customAmount <= 0) {
      toast.error("Monto inválido", "Ingrese un monto mayor a cero para el ajuste de IPS.")
      return
    }
    try {
      setSavingIpsAdjustment(phaseId)
      const motivo = ipsMotivos[phaseId] || "Ajuste extraordinario según extracto real de IPS (bajas no procesadas)"
      const res = await api.sueldok.adjustIpsPhase(selectedDossier.id, phaseId, {
        monto_ajustado: customAmount,
        motivo_ajuste: motivo,
      })
      toast.success(
        "Ajuste de IPS Guardado",
        `Monto ajustado a ${formatPYG(res.monto_ajustado)} (Diferencia: ${formatPYG(res.diferencia)}).`
      )
      await reloadSelected(selectedDossier.id)
    } catch (err: any) {
      toast.error("Error al guardar ajuste", err.response?.data?.detail)
    } finally {
      setSavingIpsAdjustment(null)
    }
  }

  // Handle IPS Execution
  const handleExecuteIps = async (phaseId: string) => {
    if (!selectedDossier) return
    try {
      setActionLoading("ips")
      const customAmount = ipsCustomAmounts[phaseId]
      const motivo = ipsMotivos[phaseId]
      const payload = (customAmount && customAmount > 0)
        ? { monto_ajustado: customAmount, motivo_ajuste: motivo }
        : undefined

      const res = await api.sueldok.executeIpsPhase(selectedDossier.id, phaseId, payload)
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
    p.phase_type === "compensacion_no_cash" || p.phase_type.startsWith("compensacion_")
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
            onClick={() => handleSyncFromSueldok(selectedDossier?.periodo || initialPeriodo || "2026-09", true)}
            disabled={actionLoading === "sync" || loading}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 disabled:opacity-50"
            title="Importar corrida de nómina aprobada desde SueldOK"
          >
            <Download className={`w-3.5 h-3.5 ${actionLoading === "sync" ? "animate-bounce" : ""}`} />
            <span>{actionLoading === "sync" ? "Sincronizando..." : "Sincronizar SueldOK"}</span>
          </button>

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
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm px-6">
          <Briefcase className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expediente Listo para Sincronizar</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 mb-5">
            Detectamos la corrida salarial aprobada del período <strong className="text-indigo-600 dark:text-indigo-400">{initialPeriodo || "2026-09"}</strong> en SueldOK. Haz clic abajo para importarla y generar las fases de desembolso bancario, compensaciones y previsión IPS.
          </p>
          <button
            onClick={() => handleSyncFromSueldok(initialPeriodo || "2026-09", true)}
            disabled={actionLoading === "sync"}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${actionLoading === "sync" ? "animate-bounce" : ""}`} />
            <span>{actionLoading === "sync" ? "Importando nómina desde SueldOK..." : "Importar Nómina Setiembre 2026 desde SueldOK"}</span>
          </button>
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
              <span className="text-[11px] text-emerald-600/80 block truncate" title={`Extra Club: ${formatPYG(selectedDossier.total_extra_club)} | Uniformes: ${formatPYG(selectedDossier.total_uniformes)}`}>
                Extra Club {formatPYG(selectedDossier.total_extra_club)} + Uniformes
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                Convenios a Terceros
              </span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {formatPYG(selectedDossier.total_convenios_terceros + selectedDossier.total_judiciales)}
              </div>
              <span className="text-[11px] text-amber-600/80 block truncate">
                Cafetería Malou + Credi Porá
              </span>
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
                  netPhases.map(phase => {
                    const isBank = phase.phase_type.includes("banco")
                    const input = netInputs[phase.id] || {
                      banco: isBank ? "Banco Continental" : "",
                      referencia: isBank ? `SIPAP-${selectedDossier.periodo}` : "Entrega en sobres piso"
                    }
                    const isPagadoEnTesoreria = phase.estado === "pagado" || phase.payment_order_estado === "pagado"
                    const isEjecutado = phase.estado === "ejecutado" || isPagadoEnTesoreria
                    const meta = phase.metadata || {}
                    const opNum = phase.payment_order_numero || meta.payment_order_numero

                    return (
                      <div
                        key={phase.id}
                        className="p-4 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                              {isBank ? (
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
                                Monto: <span className="font-bold text-gray-900 dark:text-white">{formatPYG(phase.monto)}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            {isPagadoEnTesoreria ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Liquidada {opNum ? `(${opNum})` : ""}
                              </span>
                            ) : isEjecutado ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                                <Clock className="w-3.5 h-3.5 text-blue-600" /> OP Emitida {opNum ? `(${opNum})` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-semibold">
                                <Clock className="w-3.5 h-3.5" /> Pendiente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Formulario y acción de confirmación de desembolso si está pendiente */}
                        {!isEjecutado ? (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {isBank ? (
                                <>
                                  <input
                                    type="text"
                                    placeholder="Banco (ej. Continental)"
                                    value={input.banco}
                                    onChange={(e) =>
                                      setNetInputs(prev => ({
                                        ...prev,
                                        [phase.id]: { ...input, banco: e.target.value }
                                      }))
                                    }
                                    className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                                  />
                                  <input
                                    type="text"
                                    placeholder="N° Transferencia / Referencia"
                                    value={input.referencia}
                                    onChange={(e) =>
                                      setNetInputs(prev => ({
                                        ...prev,
                                        [phase.id]: { ...input, referencia: e.target.value }
                                      }))
                                    }
                                    className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                                  />
                                </>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Detalle de entrega (ej. Sobres cerrados en tesorería)"
                                  value={input.referencia}
                                  onChange={(e) =>
                                    setNetInputs(prev => ({
                                      ...prev,
                                      [phase.id]: { ...input, referencia: e.target.value }
                                    }))
                                  }
                                  className="col-span-1 sm:col-span-2 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white border-gray-300 dark:border-gray-700"
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                onClick={() => handleExecuteNetPhase(phase.id)}
                                disabled={actionLoading === phase.id}
                                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                              >
                                {actionLoading === phase.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                )}
                                Confirmar y Emitir OP ({isBank ? "SIPAP Bancario" : "Efectivo / Sobres"})
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate("/payments")}
                                className="py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition"
                                title="Ir a Tesorería / Pagos para asignar cuentas bancarias o retiros de bóveda"
                              >
                                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                Asignar Medios en Tesorería
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-3">
                              {meta.banco && <span><b>Banco:</b> {meta.banco}</span>}
                              {meta.referencia_comprobante && <span><b>Ref:</b> {meta.referencia_comprobante}</span>}
                              {meta.payment_order_numero && (
                                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 font-bold">
                                  OP {meta.payment_order_numero}
                                </span>
                              )}
                              {phase.executed_at && <span><b>Fecha:</b> {new Date(phase.executed_at).toLocaleDateString()}</span>}
                            </div>
                            {isPagadoEnTesoreria ? (
                              <a
                                href="/payments?tab=pagadas"
                                className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1 transition border border-emerald-200 dark:border-emerald-800"
                                title="Esta nómina ya fue liquidada con medios reales en Tesorería"
                              >
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> Liquidada en Tesorería
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevertThirdParty(phase.id, phase.phase_label)}
                                disabled={actionLoading === phase.id}
                                className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium text-xs flex items-center gap-1 transition border border-rose-200 dark:border-rose-900/40 disabled:opacity-50"
                                title="Revertir el desembolso y devolver la fase a pendiente"
                              >
                                <RotateCcw className="w-3 h-3" /> Revertir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
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

              {/* Botón de Descarga Oficial RC-NOMINA */}
              <button
                onClick={handleDownloadCompensationsPdf}
                disabled={actionLoading === "download-comp"}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                {actionLoading === "download-comp" ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Download className="w-4 h-4 text-indigo-600" />
                )}
                <span>📄 Descargar Comprobante Oficial RC-NOMINA (PDF)</span>
              </button>

              <div className="space-y-3">
                {compPhases.map(phase => (
                  <div key={phase.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{phase.phase_label}</div>
                        <div className="text-[11px] text-gray-500">Monto compensado:</div>
                      </div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                        {formatPYG(phase.monto)}
                      </span>
                    </div>

                    {phase.estado === "ejecutado" ? (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Neteo ejecutado correctamente
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {phase.executed_at ? new Date(phase.executed_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleExecuteCompensations}
                        disabled={actionLoading === "compensations"}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === "compensations" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Ejecutar Neteo Interno (Generar RC-NOMINA)
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                              {phase.phase_label}
                            </span>
                            {phase.metadata?.total_transferencia_banco ? (
                              <div className="mt-1 space-y-0.5 text-xs">
                                <div className="text-gray-500">
                                  Retenciones Personal ({phase.metadata.employees?.length || 30}): <b className="text-gray-800 dark:text-gray-200">{formatPYG(phase.monto)}</b>
                                </div>
                                <div className="text-indigo-600 dark:text-indigo-400">
                                  + Factura Gasto ({phase.metadata.factura_numero || "001-003-0000015"}): <b>{formatPYG(phase.metadata.gasto_institucional_factura || 375000)}</b>
                                </div>
                                <div className="font-bold text-emerald-700 dark:text-emerald-400 pt-0.5 border-t border-gray-200 dark:border-gray-700">
                                  Monto Consolidado OP: {formatPYG(phase.metadata.total_transferencia_banco)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                Monto Retenido: <b className="text-gray-900 dark:text-white">{formatPYG(phase.monto)}</b>
                              </div>
                            )}
                          </div>

                          {phase.estado === "pagado" || phase.payment_order_estado === "pagado" ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Liquidada en Tesorería {phase.payment_order_numero ? `(${phase.payment_order_numero})` : ""}
                            </span>
                          ) : phase.estado === "ejecutado" ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                              <Clock className="w-3.5 h-3.5 text-blue-600" /> OP Emitida {phase.payment_order_numero ? `(${phase.payment_order_numero})` : ""}
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

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Botón Punteo de Convenio (Siempre Disponible) */}
                          <button
                            type="button"
                            onClick={() => handleOpenPunteo(phase.id, phase.phase_label)}
                            className="py-1.5 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium text-xs flex items-center gap-1.5 transition border border-gray-300 dark:border-gray-600"
                            title="Ver planilla consolidada de funcionarios y montos para cotejo"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            Punteo de Convenio
                          </button>

                          {/* Botón Planilla Anexa PDF (Siempre Disponible vía API en memoria) */}
                          <button
                            type="button"
                            onClick={() => handleDownloadAnnex(phase.id, phase.phase_label)}
                            disabled={downloadingAnnex === phase.id}
                            className="py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-medium text-xs flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
                            title="Descargar Planilla Anexa oficial en formato PDF"
                          >
                            {downloadingAnnex === phase.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Planilla Anexa (PDF)
                          </button>

                          {/* Estado Pendiente: Emitir OP */}
                          {phase.estado !== "ejecutado" && (
                            <button
                              type="button"
                              onClick={() => handleExecuteThirdParty(phase.id)}
                              disabled={actionLoading === phase.id}
                              className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                            >
                              {actionLoading === phase.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              Emitir OP Consolidada
                            </button>
                          )}

                          {/* Estado Liquidado en Tesorería */}
                          {(phase.estado === "pagado" || phase.payment_order_estado === "pagado") && (
                            <a
                              href="/payments?tab=pagadas"
                              className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition border border-emerald-200 dark:border-emerald-800"
                              title="Esta orden ya fue liquidada en Tesorería con fondos bancarios/efectivo"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Ver en Historial Tesorería {phase.payment_order_numero ? `(${phase.payment_order_numero})` : ""}
                            </a>
                          )}

                          {/* Estado Ejecutado: OP Emitida pendiente de desembolso */}
                          {phase.estado === "ejecutado" && phase.payment_order_estado !== "pagado" && (
                            <>
                              <a
                                href="/payments"
                                className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
                                title="Abrir Tesorería para liquidar la Orden de Pago"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Asignar Medios en Tesorería {phase.payment_order_numero ? `(${phase.payment_order_numero})` : ""}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRevertThirdParty(phase.id, phase.phase_label)}
                                disabled={actionLoading === phase.id}
                                className="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-medium text-xs flex items-center gap-1.5 transition border border-rose-200 dark:border-rose-900/40 disabled:opacity-50"
                                title="Revertir la Orden de Pago y volver a estado pendiente"
                              >
                                {actionLoading === phase.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                                Revertir OP
                              </button>
                            </>
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
              {ipsPhases.map(phase => {
                const theoreticalAmount = Number(phase.metadata?.monto_teorico_calculado ?? (selectedDossier.total_ips_obrero + selectedDossier.total_ips_patronal))
                const isAdjusted = Boolean(phase.metadata?.monto_ajustado)
                const currentMonto = Number(phase.monto)
                const isOpen = ipsAdjustmentOpen[phase.id] ?? false
                const customAmount = ipsCustomAmounts[phase.id] !== undefined ? ipsCustomAmounts[phase.id] : (isAdjusted ? currentMonto : theoreticalAmount)
                const diff = (customAmount || 0) - theoreticalAmount

                return (
                  <div key={phase.id} className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                          4
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            Fase 4: Previsión Previsional IPS
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Aporte patronal + retención obrera cotizable (9% + 16.5% = 25.5%)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-semibold">
                          {formatPYG(currentMonto)}
                        </span>
                        {isAdjusted && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                            Extracto Ajustado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Breakdown */}
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

                    {/* Active Adjustment Info Badge */}
                    {isAdjusted && (
                      <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Ajuste Extraordinario Activo (s/ Extracto IPS)
                          </span>
                          <span>
                            {diff >= 0 ? "+" : ""}{formatPYG(phase.metadata.diferencia_ajuste || diff)}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                          <b>Motivo:</b> {phase.metadata.motivo_ajuste || "Diferencias por bajas no procesadas a tiempo."}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-0.5 border-t border-amber-200/60 dark:border-amber-800/40">
                          <span>Teórico nómina: {formatPYG(theoreticalAmount)}</span>
                          <span>•</span>
                          <span>Extracto real: {formatPYG(currentMonto)}</span>
                        </div>
                      </div>
                    )}

                    {/* Adjustment Box (Toggle) */}
                    {phase.estado !== "ejecutado" && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              setIpsAdjustmentOpen(prev => ({ ...prev, [phase.id]: !prev[phase.id] }))
                            }
                            className="text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 flex items-center gap-1.5 transition"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            {isOpen ? "Ocultar panel de ajuste" : "Ajuste extraordinario de monto (bajas tardías / desvío extracto)"}
                          </button>
                          {isOpen && (
                            <button
                              type="button"
                              onClick={() =>
                                setIpsAdjustmentOpen(prev => ({ ...prev, [phase.id]: false }))
                              }
                              className="text-gray-400 hover:text-gray-600 text-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isOpen && (
                          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-purple-200 dark:border-purple-900/50 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                  Monto Real a Liquidar s/ Boleta IPS:
                                </label>
                                <CurrencyInput
                                  value={customAmount}
                                  onChangeValue={(val) =>
                                    setIpsCustomAmounts(prev => ({ ...prev, [phase.id]: val }))
                                  }
                                  currency="PYG"
                                  placeholder="Monto según extracto oficial"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                  Motivo de la variación:
                                </label>
                                <input
                                  type="text"
                                  value={ipsMotivos[phase.id] ?? (phase.metadata?.motivo_ajuste || "")}
                                  onChange={(e) =>
                                    setIpsMotivos(prev => ({ ...prev, [phase.id]: e.target.value }))
                                  }
                                  placeholder="Ej: Bajas de personal no procesadas a tiempo por la encargada"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Live calculation difference */}
                            {diff !== 0 && (
                              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200">
                                <span>
                                  Diferencia vs Cálculo Teórico ({formatPYG(theoreticalAmount)}):
                                </span>
                                <b className={diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                                  {diff > 0 ? "+" : ""}{formatPYG(diff)} {diff > 0 ? "(Sobrecosto patronal)" : "(Descuento)"}
                                </b>
                              </div>
                            )}

                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleSaveIpsAdjustment(phase.id)}
                                disabled={savingIpsAdjustment === phase.id}
                                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                              >
                                {savingIpsAdjustment === phase.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                Guardar Ajuste en Expediente
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vencimiento y Estado */}
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

                    {/* Botón de Emisión */}
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
                        Emitir OP Previsional IPS {isAdjusted || (customAmount && customAmount !== theoreticalAmount) ? `(por ${formatPYG(customAmount || currentMonto)})` : "(25.5% Legal)"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

          </div>
        </>
      )}

      {/* ══ MODAL DE PUNTEO DE CONVENIOS (REGLA CANÓNICA MODALES) ══ */}
      {punteoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-h-[90vh] w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Cabecera (shrink-0) */}
            <div className="shrink-0 p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Punteo de Convenio: {punteoModal.phaseTitle}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold">
                      Período {selectedDossier?.periodo}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Coteje renglón por renglón los descuentos cargados en SueldOK contra la planilla enviada por la conveniada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {punteoModal.phaseId && (
                  <button
                    type="button"
                    onClick={() => handleDownloadAnnex(punteoModal.phaseId!, punteoModal.phaseTitle)}
                    disabled={downloadingAnnex === punteoModal.phaseId}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium text-xs flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800"
                    title="Descargar Planilla Anexa PDF"
                  >
                    {downloadingAnnex === punteoModal.phaseId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Descargar PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPunteoModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barra de Búsqueda y Punteo Rápido (shrink-0) */}
            <div className="shrink-0 px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar funcionario o C.I..."
                  value={punteoSearch}
                  onChange={(e) => setPunteoSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {punteoModal.data && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-gray-600 dark:text-gray-300">
                    Punteados: <b className="text-emerald-600 dark:text-emerald-400">
                      {punteoModal.data.items?.filter((it: any) => checkedPunteo[`${punteoModal.phaseId}_${it.nro || it.ci}`]).length || 0}
                    </b> de <b>{punteoModal.data.total_empleados || punteoModal.data.items?.length || 0}</b>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const allKeys: Record<string, boolean> = { ...checkedPunteo }
                      const shouldCheck = punteoModal.data.items?.some((it: any) => !checkedPunteo[`${punteoModal.phaseId}_${it.nro || it.ci}`])
                      punteoModal.data.items?.forEach((it: any) => {
                        allKeys[`${punteoModal.phaseId}_${it.nro || it.ci}`] = shouldCheck
                      })
                      setCheckedPunteo(allKeys)
                    }}
                    className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                  >
                    Marcar/Desmarcar todos
                  </button>
                </div>
              )}
            </div>

            {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {punteoModal.loading ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Cargando nómina de colaboradores y descuentos...</p>
                </div>
              ) : !punteoModal.data || !punteoModal.data.items || punteoModal.data.items.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 italic">
                  No se encontraron descuentos registrados para este convenio en el período seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">Punteo</th>
                        <th className="px-3 py-2.5 w-12 text-center">N°</th>
                        <th className="px-3 py-2.5">Documento</th>
                        <th className="px-3 py-2.5">Colaborador / Funcionario</th>
                        <th className="px-3 py-2.5">Concepto / Referencia</th>
                        <th className="px-3 py-2.5 text-right">Monto Retenido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {punteoModal.data.items
                        .filter((it: any) => {
                          if (!punteoSearch) return true
                          const term = punteoSearch.toLowerCase()
                          return (
                            (it.nombre || "").toLowerCase().includes(term) ||
                            (it.ci || "").toLowerCase().includes(term) ||
                            (it.concepto || "").toLowerCase().includes(term)
                          )
                        })
                        .map((item: any, idx: number) => {
                          const itemKey = `${punteoModal.phaseId}_${item.nro || item.ci || idx}`
                          const isChecked = !!checkedPunteo[itemKey]

                          return (
                            <tr
                              key={itemKey}
                              onClick={() => setCheckedPunteo(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                              className={`cursor-pointer transition hover:bg-amber-50/50 dark:hover:bg-amber-950/20 ${
                                isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""
                              }`}
                            >
                              <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => setCheckedPunteo(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-400 font-mono">
                                {item.nro || idx + 1}
                              </td>
                              <td className="px-3 py-2.5 font-mono font-medium text-gray-700 dark:text-gray-300">
                                {item.ci}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">
                                {item.nombre}
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                                {item.concepto || punteoModal.phaseTitle}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-900 dark:text-white whitespace-nowrap">
                                {formatPYG(item.monto)}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pie de Acciones y Totales (shrink-0) */}
            <div className="shrink-0 p-4 sm:p-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Total Retenciones</span>
                  <span className="font-bold font-mono text-base text-gray-900 dark:text-white">
                    {formatPYG(punteoModal.data?.monto_total || 0)}
                  </span>
                </div>
                {punteoModal.data?.deducciones_extra > 0 && (
                  <div>
                    <span className="text-rose-500 block text-[10px] uppercase font-bold">Menos Factura Gasto</span>
                    <span className="font-bold font-mono text-base text-rose-600 dark:text-rose-400">
                      - {formatPYG(punteoModal.data.deducciones_extra)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] uppercase font-bold">
                    Neto a Pagar en OP
                  </span>
                  <span className="font-black font-mono text-base text-indigo-700 dark:text-indigo-300">
                    {formatPYG(punteoModal.data?.monto_neto_op || punteoModal.data?.monto_total || 0)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPunteoModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-bold text-xs transition"
              >
                Cerrar Punteo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
