import React, { useState, useEffect } from "react"
import {
  X, Check, AlertCircle, Loader2, DollarSign, Building2, Wallet,
  Landmark, CreditCard, Plus, Trash2, ShieldCheck, ArrowRight, Clock,
  Calendar, FileText, CheckCircle2
} from "lucide-react"
import { api, type Expense, type BankAccount, type PettyCashFund } from "../../api"
import { formatPYG, getTodayAsuncion } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import { useToast } from "../../context/ToastContext"


interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  expense: Expense | null
}

interface DisbursementRow {
  id: string
  medio_pago: "boveda" | "fondo_fijo" | "transferencia" | "cheque" | "otro"
  monto: string
  moneda?: "PYG" | "BRL"
  monto_brl?: string
  tipo_cambio?: string
  bank_account_id?: string
  petty_cash_fund_id?: string
  numero_comprobante?: string
  fecha_efectiva?: string
  // Cheque
  banco_cheque?: string
  numero_cheque?: string
  fecha_cheque_emision?: string
  fecha_cheque_vencimiento?: string
  titular_cheque?: string
  es_cheque_diferido?: boolean
}

export function ExpensePaymentModal({ isOpen, onClose, onSuccess, expense }: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Datos financieros del sistema
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [funds, setFunds] = useState<PettyCashFund[]>([])
  const [vaultBalance, setVaultBalance] = useState<number>(0)
  const [vaultBalanceBRL, setVaultBalanceBRL] = useState<number>(0)

  // Formulario
  const [fechaPago, setFechaPago] = useState(getTodayAsuncion())
  const [notas, setNotas] = useState("")
  const [disbursements, setDisbursements] = useState<DisbursementRow[]>([])

  useEffect(() => {
    if (isOpen && expense) {
      setFechaPago(getTodayAsuncion())
      setNotas("")
      loadInitialData()
    }
  }, [isOpen, expense])

  const loadInitialData = async () => {
    if (!expense) return
    setLoading(true)
    try {
      const [banksRes, fundsRes, vaultRes] = await Promise.all([
        api.financial.banks.list().catch(() => []),
        api.expenses.funds.list({ activo: true }).catch(() => []),
        api.vault.dashboard().catch(() => ({ saldo_en_boveda_pyg: 0, saldo_en_boveda_brl: 0 } as any)),
      ])

      const activeBanks = (banksRes || []).filter((b: any) => b.activo)
      const activeFunds = (fundsRes || []).filter((f: any) => f.activo)
      setBankAccounts(activeBanks)
      setFunds(activeFunds)
      setVaultBalance(Number((vaultRes as any)?.saldo_en_boveda_pyg || (vaultRes as any)?.saldo_boveda || 0))
      setVaultBalanceBRL(Number((vaultRes as any)?.saldo_en_boveda_brl || 0))

      // Pre-cargar una fila inicial con el monto total del gasto
      const defaultFund = expense.fund_id ? activeFunds.find((f: any) => f.id === expense.fund_id) : activeFunds[0]
      const defaultBank = activeBanks[0]

      const hasBrl = Boolean(expense.monto_brl && Number(expense.monto_brl) > 0)
      let initialMedio: "boveda" | "fondo_fijo" | "transferencia" = hasBrl ? "boveda" : "fondo_fijo"
      if (!hasBrl) {
        if (expense.fund_id || defaultFund) {
          initialMedio = "fondo_fijo"
        } else if (activeBanks.length > 0) {
          initialMedio = "transferencia"
        } else {
          initialMedio = "boveda"
        }
      }

      setDisbursements([
        {
          id: Math.random().toString(),
          medio_pago: initialMedio,
          monto: String(expense.monto || 0),
          moneda: hasBrl ? "BRL" : "PYG",
          monto_brl: hasBrl ? String(expense.monto_brl) : "",
          bank_account_id: defaultBank?.id || "",
          petty_cash_fund_id: defaultFund?.id || "",
          numero_comprobante: "",
          fecha_efectiva: getTodayAsuncion(),
          banco_cheque: defaultBank?.banco || "Banco Itaú",
          numero_cheque: "",
          fecha_cheque_emision: getTodayAsuncion(),
          fecha_cheque_vencimiento: getTodayAsuncion(),
          titular_cheque: expense.proveedor || "",
          es_cheque_diferido: false,
        }
      ])
    } catch (e: any) {
      toast.error("Error al cargar cuentas y fondos", e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !expense) return null

  const montoTotalGasto = Number(expense.monto || 0)
  const totalAsignado = disbursements.reduce((acc, row) => acc + (Number(row.monto) || 0), 0)
  const diferencia = montoTotalGasto - totalAsignado
  const isBalanced = Math.abs(diferencia) < 1

  const addDisbursementRow = () => {
    const restante = Math.max(0, diferencia)
    const defaultBank = bankAccounts[0]
    const defaultFund = funds[0]

    setDisbursements([
      ...disbursements,
      {
        id: Math.random().toString(),
        medio_pago: "transferencia",
        monto: restante > 0 ? String(restante) : "0",
        bank_account_id: defaultBank?.id || "",
        petty_cash_fund_id: defaultFund?.id || "",
        numero_comprobante: "",
        fecha_efectiva: fechaPago,
        banco_cheque: defaultBank?.banco || "Banco",
        numero_cheque: "",
        fecha_cheque_emision: fechaPago,
        fecha_cheque_vencimiento: fechaPago,
        titular_cheque: expense.proveedor || "",
        es_cheque_diferido: false,
      }
    ])
  }

  const removeDisbursementRow = (index: number) => {
    if (disbursements.length <= 1) {
      toast.warning("Atención", "Debe existir al menos un medio de pago asignado.")
      return
    }
    setDisbursements(disbursements.filter((_, i) => i !== index))
  }

  const updateDisbursementRow = (index: number, updates: Partial<DisbursementRow>) => {
    setDisbursements(disbursements.map((row, i) => (i === index ? { ...row, ...updates } : row)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isBalanced) {
      toast.error("Descuadre en medios de pago", `Debe asignar exactamente ${formatPYG(montoTotalGasto)}. Diferencia: ${formatPYG(diferencia)}`)
      return
    }

    // Validar datos por medio
    for (let i = 0; i < disbursements.length; i++) {
      const row = disbursements[i]
      const m = Number(row.monto)
      if (m <= 0) {
        toast.error("Monto inválido", `La línea #${i + 1} tiene un monto menor o igual a cero.`)
        return
      }

      if (row.medio_pago === "boveda") {
        if (row.moneda === "BRL") {
          const reqBrl = Number(row.monto_brl) || (expense?.monto_brl ? Number(expense.monto_brl) : (Number(row.monto) / 1350))
          if (vaultBalanceBRL < reqBrl) {
            toast.error(
              "Saldo Bóveda R$ Insuficiente",
              `Bóveda Central solo dispone de R$ ${vaultBalanceBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Requerido: R$ ${reqBrl.toFixed(2)}`
            )
            return
          }
        } else {
          if (vaultBalance < Number(row.monto)) {
            toast.error(
              "Saldo Bóveda ₲ Insuficiente",
              `Bóveda Central solo dispone de ${formatPYG(vaultBalance)}. Requerido: ${formatPYG(Number(row.monto))}`
            )
            return
          }
        }
      }

      if (row.medio_pago === "fondo_fijo" && !row.petty_cash_fund_id) {
        toast.error("Fondo requerido", `Debe seleccionar la caja chica en la línea #${i + 1}.`)
        return
      }

      if (row.medio_pago === "transferencia" && !row.bank_account_id) {
        toast.error("Cuenta bancaria requerida", `Debe seleccionar la cuenta bancaria en la línea #${i + 1}.`)
        return
      }

      if (row.medio_pago === "cheque" && !row.numero_cheque) {
        toast.error("Cheque incompleto", `Debe ingresar el número de cheque en la línea #${i + 1}.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        fecha_pago: fechaPago,
        notas: notas || undefined,
        disbursements: disbursements.map(row => ({
          medio_pago: row.medio_pago,
          monto: Number(row.monto),
          moneda: row.medio_pago === "boveda" ? (row.moneda || "PYG") : "PYG",
          monto_moneda: row.medio_pago === "boveda" && row.moneda === "BRL"
            ? (Number(row.monto_brl) || (expense?.monto_brl ? Number(expense.monto_brl) : undefined))
            : undefined,
          bank_account_id: (row.medio_pago === "transferencia" || row.medio_pago === "cheque") ? (row.bank_account_id || undefined) : undefined,
          petty_cash_fund_id: row.medio_pago === "fondo_fijo" ? (row.petty_cash_fund_id || undefined) : undefined,
          numero_comprobante: row.numero_comprobante || undefined,
          fecha_efectiva: row.fecha_efectiva || fechaPago,
          banco_cheque: row.medio_pago === "cheque" ? (row.banco_cheque || undefined) : undefined,
          numero_cheque: row.medio_pago === "cheque" ? (row.numero_cheque || undefined) : undefined,
          fecha_cheque_emision: row.medio_pago === "cheque" ? (row.fecha_cheque_emision || fechaPago) : undefined,
          fecha_cheque_vencimiento: row.medio_pago === "cheque" ? (row.fecha_cheque_vencimiento || fechaPago) : undefined,
          titular_cheque: row.medio_pago === "cheque" ? (row.titular_cheque || expense.proveedor || undefined) : undefined,
          es_cheque_diferido: row.medio_pago === "cheque" ? Boolean(row.es_cheque_diferido) : undefined,
        }))
      }

      await api.expenses.disburse(expense.id, payload)
      toast.success("Gasto Liquidado con Éxito", `Se desembolsaron ${formatPYG(montoTotalGasto)} y se afectaron los saldos correspondientes.`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Error al liquidar gasto", err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Corporativo */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Liquidación y Pago de Gasto Operativo
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Live Balancing
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Asignación de formas de desembolso (Bóveda, Fondo Fijo, Transferencias SIPAP, Cheques)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha Resumen del Gasto */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Proveedor / Beneficiario</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
              {expense.proveedor || "Sin Proveedor / Varios"}
            </span>
            {expense.ruc && <span className="text-[10px] text-slate-500">RUC: {expense.ruc}</span>}
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Comprobante Fiscal</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              {expense.tipo_comprobante?.replace("_", " ")} N° {expense.numero_factura || "S/F"}
            </span>
            {expense.timbrado && <span className="text-[10px] text-slate-500">Timb: {expense.timbrado}</span>}
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Sector / Centro de Costo</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              {expense.cost_center_nombre || "General"}
            </span>
            <span className="text-[10px] text-slate-500">F. Gasto: {expense.fecha_gasto || "-"}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Monto Total a Liquidar</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-emerald-400 block">
              {formatPYG(montoTotalGasto)}
            </span>
          </div>
        </div>

        {/* Formulario Principal con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {loading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Consultando saldos de bóveda, cuentas bancarias y fondos...</p>
            </div>
          ) : (
            <>
              {/* Fecha y Referencia General */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    Fecha Efectiva de Pago
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaPago}
                    onChange={e => setFechaPago(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Notas de Auditoría / Justificación de Pago
                  </label>
                  <input
                    type="text"
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Ej. Pago autorizado por Gerencia Administrativa"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Renglones de Medios de Pago Multicanal */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Asignación de Medios de Desembolso
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={addDisbursementRow}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Dividir en Otro Medio
                  </button>
                </div>

                {disbursements.map((row, idx) => {
                  const selectedBank = bankAccounts.find(b => b.id === row.bank_account_id)
                  const selectedFund = funds.find(f => f.id === row.petty_cash_fund_id)

                  return (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Línea de Desembolso
                          </span>
                        </div>
                        {disbursements.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDisbursementRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                            title="Eliminar medio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Selector Medio de Pago */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Canal / Medio
                          </label>
                          <select
                            value={row.medio_pago}
                            onChange={e => {
                              const newMedio = e.target.value as any
                              updateDisbursementRow(idx, {
                                medio_pago: newMedio,
                                banco_cheque: selectedBank?.banco || "Banco Itaú"
                              })
                            }}
                            className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          >
                            <option value="fondo_fijo">Efectivo Fondo Fijo (Caja Chica)</option>
                            <option value="boveda">Efectivo Bóveda Central (Tesorería)</option>
                            <option value="transferencia">Banco - Transferencia SIPAP</option>
                            <option value="cheque">Banco - Emisión de Cheque Propio</option>
                            <option value="otro">Otro Canal</option>
                          </select>
                        </div>

                        {/* Monto Asignado */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Monto a Desembolsar Gs. *
                          </label>
                          <CurrencyInput
                            required
                            currency="PYG"
                            value={row.monto}
                            onChangeValue={(num) => updateDisbursementRow(idx, { monto: String(num) })}
                            placeholder="0"
                            className="w-full text-xs font-extrabold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-right font-mono"
                          />
                        </div>

                        {/* Campo de Contexto según el medio */}
                        <div>
                          {row.medio_pago === "boveda" && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                  Moneda Bóveda
                                </label>
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => updateDisbursementRow(idx, { moneda: "PYG" })}
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      (row.moneda || "PYG") === "PYG" ? "bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white" : "text-slate-400"
                                    }`}
                                  >
                                    ₲ PYG
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDisbursementRow(idx, {
                                      moneda: "BRL",
                                      monto_brl: row.monto_brl || (expense.monto_brl ? String(expense.monto_brl) : "")
                                    })}
                                    className={`px-2 py-0.5 rounded font-bold ${
                                      row.moneda === "BRL" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400"
                                    }`}
                                  >
                                    R$ BRL
                                  </button>
                                </div>
                              </div>

                              {row.moneda === "BRL" ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400 font-medium">Disponible R$:</span>
                                    <span className={`font-mono font-bold ${vaultBalanceBRL >= (Number(row.monto_brl) || 0) ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                      R$ {vaultBalanceBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-400 block">Deducción en R$ de Bóveda</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="Monto en R$"
                                      value={row.monto_brl || ""}
                                      onChange={(e) => updateDisbursementRow(idx, { monto_brl: e.target.value })}
                                      className="w-full text-xs font-mono font-bold p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-emerald-600"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                  <span>Disp. ₲:</span>
                                  <span className={`font-mono ${vaultBalance >= Number(row.monto) ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                    ₲ {vaultBalance.toLocaleString("es-PY")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {row.medio_pago === "fondo_fijo" && (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Seleccionar Fondo Fijo
                              </label>
                              <select
                                value={row.petty_cash_fund_id || ""}
                                onChange={e => updateDisbursementRow(idx, { petty_cash_fund_id: e.target.value })}
                                className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              >
                                <option value="">-- Seleccione Fondo --</option>
                                {funds.map(f => (
                                  <option key={f.id} value={f.id}>
                                    {f.nombre} (Disp: {formatPYG(f.saldo_actual)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {row.medio_pago === "transferencia" && (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Cuenta Bancaria Origen
                              </label>
                              <select
                                value={row.bank_account_id || ""}
                                onChange={e => updateDisbursementRow(idx, { bank_account_id: e.target.value })}
                                className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              >
                                <option value="">-- Seleccione Cuenta --</option>
                                {bankAccounts.map(b => (
                                  <option key={b.id} value={b.id}>
                                    {b.banco} - {b.numero_cuenta} (Disp: {formatPYG(b.saldo_actual)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {row.medio_pago === "cheque" && (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Cuenta de Cheque
                              </label>
                              <select
                                value={row.bank_account_id || ""}
                                onChange={e => {
                                  const acc = bankAccounts.find(b => b.id === e.target.value)
                                  updateDisbursementRow(idx, {
                                    bank_account_id: e.target.value,
                                    banco_cheque: acc?.banco || row.banco_cheque
                                  })
                                }}
                                className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              >
                                <option value="">-- Seleccione Banco --</option>
                                {bankAccounts.map(b => (
                                  <option key={b.id} value={b.id}>
                                    {b.banco} ({b.numero_cuenta})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {row.medio_pago === "otro" && (
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                N° Comprobante / Referencia
                              </label>
                              <input
                                type="text"
                                value={row.numero_comprobante || ""}
                                onChange={e => updateDisbursementRow(idx, { numero_comprobante: e.target.value })}
                                placeholder="N° Comprobante externo"
                                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detalles extras para Transferencia (N° SIPAP) */}
                      {row.medio_pago === "transferencia" && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            N° Comprobante / Referencia SIPAP
                          </label>
                          <input
                            type="text"
                            value={row.numero_comprobante || ""}
                            onChange={e => updateDisbursementRow(idx, { numero_comprobante: e.target.value })}
                            placeholder="Ej. SIPAP-99882231"
                            className="w-full text-xs px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Detalles extras para Cheque Propio (Diferido vs Al Día) */}
                      {row.medio_pago === "cheque" && (
                        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Número de Cheque
                            </label>
                            <input
                              type="text"
                              required
                              value={row.numero_cheque || ""}
                              onChange={e => updateDisbursementRow(idx, { numero_cheque: e.target.value })}
                              placeholder="00012345"
                              className="w-full text-xs font-mono font-bold px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Fecha de Emisión
                            </label>
                            <input
                              type="date"
                              value={row.fecha_cheque_emision || fechaPago}
                              onChange={e => updateDisbursementRow(idx, { fecha_cheque_emision: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Fecha de Vencimiento / Cobro
                            </label>
                            <input
                              type="date"
                              value={row.fecha_cheque_vencimiento || fechaPago}
                              onChange={e => {
                                const vto = e.target.value
                                const emi = row.fecha_cheque_emision || fechaPago
                                const isDif = vto > emi
                                updateDisbursementRow(idx, {
                                  fecha_cheque_vencimiento: vto,
                                  es_cheque_diferido: isDif
                                })
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Tipo de Cheque
                            </label>
                            <div className="text-xs py-1.5 font-bold flex items-center gap-1.5">
                              {row.es_cheque_diferido ? (
                                <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                  Cheque Diferido
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                  Cheque al Día
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Barra de Cuadre en Vivo (Live Balancing) */}
              <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
                isBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
              }`}>
                <div className="flex items-center gap-3">
                  {isBalanced ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {isBalanced ? "Cuadre Exacto de Medios de Pago" : "Diferencia Pendiente de Asignación"}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Total Gasto: <b className="text-slate-800 dark:text-slate-200">{formatPYG(montoTotalGasto)}</b> &nbsp;|&nbsp; 
                      Asignado: <b className="text-slate-800 dark:text-slate-200">{formatPYG(totalAsignado)}</b>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {isBalanced ? (
                    <span className="text-xs font-bold px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-700">
                      Balance 100% Correcto
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700">
                      Diferencia: {formatPYG(diferencia)}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isBalanced || submitting || loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Liquidando Fondos...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Confirmar y Ejecutar Pago
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
