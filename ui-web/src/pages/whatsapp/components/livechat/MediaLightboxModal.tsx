import React from "react"
import { X, Download, ExternalLink, FileText, ZoomIn, ZoomOut, RotateCw } from "lucide-react"

interface MediaLightboxModalProps {
  media: {
    url: string
    title?: string
    type?: "image" | "document" | "video" | "audio"
    filename?: string
    sizeBytes?: number
  } | null
  onClose: () => void
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({ media, onClose }) => {
  const [scale, setScale] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)

  if (!media) return null

  const isPdf = media.url.toLowerCase().includes(".pdf") || media.filename?.toLowerCase().endsWith(".pdf")
  const isImage = !isPdf && (media.type === "image" || /\.(jpg|jpeg|png|webp|gif)$/i.test(media.url.split("?")[0]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Barra Superior */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-white drop-shadow-md">
          <FileText className="w-5 h-5 text-emerald-400" />
          <div className="max-w-md truncate">
            <h4 className="text-sm font-bold text-white truncate">{media.filename || media.title || "Archivo adjunto"}</h4>
            {media.sizeBytes && (
              <span className="text-[11px] text-white/70">{(media.sizeBytes / 1024).toFixed(1)} KB</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <button
                onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                title="Rotar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          <a
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all flex items-center gap-1 text-xs"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <a
            href={media.url}
            download={media.filename || "archivo"}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/30 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Descargar</span>
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-white transition-all ml-2"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido Visualizador */}
      <div className="w-full max-w-5xl max-h-[85vh] flex items-center justify-center overflow-hidden">
        {isPdf ? (
          <div className="w-full h-[80vh] bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <iframe
              src={media.url}
              className="w-full h-full border-0 rounded-2xl"
              title={media.title || "Visor PDF"}
            />
          </div>
        ) : isImage ? (
          <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
            <img
              src={media.url}
              alt={media.title || "Imagen ampliada"}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-white space-y-4 max-w-md">
            <FileText className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">{media.filename || "Documento Adjunto"}</h3>
              <p className="text-xs text-slate-400 mt-1">Este formato no admite previsualización directa en el navegador.</p>
            </div>
            <a
              href={media.url}
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white"
            >
              <Download className="w-4 h-4" /> Descargar para visualizar
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
