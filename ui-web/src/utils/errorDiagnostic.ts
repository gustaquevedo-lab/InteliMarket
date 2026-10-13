/**
 * Error Diagnostic Telemetry & Triage Engine
 * Transforms raw runtime exceptions into structured, actionable diagnostic cards.
 */

export interface ErrorDiagnostic {
  timestamp: string
  localTime: string
  route: string
  moduleName?: string
  errorName: string
  errorMessage: string
  stack?: string
  componentStack?: string
  status?: number
  endpoint?: string
  userEmail?: string
  companyId?: string
  browser: string
  suggestedTitle: string
  suggestedExplanation: string
  suggestions: string[]
}

const SUPPORT_WHATSAPP = "595994516360"

/**
 * Analyzes error patterns and returns user-friendly explanations and actionable suggestions.
 */
export function analyzeError(error: any): {
  suggestedTitle: string
  suggestedExplanation: string
  suggestions: string[]
} {
  const msg = String(error?.message || error?.detail || error || "").toLowerCase()
  const status = error?.status || (error?.message?.includes("500") ? 500 : undefined)

  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("err_connection") || msg.includes("econnrefused")) {
    return {
      suggestedTitle: "Conexión Interrumpida",
      suggestedExplanation: "No pudimos comunicarnos con el servidor central de InteliMarket. Tus datos locales están seguros.",
      suggestions: [
        "Verifica tu conexión a internet o Wi-Fi local.",
        "Comprueba si el servidor backend está en ejecución.",
        "Reintenta la operación en unos segundos."
      ]
    }
  }

  if (status === 500 || msg.includes("internal server error") || msg.includes("500") || msg.includes("pydantic") || msg.includes("sqlalchemy") || msg.includes("integrityerror")) {
    return {
      suggestedTitle: "Error del Servidor Backend",
      suggestedExplanation: "El servidor encontró un inconveniente al procesar esta consulta o registro. Nuestro equipo puede resolverlo rápidamente con el reporte técnico.",
      suggestions: [
        "Reintenta la acción para verificar si fue un bloqueo temporal.",
        "Envía el reporte directo por WhatsApp para una solución inmediata.",
        "Vuelve al inicio mientras se ajusta este módulo."
      ]
    }
  }

  if (status === 401 || msg.includes("401") || msg.includes("token") || msg.includes("no autenticado") || msg.includes("sesión expirada")) {
    return {
      suggestedTitle: "Sesión Expirada",
      suggestedExplanation: "Tu sesión de usuario ha caducado por motivos de seguridad.",
      suggestions: [
        "Vuelve a iniciar sesión con tu correo y contraseña.",
        "Si el problema persiste, limpia las cookies del navegador."
      ]
    }
  }

  if (status === 404 || msg.includes("404") || msg.includes("no encontrado")) {
    return {
      suggestedTitle: "Registro No Encontrado",
      suggestedExplanation: "El elemento, proveedor o período que buscas ya no está disponible o cambió de identificador.",
      suggestions: [
        "Comprueba los filtros seleccionados (sucursal, mes o fechas).",
        "Regresa al listado principal y actualiza la vista."
      ]
    }
  }

  if (msg.includes("cannot read properties of undefined") || msg.includes("cannot read properties of null") || msg.includes("is not a function") || msg.includes("typeerror") || msg.includes("referenceerror")) {
    return {
      suggestedTitle: "Inconsistencia de Datos en Pantalla",
      suggestedExplanation: "Se detectó un valor o referencia inesperada. La aplicación protegió el resto del sistema para evitar cierres inesperados.",
      suggestions: [
        "Pulsa 'Reintentar' para reiniciar la vista limpia.",
        "Copia el reporte o envíalo por WhatsApp con un solo clic."
      ]
    }
  }

  return {
    suggestedTitle: "Inconveniente Temporal Detectado",
    suggestedExplanation: "Ocurrió un evento no previsto mientras se procesaba esta pantalla. Tus datos y transacciones se mantienen intactos.",
    suggestions: [
      "Reintenta cargar la sección afectada.",
      "Si persiste, utiliza el botón de reporte a WhatsApp para asistencia directa."
    ]
  }
}

/**
 * Builds a structured diagnostic object with rich contextual telemetry.
 */
export function buildErrorDiagnostic(
  error: any,
  context?: { componentStack?: string; moduleName?: string; endpoint?: string; status?: number }
): ErrorDiagnostic {
  const now = new Date()
  let userEmail = ""
  let companyId = ""

  try {
    userEmail = localStorage.getItem("user_email") || ""
    const token = localStorage.getItem("access_token")
    if (token && token.includes(".")) {
      const payload = JSON.parse(atob(token.split(".")[1]))
      userEmail = userEmail || payload.email || ""
      companyId = payload.company_id || ""
    }
  } catch {
    // Ignore localStorage parsing errors
  }

  const analysis = analyzeError(error)

  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === "object" && error !== null && "detail" in error
    ? String((error as any).detail)
    : String(error || "Error desconocido")

  const errorName = error instanceof Error ? error.name : (error?.status ? `HTTP ${error.status} Error` : "Application Error")
  const stack = error instanceof Error ? error.stack : undefined

  return {
    timestamp: now.toISOString(),
    localTime: now.toLocaleString("es-PY", { timeZone: "America/Asuncion" }) + " (Hora Py)",
    route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
    moduleName: context?.moduleName || "InteliMarket Suite",
    errorName,
    errorMessage,
    stack,
    componentStack: context?.componentStack,
    status: context?.status || (error as any)?.status,
    endpoint: context?.endpoint || (error as any)?.endpoint,
    userEmail: userEmail || "No autenticado",
    companyId: companyId || "00000000-0000-0000-0000-000000000010",
    browser: typeof navigator !== "undefined" ? `${navigator.userAgent.slice(0, 120)}...` : "Browser",
    suggestedTitle: analysis.suggestedTitle,
    suggestedExplanation: analysis.suggestedExplanation,
    suggestions: analysis.suggestions
  }
}

/**
 * Formats the diagnostic as a clean Markdown report for copying.
 */
export function formatDiagnosticAsMarkdown(diag: ErrorDiagnostic): string {
  return `### 🚨 REPORTE TÉCNICO DE DIAGNÓSTICO INTELIMARKET
* **Fecha:** ${diag.localTime}
* **Módulo:** ${diag.moduleName || "General"}
* **Ruta:** \`${diag.route}\`
* **Usuario:** ${diag.userEmail}
* **Empresa ID:** \`${diag.companyId}\`
* **Error:** \`${diag.errorName}: ${diag.errorMessage}\`
${diag.status ? `* **Código HTTP:** \`${diag.status}\`` : ""}
${diag.endpoint ? `* **Endpoint API:** \`${diag.endpoint}\`` : ""}

#### 🔍 Diagnóstico Sugerido:
**${diag.suggestedTitle}**: ${diag.suggestedExplanation}

${diag.stack ? `#### 📜 Stack Trace:\n\`\`\`text\n${diag.stack.slice(0, 1500)}\n\`\`\`` : ""}
${diag.componentStack ? `#### ⚛️ Component Stack:\n\`\`\`text\n${diag.componentStack.slice(0, 800)}\n\`\`\`` : ""}
`
}

/**
 * Generates direct WhatsApp URL with prefilled message.
 */
export function getWhatsAppReportUrl(diag: ErrorDiagnostic, phoneNumber: string = SUPPORT_WHATSAPP): string {
  const shortError = diag.errorMessage.length > 160 ? diag.errorMessage.slice(0, 157) + "..." : diag.errorMessage
  
  const text = `🚨 *REPORTE DE ERROR INTELIMARKET*
━━━━━━━━━━━━━━━━━━━━
📌 *Módulo:* ${diag.moduleName || "General"}
🌐 *Ruta:* ${diag.route}
⏰ *Fecha:* ${diag.localTime}
👤 *Usuario:* ${diag.userEmail}
${diag.status ? `🔢 *HTTP Status:* ${diag.status}\n` : ""}${diag.endpoint ? `🔗 *Endpoint:* ${diag.endpoint}\n` : ""}
⚠️ *Error:*
${shortError}

💡 *Diagnóstico:*
${diag.suggestedTitle} - ${diag.suggestedExplanation}
━━━━━━━━━━━━━━━━━━━━
_Reporte generado automáticamente desde el Error Boundary de InteliMarket._`

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`
}

/**
 * Helper to copy diagnostic directly to clipboard with multi-tier fallback (supports HTTP and LAN).
 */
export async function copyDiagnosticToClipboard(diag: ErrorDiagnostic): Promise<boolean> {
  const text = formatDiagnosticAsMarkdown(diag)

  // Method 1: Modern Async Clipboard API (HTTPS/localhost)
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to fallback
    }
  }

  // Method 2: DOM execCommand Fallback (works on HTTP, LAN IP, non-secure origins)
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.style.position = "fixed"
      textarea.style.top = "0"
      textarea.style.left = "0"
      textarea.style.width = "2em"
      textarea.style.height = "2em"
      textarea.style.padding = "0"
      textarea.style.border = "none"
      textarea.style.outline = "none"
      textarea.style.boxShadow = "none"
      textarea.style.background = "transparent"
      textarea.setAttribute("readonly", "")
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      const successful = document.execCommand("copy")
      document.body.removeChild(textarea)
      return successful
    } catch (err) {
      console.error("Fallback copy failed:", err)
      return false
    }
  }

  return false
}
