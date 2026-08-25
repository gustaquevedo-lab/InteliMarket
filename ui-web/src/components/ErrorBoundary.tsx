import React, { Component, ErrorInfo, ReactNode } from "react"
import {
  AlertTriangle, RefreshCw, Copy, Check, MessageSquare, Home,
  ChevronDown, ChevronUp, Terminal, ShieldAlert, Cpu, Sparkles, ExternalLink
} from "lucide-react"

const WHATSAPP_NUMBER = "595994516360"

interface Props {
  children?: ReactNode
  moduleName?: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error("🚨 [InteliMarket ErrorBoundary Caught]:", error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleReload = () => {
    // Si es un error de chunk de Vite, forzar recarga limpia
    if (this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Loading chunk")) {
      window.location.reload()
      return
    }
    window.location.reload()
  }

  private getDiagnosis() {
    const msg = (this.state.error?.message || "").toLowerCase()
    const stack = (this.state.error?.stack || "").toLowerCase()

    if (msg.includes("dynamically imported module") || msg.includes("loading chunk") || msg.includes("mime type")) {
      return {
        tipo: "Actualización de Versión en el Servidor",
        explicacion: "Se ha desplegado una nueva versión de InteliMarket en el servidor y tu navegador tenía módulos en caché de la versión anterior.",
        solucion: "Haz clic en 'Recargar Sistema' para sincronizar con los últimos archivos del servidor.",
        icono: RefreshCw,
        color: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
      }
    }

    if (msg.includes("networkerror") || msg.includes("failed to fetch") || msg.includes("connection refused") || msg.includes("504") || msg.includes("502")) {
      return {
        tipo: "Problema de Conexión de Red / Servidor",
        explicacion: "No se pudo establecer comunicación con el servidor backend o la base de datos central.",
        solucion: "Verifica tu conexión a internet o a la red local Tailscale y presiona 'Reintentar'.",
        icono: AlertTriangle,
        color: "text-amber-500",
        bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
      }
    }

    if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("token")) {
      return {
        tipo: "Sesión Expirada o Permisos Insuficientes",
        explicacion: "Tu sesión de usuario ha caducado o no cuentas con los permisos RBAC requeridos para este módulo.",
        solucion: "Inicia sesión nuevamente con tus credenciales autorizadas.",
        icono: ShieldAlert,
        color: "text-purple-500",
        bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
      }
    }

    return {
      tipo: "Discrepancia en Procesamiento de Datos",
      explicacion: "Ocurrió una excepción al renderizar la información de este módulo.",
      solucion: "Puedes enviar el reporte directo al equipo de desarrollo con un solo clic en WhatsApp para resolverlo de inmediato.",
      icono: Cpu,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
    }
  }

  private generateReportText(): string {
    const { error, errorInfo } = this.state
    const diagnosis = this.getDiagnosis()
    const moduleName = this.props.moduleName || window.location.pathname
    const timestamp = new Date().toLocaleString("es-PY")

    let userEmail = "No identificado"
    try {
      const stored = localStorage.getItem("auth_user")
      if (stored) {
        const u = JSON.parse(stored)
        userEmail = u.email || u.nombre || userEmail
      }
    } catch {
      // ignore
    }

    return [
      `🚨 *REPORTE DE ERROR — INTELIMARKET* 🚨`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `📅 *Fecha / Hora:* ${timestamp}`,
      `📍 *Módulo Afectado:* ${moduleName}`,
      `🌐 *URL:* ${window.location.href}`,
      `👤 *Usuario:* ${userEmail}`,
      `🔍 *Diagnóstico:* ${diagnosis.tipo}`,
      `⚠️ *Mensaje de Error:* ${error?.message || "Error desconocido"}`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *Pila de Llamadas (Stack Trace):*`,
      `${error?.stack ? error.stack.slice(0, 500) + "..." : "No disponible"}`,
      errorInfo?.componentStack ? `\n🧩 *Component Stack:*\n${errorInfo.componentStack.slice(0, 300)}...` : "",
    ].filter(Boolean).join("\n")
  }

  private handleCopyReport = () => {
    const text = this.generateReportText()
    navigator.clipboard.writeText(text)
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 3000)
  }

  private handleOpenWhatsApp = () => {
    const text = this.generateReportText()
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const diagnosis = this.getDiagnosis()
      const DiagIcon = diagnosis.icono

      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-850 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700/80 shadow-2xl space-y-6">
            {/* Cabecera Amigable */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20 shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Tranquilo, tu información está a salvo
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-750 text-gray-600 dark:text-gray-300 border border-slate-200 dark:border-slate-700">
                    Sistema Protegido
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  El sistema contuvo la anomalía de forma segura para evitar pérdida de datos o cierres inesperados.
                </p>
              </div>
            </div>

            {/* Diagnóstico Contextual Inteligente */}
            <div className={`p-4 rounded-2xl border ${diagnosis.bg} space-y-2`}>
              <div className="flex items-center gap-2">
                <DiagIcon className={`w-4 h-4 ${diagnosis.color}`} />
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Diagnóstico: {diagnosis.tipo}
                </h2>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {diagnosis.explicacion}
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white border-t border-slate-200/50 dark:border-slate-700/50">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Solución sugerida: {diagnosis.solucion}</span>
              </div>
            </div>

            {/* Mensaje de Error Conciso */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto space-y-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400 border-b border-slate-800 pb-1">
                <span>Detalle técnico del error:</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <p className="text-rose-400 font-bold py-1">
                {this.state.error?.name}: {this.state.error?.message || "Error no tipificado"}
              </p>
            </div>

            {/* Botonera de Acciones Rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={this.handleOpenWhatsApp}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5"
              >
                <MessageSquare className="w-4 h-4" />
                Enviar a WhatsApp (+595 994 516360)
              </button>

              <button
                onClick={this.handleCopyReport}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-750 text-white font-bold text-xs shadow-md transition-all"
              >
                {this.state.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {this.state.copied ? "¡Informe Copiado al Portapapeles!" : "Copiar Informe Técnico Completo"}
              </button>

              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-200 font-bold text-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recargar Sistema
              </button>

              <button
                onClick={() => {
                  this.handleReset()
                  window.location.href = "/"
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-200 font-bold text-xs transition"
              >
                <Home className="w-3.5 h-3.5" />
                Volver al Dashboard
              </button>
            </div>

            {/* Desplegable de Pila de Error (Stack Trace) */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="flex items-center justify-between w-full text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  {this.state.showDetails ? "Ocultar Stack Trace Avanzado" : "Ver Pila de Ejecución Técnica (Stack Trace)"}
                </span>
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950 text-slate-400 font-mono text-[10px] max-h-48 overflow-y-auto space-y-2 border border-slate-800">
                  <p className="text-slate-300 font-bold">Stack Trace:</p>
                  <pre className="whitespace-pre-wrap">{this.state.error?.stack || "Sin stack trace disponible"}</pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <p className="text-slate-300 font-bold pt-2 border-t border-slate-800">Component Stack:</p>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
