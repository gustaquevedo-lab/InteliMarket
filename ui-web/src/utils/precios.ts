/**
 * Precio de lista de un producto, ignorando promociones vigentes.
 *
 * Una etiqueta de góndola sobrevive a la promoción: la oferta dura días, el
 * cartel se queda colgado meses. Si se imprimiera el precio de hoy, la góndola
 * terminaría anunciando un precio que ya no existe.
 *
 * Cuando hay una promo de precio fijo vigente, el backend PISA `precio_venta`
 * con el precio promocional y guarda el de lista en `precio_regular`. Por eso
 * el estándar es `precio_regular` cuando existe.
 *
 * Se exige > 0: hay filas heredadas del legacy con `precio_regular` en cero, y
 * tomarlas al pie de la letra imprimiría carteles de Gs. 0.
 */
export function precioEstandar(p: { precio_venta?: any; precio_regular?: any }): number {
  const regular = Number(p?.precio_regular) || 0
  if (regular > 0) return regular
  return Number(p?.precio_venta) || 0
}

/** true si hoy el producto se vende más barato que su precio de lista. */
export function estaEnPromocion(p: { precio_venta?: any; precio_regular?: any }): boolean {
  const venta = Number(p?.precio_venta) || 0
  const estandar = precioEstandar(p)
  return venta > 0 && estandar > venta
}
