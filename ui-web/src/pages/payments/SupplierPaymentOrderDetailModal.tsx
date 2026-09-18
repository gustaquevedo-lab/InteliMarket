import React from "react"
import {
  X, Download, CheckCircle2, Clock, Building2,
  Wallet, FileText, Calendar, CreditCard, ShieldCheck
} from "lucide-react"
import { api, SupplierPaymentOrder } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"

interface Props {
  order: SupplierPaymentOrder
  onClose: () => void
  onDisburseRequest?: (order: SupplierPaymentOrder) => void
}

export default function SupplierPaymentOrderDetailModal({
  order,
  onClose,
  onDisburseRequest,
}: Props) {
  const isPaid = order.estado === "pagado"
  const isRegistrado = order.estado === "registrado"

  const handleDownloadPdf = () => {
    api.financial.paymentOrders.downloadPdf(order.id, order.numero_orden)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* CABECERA */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black shadow-md ${
              isPaid ? "bg-emerald-600 shadow-emerald-600/20" : "bg-amber-500 shadow-amber-500/20"
            }`}>
              {isPaid ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  isPaid
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                }`}>
                  {order.estado?.toUpperCase()}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">{order.numero_orden}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {order.supplier_nombre}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              title="Descargar Comprobante PDF Oficial con Membrete y Firmas"
            >
              <Download className="w-4 h-4 text-rose-400" />
              <span>PDF Oficial</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* METADATOS RÁPIDOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/70 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Emisión</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatDate(order.fecha_emision)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Pago</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{order.fecha_pago ? formatDate(order.fecha_pago) : "Pendiente"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Recibo Proveedor</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{order.recibo_proveedor || "Sin registrar"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Neto</span>
            <span className="font-mono font-black text-rose-600 dark:text-rose-400">{formatPYG(order.monto_neto)}</span>
          </div>
        </div>

        {/* DETALLE SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* 1. FACTURAS AMORTIZADAS */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-rose-500" /> Facturas Amortizadas
            </h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Factura N°</th>
                    <th className="p-2.5">Timbrado</th>
                    <th className="p-2.5 text-right">Saldo Anterior</th>
                    <th className="p-2.5 text-right">Retención</th>
                    <th className="p-2.5 text-right">Amortizado</th>
                    <th className="p-2.5 text-right">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {order.allocations?.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{a.numero_factura || "-"}</td>
                      <td className="p-2.5 text-slate-500">{a.timbrado || "-"}</td>
                      <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{formatPYG(a.saldo_anterior)}</td>
                      <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{formatPYG(a.monto_retencion)}</td>
                      <td className="p-2.5 text-right font-black text-rose-600 dark:text-rose-400">{formatPYG(a.monto_aplicado)}</td>
                      <td className="p-2.5 text-right text-slate-500">{formatPYG(a.saldo_restante)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. MEDIOS DE PAGO Y DESEMBOLSOS */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-500" /> Desembolsos & Medios de Pago
            </h3>

            {(!order.disbursements || order.disbursements.length === 0) ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>Esta orden se encuentra registrada pero aún no ha sido liquidada.</span>
                {isRegistrado && onDisburseRequest && (
                  <button
                    onClick={() => {
                      onClose()
                      onDisburseRequest(order)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-sm"
                  >
                    Asignar Medio y Liquidar Ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {order.disbursements.map((d: any) => {
                  const fp = d.forma_pago
                  let badgeColor = "bg-slate-100 text-slate-700"
                  let label = fp
                  let sub = ""

                  if (fp === "boveda") {
                    badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    label = "Bóveda Central"
                    sub = "Efectivo entregado desde tesorería central"
                  } else if (fp === "fondo_fijo") {
                    badgeColor = "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    label = `Fondo Fijo (${d.fondo_nombre || "Caja Chica"})`
                    sub = "Egreso directo de fondo de sucursal"
                  } else if (fp === "transferencia") {
                    badgeColor = "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    label = `Transferencia (${d.banco_nombre || "Banco"})`
                    sub = `Ref: ${d.referencia_transferencia || "S/N"}`
                  } else if (fp === "cheque") {
                    badgeColor = d.es_cheque_diferido ? "bg-purple-500/10 text-purple-600 border-purple-500/20" : "bg-teal-500/10 text-teal-600 border-teal-500/20"
                    label = d.es_cheque_diferido ? `Cheque Diferido N° ${d.numero_cheque}` : `Cheque al Día N° ${d.numero_cheque}`
                    sub = `Banco: ${d.banco_cheque || d.banco_nombre || "Banco"} · Vto: ${formatDate(d.fecha_cheque_vencimiento)}`
                  } else if (fp === "nota_credito") {
                    badgeColor = "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                    label = `Nota de Crédito N° ${d.numero_nc || "S/N"}`
                    sub = "Compensación de saldo a favor"
                  }

                  return (
                    <div
                      key={d.id}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeColor}`}>
                            {label}
                          </span>
                          {d.es_cheque_diferido && (
                            <span className="text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                              Plazo / Diferido
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{sub}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {formatPYG(d.monto_pyg || d.monto)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {order.observaciones && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Observaciones:</span>
              <p className="text-slate-700 dark:text-slate-300">{order.observaciones}</p>
            </div>
          )}

        </div>

        {/* PIE */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Extra Supermercado · Tesorería & Pagos</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
