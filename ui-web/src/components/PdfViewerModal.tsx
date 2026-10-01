import React, { useRef } from "react"
import { Printer, Download, ExternalLink, X, FileText } from "lucide-react"
import { Modal } from "./Modal"

interface PdfViewerModalProps {
  open: boolean
  onClose: () => void
  pdfUrl: string | null
  title: string
  subtitle?: string
  filename?: string
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  open,
  onClose,
  pdfUrl,
  title,
  subtitle,
  filename = "documento.pdf",
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus()
        iframeRef.current.contentWindow.print()
      } else if (pdfUrl) {
        window.open(pdfUrl, "_blank")
      }
    } catch {
      if (pdfUrl) {
        const win = window.open(pdfUrl, "_blank")
        win?.print()
      }
    }
  }

  const handleDownload = () => {
    if (!pdfUrl) return
    const a = document.createElement("a")
    a.href = pdfUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenTab = () => {
    if (!pdfUrl) return
    window.open(pdfUrl, "_blank")
  }

  return (
    <Modal
      open={open && !!pdfUrl}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-rose-500" />
          <span>{title}</span>
        </div>
      }
      subtitle={subtitle || "Visualización oficial en formato estándar A4"}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
            <button
              type="button"
              onClick={handleOpenTab}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
              title="Abrir en pestaña externa del navegador"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Nueva Pestaña</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition"
          >
            Cerrar
          </button>
        </div>
      }
    >
      <div className="w-full h-[72vh] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/80 flex items-center justify-center relative">
        {pdfUrl ? (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            title={title}
            className="w-full h-full border-0 bg-white"
          />
        ) : (
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <span>Cargando documento A4...</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
