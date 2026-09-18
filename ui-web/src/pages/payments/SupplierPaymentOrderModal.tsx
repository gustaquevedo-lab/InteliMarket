import React, { useState, useEffect, useMemo } from "react"
import {
  X, Check, AlertTriangle, Plus, Trash2, CreditCard,
  Building2, Wallet, FileText, Calendar, CheckCircle2,
  DollarSign, ShieldAlert, ArrowRight, Loader2
} from "lucide-react"
import { api, SupplierPaymentOrder } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface InvoiceToPay {
  id: string
  numero_factura: string
  timbrado?: string
  fecha_emision?: string
  fecha_vencimiento?: string
  total: number
  saldo_pendiente: number
  supplier_id: string
  supplier_nombre?: string
}

interface DisbursementRow {
  forma_pago: "boveda" | "fondo_fijo" | "transferencia" | "cheque" | "nota_credito"
  monto: number
  moneda?: string
  tipo_cambio?: number
  cheque_id?: string
  monto_total_cheque?: number
  is_shared_cheque?: boolean
  is_master_cheque?: boolean
  bank_account_id?: string
  referencia_transferencia?: string
  numero_cheque?: string
  banco_cheque?: string
  fecha_cheque_emision?: string
  fecha_cheque_vencimiento?: string
  es_cheque_diferido?: boolean
  titular_cheque?: string
  petty_cash_fund_id?: string
  credit_note_id?: string
  observaciones?: string
}

interface Props {
  supplier: { id: string; razon_social: string; ruc?: string }
  initialInvoices: InvoiceToPay[]
  availableInvoices?: InvoiceToPay[]
  existingOrder?: SupplierPaymentOrder | null
  onClose: () => void
  onSuccess: (order: any) => void
}

export default function SupplierPaymentOrderModal({
  supplier,
  initialInvoices,
  availableInvoices = [],
  existingOrder = null,
  onClose,
  onSuccess,
}: Props) {
  const toast = useToast()
  const [step, setStep] = useState<"step1_facturas" | "step2_desembolso">("step1_facturas")
  const [submitting, setSubmitting] = useState(false)

  // Facturas y amortizaciones seleccionadas
  const [selectedInvoicesMap, setSelectedInvoicesMap] = useState<Record<string, {
    inv: InvoiceToPay
    monto_aplicado: number
    monto_retencion: number
  }>>({})

  // Datos de cabecera
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0])
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0])
  const [reciboProveedor, setReciboProveedor] = useState(existingOrder?.recibo_proveedor || "")
  const [observaciones, setObservaciones] = useState(existingOrder?.observaciones || "")

  // Auxiliares de tesorería y bancos
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [pettyCashFunds, setPettyCashFunds] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [vaultBalance, setVaultBalance] = useState<number>(0)
  const [availableCheques, setAvailableCheques] = useState<any[]>([])
  const [loadingAux, setLoadingAux] = useState(true)

  // Desembolsos / medios de pago
  const [disbursements, setDisbursements] = useState<DisbursementRow[]>([])

  // Inicializar facturas
  useEffect(() => {
    if (existingOrder && existingOrder.allocations) {
      // Si estamos liquidando una orden existente registrada
      const map: Record<string, any> = {}
      existingOrder.allocations.forEach((a: any) => {
        map[a.invoice_id] = {
          inv: {
            id: a.invoice_id,
            numero_factura: a.numero_factura || "Factura",
            timbrado: a.timbrado,
            total: a.saldo_anterior + a.monto_aplicado,
            saldo_pendiente: a.saldo_anterior,
            supplier_id: supplier.id,
            supplier_nombre: supplier.razon_social,
          },
          monto_aplicado: a.monto_aplicado,
          monto_retencion: a.monto_retencion || 0,
        }
      })
      setSelectedInvoicesMap(map)
      setStep("step2_desembolso")
    } else {
      const map: Record<string, any> = {}
      initialInvoices.forEach(inv => {
        map[inv.id] = {
          inv,
          monto_aplicado: inv.saldo_pendiente,
          monto_retencion: 0,
        }
      })
      setSelectedInvoicesMap(map)
    }
  }, [initialInvoices, existingOrder, supplier])

  // Cargar datos de tesorería, bancos, fondos fijos, notas de crédito y cheques disponibles
  useEffect(() => {
    let mounted = true
    async function loadAuxData() {
      try {
        const [banksRes, fundsRes, cnRes, vaultRes, chequesRes] = await Promise.allSettled([
          api.financial.banks.list(),
          api.expenses.funds.list({ activo: true }),
          api.financial.creditNotes.list({ supplier_id: supplier.id }),
          api.vault.dashboard(),
          api.financial.paymentOrders.getChequesDisponibles(),
        ])

        if (!mounted) return
        if (banksRes.status === "fulfilled" && Array.isArray(banksRes.value)) {
          setBankAccounts(banksRes.value)
        }
        if (fundsRes.status === "fulfilled" && Array.isArray(fundsRes.value)) {
          setPettyCashFunds(fundsRes.value)
        }
        if (cnRes.status === "fulfilled" && Array.isArray(cnRes.value)) {
          setCreditNotes(cnRes.value.filter((n: any) => (n.saldo_disponible ?? n.monto) > 0))
        }
        if (vaultRes.status === "fulfilled" && vaultRes.value) {
          setVaultBalance(Number(vaultRes.value.saldo_en_boveda_pyg || 0))
        }
        if (chequesRes.status === "fulfilled" && Array.isArray(chequesRes.value)) {
          setAvailableCheques(chequesRes.value)
        }
      } catch (err) {
        console.error("Error al cargar datos auxiliares de tesorería", err)
      } finally {
        if (mounted) setLoadingAux(false)
      }
    }
    loadAuxData()
    return () => { mounted = false }
  }, [supplier.id])

  // Totales calculados de facturas
  const summaryFacturas = useMemo(() => {
    let subtotal = 0
    let retenciones = 0
    Object.values(selectedInvoicesMap).forEach(item => {
      subtotal += Number(item.monto_aplicado || 0)
      retenciones += Number(item.monto_retencion || 0)
    })
    const neto = Math.max(0, subtotal - retenciones)
    return { subtotal, retenciones, neto }
  }, [selectedInvoicesMap])

  // Totales calculados de desembolsos
  const summaryDesembolsos = useMemo(() => {
    let total = 0
    disbursements.forEach(d => {
      total += Number(d.monto || 0)
    })
    const diferencia = summaryFacturas.neto - total
    const cuadra = Math.abs(diferencia) <= 50 && total > 0
    return { total, diferencia, cuadra }
  }, [disbursements, summaryFacturas.neto])

  // Inicializar un renglón de desembolso por defecto si pasa a step 2
  const handleGoToStep2 = () => {
    if (Object.keys(selectedInvoicesMap).length === 0) {
      toast.error("Seleccione al menos una factura", "Debe amortizar al menos una factura.")
      return
    }
    if (summaryFacturas.neto <= 0) {
      toast.error("Monto inválido", "El monto neto a pagar debe ser mayor a 0.")
      return
    }

    if (disbursements.length === 0) {
      // Sugerir un medio por defecto (transferencia si hay banco, o boveda)
      const defaultBank = bankAccounts[0]?.id
      setDisbursements([
        {
          forma_pago: defaultBank ? "transferencia" : "boveda",
          monto: summaryFacturas.neto,
          bank_account_id: defaultBank || undefined,
          titular_cheque: supplier.razon_social,
          fecha_cheque_emision: fechaPago,
          fecha_cheque_vencimiento: fechaPago,
          es_cheque_diferido: false,
        }
      ])
    }
    setStep("step2_desembolso")
  }

  // Agregar renglón de desembolso
  const addDisbursementRow = () => {
    const restante = Math.max(0, summaryDesembolsos.diferencia)
    setDisbursements(prev => [
      ...prev,
      {
        forma_pago: "transferencia",
        monto: restante,
        bank_account_id: bankAccounts[0]?.id || undefined,
        titular_cheque: supplier.razon_social,
        fecha_cheque_emision: fechaPago,
        fecha_cheque_vencimiento: fechaPago,
        es_cheque_diferido: false,
      }
    ])
  }

  const removeDisbursementRow = (index: number) => {
    setDisbursements(prev => prev.filter((_, i) => i !== index))
  }

  const updateDisbursementRow = (index: number, patch: Partial<DisbursementRow>) => {
    setDisbursements(prev => prev.map((d, i) => i === index ? { ...d, ...patch } : d))
  }

  // Guardar Paso 1: Sólo Registrar Orden de Pago (sin mover fondos)
  const handleSaveOnlyRegister = async () => {
    if (Object.keys(selectedInvoicesMap).length === 0) {
      toast.error("Seleccione al menos una factura", "")
      return
    }
    setSubmitting(true)
    try {
      const allocations = Object.values(selectedInvoicesMap).map(item => ({
        invoice_id: item.inv.id,
        monto_aplicado: item.monto_aplicado,
        monto_retencion: item.monto_retencion,
      }))

      const res = await api.financial.paymentOrders.create({
        supplier_id: supplier.id,
        fecha_emision: fechaEmision,
        recibo_proveedor: reciboProveedor || undefined,
        observaciones: observaciones || undefined,
        allocations,
      })

      toast.success("Orden de Pago Registrada", `Se creó la orden ${res.numero_orden} en estado 'registrado'. Lista para su posterior asignación de medios de pago.`)
      onSuccess(res)
    } catch (err: any) {
      toast.error("Error al registrar orden", err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Paso 2: Liquidar y desembolsar fondos
  const handleDisburseAndPay = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!summaryDesembolsos.cuadra) {
      toast.error(
        "Diferencia en medios de pago",
        `El total asignado (${formatPYG(summaryDesembolsos.total)}) no coincide con el total neto (${formatPYG(summaryFacturas.neto)}). Diferencia: ${formatPYG(summaryDesembolsos.diferencia)}`
      )
      return
    }

    setSubmitting(true)
    try {
      const sanitizedDisbursements = disbursements.map(d => ({
        forma_pago: d.forma_pago,
        monto: d.monto,
        moneda: d.moneda || "PYG",
        tipo_cambio: d.tipo_cambio || 1,
        bank_account_id: d.bank_account_id || undefined,
        referencia_transferencia: d.referencia_transferencia || undefined,
        cheque_id: d.is_shared_cheque ? d.cheque_id : undefined,
        monto_total_cheque: d.is_master_cheque ? d.monto_total_cheque : undefined,
        numero_cheque: d.numero_cheque || undefined,
        banco_cheque: d.banco_cheque || undefined,
        fecha_cheque_emision: d.fecha_cheque_emision || undefined,
        fecha_cheque_vencimiento: d.fecha_cheque_vencimiento || undefined,
        es_cheque_diferido: d.es_cheque_diferido,
        titular_cheque: d.titular_cheque || undefined,
        petty_cash_fund_id: d.petty_cash_fund_id || undefined,
        credit_note_id: d.credit_note_id || undefined,
        observaciones: d.observaciones || undefined,
      }))

      if (existingOrder) {
        // Liquidar orden existente
        const res = await api.financial.paymentOrders.disburse(existingOrder.id, {
          fecha_pago: fechaPago,
          recibo_proveedor: reciboProveedor || undefined,
          observaciones: observaciones || undefined,
          disbursements: sanitizedDisbursements,
        })
        toast.success("Orden de Pago Liquidada", `Se desembolsó exitosamente la orden ${res.numero_orden}. Fondos y saldos actualizados.`)
        onSuccess(res)
      } else {
        // Crear y liquidar de inmediato
        const allocations = Object.values(selectedInvoicesMap).map(item => ({
          invoice_id: item.inv.id,
          monto_aplicado: item.monto_aplicado,
          monto_retencion: item.monto_retencion,
        }))

        const res = await api.financial.paymentOrders.create({
          supplier_id: supplier.id,
          fecha_emision: fechaEmision,
          recibo_proveedor: reciboProveedor || undefined,
          observaciones: observaciones || undefined,
          allocations,
          disbursements: sanitizedDisbursements,
        })
        toast.success("Pago Liquidado con Éxito", `Se emitió y liquidó la orden ${res.numero_orden} por ${formatPYG(summaryFacturas.neto)}.`)
        onSuccess(res)
      }
    } catch (err: any) {
      toast.error("Error al liquidar pago", err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* CABECERA */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-md shadow-rose-500/20 text-white font-extrabold">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                  {existingOrder ? `Liquidación ${existingOrder.numero_orden}` : "Nueva Orden de Pago (AP)"}
                </span>
                <span className="text-xs font-mono text-slate-400">RUC: {supplier.ruc || "N/A"}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {supplier.razon_social}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEPPER BAR */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => !existingOrder && setStep("step1_facturas")}
              disabled={!!existingOrder}
              className={`flex items-center gap-1.5 font-bold transition ${
                step === "step1_facturas"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === "step1_facturas" ? "bg-rose-600 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>1</span>
              <span>Facturas a Amortizar ({Object.keys(selectedInvoicesMap).length})</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700 font-bold">→</span>

            <button
              onClick={handleGoToStep2}
              className={`flex items-center gap-1.5 font-bold transition ${
                step === "step2_desembolso"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === "step2_desembolso" ? "bg-rose-600 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>2</span>
              <span>Asignación de Medios de Pago</span>
            </button>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-500 font-medium">Neto a Liquidar: </span>
            <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
              {formatPYG(summaryFacturas.neto)}
            </span>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* PASO 1: SELECCIÓN Y AMORTIZACIÓN DE FACTURAS */}
          {step === "step1_facturas" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Facturas Comerciales a Amortizar
                  </h3>
                  <p className="text-xs text-slate-400">
                    Podés realizar amortizaciones parciales o totales ajustando el monto por cada factura.
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {Object.keys(selectedInvoicesMap).length} seleccionadas
                </div>
              </div>

              {/* TABLA FACTURAS AMORTIZADAS */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Factura N°</th>
                      <th className="p-3">Timbrado / Vto</th>
                      <th className="p-3 text-right">Saldo Original</th>
                      <th className="p-3 text-right w-36">Monto Amortizado</th>
                      <th className="p-3 text-right w-28">Retención</th>
                      <th className="p-3 text-right">Saldo Restante</th>
                      <th className="p-3 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Object.values(selectedInvoicesMap).map(({ inv, monto_aplicado, monto_retencion }) => {
                      const restante = Math.max(0, inv.saldo_pendiente - (Number(monto_aplicado) + Number(monto_retencion)))
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                            {inv.numero_factura}
                          </td>
                          <td className="p-3 text-slate-500">
                            <p>{inv.timbrado || "S/T"}</p>
                            <p className="text-[10px] text-slate-400">Vto: {formatDate(inv.fecha_vencimiento)}</p>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatPYG(inv.saldo_pendiente)}
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="1"
                              max={inv.saldo_pendiente}
                              value={monto_aplicado}
                              onChange={e => {
                                const val = Number(e.target.value) || 0
                                setSelectedInvoicesMap(prev => ({
                                  ...prev,
                                  [inv.id]: { ...prev[inv.id], monto_aplicado: val }
                                }))
                              }}
                              className="w-full text-right p-1.5 font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-rose-500"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={inv.saldo_pendiente - monto_aplicado}
                              value={monto_retencion}
                              onChange={e => {
                                const val = Number(e.target.value) || 0
                                setSelectedInvoicesMap(prev => ({
                                  ...prev,
                                  [inv.id]: { ...prev[inv.id], monto_retencion: val }
                                }))
                              }}
                              className="w-full text-right p-1.5 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-500">
                            {formatPYG(restante)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedInvoicesMap(prev => {
                                  const c = { ...prev }
                                  delete c[inv.id]
                                  return c
                                })
                              }}
                              className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                              title="Remover factura de esta orden"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* AGREGAR FACTURAS ADICIONALES DEL PROVEEDOR */}
              {availableInvoices.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-500">¿Deseás incluir más facturas pendientes de este proveedor?</span>
                  <div className="flex gap-2">
                    {availableInvoices
                      .filter(i => !selectedInvoicesMap[i.id] && i.supplier_id === supplier.id)
                      .slice(0, 3)
                      .map(inv => (
                        <button
                          key={inv.id}
                          onClick={() => {
                            setSelectedInvoicesMap(prev => ({
                              ...prev,
                              [inv.id]: {
                                inv,
                                monto_aplicado: inv.saldo_pendiente,
                                monto_retencion: 0,
                              }
                            }))
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-rose-500 text-[11px] font-mono flex items-center gap-1 transition"
                        >
                          <Plus className="w-3 h-3 text-rose-500" /> {inv.numero_factura} ({formatPYG(inv.saldo_pendiente)})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* CAMPOS DE METADATOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Fecha Emisión OP *
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaEmision}
                    onChange={e => setFechaEmision(e.target.value)}
                    className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    N° Recibo Oficial del Proveedor
                  </label>
                  <input
                    type="text"
                    value={reciboProveedor}
                    onChange={e => setReciboProveedor(e.target.value)}
                    placeholder="Ej: REC-001-002-0004512"
                    className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Observaciones / Referencia
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    placeholder="Concepto o notas para tesorería"
                    className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: ASIGNACIÓN DE MEDIOS DE PAGO Y DESEMBOLSO */}
          {step === "step2_desembolso" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Medios de Pago & Desembolsos Físicos / Bancarios
                  </h3>
                  <p className="text-xs text-slate-400">
                    Soporta pago multimedio: Bóveda Central, Fondo Fijo (Caja Chica), Transferencias SIPAP, Cheques Diferidos y Notas de Crédito.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addDisbursementRow}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-rose-400" /> Agregar Medio
                </button>
              </div>

              {/* BARRA DE DISPONIBILIDAD DE FONDOS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-900 text-white text-xs border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bóveda Central</span>
                  <span className="font-mono font-bold text-emerald-400">{formatPYG(vaultBalance)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cuentas Bancarias</span>
                  <span className="font-mono font-bold text-blue-400">{bankAccounts.length} disponibles</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Fondos Fijos</span>
                  <span className="font-mono font-bold text-amber-400">{pettyCashFunds.length} activos</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Notas Crédito Disp.</span>
                  <span className="font-mono font-bold text-purple-400">{creditNotes.length} comprobantes</span>
                </div>
              </div>

              {/* LISTA DE RENGLONES DE DESEMBOLSO */}
              <div className="space-y-3">
                {disbursements.map((d, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                      <span className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4" /> Medio de Pago #{index + 1}
                      </span>
                      {disbursements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDisbursementRow(index)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition"
                          title="Eliminar este renglón"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* TIPO DE MEDIO DE PAGO */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Forma de Pago *</label>
                        <select
                          value={d.forma_pago}
                          onChange={e => updateDisbursementRow(index, { forma_pago: e.target.value as any })}
                          className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                        >
                          <option value="transferencia">🏦 Banco - Transferencia SIPAP</option>
                          <option value="cheque">📜 Banco - Cheque Emitido (Al día o Diferido)</option>
                          <option value="boveda">🔒 Efectivo Bóveda Central</option>
                          <option value="fondo_fijo">💼 Efectivo Fondo Fijo (Caja Chica)</option>
                          <option value="nota_credito">📄 Nota de Crédito (Saldo a Favor)</option>
                        </select>
                      </div>

                      {/* IMPORTE PYG */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Importe en Guaraníes (₲) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={d.monto}
                          onChange={e => updateDisbursementRow(index, { monto: Number(e.target.value) || 0 })}
                          className="w-full p-2 text-xs font-mono font-black text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-right"
                        />
                      </div>

                      {/* DETALLES DINÁMICOS SEGÚN MEDIO DE PAGO */}
                      {d.forma_pago === "transferencia" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cuenta Bancaria de Débito *</label>
                          <select
                            value={d.bank_account_id || ""}
                            onChange={e => updateDisbursementRow(index, { bank_account_id: e.target.value })}
                            className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="">Seleccione cuenta...</option>
                            {bankAccounts.map((b: any) => (
                              <option key={b.id} value={b.id}>
                                {b.alias ? `[${b.alias}] ` : ""}{b.banco} ({b.numero_cuenta})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {d.forma_pago === "boveda" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Validación de Saldo</label>
                          <div className={`p-2 rounded-xl text-xs font-mono font-bold ${
                            vaultBalance >= d.monto ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
                          }`}>
                            Disponible: {formatPYG(vaultBalance)}
                          </div>
                        </div>
                      )}

                      {d.forma_pago === "fondo_fijo" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fondo Fijo (Caja Chica) *</label>
                          <select
                            value={d.petty_cash_fund_id || ""}
                            onChange={e => updateDisbursementRow(index, { petty_cash_fund_id: e.target.value })}
                            className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="">Seleccione fondo...</option>
                            {pettyCashFunds.map((f: any) => (
                              <option key={f.id} value={f.id}>
                                {f.nombre} (Saldo: {formatPYG(f.saldo_actual)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {d.forma_pago === "nota_credito" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nota de Crédito a Aplicar *</label>
                          <select
                            value={d.credit_note_id || ""}
                            onChange={e => updateDisbursementRow(index, { credit_note_id: e.target.value })}
                            className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value="">Seleccione NC...</option>
                            {creditNotes.map((nc: any) => (
                              <option key={nc.id} value={nc.id}>
                                NC N° {nc.numero} — Disp: {formatPYG(nc.saldo_disponible ?? nc.monto)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* CAMPOS PARA CHEQUES (OPCIÓN A: EMITIR O VINCULAR CHEQUE COMPARTIDO) */}
                      {d.forma_pago === "cheque" && (
                        <div className="sm:col-span-3 space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                          {/* CONMUTADOR DE MODO: EMITIR O VINCULAR */}
                          <div className="flex flex-wrap items-center gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                              <input
                                type="radio"
                                checked={!d.is_shared_cheque}
                                onChange={() => updateDisbursementRow(index, {
                                  is_shared_cheque: false,
                                  cheque_id: undefined,
                                })}
                              />
                              <span>Emitir Cheque Nuevo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
                              <input
                                type="radio"
                                checked={!!d.is_shared_cheque}
                                onChange={() => updateDisbursementRow(index, {
                                  is_shared_cheque: true,
                                })}
                              />
                              <span>Vincular a Cheque Compartido con Saldo ({availableCheques.length} disponibles)</span>
                            </label>
                          </div>

                          {d.is_shared_cheque ? (
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Seleccionar Cheque Emitido con Saldo Remanente *
                              </label>
                              {availableCheques.length === 0 ? (
                                <p className="text-xs text-amber-500 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                                  No hay cheques emitidos con saldo disponible actualmente. Seleccioná "Emitir Cheque Nuevo".
                                </p>
                              ) : (
                                <select
                                  value={d.cheque_id || ""}
                                  onChange={e => {
                                    const chId = e.target.value
                                    const ch = availableCheques.find((c: any) => c.id === chId)
                                    if (ch) {
                                      updateDisbursementRow(index, {
                                        cheque_id: ch.id,
                                        numero_cheque: ch.numero,
                                        banco_cheque: ch.banco_emisor,
                                        bank_account_id: ch.bank_account_id,
                                        titular_cheque: ch.beneficiario,
                                        fecha_cheque_vencimiento: ch.fecha_pago,
                                        es_cheque_diferido: ch.diferido,
                                      })
                                    } else {
                                      updateDisbursementRow(index, { cheque_id: undefined })
                                    }
                                  }}
                                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                  required
                                >
                                  <option value="">Seleccione cheque emitido...</option>
                                  {availableCheques.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      Cheque N° {c.numero} ({c.banco_emisor}) — Titular: {c.beneficiario} | Disp: {formatPYG(c.saldo_disponible)} (Total: {formatPYG(c.monto_total)}) - Venc: {formatDate(c.fecha_pago)}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {d.cheque_id && (
                                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                                  <span>Cheque N° <strong>{d.numero_cheque}</strong> ({d.banco_cheque}) asignado a esta orden.</span>
                                  <span>{d.es_cheque_diferido ? `Diferido al ${formatDate(d.fecha_cheque_vencimiento)}` : "Al Día"}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° de Cheque *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: 0048192"
                                  value={d.numero_cheque || ""}
                                  onChange={e => updateDisbursementRow(index, { numero_cheque: e.target.value })}
                                  className="w-full p-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Banco Emisor / Cuenta</label>
                                <select
                                  value={d.bank_account_id || ""}
                                  onChange={e => {
                                    const acc = bankAccounts.find((b: any) => b.id === e.target.value)
                                    updateDisbursementRow(index, {
                                      bank_account_id: e.target.value,
                                      banco_cheque: acc ? acc.banco : undefined
                                    })
                                  }}
                                  className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                >
                                  <option value="">Seleccionar banco...</option>
                                  {bankAccounts.map((b: any) => (
                                    <option key={b.id} value={b.id}>
                                      {b.banco} — Cuenta: {b.numero_cuenta}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modalidad de Cheque</label>
                                <div className="flex items-center gap-3 pt-1">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      checked={!d.es_cheque_diferido}
                                      onChange={() => updateDisbursementRow(index, {
                                        es_cheque_diferido: false,
                                        fecha_cheque_vencimiento: d.fecha_cheque_emision || fechaPago
                                      })}
                                    />
                                    <span className="text-xs font-bold">Al Día</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      checked={d.es_cheque_diferido}
                                      onChange={() => updateDisbursementRow(index, { es_cheque_diferido: true })}
                                    />
                                    <span className="text-xs font-bold text-rose-500">Diferido</span>
                                  </label>
                                </div>
                              </div>
                              {d.es_cheque_diferido && (
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Cobro / Vencimiento *</label>
                                  <input
                                    type="date"
                                    required
                                    value={d.fecha_cheque_vencimiento || ""}
                                    onChange={e => updateDisbursementRow(index, { fecha_cheque_vencimiento: e.target.value })}
                                    className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Beneficiario / Titular</label>
                                <input
                                  type="text"
                                  value={d.titular_cheque || ""}
                                  onChange={e => updateDisbursementRow(index, { titular_cheque: e.target.value })}
                                  className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                />
                              </div>

                              {/* OPCIÓN CHEQUE MATRIZ COMPARTIDO */}
                              <div className="sm:col-span-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={!!d.is_master_cheque}
                                    onChange={e => {
                                      const checked = e.target.checked
                                      updateDisbursementRow(index, {
                                        is_master_cheque: checked,
                                        monto_total_cheque: checked ? (d.monto_total_cheque || d.monto) : undefined,
                                      })
                                    }}
                                  />
                                  <span>¿Es un Cheque Matriz Compartido? (El cheque físico tiene un monto mayor para compartir con otras órdenes)</span>
                                </label>

                                {d.is_master_cheque && (
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                                    <div>
                                      <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                                        Monto Nominal Total del Cheque Físico (₲) *
                                      </label>
                                      <input
                                        type="number"
                                        min={d.monto}
                                        value={d.monto_total_cheque || d.monto}
                                        onChange={e => updateDisbursementRow(index, { monto_total_cheque: Number(e.target.value) || d.monto })}
                                        className="w-full p-2 text-xs font-mono font-black text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl"
                                      />
                                    </div>
                                    <div className="flex items-center text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                      Esta OP consumirá <strong>{formatPYG(d.monto)}</strong>. El remanente de <strong>{formatPYG(Math.max(0, (d.monto_total_cheque || d.monto) - d.monto))}</strong> quedará disponible para vincular a otras OPs.
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {d.forma_pago === "transferencia" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Comprobante / Ref. SIPAP</label>
                          <input
                            type="text"
                            placeholder="Ref. bancaria"
                            value={d.referencia_transferencia || ""}
                            onChange={e => updateDisbursementRow(index, { referencia_transferencia: e.target.value })}
                            className="w-full p-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* RESUMEN DE CUADRE EN VIVO */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
                summaryDesembolsos.cuadra
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              }`}>
                <div className="flex items-center gap-2.5">
                  {summaryDesembolsos.cuadra ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {summaryDesembolsos.cuadra
                        ? "Cuadre Financiero Exacto (100% Cubierto)"
                        : summaryDesembolsos.diferencia > 0
                          ? `Falta asignar fondos: ${formatPYG(summaryDesembolsos.diferencia)}`
                          : `Monto asignado excede el neto por: ${formatPYG(Math.abs(summaryDesembolsos.diferencia))}`}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Total Neto Requerido: <b>{formatPYG(summaryFacturas.neto)}</b> · Total Desembolsos: <b>{formatPYG(summaryDesembolsos.total)}</b>
                    </p>
                  </div>
                </div>

                {!summaryDesembolsos.cuadra && summaryDesembolsos.diferencia > 0 && (
                  <button
                    type="button"
                    onClick={addDisbursementRow}
                    className="text-xs font-bold px-3 py-1.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition shrink-0"
                  >
                    Cubrir Restante ({formatPYG(summaryDesembolsos.diferencia)})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PIE DE ACCIONES */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {step === "step1_facturas" ? (
              <span>Paso 1: Podés guardar sólo el registro o continuar a liquidar.</span>
            ) : (
              <button
                type="button"
                onClick={() => setStep("step1_facturas")}
                disabled={!!existingOrder}
                className="text-slate-600 dark:text-slate-400 hover:text-rose-500 font-bold transition flex items-center gap-1"
              >
                ← Volver a Facturas
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>

            {step === "step1_facturas" && !existingOrder && (
              <>
                <button
                  type="button"
                  onClick={handleSaveOnlyRegister}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                  title="Crea la Orden de Pago en estado 'registrado' sin mover fondos todavía"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                  Guardar como Registrado (Paso 1)
                </button>

                <button
                  type="button"
                  onClick={handleGoToStep2}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-md shadow-rose-500/20 transition flex items-center gap-1.5"
                >
                  <span>Continuar a Medios de Pago</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {step === "step2_desembolso" && (
              <button
                type="button"
                onClick={handleDisburseAndPay}
                disabled={submitting || !summaryDesembolsos.cuadra}
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg ${
                  summaryDesembolsos.cuadra && !submitting
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25"
                    : "bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Liquidar Pago (₲ {formatPYG(summaryFacturas.neto)})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
