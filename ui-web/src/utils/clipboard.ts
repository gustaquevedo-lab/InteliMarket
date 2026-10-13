/**
 * Copiar al portapapeles sin romper la pantalla si la API no está disponible
 * (contexto no seguro, iframe sin permiso, navegador viejo). Devuelve si
 * realmente copió; nunca lanza.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // sigue al fallback
  }
  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    textarea.style.top = "-9999px"
    textarea.style.opacity = "0"
    textarea.setAttribute("readonly", "")
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
