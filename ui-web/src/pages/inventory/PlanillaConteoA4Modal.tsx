import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Printer, FileDown, X, ShieldCheck, Loader2, Layers,
  ClipboardList, CheckCircle2, Eye, EyeOff, Sparkles, SlidersHorizontal, ArrowUpDown
} from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { type PhysicalSession, type PhysicalSessionItem, api } from "../../api"
import { useToast } from "../../context/ToastContext"

interface PlanillaConteoA4ModalProps {
  session: PhysicalSession
  onClose: () => void
  companyData?: any
}

// Formateador oficial de fecha y hora para Paraguay (America/Asuncion)
function formatFechaParaguay(dateVal: string | Date | undefined): string {
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

export default function PlanillaConteoA4Modal({
  session,
  onClose,
  companyData,
}: PlanillaConteoA4ModalProps) {
  const toast = useToast()
  const printContainerRef = useRef<HTMLDivElement>(null)

  // Configuración de la planilla
  const [printBlindMode, setPrintBlindMode] = useState<boolean>(true) // Por defecto ciego (sin stock sistema)
  const [blankMode, setBlankMode] = useState<boolean>(true) // Por defecto en blanco para escribir a mano
  const [rowsPerPage, setRowsPerPage] = useState<number>(20) // 20 filas da ~32px por fila: espacio óptimo para escribir
  const [sortBy, setSortBy] = useState<"pasillo" | "nombre" | "codigo">("pasillo")
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Items completos de la sesión (aseguramos si no venían hidratados)
  const [sessionItems, setSessionItems] = useState<PhysicalSessionItem[]>(session.items || [])
  const [loadingItems, setLoadingItems] = useState<boolean>(false)

  useEffect(() => {
    let active = true
    if (!session.items || session.items.length === 0) {
      setLoadingItems(true)
      api.inventory.physicalSessions
        .get(session.id)
        .then((full) => {
          if (active && full && full.items) {
            setSessionItems(full.items)
          }
        })
        .catch((err) => {
          console.error("Error cargando items de sesión para planilla:", err)
        })
        .finally(() => {
          if (active) setLoadingItems(false)
        })
    } else {
      setSessionItems(session.items)
    }
    return () => {
      active = false
    }
  }, [session.id, session.items])

  // Ordenamiento de los ítems
  const sortedItems = useMemo(() => {
    const list = [...sessionItems]
    if (sortBy === "nombre") {
      list.sort((a, b) => (a.product_nombre || "").localeCompare(b.product_nombre || ""))
    } else if (sortBy === "codigo") {
      list.sort((a, b) =>
        (a.product_codigo_barra || a.product_sku || "").localeCompare(
          b.product_codigo_barra || b.product_sku || ""
        )
      )
    } else {
      // Por pasillo / ubicación y luego nombre
      list.sort((a, b) => {
        const pasilloA = session.pasillo || ""
        const pasilloB = session.pasillo || ""
        if (pasilloA !== pasilloB) return pasilloA.localeCompare(pasilloB)
        return (a.product_nombre || "").localeCompare(b.product_nombre || "")
      })
    }
    return list
  }, [sessionItems, sortBy, session.pasillo])

  // Paginación de alta fidelidad A4
  const pagesData = useMemo(() => {
    if (sortedItems.length === 0) {
      return [
        {
          pageIndex: 0,
          pageNumber: 1,
          totalPages: 1,
          items: [] as PhysicalSessionItem[],
          startIdx: 0,
          endIdx: 0,
          isFirstPage: true,
          isLastPage: true,
        },
      ]
    }

    const totalPages = Math.ceil(sortedItems.length / rowsPerPage) || 1
    const pages = []

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const start = pIdx * rowsPerPage
      const end = Math.min(start + rowsPerPage, sortedItems.length)
      const pageItems = sortedItems.slice(start, end)

      pages.push({
        pageIndex: pIdx,
        pageNumber: pIdx + 1,
        totalPages,
        items: pageItems,
        startIdx: start + 1,
        endIdx: end,
        isFirstPage: pIdx === 0,
        isLastPage: pIdx === totalPages - 1,
      })
    }

    return pages
  }, [sortedItems, rowsPerPage])

  // Datos de la empresa (Extra Supermercado)
  const emisor = {
    razonSocial: companyData?.razon_social || "GRUPO SANTA TERESA E.A.S.",
    nombreFantasia: companyData?.nombre_fantasia || companyData?.nombre || "Extra Supermercado Mayorista",
    ruc: companyData?.ruc || "80150377-9",
    direccion: companyData?.direccion || "Alejo García esq. Carlos Antonio López",
    ciudad: companyData?.ciudad || "Pedro Juan Caballero, Amambay - Paraguay",
    telefono: companyData?.telefono || "+595 992 052200",
  }

  // Impresión aislada mediante iframe
  const handlePrint = () => {
    const container = printContainerRef.current
    if (!container) {
      window.print()
      return
    }

    let iframe = document.getElementById("conteo-print-iframe") as HTMLIFrameElement
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.id = "conteo-print-iframe"
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
          <title>Planilla_Conteo_Toma_${session.codigo}</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
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
              background: #fff !important;
              color: #000 !important;
              font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
              -webkit-font-smoothing: antialiased !important;
            }
            .font-mono {
              font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace !important;
              font-variant-numeric: tabular-nums !important;
            }
            #conteo-print-container {
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .conteo-a4-page {
              width: 210mm !important;
              height: 297mm !important;
              max-height: 297mm !important;
              min-height: 297mm !important;
              page-break-before: auto !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 6mm 8mm 6mm 8mm !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
              background: #ffffff !important;
              border: none !important;
              box-shadow: none !important;
            }
            .conteo-a4-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div id="conteo-print-container">
            ${printableHtml}
          </div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      toast.success(
        "Impresión enviada",
        `Planilla de Conteo A4 (${pagesData.length} hoja${pagesData.length > 1 ? "s" : ""}) lista en diálogo de impresión.`
      )
    }, 350)
  }

  // Descarga directa de PDF (1:1 con fidelidad milimétrica)
  const handleDownloadPdf = async () => {
    const container = printContainerRef.current
    if (!container) return

    const pageElements = container.querySelectorAll<HTMLElement>(".conteo-a4-page")
    if (!pageElements || pageElements.length === 0) {
      toast.error("Error", "No se encontraron páginas para exportar.")
      return
    }

    setIsGeneratingPdf(true)
    toast.info("Generando PDF", `Procesando ${pageElements.length} hoja(s) de conteo en alta definición A4...`)

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      })

      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i]
        const canvas = await html2canvas(el, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 1024,
        })

        const imgData = canvas.toDataURL("image/jpeg", 0.98)
        if (i > 0) {
          pdf.addPage("a4", "portrait")
        }
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST")
      }

      pdf.save(`Planilla_Conteo_Toma_${session.codigo}.pdf`)
      toast.success("PDF generado con éxito", `Archivo Planilla_Conteo_Toma_${session.codigo}.pdf descargado.`)
    } catch (err: any) {
      console.error("Error generando PDF de conteo:", err)
      toast.error("Error al generar PDF", err?.message || "Reintente.")
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      style={{ paddingTop: "4.75rem", paddingBottom: "2rem" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .conteo-a4-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            padding: 6mm 8mm 6mm 8mm !important;
          }
          .conteo-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }

        .conteo-a4-page {
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-feature-settings: 'tnum' on, 'lnum' on;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        .conteo-a4-page .font-mono {
          font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace !important;
          font-variant-numeric: tabular-nums !important;
        }
      `}</style>

      {/* Contenedor Modal de Alto Impacto */}
      <div
        className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ maxHeight: "calc(100vh - 6.5rem)" }}
      >
        {/* ── BARRA SUPERIOR DE HERRAMIENTAS Y PARÁMETROS DE PLANILLA (no-print) ── */}
        <div className="no-print bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                  Planilla Oficial de Conteo Físico A4
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                  #{session.codigo}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {pagesData.length} Hoja{pagesData.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {sessionItems.length} ítems totales • {session.warehouse_nombre || "Principal"} •{" "}
                {session.supplier_nombre
                  ? `Proveedor: ${session.supplier_nombre}`
                  : session.categoria_nombre
                  ? `Sector: ${session.categoria_nombre}`
                  : `Tipo: ${session.tipo.toUpperCase()}`}
              </p>
            </div>
          </div>

          {/* Acciones Principales */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition shadow-sm shadow-emerald-500/20 cursor-pointer"
              title="Imprimir documento oficial en hoja A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir A4 ({pagesData.length} hoja{pagesData.length > 1 ? "s" : ""})</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              title="Descargar PDF 1:1 idéntico al render CSS"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? "Generando..." : "Descargar PDF (1:1)"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BARRA DE CONTROLES Y PARÁMETROS OPERATIVOS (no-print) ── */}
        <div className="no-print bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Modo Ciego */}
            <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <input
                type="checkbox"
                checked={printBlindMode}
                onChange={(e) => setPrintBlindMode(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1">
                {printBlindMode ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
                {printBlindMode ? "Modo Ciego (Oculta Stock Teórico)" : "Modo Auditoría (Muestra Stock Teórico)"}
              </span>
            </label>

            {/* Toggle En Blanco vs Con Datos Registrados */}
            <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <input
                type="checkbox"
                checked={blankMode}
                onChange={(e) => setBlankMode(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span>{blankMode ? "Casillas Vacías (Para Conteo Manual)" : "Imprimir Conteos Cargados"}</span>
            </label>

            {/* Ordenamiento */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="pasillo">Por Góndola / Pasillo</option>
                <option value="nombre">Alfabético Producto (A-Z)</option>
                <option value="codigo">Código de Barras</option>
              </select>
            </div>

            {/* Filas por Hoja */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Filas / Hoja:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value={18}>18 filas (Amplio / Fácil Escritura)</option>
                <option value={20}>20 filas (Estándar Recomendado)</option>
                <option value={24}>24 filas (Compacto)</option>
                <option value={28}>28 filas (Máximo A4)</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {pagesData.length} página(s) calculada(s)
          </div>
        </div>

        {/* ── CONTENEDOR DEL VISOR DE HOJAS A4 ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70 dark:bg-slate-900/90 flex flex-col items-center gap-6">
          <div ref={printContainerRef} id="conteo-print-container" className="w-full flex flex-col items-center gap-6">
            {pagesData.map((page) => (
              <div
                key={`page-${page.pageNumber}`}
                className="conteo-a4-page bg-white text-black w-[210mm] min-h-[297mm] max-h-[297mm] p-[6mm_8mm] shadow-2xl border border-slate-300 font-sans text-xs flex flex-col justify-between"
                style={{
                  boxSizing: "border-box",
                  width: "210mm",
                  height: "297mm",
                  maxHeight: "297mm",
                  overflow: "hidden",
                }}
              >
                {/* ── PARTE SUPERIOR DE LA HOJA: ENCABEZADO Y TABLA ── */}
                <div className="flex-1 flex flex-col">
                  {/* 1. ENCABEZADO PRINCIPAL (MEMBRETE OFICIAL EXTRA) */}
                  <div className="border-b-2 border-black pb-2 mb-2 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo_extra.png"
                        alt="Extra Supermercado"
                        className="h-12 w-auto object-contain shrink-0"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = "none"
                        }}
                      />
                      <div>
                        <h1 className="text-base font-black uppercase tracking-tight text-black leading-none">
                          {emisor.nombreFantasia}
                        </h1>
                        <p className="text-[10px] text-slate-700 font-bold mt-0.5">
                          {emisor.razonSocial} • RUC: {emisor.ruc}
                        </p>
                        <p className="text-[11px] font-black tracking-wide text-emerald-800 mt-1 uppercase">
                          {printBlindMode
                            ? "PLANILLA OFICIAL DE CONTEO FÍSICO CIEGO — AUDITORÍA DE STOCK"
                            : "PLANILLA DE TOMA FÍSICA Y CONTROL DE STOCK SISTEMA"}
                        </p>
                      </div>
                    </div>

                    {/* Recuadro de Control / Folio */}
                    <div className="border border-black rounded-lg p-2 text-right bg-slate-50 min-w-[170px]">
                      <p className="text-[10px] uppercase font-bold text-slate-500">TOMA DE INVENTARIO</p>
                      <p className="font-mono font-black text-sm text-black">#{session.codigo}</p>
                      <p className="text-[10px] text-slate-700 mt-0.5">
                        Depósito: <strong className="text-black">{session.warehouse_nombre || "Principal"}</strong>
                      </p>
                      <div className="mt-1 pt-1 border-t border-slate-300 flex justify-between items-center text-[10px] font-mono font-bold">
                        <span>PÁGINA:</span>
                        <span className="bg-black text-white px-1.5 py-0.2 rounded-xs">
                          {page.pageNumber} / {page.totalPages}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. METADATOS Y ALCANCE DE LA TOMA */}
                  <div className="grid grid-cols-6 gap-2 text-[10px] border border-black rounded-md p-1.5 bg-slate-50/70 mb-2">
                    <div className="col-span-2">
                      <span className="text-slate-500 font-bold uppercase block text-[9px]">Alcance / Modalidad:</span>
                      <strong className="text-black uppercase text-[11px]">
                        {session.tipo} {session.descripcion_alcance ? `(${session.descripcion_alcance})` : ""}
                      </strong>
                    </div>
                    {session.supplier_nombre && (
                      <div className="col-span-2">
                        <span className="text-slate-500 font-bold uppercase block text-[9px]">Proveedor:</span>
                        <strong className="text-black truncate block">{session.supplier_nombre}</strong>
                      </div>
                    )}
                    {session.categoria_nombre && (
                      <div className="col-span-2">
                        <span className="text-slate-500 font-bold uppercase block text-[9px]">Sector / Rubro:</span>
                        <strong className="text-black truncate block">{session.categoria_nombre}</strong>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-slate-500 font-bold uppercase block text-[9px]">Góndola / Pasillo:</span>
                      <strong className="text-black">{session.pasillo || "General / Todo el Salón"}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 font-bold uppercase block text-[9px]">Fecha y Hora Emisión:</span>
                      <strong className="text-black font-mono">{formatFechaParaguay(session.created_at)}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 font-bold uppercase block text-[9px]">Contador 1 (Titular):</span>
                      <strong className="text-black">{session.contador_1_nombre || "Operador de Conteo"}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 font-bold uppercase block text-[9px]">Contador 2 (Doble Ciego):</span>
                      <strong className="text-black">{session.contador_2_nombre || "Auditor Ciego"}</strong>
                    </div>
                  </div>

                  {/* 3. TABLA DE ARTÍCULOS PARA CONTEO */}
                  <div className="border border-black rounded-sm overflow-hidden flex-1 flex flex-col">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-black text-white font-black uppercase text-[9px] tracking-wider border-b border-black">
                          <th className="p-1 text-center w-7 border-r border-slate-700">#</th>
                          <th className="p-1 w-28 text-center font-mono border-r border-slate-700">Cód. Barras</th>
                          <th className="p-1 border-r border-slate-700">Descripción del Producto</th>
                          <th className="p-1 w-20 text-center border-r border-slate-700">Góndola</th>
                          {!printBlindMode && (
                            <th className="p-1 w-16 text-right font-mono border-r border-slate-700">Stock Sist.</th>
                          )}
                          <th className="p-1 w-20 text-center border-r border-slate-700 bg-slate-900 text-white">
                            <span className="block leading-none">1° Conteo</span>
                            <span className="text-[7.5px] font-normal opacity-80">(Manual)</span>
                          </th>
                          <th className="p-1 w-20 text-center border-r border-slate-700 bg-slate-900 text-white">
                            <span className="block leading-none">2° Conteo</span>
                            <span className="text-[7.5px] font-normal opacity-80">(Doble Ciego)</span>
                          </th>
                          <th className="p-1 w-18 text-center border-r border-slate-700">
                            <span className="block leading-none">Vencimiento</span>
                            <span className="text-[7.5px] font-normal opacity-80">DD/MM/AA</span>
                          </th>
                          <th className="p-1 w-24 text-center">Estado / Obs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/80 font-medium">
                        {page.items.map((item, idx) => {
                          const globalIdx = page.startIdx + idx
                          const showRecordedC1 =
                            !blankMode && item.cantidad_conteo_1 !== null && item.cantidad_conteo_1 !== undefined
                          const showRecordedC2 =
                            !blankMode && item.cantidad_conteo_2 !== null && item.cantidad_conteo_2 !== undefined

                          return (
                            <tr
                              key={item.id || `item-${idx}`}
                              className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}
                              style={{ height: rowsPerPage <= 20 ? "34px" : "28px" }}
                            >
                              {/* # Nro secuencial */}
                              <td className="p-1 text-center font-mono font-bold text-black border-r border-black/80">
                                {globalIdx}
                              </td>

                              {/* Código de Barras */}
                              <td className="p-1 text-center font-mono font-bold text-black border-r border-black/80 text-[10px] tracking-tight">
                                {item.product_codigo_barra || item.product_sku || "—"}
                              </td>

                              {/* Descripción de Producto */}
                              <td className="p-1 text-black font-semibold border-r border-black/80 truncate max-w-[210px] leading-tight">
                                <div className="truncate font-bold">{item.product_nombre}</div>
                                {item.product_sku && item.product_codigo_barra && (
                                  <div className="text-[8.5px] font-mono text-slate-500">
                                    SKU: {item.product_sku}
                                  </div>
                                )}
                              </td>

                              {/* Góndola / Pasillo */}
                              <td className="p-1 text-center font-mono text-[9.5px] text-slate-800 border-r border-black/80">
                                {session.pasillo || "—"}
                              </td>

                              {/* Stock Sistema (Si no está en modo ciego) */}
                              {!printBlindMode && (
                                <td className="p-1 text-right font-mono font-black text-black border-r border-black/80 text-[10.5px]">
                                  {Number(item.cantidad_sistema || 0).toLocaleString("es-PY")}
                                </td>
                              )}

                              {/* Casilla 1° Conteo (Grande y limpia para escribir a mano) */}
                              <td className="p-1 text-center border-r border-black/80 bg-slate-50/40">
                                <div className="border border-black rounded-xs h-7 w-full flex items-center justify-center font-mono font-black text-black text-xs bg-white">
                                  {showRecordedC1
                                    ? Number(item.cantidad_conteo_1).toLocaleString("es-PY")
                                    : ""}
                                </div>
                              </td>

                              {/* Casilla 2° Conteo (Grande y limpia para doble ciego) */}
                              <td className="p-1 text-center border-r border-black/80 bg-slate-50/40">
                                <div className="border border-black rounded-xs h-7 w-full flex items-center justify-center font-mono font-black text-black text-xs bg-white">
                                  {showRecordedC2
                                    ? Number(item.cantidad_conteo_2).toLocaleString("es-PY")
                                    : ""}
                                </div>
                              </td>

                              {/* Casilla Vencimiento / Lote */}
                              <td className="p-1 text-center border-r border-black/80">
                                <div className="border border-dashed border-slate-400 rounded-xs h-7 w-full flex items-center justify-center font-mono text-[9px] text-slate-400">
                                  ___/___/___
                                </div>
                              </td>

                              {/* Casilla Observaciones / Estado */}
                              <td className="p-1 text-center">
                                <div className="h-7 w-full border border-dashed border-slate-300 rounded-xs"></div>
                              </td>
                            </tr>
                          )
                        })}

                        {/* Relleno de líneas vacías si la página tiene menos ítems para preservar altura */}
                        {page.items.length < rowsPerPage &&
                          Array.from({ length: rowsPerPage - page.items.length }).map((_, fIdx) => (
                            <tr
                              key={`fill-${fIdx}`}
                              className="bg-white"
                              style={{ height: rowsPerPage <= 20 ? "34px" : "28px" }}
                            >
                              <td className="border-r border-black/80 text-center text-slate-300 font-mono text-[10px]">
                                {page.startIdx + page.items.length + fIdx}
                              </td>
                              <td className="border-r border-black/80"></td>
                              <td className="border-r border-black/80"></td>
                              <td className="border-r border-black/80"></td>
                              {!printBlindMode && <td className="border-r border-black/80"></td>}
                              <td className="border-r border-black/80 p-1">
                                <div className="border border-black rounded-xs h-7 w-full"></div>
                              </td>
                              <td className="border-r border-black/80 p-1">
                                <div className="border border-black rounded-xs h-7 w-full"></div>
                              </td>
                              <td className="border-r border-black/80 p-1">
                                <div className="border border-dashed border-slate-300 rounded-xs h-7 w-full"></div>
                              </td>
                              <td className="p-1">
                                <div className="border border-dashed border-slate-200 rounded-xs h-7 w-full"></div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── PARTE INFERIOR DE LA HOJA: FIRMAS Y PIE DE PÁGINA ── */}
                <div className="pt-2">
                  {/* Bloque de Firmas Formales (Presente en la última hoja o en hoja única) */}
                  {page.isLastPage ? (
                    <div className="border border-black rounded-md p-2 bg-slate-50 mb-1.5">
                      <p className="text-[9px] uppercase font-black tracking-wider text-slate-700 text-center mb-4">
                        CERTIFICACIÓN DE TOMA FÍSICA Y CIERRE DE GÓNDOLA — FIRMAS DE CONFORMIDAD
                      </p>
                      <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
                        <div>
                          <div className="border-t-2 border-black pt-1">
                            <p className="font-black text-black uppercase">
                              {session.contador_1_nombre || "Operador de Conteo 1"}
                            </p>
                            <p className="text-[9px] text-slate-600">Contador Titular • C.I.: ________________</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">Firma del Primer Conteo</p>
                          </div>
                        </div>
                        <div>
                          <div className="border-t-2 border-black pt-1">
                            <p className="font-black text-black uppercase">
                              {session.contador_2_nombre || "Operador de Conteo 2"}
                            </p>
                            <p className="text-[9px] text-slate-600">Auditor Cruzado • C.I.: ________________</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">Firma del Conteo Doble Ciego</p>
                          </div>
                        </div>
                        <div>
                          <div className="border-t-2 border-black pt-1">
                            <p className="font-black text-black uppercase">Encargado de Depósito / Salón</p>
                            <p className="text-[9px] text-slate-600">Auditoría Interna • Sello y Aprobación</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">Visto Bueno de Cierre</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-dashed border-slate-400 pt-1 mb-1 flex justify-between items-center text-[9px] text-slate-500">
                      <span>Continúa en la siguiente hoja...</span>
                      <span className="font-mono">
                        Artículos en esta hoja: {page.items.length} (Acumulado: {page.endIdx} de {sortedItems.length})
                      </span>
                    </div>
                  )}

                  {/* Pie de página institucional */}
                  <div className="flex justify-between items-center text-[9px] text-slate-600 border-t border-black pt-1 font-mono">
                    <div>
                      <strong>INTELIMARKET ERP</strong> • {emisor.nombreFantasia} • Control Patrimonial y Auditoría de Stock
                    </div>
                    <div className="font-bold text-black">
                      Hoja {page.pageNumber} de {page.totalPages}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
