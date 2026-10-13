import React, { useState } from "react"
import { 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Terminal, 
  Lightbulb, 
  ShieldAlert, 
  RefreshCw,
  MessageSquare,
  Globe,
  User,
  Clock
} from "lucide-react"
import { 
  ErrorDiagnostic, 
  formatDiagnosticAsMarkdown, 
  getWhatsAppReportUrl, 
  copyDiagnosticToClipboard 
} from "../utils/errorDiagnostic"

interface ErrorDetailModalProps {
  isOpen: boolean
  onClose: () => void
  diagnostic: ErrorDiagnostic | null
  onRetry?: () => void
}

export const ErrorDetailModal: React.FC<ErrorDetailModalProps> = ({
  isOpen,
  onClose,
  diagnostic,
  onRetry
}) => {
  const [copied, setCopied] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  if (!isOpen || !diagnostic) return null

  const handleCopy = async () => {
    const success = await copyDiagnosticToClipboard(diagnostic)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const waUrl = getWhatsAppReportUrl(diagnostic)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl ring-4 ring-red-500/5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                  {diagnostic.moduleName || "Diagnóstico InteliMarket"}
                </span>
                <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {diagnostic.localTime}
                </span>
              </div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                {diagnostic.suggestedTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          
          {/* Explicación Amigable */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
              {diagnostic.suggestedExplanation}
            </p>
          </div>

          {/* Tarjeta de Error Principal */}
          <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-red-700 dark:text-red-300">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Mensaje del Sistema:
              </span>
              {diagnostic.status && (
                <span className="font-mono px-2 py-0.5 rounded bg-red-200/60 dark:bg-red-900/60">
                  HTTP {diagnostic.status}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-red-900 dark:text-red-200 break-words bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-red-100 dark:border-red-900/30 font-semibold">
              {diagnostic.errorMessage}
            </p>
          </div>

          {/* Sugerencias de Solución */}
          {diagnostic.suggestions && diagnostic.suggestions.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                ¿Qué puedes hacer ahora?
              </h4>
              <ul className="space-y-2">
                {diagnostic.suggestions.map((sug, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contexto Rápido */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/40 p-3 rounded-2xl">
            <div className="flex items-center gap-1.5 truncate">
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Ruta: <code className="text-gray-700 dark:text-gray-300 font-mono">{diagnostic.route}</code></span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Usuario: <strong className="text-gray-700 dark:text-gray-300">{diagnostic.userEmail}</strong></span>
            </div>
          </div>

          {/* Detalles Técnicos Desplegables */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showTechnicalDetails ? "Ocultar diagnóstico técnico" : "Ver diagnóstico técnico completo"}</span>
            </button>

            {showTechnicalDetails && (
              <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-[11px] overflow-x-auto max-h-56 space-y-2 border border-slate-800">
                <p className="text-slate-400">// Diagnóstico InteliMarket Suite Telemetry</p>
                <p><span className="text-indigo-400">Timestamp:</span> {diagnostic.timestamp}</p>
                <p><span className="text-indigo-400">Error:</span> {diagnostic.errorName}: {diagnostic.errorMessage}</p>
                {diagnostic.endpoint && <p><span className="text-indigo-400">Endpoint:</span> {diagnostic.endpoint}</p>}
                {diagnostic.stack && (
                  <div>
                    <p className="text-slate-400 mt-2">// Stack Trace:</p>
                    <pre className="text-red-400 whitespace-pre-wrap">{diagnostic.stack}</pre>
                  </div>
                )}
                {diagnostic.componentStack && (
                  <div>
                    <p className="text-slate-400 mt-2">// React Component Tree:</p>
                    <pre className="text-amber-400 whitespace-pre-wrap">{diagnostic.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Copiar Diagnóstico */}
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer ${
                copied 
                  ? "bg-emerald-600 text-white" 
                  : "bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700"
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "¡Reporte Copiado!" : "Copiar Diagnóstico"}</span>
            </button>

            {/* Reintentar Operación */}
            {onRetry && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRetry()
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar</span>
              </button>
            )}
          </div>

          {/* Botón Principal: WhatsApp Directo */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Enviar a WhatsApp (+595 994 516360)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>

        </div>

      </div>
    </div>
  )
}
