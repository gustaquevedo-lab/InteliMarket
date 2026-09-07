// Puente minimo entre PWAUpdatePrompt (que registra el Service Worker y sabe
// si hay una version nueva esperando) y cualquier otro lugar de la app que
// necesite aplicarla en un momento seguro -- hoy, el logout del POS/Layout.
// Un context de React para esto seria mas "correcto", pero forzaria a envolver
// toda la app; un modulo singleton alcanza porque solo hay un Service Worker
// por pestaña y solo nos importa el ultimo estado conocido.
type ApplyFn = () => void

let needRefresh = false
let applyFn: ApplyFn | null = null

export function setPwaUpdateState(refresh: boolean, apply: ApplyFn | null) {
  needRefresh = refresh
  applyFn = apply
}

/** Aplica la actualizacion pendiente si hay una, y devuelve true si lo hizo
 * (quien llama no deberia navegar manualmente despues -- el Service Worker
 * nuevo va a recargar la pagina solo). Si no hay nada pendiente, no hace nada
 * y devuelve false. */
export function applyPwaUpdateIfPending(): boolean {
  if (needRefresh && applyFn) {
    applyFn()
    return true
  }
  return false
}
