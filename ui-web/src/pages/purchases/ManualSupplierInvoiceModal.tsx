import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  FileText,
  Calendar,
  Building2,
  Hash,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link2,
  ShieldCheck,
  Percent,
} from "lucide-react"
import { api, type Supplier, type PurchaseOrder, type PurchaseReceipt } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import CurrencyInput from "../../components/CurrencyInput"
import {
  formatPYG,
  formatCurrency,
  getTodayAsuncion,
  normalizeInvoiceNumber,
} from "../../utils/format"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  companyId?: string
  suppliers: Supplier[]
  purchaseOrders?: PurchaseOrder[]
  receipts?: PurchaseReceipt[]
}

export const ManualSupplierInvoiceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  suppliers,
  purchaseOrders = [],
  receipts = [],
}) => {
  const toast = useToast()
  const { user } = useAuth()

  const [supplierId, setSupplierId] = useState("")
  const [numeroFactura, setNumeroFactura] = useState("")
  const [timbrado, setTimbrado] = useState("")
  const [fechaEmision, setFechaEmision] = useState(getTodayAsuncion())
  const [condicion, setCondicion] = useState<"contado" | "credito">("credito")
  const [plazoDias, setPlazoDias] = useState<number>(30)
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [moneda, setMoneda] = useState<"PYG" | "BRL" | "USD">("PYG")
  const [tipoCambio, setTipoCambio] = useState<number>(1)

  // Montos
  const [totalFactura, setTotalFactura] = useState<number>(0)
  const [subtotalGravada10, setSubtotalGravada10] = useState<number>(0)
  const [iva10, setIva10] = useState<number>(0)
  const [subtotalGravada5, setSubtotalGravada5] = useState<number>(0)
  const [iva5, setIva5] = useState<number>(0)
  const [subtotalExenta, setSubtotalExenta] = useState<number>(0)

  // Vinculación opcional
  const [selectedPoId, setSelectedPoId] = useState<string>("")
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>("")
  const [concepto, setConcepto] = useState("")
  const [notas, setNotas] = useState("")

  const [saving, setSaving] = useState(false)
  const [searchSupplier, setSearchSupplier] = useState("")

  // Calcular fecha de vencimiento al cambiar fecha de emisión o plazo
  useEffect(() => {
    if (!fechaEmision) return
    if (condicion === "contado") {
      setFechaVencimiento(fechaEmision)
    } else {
      try {
        const d = new Date(fechaEmision + "T12:00:00")
        d.setDate(d.getDate() + (plazoDias || 0))
        setFechaVencimiento(d.toISOString().slice(0, 10))
      } catch {
        setFechaVencimiento(fechaEmision)
      }
    }
  }, [fechaEmision, condicion, plazoDias])

  // Proveedores filtrados
  const filteredSuppliers = useMemo(() => {
    if (!searchSupplier.trim()) return suppliers
    const q = searchSupplier.toLowerCase()
    return suppliers.filter(
      (s) =>
        s.razon_social?.toLowerCase().includes(q) ||
        s.ruc?.toLowerCase().includes(q) ||
        s.nombre_fantasia?.toLowerCase().includes(q)
    )
  }, [suppliers, searchSupplier])

  // Filtrar OCs y Recepciones del proveedor seleccionado
  const supplierPOs = useMemo(() => {
    if (!supplierId) return []
    return purchaseOrders.filter((po) => po.supplier_id === supplierId)
  }, [purchaseOrders, supplierId])

  const supplierReceipts = useMemo(() => {
    if (!supplierId) return []
    return receipts.filter((r) => r.supplier_id === supplierId)
  }, [receipts, supplierId])

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSupplierId("")
      setNumeroFactura("")
      setTimbrado("")
      setFechaEmision(getTodayAsuncion())
      setCondicion("credito")
      setPlazoDias(30)
      setMoneda("PYG")
      setTipoCambio(1)
      setTotalFactura(0)
      setSubtotalGravada10(0)
      setIva10(0)
      setSubtotalGravada5(0)
      setIva5(0)
      setSubtotalExenta(0)
      setSelectedPoId("")
      setSelectedReceiptId("")
      setConcepto("")
      setNotas("")
      setSearchSupplier("")
    }
  }, [isOpen])

  // Al seleccionar OC o Recepción, sugerir montos
  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId)
    if (!poId) return
    const po = purchaseOrders.find((p) => p.id === poId)
    if (po && totalFactura === 0) {
      const tot = Number(po.total || 0)
      setTotalFactura(tot)
      setSubtotalGravada10(tot)
      setIva10(Math.round(tot / 11))
    }
  }

  const handleSelectReceipt = (recId: string) => {
    setSelectedReceiptId(recId)
    if (!recId) return
    const rec = receipts.find((r) => r.id === recId)
    if (rec) {
      if (rec.proveedor_ref && !numeroFactura) {
        setNumeroFactura(normalizeInvoiceNumber(rec.proveedor_ref))
      }
      if (totalFactura === 0) {
        const tot = Number(rec.total || 0)
        setTotalFactura(tot)
        setSubtotalGravada10(tot)
        setIva10(Math.round(tot / 11))
      }
    }
  }

  // Auto-cálculo de IVA 10% cuando se ingresa el total general en PYG
  const handleTotalChange = (num: number) => {
    setTotalFactura(num)
    // Si no ha desglosado exentas ni 5%, sugerir 10% estándar de retail
    if (subtotalGravada5 === 0 && subtotalExenta === 0) {
      setSubtotalGravada10(num)
      setIva10(Math.round(num / 11))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supplierId) {
      toast.error("Debe seleccionar un proveedor.")
      return
    }

    const normFactura = normalizeInvoiceNumber(numeroFactura)
    if (!normFactura || normFactura.length < 5) {
      toast.error("Ingrese un número de factura válido (ej: 001-001-0001234).")
      return
    }

    if (!totalFactura || totalFactura <= 0) {
      toast.error("El monto total de la factura debe ser mayor a cero.")
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        supplier_id: supplierId,
        numero_factura: normFactura,
        timbrado: timbrado.trim() || undefined,
        fecha_emision: fechaEmision,
        fecha_recepcion: fechaEmision,
        fecha_vencimiento: fechaVencimiento || fechaEmision,
        subtotal: subtotalGravada10 + subtotalGravada5 + subtotalExenta,
        descuento: 0,
        iva_10: iva10,
        iva_5: iva5,
        total: totalFactura,
        moneda: moneda,
        tipo_cambio: tipoCambio,
        condicion: condicion,
        tipo_comprobante: "factura",
        purchase_order_id: selectedPoId || undefined,
        receipt_id: selectedReceiptId || undefined,
        concepto:
          concepto.trim() ||
          `Factura de Compra ${normFactura} (${condicion.toUpperCase()})`,
        notas: `Carga manual física. ${notas.trim()}`.trim(),
      }

      await api.financial.invoices.create(payload)

      toast.success(`Factura ${normFactura} registrada correctamente.`)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("Error al registrar factura manual:", err)
      toast.error(err.message || "Error al registrar la factura de proveedor.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900/50 dark:via-slate-900 dark:to-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Nueva Factura Manual de Proveedor
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Física / Papel
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registra comprobantes preimpresos o no electrónicos para Cuentas por Pagar y 3-Way Match.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Fila 1: Proveedor y Timbrado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                Proveedor Fiscal <span className="text-rose-500">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Seleccione un proveedor...</option>
                {filteredSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.razon_social} ({s.ruc || "Sin RUC"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                Timbrado DNIT
              </label>
              <input
                type="text"
                maxLength={8}
                placeholder="Ej. 18545636 (8 dígitos)"
                value={timbrado}
                onChange={(e) => setTimbrado(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Fila 2: Número de Factura y Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-500" />
                Número de Factura <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="001-001-0012345"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                onBlur={() => {
                  if (numeroFactura) {
                    setNumeroFactura(normalizeInvoiceNumber(numeroFactura))
                  }
                }}
                required
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Normalización canónica DNIT automática al salir
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Fecha Emisión <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Fecha Vencimiento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Fila 3: Condición, Plazo y Moneda */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Condición de Venta
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCondicion("contado")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    condicion === "contado"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setCondicion("credito")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    condicion === "credito"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Crédito
                </button>
              </div>
            </div>

            {condicion === "credito" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Plazo en Días
                </label>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={plazoDias}
                  onChange={(e) => setPlazoDias(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Moneda
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as any)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="PYG">Guaraníes (PYG ₲)</option>
                <option value="BRL">Reales (BRL R$)</option>
                <option value="USD">Dólares (USD US$)</option>
              </select>
            </div>
          </div>

          {/* Fila 4: Importes Fiscales con CurrencyInput */}
          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Desglose Fiscal del Comprobante
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Total: {formatCurrency(totalFactura, moneda)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Factura <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={totalFactura}
                  onChangeValue={(val) => handleTotalChange(val)}
                  currency={moneda}
                  placeholder="0"
                  className="w-full px-3 py-2 text-base font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-indigo-500" />
                  IVA 10% (Liquidación)
                </label>
                <CurrencyInput
                  value={iva10}
                  onChangeValue={(val) => setIva10(val)}
                  currency={moneda}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/30">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Gravada 5% (Opcional)
                </label>
                <CurrencyInput
                  value={subtotalGravada5}
                  onChangeValue={(val) => {
                    setSubtotalGravada5(val)
                    setIva5(Math.round(val / 21))
                  }}
                  currency={moneda}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  IVA 5% (Opcional)
                </label>
                <CurrencyInput
                  value={iva5}
                  onChangeValue={(val) => setIva5(val)}
                  currency={moneda}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Exentas (Opcional)
                </label>
                <CurrencyInput
                  value={subtotalExenta}
                  onChangeValue={(val) => setSubtotalExenta(val)}
                  currency={moneda}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Fila 5: Vinculación opcional con Muelle / Pedido */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              Asociación para 3-Way Match (Opcional pero recomendado)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Recepción en Muelle (Conteo Físico)
                </label>
                <select
                  value={selectedReceiptId}
                  onChange={(e) => handleSelectReceipt(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Sin vincular a recepción...</option>
                  {supplierReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.numero} {r.proveedor_ref ? `(Ref: ${r.proveedor_ref})` : ""} - {formatPYG(r.total || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  Orden de Compra Aprobada
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handleSelectPo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Sin vincular a pedido...</option>
                  {supplierPOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.numero} - {formatPYG(po.total || 0)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Fila 6: Concepto y Observaciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Concepto / Descripción
              </label>
              <input
                type="text"
                placeholder="Ej. Compra de mercaderías para salón"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas Internas
              </label>
              <input
                type="text"
                placeholder="Observaciones de muelle o recepción"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Registrar Factura
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
