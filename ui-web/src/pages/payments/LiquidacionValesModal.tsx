import React, { useState, useEffect, useMemo } from "react"
import {
  X, Check, AlertTriangle, Plus, Trash2, CreditCard,
  Building2, Wallet, FileText, Calendar, CheckCircle2,
  DollarSign, Loader2, Apple, CheckSquare, Square, Download,
  Receipt, ArrowRight, ShieldCheck, Info
} from "lucide-react"
import { api } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import { useToast } from "../../context/ToastContext"


interface UnbilledReception {
  id: string
  numero: string
  proveedor_ref: string
  supplier_id: string
  supplier_nombre: string
  supplier_ruc: string
  fecha: string
  total: number
  observaciones: string
  estado: string
}

interface ManualVale {
  id: string
  descripcion: string
  numero_vale: string
  monto: number
  fecha: string
}

interface Props {
  suppliers: any[]
  initialSupplierId?: string | null
  onClose: () => void
  onSuccess: (result: any) => void
}

export default function LiquidacionValesModal({
  suppliers,
  initialSupplierId,
  onClose,
  onSuccess,
}: Props) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Proveedor seleccionado
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || "")
  const [unbilledReceptions, setUnbilledReceptions] = useState<UnbilledReception[]>([])
  const [loadingReceptions, setLoadingReceptions] = useState(false)
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([])

  // Vales manuales complementarios
  const [manualVales, setManualVales] = useState<ManualVale[]>([])
  const [showAddManualVale, setShowAddManualVale] = useState(false)
  const [newManualDesc, setNewManualDesc] = useState("")
  const [newManualNum, setNewManualNum] = useState("")
  const [newManualMonto, setNewManualMonto] = useState("")
  const [newManualFecha, setNewManualFecha] = useState(new Date().toISOString().split("T")[0])

  // Factura Legal que entrega el proveedor en el acto
  const [numeroFactura, setNumeroFactura] = useState("")
  const [timbrado, setTimbrado] = useState("")
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split("T")[0])
  const [condicion, setCondicion] = useState<"contado" | "credito">("contado")
  const [montoFacturaManual, setMontoFacturaManual] = useState<number | null>(null)

  // Desembolso / Medio de Pago en ventanilla
  const [formaPago, setFormaPago] = useState<"boveda" | "fondo_fijo" | "cheque" | "transferencia">("boveda")
  const [bankAccountId, setBankAccountId] = useState("")
  const [pettyCashFundId, setPettyCashFundId] = useState("")
  const [referenciaTransferencia, setReferenciaTransferencia] = useState("")

  // Cheque
  const [useExistingCheque, setUseExistingCheque] = useState(false)
  const [selectedChequeId, setSelectedChequeId] = useState("")
  const [numeroCheque, setNumeroCheque] = useState("")
  const [bancoCheque, setBancoCheque] = useState("")
  const [titularCheque, setTitularCheque] = useState("")
  const [fechaChequeEmision, setFechaChequeEmision] = useState(new Date().toISOString().split("T")[0])
  const [fechaChequeVencimiento, setFechaChequeVencimiento] = useState(new Date().toISOString().split("T")[0])
  const [esChequeDiferido, setEsChequeDiferido] = useState(false)

  // Datos de tesorería y auxiliares
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [pettyCashFunds, setPettyCashFunds] = useState<any[]>([])
  const [availableCheques, setAvailableCheques] = useState<any[]>([])
  const [vaultBalance, setVaultBalance] = useState<number>(0)
  const [observaciones, setObservaciones] = useState("")

  // Cargar datos auxiliares al abrir
  useEffect(() => {
    let mounted = true
    async function loadAux() {
      try {
        const [banksRes, fundsRes, chequesRes, vaultRes] = await Promise.allSettled([
          api.financial.banks.list(),
          api.expenses.funds.list({ activo: true }),
          api.financial.paymentOrders.getChequesDisponibles(),
          api.vault.dashboard(),
        ])

        if (!mounted) return
        if (banksRes.status === "fulfilled" && Array.isArray(banksRes.value)) {
          setBankAccounts(banksRes.value)
          if (banksRes.value.length > 0) {
            setBankAccountId(banksRes.value[0].id)
            setBancoCheque(banksRes.value[0].banco || "")
          }
        }
        if (fundsRes.status === "fulfilled" && Array.isArray(fundsRes.value)) {
          setPettyCashFunds(fundsRes.value)
          if (fundsRes.value.length > 0) {
            setPettyCashFundId(fundsRes.value[0].id)
          }
        }
        if (chequesRes.status === "fulfilled" && Array.isArray(chequesRes.value)) {
          setAvailableCheques(chequesRes.value)
        }
        if (vaultRes.status === "fulfilled" && vaultRes.value) {
          setVaultBalance(Number(vaultRes.value.saldo_en_boveda_pyg || 0))
        }
      } catch (e) {
        console.error("Error al cargar datos de tesorería", e)
      }
    }
    loadAux()
    return () => { mounted = false }
  }, [])

  // Cargar recepciones no facturadas cuando cambia el proveedor seleccionado
  useEffect(() => {
    if (!selectedSupplierId) {
      setUnbilledReceptions([])
      setSelectedReceiptIds([])
      return
    }

    const sup = suppliers.find(s => s.id === selectedSupplierId)
    if (sup) {
      setTitularCheque(sup.razon_social || sup.nombre || "")
    }

    let mounted = true
    async function fetchUnbilled() {
      setLoadingReceptions(true)
      try {
        const res = await api.financial.receptions.unbilled({ supplier_id: selectedSupplierId })
        if (!mounted) return
        setUnbilledReceptions(res || [])
        // Seleccionar todas por defecto
        setSelectedReceiptIds((res || []).map((r: any) => r.id))
      } catch (err: any) {
        toast.error("Error al buscar recepciones", err.message || String(err))
      } finally {
        if (mounted) setLoadingReceptions(false)
      }
    }
    fetchUnbilled()
    return () => { mounted = false }
  }, [selectedSupplierId, suppliers])

  // Total de vales de depósito seleccionados
  const totalValesDeposito = useMemo(() => {
    return unbilledReceptions
      .filter(r => selectedReceiptIds.includes(r.id))
      .reduce((sum, r) => sum + Number(r.total || 0), 0)
  }, [unbilledReceptions, selectedReceiptIds])

  // Total de vales manuales
  const totalValesManuales = useMemo(() => {
    return manualVales.reduce((sum, v) => sum + Number(v.monto || 0), 0)
  }, [manualVales])

  // Total consolidado de entregas
  const totalEntregasCalculado = totalValesDeposito + totalValesManuales

  // Monto final de la Factura (si el usuario lo ajustó manualmente por redondeo, usa ese)
  const montoFacturaFinal = montoFacturaManual !== null ? montoFacturaManual : totalEntregasCalculado

  const toggleSelectReceipt = (id: string) => {
    setSelectedReceiptIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllReceipts = () => {
    if (selectedReceiptIds.length === unbilledReceptions.length) {
      setSelectedReceiptIds([])
    } else {
      setSelectedReceiptIds(unbilledReceptions.map(r => r.id))
    }
  }

  const handleAddManualVale = () => {
    const monto = Number(newManualMonto)
    if (!monto || monto <= 0) {
      toast.error("Monto inválido", "El monto del vale debe ser mayor a 0.")
      return
    }
    setManualVales(prev => [
      ...prev,
      {
        id: `manual_${Date.now()}`,
        descripcion: newManualDesc || "Entrega diaria / Vale",
        numero_vale: newManualNum || "S/N",
        monto,
        fecha: newManualFecha,
      }
    ])
    setNewManualDesc("")
    setNewManualNum("")
    setNewManualMonto("")
    setShowAddManualVale(false)
  }

  const handleRemoveManualVale = (id: string) => {
    setManualVales(prev => prev.filter(v => v.id !== id))
  }

  // Ejecutar liquidación atómica en ventanilla
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSupplierId) {
      toast.error("Seleccione Proveedor", "Debe indicar qué proveedor está cobrando.")
      return
    }

    if (selectedReceiptIds.length === 0 && manualVales.length === 0) {
      toast.error("Sin Vales", "Debe seleccionar al menos una recepción o agregar un vale.")
      return
    }

    if (!numeroFactura.trim()) {
      toast.error("N° de Factura Requerido", "Debe ingresar el número de la factura legal que entrega el proveedor.")
      return
    }

    if (montoFacturaFinal <= 0) {
      toast.error("Monto Inválido", "El monto de la factura debe ser mayor a 0.")
      return
    }

    // Validar disponibilidad según medio de pago
    if (formaPago === "boveda" && vaultBalance < montoFacturaFinal) {
      toast.error(
        "Saldo Insuficiente en Bóveda",
        `Bóveda Central solo dispone de ${formatPYG(vaultBalance)}. Requerido: ${formatPYG(montoFacturaFinal)}`
      )
      return
    }

    if (formaPago === "fondo_fijo") {
      const fund = pettyCashFunds.find(f => f.id === pettyCashFundId)
      if (fund && fund.saldo_actual < montoFacturaFinal) {
        toast.error(
          "Saldo Insuficiente en Caja Chica",
          `El Fondo Fijo '${fund.nombre}' solo dispone de ${formatPYG(fund.saldo_actual)}. Requerido: ${formatPYG(montoFacturaFinal)}`
        )
        return
      }
    }

    if (formaPago === "cheque") {
      if (useExistingCheque) {
        if (!selectedChequeId) {
          toast.error("Cheque no seleccionado", "Debe seleccionar el cheque emitido con saldo.")
          return
        }
        const ch = availableCheques.find(c => c.id === selectedChequeId)
        if (ch && ch.saldo_disponible < montoFacturaFinal) {
          toast.error("Saldo insuficiente en Cheque", `El cheque solo dispone de ${formatPYG(ch.saldo_disponible)}.`)
          return
        }
      } else {
        if (!numeroCheque.trim()) {
          toast.error("Número de Cheque", "Debe ingresar el número del cheque a emitir.")
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        supplier_id: selectedSupplierId,
        receipt_ids: selectedReceiptIds,
        vales_adicionales: manualVales.map(v => ({
          descripcion: v.descripcion,
          numero_vale: v.numero_vale,
          monto: v.monto,
          fecha: v.fecha,
        })),
        numero_factura: numeroFactura.trim(),
        timbrado: timbrado.trim() || undefined,
        fecha_factura: fechaFactura,
        condicion,
        monto_total_factura: montoFacturaFinal,
        forma_pago: formaPago,
        bank_account_id: formaPago === "transferencia" || (formaPago === "cheque" && !useExistingCheque) ? bankAccountId : undefined,
        petty_cash_fund_id: formaPago === "fondo_fijo" ? pettyCashFundId : undefined,
        referencia_transferencia: formaPago === "transferencia" ? referenciaTransferencia : undefined,
        cheque_id: formaPago === "cheque" && useExistingCheque ? selectedChequeId : undefined,
        numero_cheque: formaPago === "cheque" && !useExistingCheque ? numeroCheque : undefined,
        banco_cheque: formaPago === "cheque" && !useExistingCheque ? bancoCheque : undefined,
        titular_cheque: formaPago === "cheque" && !useExistingCheque ? titularCheque : undefined,
        fecha_cheque_emision: formaPago === "cheque" && !useExistingCheque ? fechaChequeEmision : undefined,
        fecha_cheque_vencimiento: formaPago === "cheque" && !useExistingCheque ? (esChequeDiferido ? fechaChequeVencimiento : fechaChequeEmision) : undefined,
        es_cheque_diferido: formaPago === "cheque" && !useExistingCheque ? esChequeDiferido : false,
        observaciones: observaciones.trim() || undefined,
      }

      const res = await api.financial.receptions.settleAndPay(payload)

      toast.success(
        "Liquidación Exitosa",
        `Se registró la Factura ${res.numero_factura} y se emitió la Orden de Pago ${res.numero_orden} por ${formatPYG(res.monto_total)}.`
      )

      // Descarga automática del recibo oficial de pago en PDF
      if (res.order_id && res.numero_orden) {
        api.financial.paymentOrders.downloadPdf(res.order_id, res.numero_orden)
      }

      onSuccess(res)
    } catch (err: any) {
      toast.error("Error al liquidar vales", err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* CABECERA */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-5 sm:p-6 text-white flex items-center justify-between border-b border-emerald-600/30">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Apple className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Liquidación de Vales / Frutihorti en Ventanilla
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                  Factura & Pago en el Acto
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Concilia las notas de control interno de depósito, carga la Factura Legal del proveedor y desembolsa de inmediato.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO DEL FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* PASO 1: SELECCIÓN DEL PROVEEDOR */}
          <div className="bg-slate-50 dark:bg-slate-850/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              1. Seleccionar Proveedor Frutihorti / Productor *
            </label>
            <select
              value={selectedSupplierId}
              onChange={e => {
                setSelectedSupplierId(e.target.value)
                setManualVales([])
                setMontoFacturaManual(null)
              }}
              className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
              required
            >
              <option value="">Seleccione proveedor a liquidar...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.razon_social || s.nombre} {s.ruc ? `(RUC: ${s.ruc})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* PASO 2: VALES DE CONTROL INTERNO / RECEPCIONES DE DEPÓSITO */}
          {selectedSupplierId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">
                    2. Notas de Recepción / Vales Pendientes ({unbilledReceptions.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddManualVale(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 transition text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                    <span>+ Vale Manual</span>
                  </button>
                  {unbilledReceptions.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllReceipts}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold transition text-[11px]"
                    >
                      {selectedReceiptIds.length === unbilledReceptions.length ? "Desmarcar Todos" : "Marcar Todos"}
                    </button>
                  )}
                </div>
              </div>

              {/* LISTA DE RECEPCIONES */}
              {loadingReceptions ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p>Buscando recepciones pendientes...</p>
                </div>
              ) : unbilledReceptions.length === 0 && manualVales.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-bold">No hay recepciones de depósito pendientes para este proveedor</p>
                  <p className="mt-1">Podés agregar un vale manual con el botón "+ Vale Manual" si trajo el remito en papel.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-850 text-slate-400 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5 w-10 text-center">Cobrar</th>
                          <th className="p-2.5">Fecha Entrega</th>
                          <th className="p-2.5">N° Vale / Remisión</th>
                          <th className="p-2.5">N° Recepción Interna</th>
                          <th className="p-2.5 text-right">Monto Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {unbilledReceptions.map(rc => {
                          const isSelected = selectedReceiptIds.includes(rc.id)
                          return (
                            <tr
                              key={rc.id}
                              onClick={() => toggleSelectReceipt(rc.id)}
                              className={`cursor-pointer transition ${
                                isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                              }`}
                            >
                              <td className="p-2.5 text-center">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 inline" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 inline" />
                                )}
                              </td>
                              <td className="p-2.5 font-mono">{formatDate(rc.fecha)}</td>
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100 font-mono">
                                {rc.proveedor_ref || "Sin N° (Control Interno)"}
                              </td>
                              <td className="p-2.5 text-slate-500 font-mono">{rc.numero}</td>
                              <td className="p-2.5 text-right font-black text-slate-900 dark:text-white font-mono">
                                {formatPYG(rc.total)}
                              </td>
                            </tr>
                          )
                        })}

                        {/* VALES MANUALES ADICIONALES */}
                        {manualVales.map(mv => (
                          <tr key={mv.id} className="bg-amber-50/40 dark:bg-amber-950/20 border-l-4 border-amber-500">
                            <td className="p-2.5 text-center">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Manual</span>
                            </td>
                            <td className="p-2.5 font-mono">{formatDate(mv.fecha)}</td>
                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100 font-mono">
                              Vale #{mv.numero_vale} ({mv.descripcion})
                            </td>
                            <td className="p-2.5 text-slate-400 font-mono">-</td>
                            <td className="p-2.5 text-right font-black text-amber-700 dark:text-amber-400 font-mono">
                              {formatPYG(mv.monto)}
                              <button
                                type="button"
                                onClick={() => handleRemoveManualVale(mv.id)}
                                className="ml-2 text-slate-400 hover:text-red-500 p-0.5"
                                title="Eliminar vale manual"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* BARRA DE TOTALIZACIÓN DE VALES */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">
                      {selectedReceiptIds.length + manualVales.length} entrega(s) seleccionada(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400">Total Liquidación:</span>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatPYG(totalEntregasCalculado)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: DATOS DE LA FACTURA LEGAL EMITIDA EN EL ACTO */}
          {selectedSupplierId && (
            <div className="bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> 3. Factura Legal que Entrega en Mostrador *
                </span>
                <span className="text-[10px] text-slate-400">
                  Emitida por el proveedor para amparar las entregas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    N° Factura Legal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 001-002-0004512"
                    value={numeroFactura}
                    onChange={e => setNumeroFactura(e.target.value)}
                    className="w-full p-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Timbrado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 18545636"
                    value={timbrado}
                    onChange={e => setTimbrado(e.target.value)}
                    className="w-full p-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Fecha Factura *
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaFactura}
                    onChange={e => setFechaFactura(e.target.value)}
                    className="w-full p-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Condición
                  </label>
                  <select
                    value={condicion}
                    onChange={e => setCondicion(e.target.value as any)}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Monto Total de la Factura (₲) *
                  </label>
                  <div className="flex items-center gap-2">
                    <CurrencyInput
                      required
                      currency="PYG"
                      value={montoFacturaFinal}
                      onChangeValue={(num) => setMontoFacturaManual(num || 0)}
                      className="w-full p-2 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-right"
                    />
                    {montoFacturaManual !== null && montoFacturaManual !== totalEntregasCalculado && (
                      <button
                        type="button"
                        onClick={() => setMontoFacturaManual(null)}
                        className="px-2.5 py-2 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 rounded-xl hover:bg-slate-300"
                        title="Restablecer al total de los vales"
                      >
                        Resetear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: FORMA DE DESEMBOLSO / PAGO INMEDIATO */}
          {selectedSupplierId && (
            <div className="bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" /> 4. Medio de Pago en Ventanilla *
                </span>
                <span className="text-[10px] text-slate-400">
                  Desembolso inmediato en el acto de entrega de la factura
                </span>
              </div>

              {/* SELECTOR MEDIO */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                  formaPago === "boveda" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}>
                  <input type="radio" checked={formaPago === "boveda"} onChange={() => setFormaPago("boveda")} />
                  <span>🔒 Bóveda Central</span>
                </label>

                <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                  formaPago === "fondo_fijo" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}>
                  <input type="radio" checked={formaPago === "fondo_fijo"} onChange={() => setFormaPago("fondo_fijo")} />
                  <span>💼 Caja Chica</span>
                </label>

                <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                  formaPago === "cheque" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}>
                  <input type="radio" checked={formaPago === "cheque"} onChange={() => setFormaPago("cheque")} />
                  <span>📜 Cheque</span>
                </label>

                <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                  formaPago === "transferencia" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}>
                  <input type="radio" checked={formaPago === "transferencia"} onChange={() => setFormaPago("transferencia")} />
                  <span>🏦 SIPAP</span>
                </label>
              </div>

              {/* CAMPOS SEGÚN FORMA */}
              {formaPago === "boveda" && (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold">Efectivo de Bóveda Central</p>
                    <p className="text-[11px] text-slate-400">Se registrará el egreso formal para el arqueo de tesorería</p>
                  </div>
                  <span className={`p-2 rounded-lg font-mono font-bold ${
                    vaultBalance >= montoFacturaFinal ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-red-500 bg-red-50"
                  }`}>
                    Disponible: {formatPYG(vaultBalance)}
                  </span>
                </div>
              )}

              {formaPago === "fondo_fijo" && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Caja Chica *</label>
                  <select
                    value={pettyCashFundId}
                    onChange={e => setPettyCashFundId(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {pettyCashFunds.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nombre} — Saldo: {formatPYG(f.saldo_actual)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formaPago === "cheque" && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                  <div className="flex items-center gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input type="radio" checked={!useExistingCheque} onChange={() => setUseExistingCheque(false)} />
                      <span>Emitir Cheque Nuevo</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-600 dark:text-emerald-400">
                      <input type="radio" checked={useExistingCheque} onChange={() => setUseExistingCheque(true)} />
                      <span>Vincular Cheque con Saldo ({availableCheques.length} disponibles)</span>
                    </label>
                  </div>

                  {useExistingCheque ? (
                    <select
                      value={selectedChequeId}
                      onChange={e => setSelectedChequeId(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                    >
                      <option value="">Seleccionar cheque con saldo...</option>
                      {availableCheques.map(c => (
                        <option key={c.id} value={c.id}>
                          Cheque N° {c.numero} ({c.banco_emisor}) — Titular: {c.beneficiario} | Disp: {formatPYG(c.saldo_disponible)} (Venc: {formatDate(c.fecha_pago)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Cheque *</label>
                        <input
                          type="text"
                          placeholder="Ej: 0049102"
                          value={numeroCheque}
                          onChange={e => setNumeroCheque(e.target.value)}
                          className="w-full p-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Banco / Cuenta</label>
                        <select
                          value={bankAccountId}
                          onChange={e => {
                            setBankAccountId(e.target.value)
                            const b = bankAccounts.find(x => x.id === e.target.value)
                            if (b) setBancoCheque(b.banco)
                          }}
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                        >
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.banco} ({b.numero_cuenta})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modalidad</label>
                        <div className="flex items-center gap-3 pt-1.5">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" checked={!esChequeDiferido} onChange={() => setEsChequeDiferido(false)} />
                            <span>Al Día</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" checked={esChequeDiferido} onChange={() => setEsChequeDiferido(true)} />
                            <span className="text-rose-500 font-bold">Diferido</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formaPago === "transferencia" && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cuenta Débito *</label>
                    <select
                      value={bankAccountId}
                      onChange={e => setBankAccountId(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.banco} ({b.numero_cuenta}) — Saldo: {formatPYG(b.saldo_actual)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Referencia SIPAP</label>
                    <input
                      type="text"
                      placeholder="Ej: SIPAP-2026-98124"
                      value={referenciaTransferencia}
                      onChange={e => setReferenciaTransferencia(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TOTAL FINAL & BOTONES DE ACCIÓN */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Liquidación a Desembolsar</p>
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                {formatPYG(montoFacturaFinal)}
              </p>
              <p className="text-[11px] text-slate-400">
                Genera Factura formal + OP cancelada + Descarga automática de Recibo en PDF.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedSupplierId || montoFacturaFinal <= 0}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Liquidando en Ventanilla...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registrar Factura y Pagar en el Acto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SUB-MODAL: AGREGAR VALE MANUAL */}
      {showAddManualVale && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Agregar Vale Manual / Manuscrito</h4>
              <button onClick={() => setShowAddManualVale(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° Vale / Remito</label>
                <input
                  type="text"
                  placeholder="Ej: Vale 104 o Remito 0092"
                  value={newManualNum}
                  onChange={e => setNewManualNum(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Descripción de la Entrega</label>
                <input
                  type="text"
                  placeholder="Ej: 20 cajones lechuga + 10 bolsas mandioca"
                  value={newManualDesc}
                  onChange={e => setNewManualDesc(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monto del Vale (₲) *</label>
                <CurrencyInput
                  required
                  currency="PYG"
                  placeholder="Ej: 450.000"
                  value={newManualMonto}
                  onChangeValue={(num, formatted) => setNewManualMonto(String(num))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-right"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha de la Entrega</label>
                <input
                  type="date"
                  value={newManualFecha}
                  onChange={e => setNewManualFecha(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddManualVale(false)}
                className="px-3 py-1.5 rounded-xl border text-slate-600 dark:text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddManualVale}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Agregar Vale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
