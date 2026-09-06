// Code128 vectorial, sin dependencias. Devuelve los anchos de barra crudos
// para que cada consumidor los dibuje como quiera (SVG en pantalla, canvas
// para la impresora). Antes esta lógica vivía duplicada dentro de la página
// de etiquetas.

const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
]

/** Secuencia de anchos de barra/espacio (alternando barra, espacio, barra...). */
export function code128Widths(code: string): number[] {
  if (!code) return []
  let checksum = 104
  const patrones: string[] = [PATTERNS[104]] // START B
  for (let i = 0; i < code.length; i++) {
    const cc = code.charCodeAt(i) - 32
    if (cc >= 0 && cc <= 95) {
      patrones.push(PATTERNS[cc])
      checksum += cc * (i + 1)
    }
  }
  patrones.push(PATTERNS[checksum % 103])
  patrones.push(PATTERNS[106]) // STOP
  return patrones.join("").split("").map((n) => parseInt(n, 10) || 1)
}

/** Módulos totales, para calcular cuántos dots mide el código completo. */
export function code128TotalModulos(code: string): number {
  return code128Widths(code).reduce((a, b) => a + b, 0)
}
