import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Printer, FileDown, X, ShieldCheck, Check, Loader2, QrCode, Receipt, Layers
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

// 24 ítems por hoja A4 aprovechan el alto del papel sin dejar gaps excesivos
// y garantizan que el pie de página nunca se corte.
const ITEMS_PER_PAGE = 24

export default function FacturaA4Modal({
  sale,
  customer,
  onClose,
  timbrado = "18545636",
  timbradoVencimiento = "31/12/2026",
}: FacturaA4ModalProps) {
  const [items, setItems] = useState<any[]>(sale.items || [])
  const [loadingItems, setLoadingItems] = useState(false)
  const printContainerRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Carga reactiva de los ítems reales de la venta (con nombres y SKUs cruzados desde products)
  useEffect(() => {
    let cancelled = false
    setLoadingItems(true)
    api.sales.getItems(sale.id)
      .then((data) => {
        if (!cancelled && data && data.length > 0) {
          setItems(data)
        } else if (!cancelled && sale.items && sale.items.length > 0) {
          setItems(sale.items)
        }
      })
      .catch((err) => {
        console.warn("No se pudieron cargar los ítems detallados:", err)
        if (!cancelled && sale.items) setItems(sale.items)
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false)
      })
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

  // Desglose oficial de IVA y Columnas de Ventas (Exenta, 5%, 10%)
  const desglose = useMemo(() => {
    let subtotalExenta = 0
    let subtotal5 = 0
    let subtotal10 = 0

    items.forEach((item: any) => {
      const cant = Number(item.cantidad || 1)
      const pu = Number(item.precio_unitario || item.precio || 0)
      const desc = Number(item.descuento_monto || 0)
      const lineTotal = Number(item.total !== undefined ? item.total : (cant * pu - desc))
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

    // Liquidación IVA según fórmula oficial SET (IVA 10% = Total / 11, IVA 5% = Total / 21)
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

  // ── DIVISIÓN MULTIPÁGINA REGLAMENTARIA (SET / DNIT) ──────────────────────
  const pagesData = useMemo(() => {
    if (items.length === 0) {
      return [{
        pageIndex: 0,
        pageNumber: 1,
        totalPages: 1,
        items: [],
        carryOverIn: 0,
        pageTotal: 0,
        carryOverOut: 0,
        isFirstPage: true,
        isLastPage: true,
      }]
    }

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1
    const pages = []
    let cumulative = 0

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageStart = pIdx * ITEMS_PER_PAGE
      const pageEnd = pageStart + ITEMS_PER_PAGE
      const pageItems = items.slice(pageStart, pageEnd)

      const carryOverIn = cumulative
      const pageTotal = pageItems.reduce((acc, it) => {
        const cant = Number(it.cantidad || 1)
        const pu = Number(it.precio_unitario || it.precio || 0)
        const desc = Number(it.descuento_monto || 0)
        return acc + Number(it.total !== undefined ? it.total : (cant * pu - desc))
      }, 0)

      cumulative += pageTotal
      const carryOverOut = cumulative

      pages.push({
        pageIndex: pIdx,
        pageNumber: pIdx + 1,
        totalPages,
        items: pageItems,
        carryOverIn,
        pageTotal,
        carryOverOut,
        isFirstPage: pIdx === 0,
        isLastPage: pIdx === totalPages - 1,
      })
    }

    return pages
  }, [items])

  // ── IMPRESIÓN AISLADA BULLETPROOF (IFRAME LIMPIO) ────────────────────────
  // Resuelve el problema donde Chrome/Edge corta después de la hoja 1 cuando se
  // imprime desde un modal que tiene position:fixed / overflow-y:auto en React.
  const handlePrint = (mode: "a4" | "ticket" = "a4") => {
    const container = printContainerRef.current
    if (!container) {
      window.print()
      return
    }

    let iframe = document.getElementById("factura-print-iframe") as HTMLIFrameElement
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.id = "factura-print-iframe"
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      iframe.style.opacity = "0"
      iframe.style.pointerEvents = "none"
      document.body.appendChild(iframe)
    }

    const doc = iframe.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    const printableHtml = container.innerHTML

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Factura ${sale.numero || sale.id}</title>
          <style>
            @page {
              size: ${mode === "ticket" ? "80mm auto" : "A4 portrait"};
              margin: ${mode === "ticket" ? "0" : "5mm 7mm 5mm 7mm"};
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff !important;
              color: #000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: 9px;
              line-height: 1.2;
            }
            .factura-a4-page {
              width: 100%;
              min-height: 278mm;
              max-height: 282mm;
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 2mm 2mm 3mm 2mm;
              box-sizing: border-box;
              overflow: hidden;
              background: #fff !important;
            }
            .factura-a4-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          </style>
          <link rel="stylesheet" href="/index.css">
        </head>
        <body>
          ${printableHtml}
        </body>
      </html>
    `)
    doc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      toast.success(
        "Impresión enviada",
        mode === "a4"
          ? `Factura A4 (${pagesData.length} hoja${pagesData.length > 1 ? "s" : ""}) enviada a la impresora.`
          : "Enviando comprobante térmico..."
      )
    }, 200)
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
            size: A4 portrait;
            margin: 5mm 7mm 5mm 7mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body, #root, .fixed, .overflow-y-auto {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            background: white !important;
          }
          body > *:not(#facturas-print-container) {
            display: none !important;
          }
          #facturas-print-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .factura-a4-page {
            page-break-after: always !important;
            break-after: page !important;
            height: 280mm !important;
            max-height: 282mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 2mm 2mm 3mm 2mm !important;
            box-sizing: border-box !important;
          }
          .factura-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Tarjeta Envolvente del Modal */}
      <div
        className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ maxHeight: "min(92vh, 920px)" }}
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
                  Factura Legal A4 (SET / DNIT)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono">
                  Timbrado #{timbrado}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-mono flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {pagesData.length} Hoja{pagesData.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {items.length} ítems registrados · Foliado correlativo SET con arrastre de saldos
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
              <span>Imprimir A4 ({pagesData.length} hoja{pagesData.length > 1 ? "s" : ""})</span>
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

        {/* Contenedor del Visor / Hojas A4 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70 dark:bg-slate-900/90 flex flex-col items-center gap-6">
          <div ref={printContainerRef} id="facturas-print-container" className="w-full flex flex-col items-center gap-6">
            {pagesData.map((page) => (
              <div
                key={`page-${page.pageNumber}`}
                className="factura-a4-page bg-white text-black w-full max-w-[210mm] min-h-[278mm] max-h-[282mm] p-5 sm:p-7 shadow-xl border border-slate-300 font-sans text-xs flex flex-col justify-between"
                style={{ boxSizing: "border-box" }}
              >
                <div>
                  {/* ── 1. ENCABEZADO: DATOS DE LA EMPRESA & TIMBRADO SET ── */}
                  <div className="grid grid-cols-12 gap-3 pb-2 border-b-2 border-black">
                    {/* Lado Izquierdo: Emisor */}
                    <div className="col-span-7 sm:col-span-8 flex items-start gap-3">
                      <img
                        src="/logo_extra.png"
                        alt="Extra Supermercado Mayorista"
                        className="h-12 w-auto object-contain flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none"
                        }}
                      />
                      <div className="min-w-0">
                        <h1 className="font-black text-[13px] uppercase tracking-tight text-black leading-tight">
                          {emisor.razonSocial}
                        </h1>
                        <p className="font-bold text-[11px] text-black">
                          {emisor.nombreFantasia}
                        </p>
                        <p className="text-[9.5px] text-gray-700 leading-tight mt-0.5">
                          {emisor.actividad}
                        </p>
                        <p className="text-[9px] text-gray-700 leading-tight mt-0.5">
                          {emisor.direccion} · {emisor.ciudad}
                        </p>
                        <p className="text-[9px] text-gray-700 font-mono">
                          Tel: {emisor.telefono}
                        </p>
                      </div>
                    </div>

                    {/* Lado Derecho: Recuadro Oficial Timbrado SET con Foliado */}
                    <div className="col-span-5 sm:col-span-4 border-2 border-black rounded p-1.5 text-center flex flex-col justify-center bg-gray-50/50 relative">
                      {page.totalPages > 1 && (
                        <div className="absolute -top-3 right-2 border-2 border-black bg-white text-black font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider shadow-xs">
                          Hoja {page.pageNumber} de {page.totalPages}
                        </div>
                      )}
                      <div className="text-[9.5px] font-bold">TIMBRADO Nº {timbrado}</div>
                      <div className="text-[8.5px] text-gray-600">
                        Válido hasta: {timbradoVencimiento}
                      </div>
                      <div className="text-[10px] font-mono font-black mt-0.5">
                        RUC: {emisor.ruc}
                      </div>
                      <div
                        style={{
                          backgroundColor: "#000",
                          color: "#fff",
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact",
                        }}
                        className="border border-black font-black text-[11px] py-0.5 my-0.5 uppercase tracking-widest text-center"
                      >
                        FACTURA
                      </div>
                      <div className="font-mono font-black text-xs tracking-tight">
                        Nº {sale.numero || `001-011-00${sale.id.slice(-5)}`}
                      </div>
                    </div>
                  </div>

                  {/* ── 2. DATOS DEL CLIENTE / RECEPTOR (RECUADRO LEGAL) ── */}
                  <div className="mt-2 border border-black rounded p-2 text-[10px] space-y-0.5 bg-white">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <span className="font-bold">Fecha de Emisión: </span>
                        <span className="font-mono">
                          {formatFechaFacturaPY(sale.fecha || sale.created_at)}
                        </span>
                      </div>
                      <div className="col-span-5 flex items-center justify-end gap-3">
                        <span className="font-bold">Condición:</span>
                        <label className="flex items-center gap-1 font-mono text-[9.5px]">
                          <span className="inline-block w-3 h-3 border border-black text-center leading-2.5 font-bold text-[8.5px]">
                            {!isCredito ? "X" : ""}
                          </span>
                          CONTADO
                        </label>
                        <label className="flex items-center gap-1 font-mono text-[9.5px]">
                          <span className="inline-block w-3 h-3 border border-black text-center leading-2.5 font-bold text-[8.5px]">
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

                    <div className="grid grid-cols-12 gap-2 pt-0.5 text-[9px] text-gray-800">
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
                  <div className="mt-2 border border-black rounded overflow-hidden">
                    <table className="w-full text-[9px] border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-black border-b border-black font-bold text-center">
                          <th className="py-1 px-1.5 border-r border-black w-[6%]">CANT.</th>
                          <th className="py-1 px-1.5 border-r border-black w-[13%]">CÓDIGO</th>
                          <th className="py-1 px-1.5 border-r border-black text-left w-[45%]">
                            DESCRIPCIÓN DE MERCADERÍAS Y/O SERVICIOS
                          </th>
                          <th className="py-1 px-1.5 border-r border-black text-right w-[12%]">
                            PRECIO UNIT.
                          </th>
                          <th className="py-1 px-1 border-r border-black text-right w-[8%]">
                            EXENTAS
                          </th>
                          <th className="py-1 px-1 border-r border-black text-right w-[8%]">
                            5%
                          </th>
                          <th className="py-1 px-1 text-right w-[8%]">10%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* ── FILA DE APERTURA POR TRANSPORTE (VIENEN DEL FOLIO ANTERIOR) ── */}
                        {!page.isFirstPage && (
                          <tr className="bg-amber-50/70 font-bold border-b border-black text-amber-950">
                            <td className="py-0.5 px-1.5 border-r border-black text-center font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1.5 border-r border-black font-mono text-[8.5px] text-center">TRANSP.</td>
                            <td className="py-0.5 px-1.5 border-r border-black uppercase text-[9px]">
                              *** VIENEN DEL FOLIO ANTERIOR (HOJA {page.pageNumber - 1}) ***
                            </td>
                            <td className="py-0.5 px-1.5 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 text-right font-mono font-bold">
                              {formatPYG(page.carryOverIn)}
                            </td>
                          </tr>
                        )}

                        {loadingItems ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-gray-500">
                              <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                              Cargando detalle de productos de la factura...
                            </td>
                          </tr>
                        ) : page.items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-gray-500 italic">
                              Sin ítems cargados en el comprobante
                            </td>
                          </tr>
                        ) : (
                          page.items.map((item: any, idx: number) => {
                            const cant = Number(item.cantidad || 1)
                            const pu = Number(item.precio_unitario || item.precio || 0)
                            const desc = Number(item.descuento_monto || 0)
                            const lineTotal = Number(item.total !== undefined ? item.total : (cant * pu - desc))
                            const tasa = Number(item.iva_tasa !== undefined ? item.iva_tasa : 10)

                            const exenta = tasa === 0 ? lineTotal : 0
                            const v5 = tasa === 5 ? lineTotal : 0
                            const v10 = tasa === 10 || tasa > 5 ? lineTotal : 0

                            // Código preferente: SKU -> Código de Barra -> ID corto
                            const itemCode =
                              item.product_sku ||
                              item.codigo_barra ||
                              (item.product_id ? String(item.product_id).slice(0, 8) : "—")

                            // Descripción preferente: descripcion -> product_name
                            const itemDesc = item.descripcion || item.product_name || "Producto"

                            return (
                              <tr key={`item-${page.pageNumber}-${idx}`} className="hover:bg-gray-50/50">
                                <td className="py-0.5 px-1.5 border-r border-black text-center font-mono font-semibold">
                                  {cant}
                                </td>
                                <td className="py-0.5 px-1.5 border-r border-black font-mono text-[8.5px] text-gray-700">
                                  {itemCode}
                                </td>
                                <td className="py-0.5 px-1.5 border-r border-black uppercase font-medium truncate max-w-[280px]" title={itemDesc}>
                                  {itemDesc}
                                </td>
                                <td className="py-0.5 px-1.5 border-r border-black text-right font-mono">
                                  {formatPYG(pu)}
                                </td>
                                <td className="py-0.5 px-1 border-r border-black text-right font-mono">
                                  {exenta > 0 ? formatPYG(exenta) : "0"}
                                </td>
                                <td className="py-0.5 px-1 border-r border-black text-right font-mono">
                                  {v5 > 0 ? formatPYG(v5) : "0"}
                                </td>
                                <td className="py-0.5 px-1 text-right font-mono font-semibold">
                                  {v10 > 0 ? formatPYG(v10) : "0"}
                                </td>
                              </tr>
                            )
                          })
                        )}

                        {/* ── FILA DE ARRASTRE TRIBUTARIO (VAN AL FOLIO SIGUIENTE) EN HOJAS INTERMEDIAS ── */}
                        {!page.isLastPage && (
                          <tr className="bg-amber-50/70 font-bold border-t border-black text-amber-950">
                            <td className="py-0.5 px-1.5 border-r border-black text-center font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1.5 border-r border-black font-mono text-[8.5px] text-center">TRANSP.</td>
                            <td className="py-0.5 px-1.5 border-r border-black uppercase text-[9px]">
                              *** VAN AL FOLIO SIGUIENTE (HOJA {page.pageNumber + 1}) ***
                            </td>
                            <td className="py-0.5 px-1.5 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 border-r border-black text-right font-mono text-[8.5px]">—</td>
                            <td className="py-0.5 px-1 text-right font-mono font-bold">
                              {formatPYG(page.carryOverOut)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── 4. SUBTOTALES POR TASA (O RESUMEN DE PÁGINA INTERMEDIA) ── */}
                  <div className="border-x border-b border-black rounded-b grid grid-cols-12 text-[9.5px] bg-gray-50 font-bold">
                    <div className="col-span-8 py-1 px-2 border-r border-black text-right">
                      {page.isLastPage ? "SUBTOTALES GENERALES:" : `SUBTOTAL ACUMULADO HOJA ${page.pageNumber}:`}
                    </div>
                    <div className="col-span-1 py-1 px-1 border-r border-black text-right font-mono">
                      {page.isLastPage ? formatPYG(desglose.subtotalExenta) : "—"}
                    </div>
                    <div className="col-span-1 py-1 px-1 border-r border-black text-right font-mono">
                      {page.isLastPage ? formatPYG(desglose.subtotal5) : "—"}
                    </div>
                    <div className="col-span-2 py-1 px-1 text-right font-mono">
                      {page.isLastPage ? formatPYG(desglose.subtotal10) : formatPYG(page.carryOverOut)}
                    </div>
                  </div>

                  {/* ── 5. TOTAL A PAGAR EN NÚMEROS Y EN LETRAS ── */}
                  {page.isLastPage ? (
                    <div className="mt-1.5 border-2 border-black rounded p-1.5 bg-white space-y-0.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[9.5px] text-gray-700">
                          <span className="font-bold">TOTAL A PAGAR EN GUARANÍES:</span>
                        </div>
                        <div className="font-mono font-black text-sm text-black">
                          Gs. {formatPYG(desglose.totalFactura)}
                        </div>
                      </div>
                      <div className="text-[9px] border-t border-gray-300 pt-0.5">
                        <span className="font-bold">SON: </span>
                        <span className="font-mono uppercase font-bold text-gray-900">
                          {numeroALetras(desglose.totalFactura)} GUARANÍES
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 border border-dashed border-gray-400 rounded p-1 bg-gray-50 text-center text-[9px] text-gray-600 font-bold">
                      PASA A LA HOJA {page.pageNumber + 1} DE {page.totalPages} · TOTALIZACIÓN Y LIQUIDACIÓN EN LA ÚLTIMA HOJA
                    </div>
                  )}

                  {/* ── 6. LIQUIDACIÓN DEL IVA (DNIT / SET) ── */}
                  {page.isLastPage ? (
                    <div className="mt-1.5 border border-black rounded p-1.5 text-[9px] grid grid-cols-12 gap-2 bg-gray-50/50">
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
                  ) : (
                    <div className="mt-1 border border-gray-300 rounded p-1 text-[8.5px] text-center text-gray-400 italic">
                      Liquidación del I.V.A. consolidada al cierre en la Hoja {page.totalPages}
                    </div>
                  )}
                </div>

                {/* ── 7. PIE DE PÁGINA LEGAL & CONTROL TRIBUTARIO (SEGURO CONTRA CORTES) ── */}
                <div className="mt-2 pt-1.5 pb-1 border-t border-dashed border-gray-400 text-[8.5px] text-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold uppercase tracking-wider text-black">
                        ORIGINAL: Comprador &nbsp;·&nbsp; DUPLICADO: Archivo Tributario &nbsp;
                        <span className="font-mono text-gray-600">
                          (Hoja {page.pageNumber} de {page.totalPages})
                        </span>
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
                  {sale.cdc && page.isLastPage && (
                    <div className="mt-1 p-1 bg-blue-50 border border-blue-200 rounded flex items-center justify-between text-[8px]">
                      <div>
                        <span className="font-bold text-blue-900">CDC SIFEN: </span>
                        <span className="font-mono text-blue-950 font-bold">{sale.cdc}</span>
                      </div>
                      <div className="text-blue-700 font-mono text-[8px]">
                        e-Kuatia SET
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pie de modal para pantalla (no-print) */}
        <div className="no-print bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Comprobante Nº {sale.numero || sale.id.slice(0, 8)}
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
              {items.length} ítems en total · {pagesData.length} hoja{pagesData.length > 1 ? "s" : ""}
            </span>
          </div>
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
              <span>Imprimir Factura A4 ({pagesData.length} hoja{pagesData.length > 1 ? "s" : ""})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
