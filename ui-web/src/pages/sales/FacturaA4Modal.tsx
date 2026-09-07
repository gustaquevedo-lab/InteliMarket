import React, { useState, useEffect, useMemo } from "react"
import {
  Printer, FileDown, X, ShieldCheck, Check, Loader2, QrCode, Receipt
} from "lucide-react"
import { type Sale, type Customer, api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface FacturaA4ModalProps {
  sale: Sale
  customer?: Customer | null
  onClose: () => void
  timbrado?: string
  timbradoVencimiento?: string
}

// Formateador oficial de fecha y hora para Paraguay (America/Asuncion)
function formatFechaFacturaPY(dateVal: string | Date | undefined): string {
  if (!dateVal) return "—"
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal
    return new Intl.DateTimeFormat("es-PY", {
      timeZone: "America/Asuncion",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return String(dateVal)
  }
}

// Convertidor de importes a letras en español (formato legal SET Guaraníes)
function numeroALetras(monto: number): string {
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
  const diez_a_diecinueve = [
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
    "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
  ]
  const veintis = [
    "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO",
    "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"
  ]
  const decenas = [
    "", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
    "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
  ]
  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
    "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
  ]

  function leerCentenas(n: number): string {
    if (n === 0) return ""
    if (n === 100) return "CIEN"
    let str = ""
    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10

    if (c > 0) str += centenas[c] + " "
    if (d === 1) {
      str += diez_a_diecinueve[u]
      return str.trim()
    } else if (d === 2) {
      str += veintis[u]
      return str.trim()
    } else if (d > 2) {
      str += decenas[d]
      if (u > 0) str += " Y " + unidades[u]
      return str.trim()
    }
    if (u > 0) str += unidades[u]
    return str.trim()
  }

  const entero = Math.floor(Math.abs(monto))
  if (entero === 0) return "CERO"

  const millones = Math.floor(entero / 1_000_000)
  const miles = Math.floor((entero % 1_000_000) / 1_000)
  const resto = entero % 1_000

  let resultado = ""
  if (millones > 0) {
    if (millones === 1) resultado += "UN MILLÓN "
    else resultado += leerCentenas(millones) + " MILLONES "
  }
  if (miles > 0) {
    if (miles === 1) resultado += "MIL "
    else resultado += leerCentenas(miles) + " MIL "
  }
  if (resto > 0) {
    resultado += leerCentenas(resto)
  }

  return resultado.trim()
}

export default function FacturaA4Modal({
  sale,
  customer,
  onClose,
  timbrado = "18545636",
  timbradoVencimiento = "31/12/2026",
}: FacturaA4ModalProps) {
  const [items, setItems] = useState<any[]>(sale.items || [])
  const [loadingItems, setLoadingItems] = useState(false)
  const [printMode, setPrintMode] = useState<"a4" | "ticket">("a4")
  const toast = useToast()

  // Cierre con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Carga reactiva de los ítems reales de la venta si faltaban
  useEffect(() => {
    let cancelled = false
    if (!sale.items || sale.items.length === 0) {
      setLoadingItems(true)
      api.sales.getItems(sale.id)
        .then((data) => {
          if (!cancelled && data && data.length > 0) {
            setItems(data)
          }
        })
        .catch((err) => {
          console.warn("No se pudieron cargar los ítems detallados:", err)
        })
        .finally(() => {
          if (!cancelled) setLoadingItems(false)
        })
    } else {
      setItems(sale.items)
    }
    return () => {
      cancelled = true
    }
  }, [sale])

  // Datos fiscales de emisor oficiales (Extra Supermercado)
  const emisor = {
    razonSocial: "GRUPO SANTA TERESA E.A.S.",
    nombreFantasia: "Extra Supermercado Mayorista",
    ruc: "80150377-9",
    actividad: "Venta al por mayor y menor de mercaderías generales en supermercado",
    direccion: "Supercarretera Itaipú c/ Av. Los Yerbales",
    ciudad: "Hernandarias, Alto Paraná - Paraguay",
    telefono: "(0983) 123-456 / (0631) 22-000",
  }

  // Datos de cliente / receptor
  const custName = customer?.razon_social || (sale as any).customer_nombre || (sale as any).customer_name || "CONSUMIDOR FINAL"
  const custRuc = customer?.ruc || (sale as any).customer_doc || (sale as any).customer_ruc || "44444401-7"
  const custAddress = customer?.direccion || "Hernandarias / Ciudad del Este"
  const custPhone = customer?.telefono || "—"

  // Condición de Venta
  const isCredito = sale.condicion === "credito" || sale.condicion === "credito_extra_club"
  const condicionLabel = isCredito ? "CRÉDITO" : "CONTADO"

  // Desglose oficial de IVA y Columnas de Ventas (Exenta, 5%, 10%)
  const desglose = useMemo(() => {
    let subtotalExenta = 0
    let subtotal5 = 0
    let subtotal10 = 0

    items.forEach((item: any) => {
      const cant = Number(item.cantidad || 1)
      const pu = Number(item.precio_unitario || item.precio || 0)
      const desc = Number(item.descuento_monto || 0)
      const lineTotal = Number(item.total || (cant * pu - desc))
      const tasa = Number(item.iva_tasa !== undefined ? item.iva_tasa : 10)

      if (tasa === 0) {
        subtotalExenta += lineTotal
      } else if (tasa === 5) {
        subtotal5 += lineTotal
      } else {
        subtotal10 += lineTotal
      }
    })

    const totalCalculado = subtotalExenta + subtotal5 + subtotal10
    const totalFactura = Number(sale.total || totalCalculado || 0)

    // Liquidación IVA según fórmula SET (IVA 10% = Total / 11, IVA 5% = Total / 21)
    const iva5 = Math.round(subtotal5 / 21) || Number(sale.iva_5 || 0)
    const iva10 = Math.round(subtotal10 / 11) || Number(sale.iva_10 || 0)
    const totalIva = iva5 + iva10

    return {
      subtotalExenta,
      subtotal5,
      subtotal10,
      totalFactura,
      iva5,
      iva10,
      totalIva,
    }
  }, [items, sale])

  const handlePrint = (mode: "a4" | "ticket" = "a4") => {
    setPrintMode(mode)
    setTimeout(() => {
      window.print()
      toast.success(
        "Impresión enviada",
        mode === "a4" ? "Enviando Factura A4 a la impresora del sistema..." : "Enviando comprobante térmico..."
      )
    }, 100)
  }

  const handleDownloadPdf = async () => {
    try {
      toast.info("Generando PDF", "Preparando Factura Legal A4...")
      const res = await fetch(`/api/v1/receipts/sales/${sale.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      })
      if (!res.ok) throw new Error("No se pudo descargar el PDF de la factura")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Factura_${sale.numero || sale.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Descarga Exitosa", "Factura A4 descargada correctamente.")
    } catch (err: any) {
      toast.error("Error al descargar PDF", err.message || "No disponible")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @media print {
          @page {
            size: ${printMode === "ticket" ? "80mm auto" : "A4 portrait"};
            margin: ${printMode === "ticket" ? "0" : "8mm 10mm 8mm 10mm"};
          }
          body * {
            visibility: hidden !important;
          }
          #factura-a4-sheet, #factura-a4-sheet * {
            visibility: visible !important;
          }
          #factura-a4-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: ${printMode === "ticket" ? "4mm" : "0"} !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Tarjeta Envolvente del Modal */}
      <div
        className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ maxHeight: "min(92vh, 900px)" }}
      >
        {/* Barra Superior de Herramientas (no-print) */}
        <div className="no-print bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                  Factura Legal A4 (Formato Aprobado SET / DNIT)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono">
                  Timbrado #{timbrado}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Comprobante oficial con validez tributaria · Original y Duplicado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint("a4")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-blue-500/20"
              title="Imprimir documento oficial en hoja A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir A4</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              title="Descargar archivo PDF A4"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={() => handlePrint("ticket")}
              className="hidden md:flex bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-2 rounded-xl text-xs font-medium items-center gap-1 transition"
              title="Opción secundaria para ticketera térmica 80mm"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span className="text-[11px]">80mm</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenedor del Visor / Hoja A4 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70 dark:bg-slate-900/90 flex justify-center">
          {/* ══════════════ HOJA OFICIAL A4 PARA PANTALLA E IMPRESIÓN ══════════════ */}
          <div
            id="factura-a4-sheet"
            className="bg-white text-black w-full max-w-[210mm] min-h-[280mm] p-6 sm:p-8 shadow-xl border border-slate-300 font-sans text-xs flex flex-col justify-between"
            style={{ boxSizing: "border-box" }}
          >
            <div>
              {/* ── 1. ENCABEZADO: DATOS DE LA EMPRESA & TIMBRADO SET ── */}
              <div className="grid grid-cols-12 gap-3 pb-3 border-b-2 border-black">
                {/* Lado Izquierdo: Emisor */}
                <div className="col-span-7 sm:col-span-8 flex items-start gap-3">
                  <img
                    src="/logo_extra.png"
                    alt="Extra Supermercado Mayorista"
                    className="h-16 w-auto object-contain flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none"
                    }}
                  />
                  <div className="min-w-0">
                    <h1 className="font-black text-sm uppercase tracking-tight text-black leading-tight">
                      {emisor.razonSocial}
                    </h1>
                    <p className="font-bold text-xs text-black">
                      {emisor.nombreFantasia}
                    </p>
                    <p className="text-[10px] text-gray-700 leading-tight mt-0.5">
                      {emisor.actividad}
                    </p>
                    <p className="text-[10px] text-gray-700 leading-tight mt-0.5">
                      {emisor.direccion} · {emisor.ciudad}
                    </p>
                    <p className="text-[10px] text-gray-700 font-mono">
                      Tel: {emisor.telefono}
                    </p>
                  </div>
                </div>

                {/* Lado Derecho: Recuadro Oficial Timbrado SET */}
                <div className="col-span-5 sm:col-span-4 border-2 border-black rounded-lg p-2 text-center flex flex-col justify-center bg-gray-50/50">
                  <div className="text-[10px] font-bold">TIMBRADO Nº {timbrado}</div>
                  <div className="text-[9px] text-gray-600">
                    Válido hasta: {timbradoVencimiento}
                  </div>
                  <div className="text-[11px] font-mono font-black mt-0.5">
                    RUC: {emisor.ruc}
                  </div>
                  <div className="bg-black text-white text-xs font-black py-0.5 my-1 uppercase tracking-widest">
                    FACTURA
                  </div>
                  <div className="font-mono font-black text-sm tracking-tight">
                    Nº {sale.numero || `001-011-00${sale.id.slice(-5)}`}
                  </div>
                </div>
              </div>

              {/* ── 2. DATOS DEL CLIENTE / RECEPTOR (RECUADRO LEGAL) ── */}
              <div className="mt-3 border border-black rounded-lg p-2.5 text-[11px] space-y-1 bg-white">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <span className="font-bold">Fecha de Emisión: </span>
                    <span className="font-mono">
                      {formatFechaFacturaPY(sale.fecha || sale.created_at)}
                    </span>
                  </div>
                  <div className="col-span-5 flex items-center justify-end gap-3">
                    <span className="font-bold">Condición de Venta:</span>
                    <label className="flex items-center gap-1 font-mono text-[10px]">
                      <span className="inline-block w-3.5 h-3.5 border border-black text-center leading-3 font-bold text-[9px]">
                        {!isCredito ? "X" : ""}
                      </span>
                      CONTADO
                    </label>
                    <label className="flex items-center gap-1 font-mono text-[10px]">
                      <span className="inline-block w-3.5 h-3.5 border border-black text-center leading-3 font-bold text-[9px]">
                        {isCredito ? "X" : ""}
                      </span>
                      CRÉDITO
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 pt-0.5">
                  <div className="col-span-8">
                    <span className="font-bold">Nombre o Razón Social: </span>
                    <span className="uppercase font-semibold">{custName}</span>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="font-bold">R.U.C. / C.I. Nº: </span>
                    <span className="font-mono font-bold">{custRuc}</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 pt-0.5 text-[10px] text-gray-800">
                  <div className="col-span-8">
                    <span className="font-bold">Dirección: </span>
                    <span>{custAddress}</span>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="font-bold">Teléfono: </span>
                    <span>{custPhone}</span>
                  </div>
                </div>
              </div>

              {/* ── 3. TABLA OFICIAL DE ÍTEMS Y MERCADERÍAS (SET 7 COLS) ── */}
              <div className="mt-3 border border-black rounded-lg overflow-hidden">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-black border-b border-black font-bold text-center">
                      <th className="py-1.5 px-2 border-r border-black w-[8%]">CANT.</th>
                      <th className="py-1.5 px-2 border-r border-black w-[12%]">CÓDIGO</th>
                      <th className="py-1.5 px-2 border-r border-black text-left w-[44%]">
                        DESCRIPCIÓN DE MERCADERÍAS Y/O SERVICIOS
                      </th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-[12%]">
                        PRECIO UNIT.
                      </th>
                      <th className="py-1.5 px-1 border-r border-black text-right w-[8%]">
                        EXENTAS
                      </th>
                      <th className="py-1.5 px-1 border-r border-black text-right w-[8%]">
                        5%
                      </th>
                      <th className="py-1.5 px-1 text-right w-[8%]">10%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingItems ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                          Cargando detalle de ítems...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-500 italic">
                          Sin ítems cargados en el comprobante
                        </td>
                      </tr>
                    ) : (
                      items.map((item: any, idx: number) => {
                        const cant = Number(item.cantidad || 1)
                        const pu = Number(item.precio_unitario || item.precio || 0)
                        const desc = Number(item.descuento_monto || 0)
                        const lineTotal = Number(item.total || (cant * pu - desc))
                        const tasa = Number(item.iva_tasa !== undefined ? item.iva_tasa : 10)

                        const exenta = tasa === 0 ? lineTotal : 0
                        const v5 = tasa === 5 ? lineTotal : 0
                        const v10 = tasa === 10 || tasa > 5 ? lineTotal : 0

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-1 px-2 border-r border-black text-center font-mono font-semibold">
                              {cant}
                            </td>
                            <td className="py-1 px-2 border-r border-black font-mono text-[9px] text-gray-600">
                              {item.product_sku || (item.product_id ? item.product_id.slice(0, 8) : "—")}
                            </td>
                            <td className="py-1 px-2 border-r border-black uppercase font-medium">
                              {item.descripcion || item.product_name || "Producto"}
                            </td>
                            <td className="py-1 px-2 border-r border-black text-right font-mono">
                              {formatPYG(pu)}
                            </td>
                            <td className="py-1 px-1 border-r border-black text-right font-mono">
                              {exenta > 0 ? formatPYG(exenta) : "0"}
                            </td>
                            <td className="py-1 px-1 border-r border-black text-right font-mono">
                              {v5 > 0 ? formatPYG(v5) : "0"}
                            </td>
                            <td className="py-1 px-1 text-right font-mono font-semibold">
                              {v10 > 0 ? formatPYG(v10) : "0"}
                            </td>
                          </tr>
                        )
                      })
                    )}

                    {/* Filas vacías estéticas para mantener cuerpo de hoja A4 SET */}
                    {items.length > 0 && items.length < 8 &&
                      Array.from({ length: 8 - items.length }).map((_, i) => (
                        <tr key={`fill-${i}`} className="h-5">
                          <td className="border-r border-black">&nbsp;</td>
                          <td className="border-r border-black">&nbsp;</td>
                          <td className="border-r border-black">&nbsp;</td>
                          <td className="border-r border-black">&nbsp;</td>
                          <td className="border-r border-black">&nbsp;</td>
                          <td className="border-r border-black">&nbsp;</td>
                          <td>&nbsp;</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>

              {/* ── 4. SUB TOTALES POR TASA DE IVA ── */}
              <div className="border-x border-b border-black rounded-b-lg grid grid-cols-12 text-[10px] bg-gray-50 font-bold">
                <div className="col-span-8 py-1.5 px-3 border-r border-black text-right">
                  SUBTOTALES:
                </div>
                <div className="col-span-1 py-1.5 px-1 border-r border-black text-right font-mono">
                  {formatPYG(desglose.subtotalExenta)}
                </div>
                <div className="col-span-1 py-1.5 px-1 border-r border-black text-right font-mono">
                  {formatPYG(desglose.subtotal5)}
                </div>
                <div className="col-span-2 py-1.5 px-1 text-right font-mono">
                  {formatPYG(desglose.subtotal10)}
                </div>
              </div>

              {/* ── 5. TOTAL A PAGAR EN NÚMEROS Y EN LETRAS ── */}
              <div className="mt-2 border-2 border-black rounded-lg p-2 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-700">
                    <span className="font-bold">TOTAL A PAGAR EN GUARANÍES:</span>
                  </div>
                  <div className="font-mono font-black text-base text-black">
                    Gs. {formatPYG(desglose.totalFactura)}
                  </div>
                </div>
                <div className="text-[10px] border-t border-gray-300 pt-1">
                  <span className="font-bold">SON: </span>
                  <span className="font-mono uppercase font-bold text-gray-900">
                    {numeroALetras(desglose.totalFactura)} GUARANÍES
                  </span>
                </div>
              </div>

              {/* ── 6. LIQUIDACIÓN DEL IVA (DNIT / SET) ── */}
              <div className="mt-2 border border-black rounded-lg p-2 text-[10px] grid grid-cols-12 gap-2 bg-gray-50/50">
                <div className="col-span-3 font-bold">
                  LIQUIDACIÓN DEL I.V.A.:
                </div>
                <div className="col-span-3">
                  <span className="font-semibold">(5%): </span>
                  <span className="font-mono font-bold">Gs. {formatPYG(desglose.iva5)}</span>
                </div>
                <div className="col-span-3">
                  <span className="font-semibold">(10%): </span>
                  <span className="font-mono font-bold">Gs. {formatPYG(desglose.iva10)}</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="font-bold">TOTAL I.V.A.: </span>
                  <span className="font-mono font-black">Gs. {formatPYG(desglose.totalIva)}</span>
                </div>
              </div>
            </div>

            {/* ── 7. PIE DE PÁGINA LEGAL & CONTROL TRIBUTARIO ── */}
            <div className="mt-4 pt-3 border-t border-dashed border-gray-400 text-[9px] text-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold uppercase tracking-wider text-black">
                    ORIGINAL: Comprador &nbsp;·&nbsp; DUPLICADO: Archivo Tributario
                  </p>
                  <p className="mt-0.5 text-gray-500">
                    Autorizado como Autoimpresor por Resolución SET / DNIT Nº {timbrado}
                  </p>
                </div>
                <div className="text-right font-mono text-[8px] text-gray-400">
                  ID VENTA: {sale.id}
                </div>
              </div>

              {/* Control SIFEN si existe CDC */}
              {sale.cdc && (
                <div className="mt-2 p-1.5 bg-blue-50 border border-blue-200 rounded flex items-center justify-between text-[9px]">
                  <div>
                    <span className="font-bold text-blue-900">CDC (SIFEN Factura Electrónica): </span>
                    <span className="font-mono text-blue-950 font-bold">{sale.cdc}</span>
                  </div>
                  <div className="text-blue-700 font-mono text-[8px]">
                    e-Kuatia SET
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pie de modal para pantalla (no-print) */}
        <div className="no-print bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Comprobante Oficial Nº {sale.numero || sale.id.slice(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
            <button
              onClick={() => handlePrint("a4")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-blue-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Factura A4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
