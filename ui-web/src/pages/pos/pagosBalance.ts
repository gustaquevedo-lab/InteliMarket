/**
 * pagosBalance.ts
 * Logica pura de balance y calculo de saldo faltante/resto para pagos mixtos en el POS.
 */

export interface PagosEstado {
  payCashPyg?: number;
  payCashUsd?: number;
  rateUsd?: number;
  payCashBrl?: number;
  rateBrl?: number;
  mixedCardPyg?: number;
  mixedDinelcoPyg?: number;
  mixedQrPyg?: number;
  mixedPlugPayPyg?: number;
  mixedParceladoPyg?: number;
  mixedExtraClubPyg?: number;
  mixedOtrosPyg?: number;
  extraCards?: Array<{ montoPyg?: number }>;
}

function sanitizeNum(val?: number): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val) || val <= 0) {
    return 0;
  }
  return Math.round(val);
}

/**
 * Calcula la suma total en guaranies de todos los medios de pago configurados.
 */
export function calcularTotalCubiertoPyg(pagos: PagosEstado): number {
  const efectivoPyg = sanitizeNum(pagos.payCashPyg);
  const efectivoUsdPyg = Math.round(sanitizeNum(pagos.payCashUsd) * sanitizeNum(pagos.rateUsd));
  const efectivoBrlPyg = Math.round(sanitizeNum(pagos.payCashBrl) * sanitizeNum(pagos.rateBrl));
  const cardBancardPyg = sanitizeNum(pagos.mixedCardPyg);
  const cardDinelcoPyg = sanitizeNum(pagos.mixedDinelcoPyg);
  const qrPyg = sanitizeNum(pagos.mixedQrPyg);
  const plugPayPyg = sanitizeNum(pagos.mixedPlugPayPyg);
  const parceladoPyg = sanitizeNum(pagos.mixedParceladoPyg);
  const extraClubPyg = sanitizeNum(pagos.mixedExtraClubPyg);
  const otrosPyg = sanitizeNum(pagos.mixedOtrosPyg);

  let extraCardsPyg = 0;
  if (Array.isArray(pagos.extraCards)) {
    for (const card of pagos.extraCards) {
      extraCardsPyg += sanitizeNum(card?.montoPyg);
    }
  }

  return (
    efectivoPyg +
    efectivoUsdPyg +
    efectivoBrlPyg +
    cardBancardPyg +
    cardDinelcoPyg +
    qrPyg +
    plugPayPyg +
    parceladoPyg +
    extraClubPyg +
    otrosPyg +
    extraCardsPyg
  );
}

/**
 * Calcula cuanto falta cubrir de la venta excluyendo el campo destino (targetKey),
 * permitiendo calcular el "Resto" exacto para ese metodo sin pisar los demas.
 */
export function calcularRestoParaMetodo(
  targetKey: keyof PagosEstado | `extraCard_${number}`,
  totalVentaPyg: number,
  pagos: PagosEstado
): number {
  const copia: PagosEstado = { ...pagos };

  if (targetKey.startsWith('extraCard_')) {
    const idx = parseInt(targetKey.replace('extraCard_', ''), 10);
    if (Array.isArray(copia.extraCards)) {
      copia.extraCards = copia.extraCards.map((c, i) =>
        i === idx ? { ...c, montoPyg: 0 } : c
      );
    }
  } else {
    copia[targetKey as keyof PagosEstado] = 0 as never;
  }

  const cubiertoPorOtros = calcularTotalCubiertoPyg(copia);
  return Math.max(0, Math.round(totalVentaPyg) - cubiertoPorOtros);
}
