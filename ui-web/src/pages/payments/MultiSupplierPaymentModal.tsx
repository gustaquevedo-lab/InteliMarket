import React, { useState, useEffect, useMemo } from "react"
import {
  X, Check, AlertTriangle, Plus, Trash2, CreditCard,
  Building2, Wallet, FileText, Calendar, CheckCircle2,
  DollarSign, Layers, Loader2, Globe, ArrowRight, Info,
  ArrowRightLeft
} from "lucide-react"
import { api } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import { useToast } from "../../context/ToastContext"


interface InvoiceItem {
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

interface SupplierGroup {
  supplier_id: string
  supplier_nombre: string
  moneda: "BRL" | "PYG"
  tipo_cambio: number
  invoices: {
    invoice_id: string
    numero_factura: string
    saldo_pendiente: number
    monto_moneda: number
    monto_pyg: number
  }[]
  observaciones?: string
  recibo_proveedor?: string
}

interface Props {
  initialInvoices: InvoiceItem[]
  allPayableInvoices: InvoiceItem[]
  suppliers: any[]
  onClose: () => void
  onSuccess: (result: any) => void
}

export default function MultiSupplierPaymentModal({
  initialInvoices,
  allPayableInvoices,
  suppliers,
  onClose,
  onSuccess,
}: Props) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Cotización por defecto para Reales (R$)
  const [globalTipoCambioBRL, setGlobalTipoCambioBRL] = useState<number>(1450)

  // Proveedores y sus facturas agrupadas
  const [groups, setGroups] = useState<SupplierGroup[]>([])

  // Datos del instrumento de desembolso único
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0])
  const [formaPago, setFormaPago] = useState<"cheque" | "transferencia" | "boveda">("cheque")
  const [observacionesLote, setObservacionesLote] = useState("Lote Brasil - Liquidación agrupada con cambio de divisas")

  // Cheque
  const [useExistingCheque, setUseExistingCheque] = useState(false)
  const [selectedChequeId, setSelectedChequeId] = useState("")
  const [numeroCheque, setNumeroCheque] = useState("")
  const [bancoChequeId, setBancoChequeId] = useState("")
  const [titularCheque, setTitularCheque] = useState("Cambios Chaco S.A.")
  const [fechaChequeEmision, setFechaChequeEmision] = useState(new Date().toISOString().split("T")[0])
  const [fechaChequeVencimiento, setFechaChequeVencimiento] = useState(new Date().toISOString().split("T")[0])
  const [esChequeDiferido, setEsChequeDiferido] = useState(false)

  // Desembolso nominal personalizado y diferencia de cambio
  const [customMontoDesembolso, setCustomMontoDesembolso] = useState<number | null>(null)

  // Transferencia
  const [transferBankAccountId, setTransferBankAccountId] = useState("")
  const [referenciaTransferencia, setReferenciaTransferencia] = useState("")

  // Datos auxiliares
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [availableCheques, setAvailableCheques] = useState<any[]>([])
  const [vaultBalance, setVaultBalance] = useState<number>(0)
  const [loadingAux, setLoadingAux] = useState(true)

  // Modal para agregar facturas de otros proveedores
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [selectedSupplierToAdd, setSelectedSupplierToAdd] = useState("")

  // Inicializar grupos con facturas seleccionadas
  useEffect(() => {
    const map: Record<string, SupplierGroup> = {}

    initialInvoices.forEach(inv => {
      const sId = inv.supplier_id
      const sup = suppliers.find(s => s.id === sId)
      const supName = inv.supplier_nombre || sup?.razon_social || sup?.nombre || "Proveedor"

      if (!map[sId]) {
        map[sId] = {
          supplier_id: sId,
          supplier_nombre: supName,
          moneda: "PYG",
          tipo_cambio: 1,
          invoices: [],
        }
      }

      map[sId].invoices.push({
        invoice_id: inv.id,
        numero_factura: inv.numero_factura,
        saldo_pendiente: Number(inv.saldo_pendiente || inv.total || 0),
        monto_moneda: Number(inv.saldo_pendiente || inv.total || 0),
        monto_pyg: Number(inv.saldo_pendiente || inv.total || 0),
      })
    })

    setGroups(Object.values(map))
  }, [initialInvoices, suppliers])

  // Cargar cuentas bancarias, cheques con saldo y bóveda
  useEffect(() => {
    let mounted = true
    async function loadAux() {
      try {
        const [banksRes, chequesRes, vaultRes] = await Promise.allSettled([
          api.financial.banks.list(),
          api.financial.paymentOrders.getChequesDisponibles(),
          api.vault.dashboard(),
        ])

        if (!mounted) return
        if (banksRes.status === "fulfilled" && Array.isArray(banksRes.value)) {
          setBankAccounts(banksRes.value)
          if (banksRes.value.length > 0) {
            setBancoChequeId(banksRes.value[0].id)
            setTransferBankAccountId(banksRes.value[0].id)
          }
        }
        if (chequesRes.status === "fulfilled" && Array.isArray(chequesRes.value)) {
          setAvailableCheques(chequesRes.value)
        }
        if (vaultRes.status === "fulfilled" && vaultRes.value) {
          setVaultBalance(Number(vaultRes.value.saldo_en_boveda_pyg || 0))
        }
      } catch (e) {
        console.error("Error al cargar auxiliares para Lote Multi-Proveedor", e)
      } finally {
        if (mounted) setLoadingAux(false)
      }
    }
    loadAux()
    return () => { mounted = false }
  }, [])

  // Si cambia el tipo de cambio global de BRL, aplicarlo a proveedores con moneda BRL
  const handleApplyGlobalTipoCambio = (newTc: number) => {
    setGlobalTipoCambioBRL(newTc)
    setGroups(prev => prev.map(g => {
      if (g.moneda === "BRL") {
        return {
          ...g,
          tipo_cambio: newTc,
          invoices: g.invoices.map(inv => ({
            ...inv,
            monto_pyg: Math.round(inv.monto_moneda * newTc),
          }))
        }
      }
      return g
    }))
  }

  // Modificar moneda de un proveedor
  const handleToggleGroupMoneda = (sId: string, moneda: "BRL" | "PYG") => {
    setGroups(prev => prev.map(g => {
      if (g.supplier_id !== sId) return g
      const tc = moneda === "BRL" ? globalTipoCambioBRL : 1
      return {
        ...g,
        moneda,
        tipo_cambio: tc,
        invoices: g.invoices.map(inv => {
          // Si pasa a BRL, el saldo original en facturas está en PYG, calcular equivalente en R$
          const montoMoneda = moneda === "BRL" ? Math.round((inv.saldo_pendiente / tc) * 100) / 100 : inv.saldo_pendiente
          const montoPyg = Math.round(montoMoneda * tc)
          return {
            ...inv,
            monto_moneda: montoMoneda,
            monto_pyg: montoPyg,
          }
        })
      }
    }))
  }

  // Modificar monto de una factura
  const handleUpdateInvoiceMonto = (sId: string, invId: string, montoMoneda: number) => {
    setGroups(prev => prev.map(g => {
      if (g.supplier_id !== sId) return g
      return {
        ...g,
        invoices: g.invoices.map(inv => {
          if (inv.invoice_id !== invId) return inv
          const montoPyg = Math.round(montoMoneda * g.tipo_cambio)
          return {
            ...inv,
            monto_moneda: montoMoneda,
            monto_pyg: montoPyg,
          }
        })
      }
    }))
  }

  // Quitar una factura del grupo
  const handleRemoveInvoice = (sId: string, invId: string) => {
    setGroups(prev => {
      return prev
        .map(g => {
          if (g.supplier_id !== sId) return g
          return {
            ...g,
            invoices: g.invoices.filter(i => i.invoice_id !== invId),
          }
        })
        .filter(g => g.invoices.length > 0)
    })
  }

  // Agregar proveedor y sus facturas pendientes
  const handleAddSupplierGroup = (supplierId: string) => {
    if (!supplierId) return
    const sup = suppliers.find(s => s.id === supplierId)
    const supName = sup?.razon_social || sup?.nombre || "Proveedor"
    const pendingInvs = allPayableInvoices.filter(i => i.supplier_id === supplierId)

    if (pendingInvs.length === 0) {
      toast.error("Sin facturas pendientes", `El proveedor ${supName} no tiene facturas pendientes de pago.`)
      return
    }

    setGroups(prev => {
      if (prev.some(g => g.supplier_id === supplierId)) {
        toast.info("Ya agregado", `El proveedor ${supName} ya forma parte del lote.`)
        return prev
      }
      return [
        ...prev,
        {
          supplier_id: supplierId,
          supplier_nombre: supName,
          moneda: "PYG",
          tipo_cambio: 1,
          invoices: pendingInvs.map(inv => ({
            invoice_id: inv.id,
            numero_factura: inv.numero_factura,
            saldo_pendiente: Number(inv.saldo_pendiente || inv.total || 0),
            monto_moneda: Number(inv.saldo_pendiente || inv.total || 0),
            monto_pyg: Number(inv.saldo_pendiente || inv.total || 0),
          }))
        }
      ]
    })
    setShowAddSupplierModal(false)
    setSelectedSupplierToAdd("")
  }

  // Totales calculados
  const summary = useMemo(() => {
    let totalPyg = 0
    let totalBrl = 0
    let totalFacturas = 0

    groups.forEach(g => {
      g.invoices.forEach(inv => {
        totalPyg += inv.monto_pyg
        totalFacturas++
        if (g.moneda === "BRL") {
          totalBrl += inv.monto_moneda
        }
      })
    })

    return {
      totalPyg,
      totalBrl,
      totalFacturas,
      totalProveedores: groups.length,
    }
  }, [groups])

  // Desembolso efectivo final y cálculo de diferencia de cambio
  const montoDesembolsoFinal = customMontoDesembolso !== null ? customMontoDesembolso : summary.totalPyg
  const diferenciaCambio = montoDesembolsoFinal - summary.totalPyg

  const selectedCheque = useMemo(() => {
    return availableCheques.find(c => c.id === selectedChequeId)
  }, [availableCheques, selectedChequeId])

  // Procesar lote multi-proveedor
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (groups.length === 0 || summary.totalFacturas === 0) {
      toast.error("Lote Vacío", "Debe incluir al menos un proveedor con facturas a pagar.")
      return
    }

    if (summary.totalPyg <= 0 || montoDesembolsoFinal <= 0) {
      toast.error("Importe Inválido", "El monto de facturas y desembolso deben ser mayores a 0.")
      return
    }

    // Validar cheque si aplica
    if (formaPago === "cheque") {
      if (useExistingCheque) {
        if (!selectedChequeId) {
          toast.error("Seleccione Cheque", "Debe seleccionar el cheque emitido a vincular.")
          return
        }
        if (selectedCheque && selectedCheque.saldo_disponible < montoDesembolsoFinal) {
          toast.error(
            "Saldo Insuficiente en Cheque",
            `El cheque N° ${selectedCheque.numero} solo dispone de ${formatPYG(selectedCheque.saldo_disponible)}. Requerido: ${formatPYG(montoDesembolsoFinal)}`
          )
          return
        }
      } else {
        if (!numeroCheque.trim()) {
          toast.error("Número de Cheque", "Debe ingresar el número del cheque a emitir.")
          return
        }
      }
    }

    // Validar transferencia
    if (formaPago === "transferencia" && !transferBankAccountId) {
      toast.error("Cuenta Bancaria", "Debe seleccionar la cuenta bancaria de origen para la transferencia.")
      return
    }

    // Validar bóveda
    if (formaPago === "boveda" && vaultBalance < montoDesembolsoFinal) {
      toast.error("Saldo Bóveda Insuficiente", `Bóveda Central solo dispone de ${formatPYG(vaultBalance)}. Requerido: ${formatPYG(montoDesembolsoFinal)}`)
      return
    }

    setSubmitting(true)
    try {
      const selectedAcc = bankAccounts.find(b => b.id === (formaPago === "transferencia" ? transferBankAccountId : bancoChequeId))

      const batchPayload = {
        fecha_pago: fechaPago,
        observaciones: observacionesLote,
        forma_pago: formaPago,
        moneda_desembolso: "PYG",
        bank_account_id: formaPago === "transferencia" ? transferBankAccountId : (formaPago === "cheque" ? (useExistingCheque ? undefined : bancoChequeId) : undefined),
        referencia_transferencia: formaPago === "transferencia" ? referenciaTransferencia : undefined,
        // Cheque
        cheque_id: formaPago === "cheque" && useExistingCheque ? selectedChequeId : undefined,
        numero_cheque: formaPago === "cheque" && !useExistingCheque ? numeroCheque : undefined,
        banco_cheque: formaPago === "cheque" && !useExistingCheque ? (selectedAcc?.banco || "Banco") : undefined,
        titular_cheque: formaPago === "cheque" && !useExistingCheque ? titularCheque : undefined,
        fecha_cheque_emision: formaPago === "cheque" && !useExistingCheque ? fechaChequeEmision : undefined,
        fecha_cheque_vencimiento: formaPago === "cheque" && !useExistingCheque ? (esChequeDiferido ? fechaChequeVencimiento : fechaChequeEmision) : undefined,
        es_cheque_diferido: formaPago === "cheque" && !useExistingCheque ? esChequeDiferido : false,
        monto_total_desembolso_pyg: montoDesembolsoFinal,
        diferencia_cambio_total: diferenciaCambio,
        items: groups.map((g, idx) => {
          const groupMontoPyg = g.invoices.reduce((s, i) => s + i.monto_pyg, 0)
          const groupMontoMoneda = g.invoices.reduce((s, i) => s + i.monto_moneda, 0)

          // Prorrateo exacto de la diferencia de cambio por proveedor
          const diffItem = summary.totalPyg > 0
            ? (idx === groups.length - 1
                ? diferenciaCambio - groups.slice(0, idx).reduce((acc, prevG) => {
                    const pPyg = prevG.invoices.reduce((s, i) => s + i.monto_pyg, 0)
                    return acc + Math.round((diferenciaCambio * pPyg) / summary.totalPyg)
                  }, 0)
                : Math.round((diferenciaCambio * groupMontoPyg) / summary.totalPyg))
            : 0

          return {
            supplier_id: g.supplier_id,
            recibo_proveedor: g.recibo_proveedor || undefined,
            observaciones: g.observaciones || undefined,
            moneda: g.moneda,
            tipo_cambio: g.tipo_cambio,
            monto_moneda: groupMontoMoneda,
            monto_pyg: groupMontoPyg,
            diferencia_cambio: diffItem,
            allocations: g.invoices.map(inv => ({
              invoice_id: inv.invoice_id,
              monto_aplicado: inv.monto_pyg,
              monto_retencion: 0,
            })),
          }
        }),
      }

      const res = await api.financial.paymentOrders.createMultiSupplierBatch(batchPayload)

      toast.success(
        "Lote Procesado con Éxito",
        `Se crearon ${res.orders?.length || groups.length} Órdenes de Pago individuales respaldadas por un único instrumento de desembolso.`
      )
      onSuccess(res)
    } catch (err: any) {
      toast.error("Error al procesar lote", err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* CABECERA MODAL */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 p-5 sm:p-6 text-white flex items-center justify-between border-b border-emerald-600/30">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <Globe className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Pago Agrupado Multi-Proveedor / Lote Brasil
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                  Desembolso Único
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Liquida facturas de múltiples proveedores (en R$ o Gs.) emitiendo un solo cheque, transferencia o retiro de bóveda.
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

        {/* CONTENIDO SCROLLABLE */}
        <form onSubmit={handleSubmitBatch} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* BARRA DE COTIZACIÓN R$ Y ACCIONES RÁPIDAS */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                  Cotización R$ (Cambista / Frontera)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tipo de cambio para convertir compras de Brasil (1 R$ = ₲)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-1 shadow-inner">
                <span className="text-slate-400 font-bold mr-2 text-xs">₲ / R$</span>
                <CurrencyInput
                  currency="PYG"
                  value={globalTipoCambioBRL}
                  onChangeValue={(num) => handleApplyGlobalTipoCambio(num || 1)}
                  className="w-24 font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm bg-transparent outline-none text-right"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAddSupplierModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Agregar Proveedor</span>
              </button>
            </div>
          </div>

          {/* LISTA DE PROVEEDORES Y SUS FACTURAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" /> Proveedores y Facturas en este Lote ({groups.length})
              </h4>
            </div>

            {groups.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-bold">No hay proveedores en el lote</p>
                <p className="mt-1">Agregá proveedores con el botón superior.</p>
              </div>
            ) : (
              groups.map((group, gIdx) => {
                const groupTotalPyg = group.invoices.reduce((s, i) => s + i.monto_pyg, 0)
                const groupTotalMoneda = group.invoices.reduce((s, i) => s + i.monto_moneda, 0)
                const difProv = summary.totalPyg > 0
                  ? (gIdx === groups.length - 1
                      ? diferenciaCambio - groups.slice(0, gIdx).reduce((acc, prevG) => {
                          const pPyg = prevG.invoices.reduce((s, i) => s + i.monto_pyg, 0)
                          return acc + Math.round((diferenciaCambio * pPyg) / summary.totalPyg)
                        }, 0)
                      : Math.round((diferenciaCambio * groupTotalPyg) / summary.totalPyg))
                  : 0

                return (
                  <div
                    key={group.supplier_id}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/80 shadow-xs overflow-hidden"
                  >
                    {/* ENCABEZADO DEL PROVEEDOR */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-white text-xs">{group.supplier_nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{group.invoices.length} factura(s) amortizada(s)</p>
                        </div>
                      </div>

                      {/* CONMUTADOR DE MONEDA PARA ESTE PROVEEDOR */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleToggleGroupMoneda(group.supplier_id, "PYG")}
                            className={`px-3 py-1 rounded-lg transition ${
                              group.moneda === "PYG" ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            🇵🇾 Guaraníes (₲)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleGroupMoneda(group.supplier_id, "BRL")}
                            className={`px-3 py-1 rounded-lg transition ${
                              group.moneda === "BRL" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            🇧🇷 Reales (R$)
                          </button>
                        </div>

                        <div className="text-right pl-2 border-l border-slate-300 dark:border-slate-700">
                          {group.moneda === "BRL" && (
                            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                              R$ {groupTotalMoneda.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          <p className="font-black text-slate-900 dark:text-white text-xs font-mono">
                            {formatPYG(groupTotalPyg)}
                          </p>
                          {diferenciaCambio !== 0 && (
                            <p className={`text-[10px] font-mono font-bold mt-0.5 ${
                              difProv > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                            }`}>
                              Dif: {difProv > 0 ? `+${formatPYG(difProv)}` : formatPYG(difProv)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* TABLA DE FACTURAS DEL PROVEEDOR */}
                    <div className="overflow-x-auto p-2">
                      <table className="w-full text-[11px] text-left">
                        <thead>
                          <tr className="text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 dark:border-slate-800">
                            <th className="p-2">Factura N°</th>
                            <th className="p-2 text-right">Saldo Original (₲)</th>
                            <th className="p-2 text-right">
                              {group.moneda === "BRL" ? "Monto a Pagar (R$)" : "Monto a Pagar (₲)"}
                            </th>
                            <th className="p-2 text-right">Equivalente ₲</th>
                            <th className="p-2 text-center w-10">Quitar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                          {group.invoices.map((inv) => (
                            <tr key={inv.invoice_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                              <td className="p-2 font-mono font-bold text-slate-700 dark:text-slate-200">
                                {inv.numero_factura}
                              </td>
                              <td className="p-2 text-right font-mono text-slate-500">
                                {formatPYG(inv.saldo_pendiente)}
                              </td>
                              <td className="p-2 text-right">
                                <div className="inline-flex items-center justify-end">
                                  <CurrencyInput
                                    currency={group.moneda === "BRL" ? "BRL" : "PYG"}
                                    allowDecimals={group.moneda === "BRL"}
                                    value={inv.monto_moneda}
                                    onChangeValue={(num) => handleUpdateInvoiceMonto(group.supplier_id, inv.invoice_id, num)}
                                    className="w-28 text-right p-1 font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs"
                                  />
                                </div>
                              </td>
                              <td className="p-2 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                {formatPYG(inv.monto_pyg)}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInvoice(group.supplier_id, inv.invoice_id)}
                                  className="text-slate-400 hover:text-red-500 p-1 transition"
                                  title="Quitar factura"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* INSTRUMENTO CENTRAL DE DESEMBOLSO ÚNICO */}
          <div className="bg-slate-50 dark:bg-slate-850/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Instrumento Financiero Único de Desembolso
              </h4>
              <span className="text-[11px] font-bold text-slate-500">
                1 solo cheque, transferencia o egreso respaldará las {groups.length} Órdenes de Pago
              </span>
            </div>

            {/* SELECCIÓN FORMA DE PAGO ÚNICA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                formaPago === "cheque"
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
              }`}>
                <input
                  type="radio"
                  name="formaPagoLote"
                  checked={formaPago === "cheque"}
                  onChange={() => setFormaPago("cheque")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-bold">📜 Cheque Bancario</p>
                  <p className="text-[10px] text-slate-400">Emisión única o vinculado</p>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                formaPago === "transferencia"
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
              }`}>
                <input
                  type="radio"
                  name="formaPagoLote"
                  checked={formaPago === "transferencia"}
                  onChange={() => setFormaPago("transferencia")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-bold">🏦 Transferencia SIPAP</p>
                  <p className="text-[10px] text-slate-400">Débito directo bancario</p>
                </div>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                formaPago === "boveda"
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
              }`}>
                <input
                  type="radio"
                  name="formaPagoLote"
                  checked={formaPago === "boveda"}
                  onChange={() => setFormaPago("boveda")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-bold">🔒 Efectivo Bóveda Central</p>
                  <p className="text-[10px] text-slate-400">Retiro físico en tesorería</p>
                </div>
              </label>
            </div>

            {/* CAMPOS SEGÚN FORMA DE PAGO */}
            {formaPago === "cheque" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                {/* SWITCHER VINCULAR O EMITIR */}
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                    <input
                      type="radio"
                      checked={!useExistingCheque}
                      onChange={() => setUseExistingCheque(false)}
                    />
                    <span>Emitir Nuevo Cheque Matriz</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <input
                      type="radio"
                      checked={useExistingCheque}
                      onChange={() => setUseExistingCheque(true)}
                    />
                    <span>Vincular a Cheque Compartido con Saldo ({availableCheques.length} disponibles)</span>
                  </label>
                </div>

                {useExistingCheque ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Seleccionar Cheque Emitido con Saldo Remanente *
                      </label>
                      {availableCheques.length === 0 ? (
                        <p className="text-xs text-amber-500 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                          No hay cheques emitidos con saldo disponible actualmente. Seleccioná "Emitir Nuevo Cheque Matriz".
                        </p>
                      ) : (
                        <select
                          value={selectedChequeId}
                          onChange={e => setSelectedChequeId(e.target.value)}
                          className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                          required
                        >
                          <option value="">Seleccione cheque...</option>
                          {availableCheques.map(c => (
                            <option key={c.id} value={c.id}>
                              Cheque N° {c.numero} ({c.banco_emisor}) — Titular: {c.beneficiario} | Disponible: {formatPYG(c.saldo_disponible)} (Total: {formatPYG(c.monto_total)}) - Venc: {formatDate(c.fecha_pago)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedCheque && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Saldo Disponible en Cheque N° {selectedCheque.numero}
                          </label>
                          <div className="p-2 text-xs font-mono font-bold bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                            {formatPYG(selectedCheque.saldo_disponible)} <span className="text-[10px] text-slate-400 font-normal">(Total: {formatPYG(selectedCheque.monto_total)})</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                              Monto a Imputar de este Cheque (₲) *
                            </label>
                            {customMontoDesembolso !== null && (
                              <button
                                type="button"
                                onClick={() => setCustomMontoDesembolso(null)}
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                              >
                                Igualar a Deuda ({formatPYG(summary.totalPyg)})
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <CurrencyInput
                              currency="PYG"
                              value={montoDesembolsoFinal}
                              onChangeValue={(val) => setCustomMontoDesembolso(val)}
                              className="flex-1 p-2 text-xs font-mono font-black bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setCustomMontoDesembolso(selectedCheque.saldo_disponible)}
                              className="px-2.5 py-2 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition whitespace-nowrap"
                              title="Aplicar todo el saldo disponible del cheque"
                            >
                              Todo el Saldo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">N° de Cheque *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 0098421"
                          value={numeroCheque}
                          onChange={e => setNumeroCheque(e.target.value)}
                          className="w-full p-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Banco Emisor / Cuenta *</label>
                        <select
                          value={bancoChequeId}
                          onChange={e => setBancoChequeId(e.target.value)}
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        >
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.banco} — Cuenta: {b.numero_cuenta}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Titular / Beneficiario *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Cambios Chaco S.A. o Al Portador"
                          value={titularCheque}
                          onChange={e => setTitularCheque(e.target.value)}
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Monto Nominal Cheque (₲) *</label>
                          {customMontoDesembolso !== null && customMontoDesembolso !== summary.totalPyg && (
                            <button
                              type="button"
                              onClick={() => setCustomMontoDesembolso(null)}
                              className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                            >
                              Restablecer
                            </button>
                          )}
                        </div>
                        <CurrencyInput
                          currency="PYG"
                          value={montoDesembolsoFinal}
                          onChangeValue={(val) => setCustomMontoDesembolso(val)}
                          className="w-full p-2 text-xs font-mono font-black bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Emisión</label>
                        <input
                          type="date"
                          value={fechaChequeEmision}
                          onChange={e => setFechaChequeEmision(e.target.value)}
                          className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modalidad</label>
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              checked={!esChequeDiferido}
                              onChange={() => setEsChequeDiferido(false)}
                            />
                            <span>Al Día</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              checked={esChequeDiferido}
                              onChange={() => setEsChequeDiferido(true)}
                            />
                            <span className="text-rose-500 font-bold">Diferido</span>
                          </label>
                        </div>
                      </div>

                      {esChequeDiferido && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Vencimiento *</label>
                          <input
                            type="date"
                            required
                            value={fechaChequeVencimiento}
                            onChange={e => setFechaChequeVencimiento(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formaPago === "transferencia" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cuenta Bancaria de Origen *</label>
                  <select
                    value={transferBankAccountId}
                    onChange={e => setTransferBankAccountId(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    required
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.banco} ({b.numero_cuenta}) — Saldo: {formatPYG(b.saldo_actual)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Referencia SIPAP / Transferencia</label>
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

            {formaPago === "boveda" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Disponibilidad en Bóveda Central</p>
                  <p className="text-[11px] text-slate-400">Se registrará el egreso físico consolidado en el arqueo de bóveda</p>
                </div>
                <div className={`p-2.5 rounded-xl font-mono font-black text-sm ${
                  vaultBalance >= montoDesembolsoFinal ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
                }`}>
                  Disponible: {formatPYG(vaultBalance)}
                </div>
              </div>
            )}

            {/* TARJETA DE COTEJO Y DIFERENCIA DE CAMBIO EN VIVO */}
            <div className={`p-4 rounded-2xl border transition-all ${
              diferenciaCambio === 0
                ? "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                : diferenciaCambio > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    diferenciaCambio === 0
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      : diferenciaCambio > 0
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-xs uppercase tracking-wider">
                        Cotejo de Desembolso vs. Deuda Imputada
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        diferenciaCambio === 0
                          ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          : diferenciaCambio > 0
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {diferenciaCambio === 0
                          ? "Sin Diferencia"
                          : diferenciaCambio > 0
                          ? "Sobrecosto / Pérdida Cambiaria"
                          : "Ganancia Cambiaria Favorable"}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {diferenciaCambio === 0
                        ? "El importe del desembolso coincide exactamente con las facturas a cancelar."
                        : diferenciaCambio > 0
                        ? `El desembolso supera la deuda por ₲ ${formatPYG(diferenciaCambio)}. Esta diferencia se imputará automáticamente como Diferencia de Cambio a los proveedores.`
                        : `El desembolso es menor a la deuda por ₲ ${formatPYG(Math.abs(diferenciaCambio))}. Se registrará como una ganancia cambiaria favorable prorrateada.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Deuda Facturas</span>
                    <span className="font-mono font-bold text-xs">{formatPYG(summary.totalPyg)}</span>
                  </div>
                  <span className="text-slate-400 font-bold text-xs">vs</span>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Desembolso Real</span>
                    <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                      {formatPYG(montoDesembolsoFinal)}
                    </span>
                  </div>
                  <div className="pl-3 border-l border-slate-300 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Dif. de Cambio</span>
                    <span className={`font-mono font-black text-sm ${
                      diferenciaCambio === 0
                        ? "text-slate-500"
                        : diferenciaCambio > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {diferenciaCambio > 0 ? `+${formatPYG(diferenciaCambio)}` : formatPYG(diferenciaCambio)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FECHA Y OBSERVACIONES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha de Liquidación *</label>
                <input
                  type="date"
                  required
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Observaciones / Concepto del Lote</label>
                <input
                  type="text"
                  value={observacionesLote}
                  onChange={e => setObservacionesLote(e.target.value)}
                  className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="Ej: Pago de Reales al cambista X para cancelar proveedores de hortifruti"
                />
              </div>
            </div>
          </div>

          {/* TOTALES CONSOLIDADOS */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Consolidado a Desembolsar</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                  {formatPYG(montoDesembolsoFinal)}
                </span>
                {summary.totalBrl > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-700/50">
                    R$ {summary.totalBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                {diferenciaCambio !== 0 && (
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                    diferenciaCambio > 0
                      ? "bg-amber-950/60 text-amber-300 border-amber-700/50"
                      : "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                  }`}>
                    Dif: {diferenciaCambio > 0 ? `+${formatPYG(diferenciaCambio)}` : formatPYG(diferenciaCambio)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Se generarán <strong>{groups.length} Órdenes de Pago individuales</strong> amortizando <strong>{summary.totalFacturas} facturas</strong> por un total de <strong>{formatPYG(summary.totalPyg)}</strong>.
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
                disabled={submitting || groups.length === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando Lote...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Desembolsar Lote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL SECUNDARIO: AGREGAR OTRO PROVEEDOR */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Agregar Proveedor al Lote</h4>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Seleccione Proveedor con Facturas Pendientes</label>
              <select
                value={selectedSupplierToAdd}
                onChange={e => setSelectedSupplierToAdd(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                <option value="">Seleccionar...</option>
                {suppliers.map(s => {
                  const pendingCount = allPayableInvoices.filter(i => i.supplier_id === s.id).length
                  if (pendingCount === 0) return null
                  return (
                    <option key={s.id} value={s.id}>
                      {s.razon_social || s.nombre} ({pendingCount} facturas pendientes)
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedSupplierToAdd}
                onClick={() => handleAddSupplierGroup(selectedSupplierToAdd)}
                className="px-4 py-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition disabled:opacity-50"
              >
                Agregar al Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
