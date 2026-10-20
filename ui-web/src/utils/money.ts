// Única fuente de verdad para montos en guaraníes en el frontend (espejo de api/src/common/money.py).
// Gs. sin decimales: todo cálculo se redondea HACIA ARRIBA al entero en el momento.
// Única excepción, el IVA: al MÁS PRÓXIMO (DNIT). 10% = total/11, 5% = total/21.

export const gs = (x: number): number => Math.ceil(Number(x) || 0)

export const ivaIncluido = (total: number, tasa: number): number =>
  tasa === 10 ? Math.round(total / 11) : tasa === 5 ? Math.round(total / 21) : 0
