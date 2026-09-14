import React, { useRef } from "react"
import { Printer, X, Truck, CheckCircle2, Clock, Ban, Package, Building2, FileText } from "lucide-react"
import { formatDate, formatDateTime, formatPYG } from "../../utils/format"

export interface DevolucionItemPrint {
  id?: string
  producto_id?: string
  producto_nombre?: string
  sku?: string
  codigo_barra?: string
  factura_numero?: string
  cantidad: number
  valor_unitario: number
  valor_total?: number
  motivo?: string
  lote?: string
  fecha_vencimiento?: string
  detalle?: string
}

export interface DevolucionDocPrint {
  id: string
  codigo: string
  tipo?: string
  proveedor_nombre?: string
  supplier_nombre?: string
  proveedor_ruc?: string
  almacen_nombre?: string
  fecha_creacion?: string
  fecha?: string
  fecha_estimada_retiro?: string
  total_items?: number
  valor_total_estimado?: number
  monto?: number
  nota_credito_numero?: string
  nota_credito_monto?: number
  estado: "pendiente" | "autorizado" | "completado" | "rechazado" | string
  autorizado_at?: string
  completado_at?: string
  rechazado_at?: string
  motivo_rechazo?: string
  observaciones?: string
  items?: DevolucionItemPrint[]
  raw?: any
}

interface Props {
  devolucion: DevolucionDocPrint
  onClose: () => void
}

export const DevolucionProveedorPrintModal: React.FC<Props> = ({ devolucion, onClose }) => {
  const printAreaRef = useRef<HTMLDivElement>(null)

  const items: DevolucionItemPrint[] = devolucion.items || devolucion.raw?.items || []
  const proveedorNombre = devolucion.proveedor_nombre || devolucion.supplier_nombre || devolucion.raw?.proveedor_nombre || "Proveedor Sin Nombre"
  const proveedorRuc = devolucion.proveedor_ruc || devolucion.raw?.proveedor_ruc || "—"
  const codigo = devolucion.codigo || devolucion.raw?.codigo || `DEV-${devolucion.id.slice(0, 8).toUpperCase()}`
  const totalDevuelto = devolucion.valor_total_estimado ?? devolucion.monto ?? devolucion.raw?.valor_total_estimado ?? 0
  const totalBultos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0)
  const almacen = devolucion.almacen_nombre || devolucion.raw?.almacen_nombre || "Depósito Central"

  const estado = devolucion.estado || "pendiente"
  const yaImpactoStock = estado === "completado"

  const handlePrint = () => {
    const printContent = printAreaRef.current
    if (!printContent) {
      window.print()
      return
    }

    const printWindow = window.open("", "_blank", "width=900,height=750")
    if (!printWindow) {
      window.print()
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Devolución a Proveedor ${codigo} - Extra Supermercado</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 12mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
            }
            .header-box {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title-main {
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              margin: 0 0 2px 0;
            }
            .subtitle-main {
              font-size: 12px;
              font-weight: 700;
              color: #e11d48;
              margin: 0 0 4px 0;
            }
            .company-info {
              font-size: 10px;
              color: #475569;
            }
            .doc-card {
              border: 2px solid #0f172a;
              border-radius: 8px;
              padding: 8px 14px;
              text-align: right;
              background-color: #f8fafc;
            }
            .doc-card .doc-num {
              font-family: ui-monospace, monospace;
              font-size: 15px;
              font-weight: 900;
              color: #0f172a;
            }
            .doc-card .doc-date {
              font-size: 10px;
              color: #475569;
              margin-top: 3px;
            }
            .stock-alert-box {
              margin: 12px 0;
              padding: 10px 14px;
              border-radius: 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: 700;
              border: 1.5px solid;
            }
            .stock-impact-yes {
              background-color: #f0fdf4;
              border-color: #16a34a;
              color: #14532d;
            }
            .stock-impact-pending {
              background-color: #eff6ff;
              border-color: #2563eb;
              color: #1e3a8a;
            }
            .stock-impact-none {
              background-color: #fffbeb;
              border-color: #d97706;
              color: #78350f;
            }
            .stock-impact-rejected {
              background-color: #fef2f2;
              border-color: #dc2626;
              color: #7f1d1d;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 14px;
            }
            .info-panel {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 12px;
              background-color: #f8fafc;
            }
            .info-panel h4 {
              margin: 0 0 6px 0;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 3px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 10.5px;
              margin-bottom: 3px;
            }
            .info-row .lbl {
              color: #64748b;
              font-weight: 600;
            }
            .info-row .val {
              color: #0f172a;
              font-weight: 700;
              text-align: right;
            }
            table.items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: 10px;
            }
            table.items-table th {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
              padding: 6px 8px;
              text-align: left;
            }
            table.items-table td {
              padding: 6px 8px;
              border-bottom: 1px solid #e2e8f0;
              color: #1e293b;
              vertical-align: top;
            }
            table.items-table tr:nth-child(even) td {
              background-color: #f8fafc;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .mono {
              font-family: ui-monospace, monospace;
            }
            .badge-motivo {
              display: inline-block;
              padding: 1px 5px;
              border-radius: 4px;
              background-color: #e2e8f0;
              font-weight: 700;
              font-size: 8.5px;
              text-transform: uppercase;
              color: #334155;
            }
            .totals-box {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 18px;
            }
            .totals-table {
              width: 280px;
              border: 1.5px solid #0f172a;
              border-radius: 6px;
              overflow: hidden;
            }
            .totals-table td {
              padding: 6px 10px;
              font-size: 11px;
            }
            .totals-table .total-row {
              background-color: #0f172a;
              color: #fff;
              font-weight: 900;
              font-size: 13px;
            }
            .timeline-steps {
              display: flex;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              margin-bottom: 18px;
              overflow: hidden;
              background: #fff;
            }
            .step-box {
              flex: 1;
              padding: 6px 8px;
              border-right: 1px solid #cbd5e1;
              font-size: 9px;
            }
            .step-box:last-child {
              border-right: none;
            }
            .step-box .step-num {
              font-weight: 900;
              color: #64748b;
              margin-bottom: 2px;
            }
            .step-box .step-title {
              font-weight: 800;
              font-size: 10px;
              color: #0f172a;
            }
            .step-box.active {
              background-color: #f0fdf4;
            }
            .signatures-box {
              margin-top: 25px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 25px;
              page-break-inside: avoid;
            }
            .sig-card {
              border: 1px dashed #64748b;
              border-radius: 6px;
              padding: 12px;
              min-height: 100px;
              display: flex;
              flex-col;
              flex-direction: column;
              justify-content: space-between;
              background-color: #fafafa;
            }
            .sig-line {
              margin-top: 40px;
              border-top: 1px solid #0f172a;
              text-align: center;
              padding-top: 4px;
              font-weight: 700;
              font-size: 10px;
            }
            .sig-details {
              font-size: 9px;
              color: #64748b;
              line-height: 1.4;
              margin-top: 4px;
            }
            .footer-note {
              margin-top: 20px;
              text-align: center;
              font-size: 8.5px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 6px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-white shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Comprobante Oficial de Devolución</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                  {codigo}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Formato legal y logístico para entrega física a transportista y registro de egreso de stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-lg shadow-rose-600/25 transition-all transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Remito A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Cerrar vista"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950/50 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-[800px] bg-white text-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 print:border-0 print:shadow-none print:p-0"
          >
            {/* Header Documento */}
            <div className="border-b-2 border-slate-900 pb-3 mb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase m-0 leading-tight">
                  EXTRA SUPERMERCADO MAYORISTA
                </h1>
                <h2 className="text-xs font-black text-rose-600 uppercase tracking-widest mt-0.5 mb-1">
                  GRUPO SANTA TERESA E.A.S.
                </h2>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  <p className="m-0 font-bold text-slate-700">RUC: 80150377-9 · Sucursal Casa Central</p>
                  <p className="m-0">Supermercado Retail & Distribución Mayorista · Asunción, Paraguay</p>
                  <p className="m-0">Teléfono: (021) 000-0000 · Sistema Central InteliMarket</p>
                </div>
              </div>

              <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50 text-right min-w-[220px]">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                  ORDEN & REMITO DE DEVOLUCIÓN
                </span>
                <span className="font-mono text-base font-black text-slate-900 block mt-0.5">
                  {codigo}
                </span>
                <span className="text-[10px] text-slate-600 block mt-1">
                  Emisión: <strong>{devolucion.fecha_creacion ? formatDateTime(devolucion.fecha_creacion) : formatDateTime(new Date())}</strong>
                </span>
                <span className="text-[9px] text-slate-500 block font-mono">
                  Depósito: <strong>{almacen}</strong>
                </span>
              </div>
            </div>

            {/* Banner de Impacto en Stock y Etapas */}
            <div
              className={`p-3 rounded-xl mb-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                yaImpactoStock
                  ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                  : estado === "autorizado"
                  ? "bg-blue-50 border-blue-500 text-blue-900"
                  : estado === "rechazado"
                  ? "bg-rose-50 border-rose-500 text-rose-900"
                  : "bg-amber-50 border-amber-500 text-amber-900"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {yaImpactoStock ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : estado === "autorizado" ? (
                    <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                  ) : estado === "rechazado" ? (
                    <Ban className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-black uppercase tracking-wide block text-sm">
                      {yaImpactoStock
                        ? "✓ STOCK EGRESADO DEL INVENTARIO — SALIDA FÍSICA CONFIRMADA"
                        : estado === "autorizado"
                        ? "SALIDA AUTORIZADA — PENDIENTE DE RETIRO EN DEPÓSITO"
                        : estado === "rechazado"
                        ? "DEVOLUCIÓN RECHAZADA — SIN IMPACTO EN STOCK"
                        : "SOLICITUD EN TRÁMITE — SIN IMPACTO EN STOCK"}
                    </span>
                    <span className="text-[11px] block opacity-90">
                      {yaImpactoStock
                        ? `Se descontaron ${totalBultos} unidades del stock del depósito con movimiento tipo 'devolucion_proveedor'.`
                        : estado === "autorizado"
                        ? "La devolución fue aprobada comercialmente. Los productos deben ser entregados al proveedor para descontar el stock."
                        : estado === "rechazado"
                        ? `Motivo de rechazo: ${devolucion.motivo_rechazo || "No especificado"}.`
                        : "La solicitud está en borrador/revisión. La mercadería permanece en gaveta hasta su autorización y egreso."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">IMPACTO EN STOCK:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase inline-block ${
                    yaImpactoStock
                      ? "bg-emerald-600 text-white"
                      : estado === "autorizado"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {yaImpactoStock ? "SÍ (DESCONTADO)" : "PENDIENTE (NO)"}
                </span>
              </div>
            </div>

            {/* Trazabilidad por Etapas (Circuito) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[10px]">
              <div className={`p-2.5 rounded-lg border ${devolucion.fecha_creacion ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 1</span>
                <span className="font-extrabold text-slate-900 block text-[11px]">1. Solicitud & Imputación</span>
                <span className="text-slate-500 block mt-0.5">{devolucion.fecha_creacion ? formatDate(devolucion.fecha_creacion) : "—"}</span>
                <span className="font-mono text-[9px] text-emerald-700 font-bold">✓ Registrada</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${devolucion.autorizado_at ? "border-emerald-300 bg-emerald-50/50" : estado === "autorizado" || yaImpactoStock ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 2</span>
                <span className="font-extrabold text-slate-900 block text-[11px]">2. Aprobación Comercial</span>
                <span className="text-slate-500 block mt-0.5">{devolucion.autorizado_at ? formatDate(devolucion.autorizado_at) : estado === "autorizado" || yaImpactoStock ? "Aprobada" : "Pendiente"}</span>
                <span className={`font-mono text-[9px] font-bold ${devolucion.autorizado_at || estado === "autorizado" || yaImpactoStock ? "text-blue-700" : "text-slate-400"}`}>
                  {devolucion.autorizado_at || estado === "autorizado" || yaImpactoStock ? "✓ Aprobada" : "En Espera"}
                </span>
              </div>

              <div className={`p-2.5 rounded-lg border ${yaImpactoStock ? "border-emerald-500 bg-emerald-50/80 shadow-xs" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 3</span>
                <span className="font-extrabold text-slate-900 block text-[11px]">3. Salida Física / Stock</span>
                <span className="text-slate-500 block mt-0.5">{devolucion.completado_at ? formatDate(devolucion.completado_at) : "Pendiente salida"}</span>
                <span className={`font-mono text-[9px] font-black ${yaImpactoStock ? "text-emerald-700" : "text-amber-600"}`}>
                  {yaImpactoStock ? "✓ Egreso Inventario OK" : "Pendiente"}
                </span>
              </div>

              <div className={`p-2.5 rounded-lg border ${devolucion.nota_credito_numero ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 4</span>
                <span className="font-extrabold text-slate-900 block text-[11px]">4. Nota de Crédito / P2P</span>
                <span className="text-slate-500 block mt-0.5">{devolucion.nota_credito_numero ? `NC: ${devolucion.nota_credito_numero}` : "Sin NC aún"}</span>
                <span className={`font-mono text-[9px] font-bold ${devolucion.nota_credito_numero ? "text-emerald-700" : "text-slate-400"}`}>
                  {devolucion.nota_credito_numero ? "✓ Compensada" : "Por liquidar"}
                </span>
              </div>
            </div>

            {/* Paneles de Datos: Proveedor y Depósito */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                <h4 className="m-0 font-black text-slate-400 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  Datos del Proveedor Destinatario
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Razón Social:</span>
                    <strong className="text-slate-900 text-right">{proveedorNombre}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">RUC Proveedor:</span>
                    <span className="font-mono font-bold text-slate-800">{proveedorRuc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Factura de Origen Afectada:</span>
                    <span className="font-mono text-slate-700">
                      {devolucion.raw?.numero_factura_origen || items.find(i => i.factura_numero)?.factura_numero ? `#${devolucion.raw?.numero_factura_origen || items.find(i => i.factura_numero)?.factura_numero}` : "Sin factura específica (Ajuste directo)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
                <h4 className="m-0 font-black text-slate-400 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-600" />
                  Datos del Depósito y Logística
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Depósito Origen Salida:</span>
                    <strong className="text-slate-900">{almacen}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tipo de Documento:</span>
                    <span className="font-bold text-slate-800 uppercase">Devolución Comercial / Merma</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fecha Estimada Retiro:</span>
                    <span className="font-mono text-slate-800">
                      {devolucion.fecha_estimada_retiro ? formatDate(devolucion.fecha_estimada_retiro) : "Inmediata al retiro"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla Detallada de Ítems Devueltos */}
            <div className="mb-4">
              <h4 className="font-black text-xs text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-600" />
                Detalle de Mercadería Devuelta ({items.length} ítems)
              </h4>

              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-extrabold uppercase text-[9px] tracking-wider">
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2">Cód. Barras</th>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Descripción del Producto</th>
                      <th className="p-2">Lote / Venc.</th>
                      <th className="p-2">Motivo</th>
                      <th className="p-2 text-right">Cant.</th>
                      <th className="p-2 text-right">Costo Unit.</th>
                      <th className="p-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-[10.5px]">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400">
                          No se encontraron ítems desglosados en este registro.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const subtotal = (it.valor_total != null) ? Number(it.valor_total) : (Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0)
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-bold text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-2 font-mono text-[10px] font-bold text-slate-800">
                              {it.codigo_barra || "—"}
                            </td>
                            <td className="p-2 font-mono text-[10px] text-slate-600">
                              {it.sku || "—"}
                            </td>
                            <td className="p-2 font-bold text-slate-900 max-w-[200px]">
                              {it.producto_nombre || "Producto sin nombre"}
                              {it.detalle && (
                                <span className="block text-[9px] font-normal text-slate-500 italic mt-0.5">
                                  Nota: {it.detalle}
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-mono text-[9.5px] text-slate-600 whitespace-nowrap">
                              {it.lote ? `Lote: ${it.lote}` : ""}
                              {it.fecha_vencimiento ? `${it.lote ? " · " : ""}Vto: ${it.fecha_vencimiento}` : (!it.lote ? "—" : "")}
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[9px] uppercase tracking-wide">
                                {it.motivo || "devolución"}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono font-black text-slate-900">
                              {it.cantidad}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-700">
                              {formatPYG(it.valor_unitario)}
                            </td>
                            <td className="p-2 text-right font-mono font-black text-rose-700">
                              {formatPYG(subtotal)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totales y Observaciones */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex-1 w-full text-xs">
                {devolucion.observaciones && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                    <strong className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Observaciones Generales:</strong>
                    <p className="m-0 text-[11px] leading-relaxed italic">"{devolucion.observaciones}"</p>
                  </div>
                )}
                {devolucion.nota_credito_numero && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[11px] flex items-center justify-between">
                    <span>Nota de Crédito Proveedor Emitida:</span>
                    <span className="font-mono text-xs">{devolucion.nota_credito_numero}</span>
                  </div>
                )}
              </div>

              <div className="border-2 border-slate-900 rounded-xl overflow-hidden w-full sm:w-[280px] shrink-0 text-xs">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex justify-between">
                  <span className="text-slate-600 font-bold">Total Unidades Devueltas:</span>
                  <span className="font-mono font-black text-slate-900">{totalBultos} UN</span>
                </div>
                <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                  <span className="font-black uppercase tracking-wider text-xs">TOTAL DEVOLUCIÓN:</span>
                  <span className="font-mono font-black text-base text-rose-400">{formatPYG(totalDevuelto)}</span>
                </div>
              </div>
            </div>

            {/* Firmas de Conformidad (Legal y Logística) */}
            <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 page-break-inside-avoid">
              <div className="border border-dashed border-slate-400 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between min-h-[120px]">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-6">
                  ENTREGADO POR: EXTRA SUPERMERCADO MAYORISTA
                </div>
                <div>
                  <div className="border-t border-slate-900 pt-1 text-center">
                    <span className="font-black text-xs block text-slate-900">Responsable de Depósito / Mermas</span>
                    <span className="text-[10px] text-slate-500 block">Firma, Aclaración y C.I.</span>
                  </div>
                </div>
              </div>

              <div className="border border-dashed border-slate-400 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between min-h-[120px]">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-6">
                  RECIBIDO CONFORME: PROVEEDOR / TRANSPORTISTA
                </div>
                <div>
                  <div className="border-t border-slate-900 pt-1 text-center">
                    <span className="font-black text-xs block text-slate-900">Receptor / Chofer Autorizado</span>
                    <span className="text-[10px] text-slate-500 block">Aclaración, C.I., Chapa Vehículo y Fecha</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de página institucional */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
              Comprobante de uso logístico y fiscal interno · Extra Supermercado Mayorista · GRUPO SANTA TERESA E.A.S. (RUC 80150377-9) · Asunción, Paraguay
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {yaImpactoStock ? "✓ Documento listo para archivo y contabilidad" : "⚠️ Documento pendiente de firma de entrega física"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-lg shadow-rose-600/25"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Documento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default DevolucionProveedorPrintModal
