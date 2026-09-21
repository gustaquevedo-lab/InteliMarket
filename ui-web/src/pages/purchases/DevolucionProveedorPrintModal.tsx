import React, { useRef, useMemo } from "react"
import { Printer, X, Truck, CheckCircle2, Clock, Ban, Building2, FileCheck, ShieldCheck, UserCheck } from "lucide-react"
import { formatDate, formatDateTime, formatPYG } from "../../utils/format"

export interface DevolucionItemPrint {
  id?: string
  producto_id?: string
  producto_nombre?: string
  sku?: string
  codigo_barra?: string
  codigo_barras?: string
  codigo_interno?: string
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
  proveedor_telefono?: string
  proveedor_direccion?: string
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
  autorizado_por_nombre?: string
  completado_at?: string
  completado_por_nombre?: string
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

  const rawItems: DevolucionItemPrint[] = devolucion.items || devolucion.raw?.items || []

  // Unificar líneas de productos por producto_id / SKU / código de barras / nombre
  const items: DevolucionItemPrint[] = useMemo(() => {
    const map = new Map<string, DevolucionItemPrint>()
    for (const it of rawItems) {
      const key = (it.producto_id && String(it.producto_id)) || it.sku || it.codigo_barra || it.codigo_barras || it.codigo_interno || it.producto_nombre || Math.random().toString()
      const cant = Number(it.cantidad || 0)
      const unit = Number(it.valor_unitario || 0)
      const sub = Number(it.valor_total != null ? it.valor_total : cant * unit)

      if (map.has(key)) {
        const existing = map.get(key)!
        const newCant = Number(existing.cantidad || 0) + cant
        const newSub = Number(existing.valor_total || 0) + sub
        const newUnit = newCant > 0 ? Math.round(newSub / newCant) : (unit || existing.valor_unitario)

        // Combinar lotes sin duplicar
        const lotes = [existing.lote, it.lote].filter(Boolean)
        const uniqueLotes = Array.from(new Set(lotes)).join(", ")

        // Combinar vencimientos
        const vtos = [existing.fecha_vencimiento, it.fecha_vencimiento].filter(Boolean)
        const uniqueVtos = Array.from(new Set(vtos)).join(", ")

        // Combinar facturas
        const facturas = [existing.factura_numero, it.factura_numero].filter(Boolean)
        const uniqueFacturas = Array.from(new Set(facturas)).join(", ")

        // Combinar detalles
        const detalles = [existing.detalle, it.detalle].filter(Boolean)
        const uniqueDetalles = Array.from(new Set(detalles)).join(" | ")

        map.set(key, {
          ...existing,
          cantidad: newCant,
          valor_unitario: newUnit,
          valor_total: newSub,
          lote: uniqueLotes || undefined,
          fecha_vencimiento: uniqueVtos || undefined,
          factura_numero: uniqueFacturas || undefined,
          detalle: uniqueDetalles || undefined,
        })
      } else {
        map.set(key, {
          ...it,
          cantidad: cant,
          valor_unitario: unit,
          valor_total: sub,
        })
      }
    }
    return Array.from(map.values())
  }, [rawItems])

  const proveedorNombre = devolucion.proveedor_nombre || devolucion.supplier_nombre || devolucion.raw?.proveedor_nombre || "Proveedor Sin Asignar"
  const proveedorRuc = devolucion.proveedor_ruc || devolucion.raw?.proveedor_ruc || devolucion.raw?.supplier?.ruc || "—"
  const proveedorTel = devolucion.proveedor_telefono || devolucion.raw?.proveedor_telefono || devolucion.raw?.supplier?.telefono || "—"
  const proveedorDir = devolucion.proveedor_direccion || devolucion.raw?.proveedor_direccion || devolucion.raw?.supplier?.direccion || "—"
  const codigo = devolucion.codigo || devolucion.raw?.codigo || `DEV-${devolucion.id.slice(0, 8).toUpperCase()}`
  const totalBultos = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0)
  const totalCalculado = items.reduce((acc, it) => acc + (Number(it.valor_total) || 0), 0)
  const totalDevuelto = totalCalculado > 0 ? totalCalculado : Number(devolucion.valor_total_estimado ?? devolucion.monto ?? devolucion.raw?.valor_total_estimado ?? 0)
  const almacen = devolucion.almacen_nombre || devolucion.raw?.almacen_nombre || "Depósito Central"

  const estado = devolucion.estado || "pendiente"
  const yaImpactoStock = estado === "completado"

  const handlePrint = () => {
    const container = printAreaRef.current
    if (!container) {
      window.print()
      return
    }

    // Usar iframe oculto inyectando todos los estilos de la aplicación (Tailwind, Google Fonts)
    // para replicar con exactitud milimétrica el diseño del reporte premium y evitar que el navegador bloquee popups
    const existingIframe = document.getElementById("devolucion-print-iframe")
    if (existingIframe) {
      existingIframe.remove()
    }

    const iframe = document.createElement("iframe")
    iframe.id = "devolucion-print-iframe"
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    // Copiar estilos activos compilados de Tailwind y la app
    const headStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((el) => el.outerHTML)
      .join("\n")

    const printableHtml = container.innerHTML

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Remito de Devolución ${codigo} - Extra Supermercado</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 10mm 10mm;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              -webkit-font-smoothing: antialiased !important;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
              font-variant-numeric: tabular-nums !important;
            }
            .print-sheet {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              border: none !important;
              box-shadow: none !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            .page-break-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="print-sheet">
            ${printableHtml}
          </div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    }, 350)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Barra superior del Modal */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-rose-600 flex items-center justify-center text-white shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                  Reporte Premium A4
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  {codigo}
                </span>
              </div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white mt-0.5">
                Remito Oficial de Devolución de Mercadería
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition transform active:scale-95"
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

        {/* Contenedor del Documento Imprimible */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950/60 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-[800px] bg-white text-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 print:border-0 print:shadow-none print:p-0 space-y-4"
          >
            {/* ── 1. ENCABEZADO INSTITUCIONAL OFICIAL EXTRA SUPERMERCADO ── */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-indigo-600 pb-3">
              <div className="flex items-start gap-3.5">
                <img
                  src="/logo_extra.png"
                  alt="Extra Supermercado Mayorista"
                  className="h-12 w-auto object-contain flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none"
                  }}
                />
                <div className="space-y-0.5">
                  <h1 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight m-0">
                    Extra Supermercado Mayorista
                  </h1>
                  <p className="text-[11px] font-black text-indigo-600 leading-tight m-0 uppercase tracking-wide">
                    GRUPO SANTA TERESA E.A.S.
                  </p>
                  <div className="text-[10px] text-slate-500 leading-relaxed pt-0.5">
                    <div><strong>RUC:</strong> 80150377-9 · <strong>Timbrado:</strong> 18545636</div>
                    <div>Alejo García esquina Carlos Antonio López — Pedro Juan Caballero, Amambay, Paraguay</div>
                    <div>Teléfono: +595 992 052200 · Email: contacto@superextra.com.py</div>
                  </div>
                </div>
              </div>

              {/* Recuadro Oficial de Expediente de Devolución */}
              <div className="sm:text-right space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-300 min-w-[220px]">
                <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
                  Remito Oficial de Devolución
                </span>
                <div className="text-lg font-black font-mono text-indigo-600 leading-none pt-0.5">
                  N° {codigo}
                </div>
                <div className="text-[10.5px] text-slate-600 pt-0.5">
                  Fecha Emisión: <strong>{devolucion.fecha_creacion ? formatDateTime(devolucion.fecha_creacion) : devolucion.fecha ? formatDate(devolucion.fecha) : formatDateTime(new Date())}</strong>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Depósito Origen: <strong>{almacen}</strong>
                </div>
              </div>
            </div>

            {/* ── 2. BANNER DE TRAZABILIDAD & IMPACTO EN STOCK POR ETAPAS ── */}
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                yaImpactoStock
                  ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                  : estado === "autorizado"
                  ? "bg-blue-50 border-blue-500 text-blue-950"
                  : estado === "rechazado"
                  ? "bg-rose-50 border-rose-500 text-rose-950"
                  : "bg-amber-50 border-amber-500 text-amber-950"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {yaImpactoStock ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : estado === "autorizado" ? (
                  <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                ) : estado === "rechazado" ? (
                  <Ban className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-black uppercase tracking-wide block text-xs">
                    {yaImpactoStock
                      ? "✓ STOCK EGRESADO DEL INVENTARIO — SALIDA FÍSICA CONFIRMADA"
                      : estado === "autorizado"
                      ? "SALIDA AUTORIZADA — PENDIENTE DE RETIRO EN DEPÓSITO"
                      : estado === "rechazado"
                      ? "SOLICITUD RECHAZADA — SIN IMPACTO EN STOCK"
                      : "SOLICITUD EN TRÁMITE — SIN EGRESO DE INVENTARIO"}
                  </span>
                  <span className="text-[10.5px] block opacity-90 leading-tight mt-0.5">
                    {yaImpactoStock
                      ? `Se descontaron ${totalBultos} unidades del depósito bajo movimiento Kardex 'devolucion_proveedor'. Saldo de compra imputado.`
                      : estado === "autorizado"
                      ? "Devolución aprobada comercialmente. Mercadería separada en zona de despacho para entrega física a transportista."
                      : estado === "rechazado"
                      ? `Motivo de rechazo: ${devolucion.motivo_rechazo || "No cumple condiciones de devolución comercial"}.`
                      : "Solicitud registrada en revisión. No descuenta stock físico ni contable hasta su autorización y entrega."}
                  </span>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">IMPACTO EN STOCK:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase inline-block font-mono ${
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

            {/* ── 3. TIMELINE DE 4 ETAPAS DEL CIRCUITO ADMINISTRATIVO ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className={`p-2 rounded-lg border ${devolucion.fecha_creacion || devolucion.fecha ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 1</span>
                <span className="font-black text-slate-900 block text-[10.5px]">1. Solicitud Registrada</span>
                <span className="text-slate-500 block">{devolucion.fecha_creacion ? formatDate(devolucion.fecha_creacion) : devolucion.fecha ? formatDate(devolucion.fecha) : "Completada"}</span>
                <span className="font-mono text-[9px] text-emerald-700 font-bold">✓ En Sistema</span>
              </div>

              <div className={`p-2 rounded-lg border ${devolucion.autorizado_at || estado === "autorizado" || yaImpactoStock ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 2</span>
                <span className="font-black text-slate-900 block text-[10.5px]">2. Aprobación Comercial</span>
                <span className="text-slate-500 block">{devolucion.autorizado_at ? formatDate(devolucion.autorizado_at) : estado === "autorizado" || yaImpactoStock ? "Aprobada" : "En Espera"}</span>
                <span className={`font-mono text-[9px] font-bold ${devolucion.autorizado_at || estado === "autorizado" || yaImpactoStock ? "text-blue-700" : "text-slate-400"}`}>
                  {devolucion.autorizado_at || estado === "autorizado" || yaImpactoStock ? "✓ Aprobada" : "Pendiente"}
                </span>
              </div>

              <div className={`p-2 rounded-lg border ${yaImpactoStock ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 3</span>
                <span className="font-black text-slate-900 block text-[10.5px]">3. Salida Física / Kardex</span>
                <span className="text-slate-500 block">{devolucion.completado_at ? formatDate(devolucion.completado_at) : yaImpactoStock ? "Egresada" : "En Depósito"}</span>
                <span className={`font-mono text-[9px] font-bold ${yaImpactoStock ? "text-emerald-700" : "text-slate-400"}`}>
                  {yaImpactoStock ? "✓ Egreso Confirmado" : "Pendiente Retiro"}
                </span>
              </div>

              <div className={`p-2 rounded-lg border ${devolucion.nota_credito_numero ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
                <span className="font-bold text-slate-400 block uppercase text-[8px]">Etapa 4</span>
                <span className="font-black text-slate-900 block text-[10.5px]">4. Nota de Crédito</span>
                <span className="text-slate-500 block font-mono">{devolucion.nota_credito_numero || "A liquidar"}</span>
                <span className={`font-mono text-[9px] font-bold ${devolucion.nota_credito_numero ? "text-emerald-700" : "text-slate-400"}`}>
                  {devolucion.nota_credito_numero ? "✓ Liquidado" : "Pendiente"}
                </span>
              </div>
            </div>

            {/* ── 4. PANELES DE INFORMACIÓN EN 2 COLUMNAS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Proveedor */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-1">
                <div className="font-black uppercase tracking-wider text-[10px] text-indigo-600 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                  <Building2 className="w-3.5 h-3.5" /> Datos del Proveedor Destinatario
                </div>
                <div><strong>Razón Social:</strong> {proveedorNombre}</div>
                <div><strong>RUC:</strong> <span className="font-mono">{proveedorRuc}</span></div>
                <div><strong>Teléfono:</strong> <span className="font-mono">{proveedorTel}</span></div>
                <div><strong>Dirección:</strong> {proveedorDir}</div>
              </div>

              {/* Condiciones y Transporte */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 space-y-1">
                <div className="font-black uppercase tracking-wider text-[10px] text-indigo-600 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                  <FileCheck className="w-3.5 h-3.5" /> Condiciones de Imputación y Retiro
                </div>
                <div><strong>Factura Afectada:</strong> <span className="font-mono font-bold">{items[0]?.factura_numero || devolucion.raw?.numero_factura_origen || "Ajuste Directo / Sin Factura"}</span></div>
                <div><strong>Moneda de Operación:</strong> Guaraníes (PYG)</div>
                <div><strong>Depósito de Despacho:</strong> {almacen}</div>
                <div><strong>Fecha Estimada Retiro:</strong> {devolucion.fecha_estimada_retiro ? formatDate(devolucion.fecha_estimada_retiro) : "Coordinación inmediata"}</div>
              </div>
            </div>

            {/* ── 5. TABLA PREMIUM DE MERCADERÍA DEVUELTA ── */}
            <div className="overflow-x-auto w-full border border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider border-b border-slate-900">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2 w-24">Cód. Interno</th>
                    <th className="p-2 w-32">Cód. Barra</th>
                    <th className="p-2">Descripción del Producto</th>
                    <th className="p-2 w-28">Lote / Vto.</th>
                    <th className="p-2 w-28">Motivo</th>
                    <th className="p-2 text-right w-16">Cant.</th>
                    <th className="p-2 text-right w-24">Unitario Gs.</th>
                    <th className="p-2 text-right w-28">Subtotal Gs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                        No hay ítems registrados en el detalle de esta devolución.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const cant = Number(it.cantidad || 0)
                      const unit = Number(it.valor_unitario || 0)
                      const sub = Number(it.valor_total || (cant * unit))
                      const isEven = idx % 2 === 0
                      const skuVal = it.sku || it.codigo_interno || "—"
                      const barVal = it.codigo_barra || it.codigo_barras || "—"

                      return (
                        <tr
                          key={idx}
                          className={`${isEven ? "bg-white" : "bg-slate-50/80"} hover:bg-slate-100 transition-colors`}
                        >
                          <td className="p-2 text-center font-mono text-slate-400 text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-mono font-semibold text-slate-700 text-[10px]">
                            {skuVal}
                          </td>
                          <td className="p-2 font-mono text-slate-500 text-[10px]">
                            {barVal}
                          </td>
                          <td className="p-2 font-bold text-slate-900">
                            {it.producto_nombre || "Producto"}
                            {it.detalle && (
                              <span className="block text-[9px] font-normal text-slate-500 italic mt-0.5">
                                Nota: {it.detalle}
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-[9.5px] text-slate-600">
                            {it.lote ? `Lote: ${it.lote}` : ""}
                            {it.fecha_vencimiento ? `${it.lote ? " · " : ""}Vto: ${it.fecha_vencimiento}` : (!it.lote ? "—" : "")}
                          </td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[8.5px] uppercase tracking-wide">
                              {it.motivo || "Devolución"}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-black text-slate-900">
                            {cant.toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {formatPYG(unit)}
                          </td>
                          <td className="p-2 text-right font-mono font-black text-slate-900">
                            {formatPYG(sub)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── 6. TOTALES Y OBSERVACIONES ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2 text-xs">
                {devolucion.observaciones && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-700">
                    <strong className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Observaciones Generales:</strong>
                    <p className="m-0 text-[11px] leading-relaxed italic">"{devolucion.observaciones}"</p>
                  </div>
                )}
                {devolucion.nota_credito_numero && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-[11px] flex items-center justify-between">
                    <span>Nota de Crédito Vinculada:</span>
                    <span className="font-mono text-xs">{devolucion.nota_credito_numero}</span>
                  </div>
                )}
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden text-xs self-start">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex justify-between">
                  <span className="text-slate-600 font-bold">Total Unidades Egresadas:</span>
                  <span className="font-mono font-black text-slate-900">{totalBultos.toLocaleString()} UN</span>
                </div>
                <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                  <span className="font-black uppercase tracking-wider text-xs">TOTAL DEVOLUCIÓN (PYG):</span>
                  <span className="font-mono font-black text-lg text-emerald-400">{formatPYG(totalDevuelto)}</span>
                </div>
              </div>
            </div>

            {/* ── 7. CASILLAS PARA LAS 4 FIRMAS PERTINENTES Y SELLOS (CONTROL INTERNO TOTAL) ── */}
            <div className="pt-6 border-t border-slate-300 page-break-avoid">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-center mb-3">
                CONSTANCIA DE CONFORMIDAD Y CIRCUITOS DE AUTORIZACIÓN (EXTRA SUPERMERCADO MAYORISTA)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[10.5px]">
                {/* 1. Depósito */}
                <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[125px]">
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-indigo-700">
                    <Building2 className="w-3 h-3" /> 1. Depósito / Mermas
                  </div>
                  <div className="mt-10 border-t border-slate-400 pt-1 text-[9.5px]">
                    <div className="font-black text-slate-800">Entregó Mercadería</div>
                    <div className="text-[8.5px] text-slate-500">Firma, Aclaración y C.I.</div>
                  </div>
                </div>

                {/* 2. Administración / Compras */}
                <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[125px]">
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-indigo-700">
                    <UserCheck className="w-3 h-3" /> 2. Compras / Admin.
                  </div>
                  <div className="mt-10 border-t border-slate-400 pt-1 text-[9.5px]">
                    <div className="font-black text-slate-800">Autorizó Devolución</div>
                    <div className="text-[8.5px] text-slate-500">Firma, Aclaración y C.I.</div>
                  </div>
                </div>

                {/* 3. Seguridad / Portería */}
                <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[125px]">
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-indigo-700">
                    <ShieldCheck className="w-3 h-3" /> 3. Portería / Salida
                  </div>
                  <div className="mt-10 border-t border-slate-400 pt-1 text-[9.5px]">
                    <div className="font-black text-slate-800">Control de Bultos</div>
                    <div className="text-[8.5px] text-slate-500">Firma, C.I. y Hora Salida</div>
                  </div>
                </div>

                {/* 4. Transportista / Proveedor */}
                <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/70 flex flex-col justify-between min-h-[125px]">
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-rose-700">
                    <Truck className="w-3 h-3" /> 4. Transportista
                  </div>
                  <div className="mt-10 border-t border-slate-400 pt-1 text-[9.5px]">
                    <div className="font-black text-slate-800">Recibí Conforme</div>
                    <div className="text-[8.5px] text-slate-500">Aclaración, C.I. y Chapa</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 8. PIE DE PÁGINA FISCAL & LEGAL ── */}
            <div className="pt-3 border-t border-slate-200 text-center text-[8.5px] text-slate-400 font-mono">
              Extra Supermercado Mayorista · GRUPO SANTA TERESA E.A.S. · RUC 80150377-9 · Pedro Juan Caballero, Paraguay · Documento válido para amparo logístico de mercadería en tránsito
            </div>
          </div>
        </div>

        {/* Barra inferior del Modal */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 no-print">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {yaImpactoStock ? "✓ Stock egresado formalmente de Kardex" : "⚠️ Mercadería en trámite / pendiente de firma de entrega"}
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
              className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/25"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Remito A4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DevolucionProveedorPrintModal
