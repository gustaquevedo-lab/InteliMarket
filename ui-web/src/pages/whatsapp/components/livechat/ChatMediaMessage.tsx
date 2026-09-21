import React, { useState } from "react"
import { FileText, Download, Maximize2, Play, Pause, MapPin, ExternalLink, Image as ImageIcon, Volume2 } from "lucide-react"

interface ChatMediaMessageProps {
  mediaUrl: string
  content?: string
  mediaType?: string | null
  mediaFilename?: string | null
  mediaSizeBytes?: number | null
  isOutbound?: boolean
  onOpenLightbox: (media: { url: string; title?: string; filename?: string; sizeBytes?: number }) => void
}

export const ChatMediaMessage: React.FC<ChatMediaMessageProps> = ({
  mediaUrl,
  content,
  mediaType,
  mediaFilename,
  mediaSizeBytes,
  isOutbound = false,
  onOpenLightbox,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [imgError, setImgError] = useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const cleanUrl = mediaUrl.toLowerCase().split("?")[0]
  const isPdf = cleanUrl.endsWith(".pdf") || mediaFilename?.toLowerCase().endsWith(".pdf") || mediaType === "document" && cleanUrl.includes("pdf")
  const isImage = !isPdf && (
    mediaType === "image" ||
    cleanUrl.startsWith("data:image/") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(cleanUrl)
  )
  const isAudio = mediaType === "audio" || cleanUrl.startsWith("data:audio/") || /\.(mp3|ogg|wav|m4a|aac)$/i.test(cleanUrl)
  const isVideo = mediaType === "video" || cleanUrl.startsWith("data:video/") || /\.(mp4|webm|mov|mkv)$/i.test(cleanUrl)
  const isLocation = content?.startsWith("📍") || content?.includes("maps.google.com")

  const filename = mediaFilename || (isPdf ? "Documento.pdf" : "Archivo")

  const togglePlayAudio = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setAudioError(true))
    }
  }

  // 1. Imagen
  if (isImage) {
    return (
      <div className="mb-2">
        <div
          onClick={() => onOpenLightbox({ url: mediaUrl, title: content, filename, sizeBytes: mediaSizeBytes || undefined })}
          className="relative group cursor-pointer overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 max-w-sm"
        >
          {imgError ? (
            <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
              <ImageIcon className="w-8 h-8 text-slate-300" />
              <span>No se pudo cargar la imagen</span>
              <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-500 underline text-[11px]">
                Abrir enlace directo
              </a>
            </div>
          ) : (
            <>
              <img
                src={mediaUrl}
                alt={content || "Foto de WhatsApp"}
                onError={() => setImgError(true)}
                className="max-h-72 w-full object-cover rounded-2xl transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[1px]">
                <Maximize2 className="w-4 h-4" />
                <span>Ampliar foto</span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // 2. Documento / PDF (Tarjeta con Thumbnail y Previsualización)
  if (isPdf || mediaType === "document") {
    return (
      <div className="mb-2">
        <div
          className={`rounded-2xl border p-3 flex items-center gap-3 transition-all ${
            isOutbound
              ? "bg-emerald-700/60 hover:bg-emerald-700 border-emerald-500/80 text-white"
              : "bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
          }`}
        >
          {/* Thumbnail / Icono de PDF */}
          <div
            onClick={() => onOpenLightbox({ url: mediaUrl, title: content, filename, sizeBytes: mediaSizeBytes || undefined })}
            className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500 flex flex-col items-center justify-center font-bold text-[10px] shrink-0 cursor-pointer hover:scale-105 transition-transform"
            title="Clic para previsualizar"
          >
            <FileText className="w-5 h-5" />
            <span className="text-[8px] uppercase tracking-wider font-extrabold">PDF</span>
          </div>

          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold truncate leading-tight">{filename}</h5>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-75">
              {mediaSizeBytes ? <span>{(mediaSizeBytes / 1024).toFixed(1)} KB</span> : <span>Documento oficial</span>}
              <span>•</span>
              <span className="font-semibold text-emerald-300 dark:text-emerald-400">Listo para ver</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenLightbox({ url: mediaUrl, title: content, filename, sizeBytes: mediaSizeBytes || undefined })}
              className={`p-2 rounded-xl transition-all ${
                isOutbound
                  ? "hover:bg-emerald-600 text-white"
                  : "hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
              }`}
              title="Previsualizar PDF en pantalla"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <a
              href={mediaUrl}
              download={filename}
              className={`p-2 rounded-xl transition-all ${
                isOutbound
                  ? "hover:bg-emerald-600 text-white"
                  : "hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
              }`}
              title="Descargar archivo"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  // 3. Audio / Nota de Voz
  if (isAudio) {
    return (
      <div className="mb-2">
        <div
          className={`p-2.5 rounded-2xl flex items-center gap-3 border max-w-xs ${
            isOutbound
              ? "bg-emerald-700/50 border-emerald-500/70 text-white"
              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={togglePlayAudio}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isOutbound ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[10px] opacity-75 mb-1">
              <span className="flex items-center gap-1 font-semibold">
                <Volume2 className="w-3 h-3" /> Mensaje de voz
              </span>
              <span>WhatsApp Audio</span>
            </div>
            {/* Visualizador de onda sutil */}
            <div className="flex items-center gap-0.5 h-3">
              {[40, 70, 30, 90, 60, 100, 45, 80, 55, 95, 30, 85, 50, 75, 40].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-200 ${
                    isPlaying ? "bg-emerald-400 animate-pulse" : isOutbound ? "bg-white/40" : "bg-slate-400"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <audio
            ref={audioRef}
            src={mediaUrl}
            onEnded={() => setIsPlaying(false)}
            onError={() => setAudioError(true)}
            className="hidden"
          />
        </div>
        {audioError && (
          <p className="text-[10px] text-red-400 mt-1">No se pudo reproducir el formato de audio.</p>
        )}
      </div>
    )
  }

  // 4. Video
  if (isVideo) {
    return (
      <div className="mb-2 max-w-sm rounded-2xl overflow-hidden border border-black/10 dark:border-white/10">
        <video controls src={mediaUrl} className="max-h-72 w-full rounded-2xl bg-black" />
      </div>
    )
  }

  // 5. Ubicación
  if (isLocation) {
    return (
      <div className="mb-2">
        <a
          href={mediaUrl.includes("http") ? mediaUrl : `https://maps.google.com/?q=${encodeURIComponent(content || "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 flex items-center gap-3 text-blue-900 dark:text-blue-200 hover:scale-[1.01] transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold truncate">Ubicación Compartida por Cliente</h5>
            <p className="text-[10px] text-blue-600 dark:text-blue-300 flex items-center gap-1">
              Abrir en Google Maps <ExternalLink className="w-3 h-3" />
            </p>
          </div>
        </a>
      </div>
    )
  }

  // 6. Archivo genérico descargable
  return (
    <div className="mb-2">
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={filename}
        className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all ${
          isOutbound
            ? "bg-emerald-700/50 hover:bg-emerald-700 border-emerald-500 text-white"
            : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
        }`}
      >
        <FileText className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{filename}</p>
          <span className="text-[9px] opacity-75">Descargar archivo adjunto</span>
        </div>
        <Download className="w-4 h-4 flex-shrink-0 opacity-75" />
      </a>
    </div>
  )
}
