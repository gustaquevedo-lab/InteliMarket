// Guardian puro de cierre del cobro mixto. Sin imports: ejecutable con node --test.

export const TOLERANCIA_PAGOS_PYG = 50

export type MetodoLinea =
  | "cash"
  | "bancard"
  | "dinelco"
  | "plugpay"
  | "qr"
  | "plugpay_credito"
  | "extra_club"
  | "otros"
export type EstadoLinea = "confirmada" | "en_curso" | "sin_cobrar"

export interface LineaCobro {
  id: string
  metodo: MetodoLinea
  montoPyg: number
  estado: EstadoLinea
  esExtra: boolean
}

export interface ContextoCierre {
  totalPyg: number
  metodosActivos: MetodoLinea[]
  extraClub?: { tieneLinea: boolean; saldoDisponible: number }
  otrosCompleto?: boolean
}

export type CodigoRechazo =
  | "linea_extra_sin_metodo_activo"
  | "linea_sin_confirmar"
  | "monto_invalido"
  | "extra_club_sin_saldo"
  | "otros_incompleto"
  | "suma_no_cuadra"

export type ResultadoCierre = { ok: true } | { ok: false; codigo: CodigoRechazo; mensaje: string }

// El efectivo se considera siempre confirmado.
function estaConfirmada(l: LineaCobro): boolean {
  return l.metodo === "cash" || l.estado === "confirmada"
}

export function totalConfirmadoPyg(lineas: LineaCobro[]): number {
  return lineas.filter(estaConfirmada).reduce((acc, l) => acc + l.montoPyg, 0)
}

const NOMBRE_METODO: Record<MetodoLinea, string> = {
  cash: "Efectivo",
  bancard: "Bancard",
  dinelco: "Dinelco",
  plugpay: "PlugPay",
  qr: "QR Bancard",
  plugpay_credito: "PlugPay crédito",
  extra_club: "Extra Club",
  otros: "Otros",
}

function rechazo(codigo: CodigoRechazo, mensaje: string): ResultadoCierre {
  return { ok: false, codigo, mensaje }
}

export function validarCierre(lineas: LineaCobro[], ctx: ContextoCierre): ResultadoCierre {
  const extraSinMetodo = lineas.find((l) => l.esExtra && !ctx.metodosActivos.includes(l.metodo))
  if (extraSinMetodo) {
    // El cobro adicional puede estar ya aprobado por el terminal: quitarlo
    // dejaria dinero cobrado sin venta. Se pide activar su metodo.
    return rechazo(
      "linea_extra_sin_metodo_activo",
      `Hay un cobro adicional de ${NOMBRE_METODO[extraSinMetodo.metodo] ?? extraSinMetodo.metodo} pero ese método no está activo: activalo para poder cerrar la venta.`,
    )
  }
  if (lineas.some((l) => !estaConfirmada(l))) {
    return rechazo(
      "linea_sin_confirmar",
      "Hay un cobro sin confirmar: completalo o quitalo antes de continuar.",
    )
  }
  if (lineas.some((l) => !Number.isFinite(l.montoPyg) || l.montoPyg <= 0)) {
    return rechazo("monto_invalido", "Hay un cobro con monto inválido: corregilo o quitalo.")
  }
  const extraClubLineas = lineas.filter((l) => l.metodo === "extra_club")
  if (extraClubLineas.length > 0) {
    const pedido = extraClubLineas.reduce((a, l) => a + l.montoPyg, 0)
    const saldo = ctx.extraClub?.saldoDisponible ?? 0
    if (!ctx.extraClub?.tieneLinea || saldo < pedido) {
      return rechazo(
        "extra_club_sin_saldo",
        "El saldo de Extra Club no alcanza para ese monto: bajalo o usá otro método.",
      )
    }
  }
  if (ctx.otrosCompleto === false && lineas.some((l) => l.metodo === "otros")) {
    return rechazo(
      "otros_incompleto",
      "Completá los datos del cobro en 'Otros' antes de continuar.",
    )
  }
  const confirmado = totalConfirmadoPyg(lineas)
  const diferencia = confirmado - ctx.totalPyg
  if (diferencia > TOLERANCIA_PAGOS_PYG) {
    // El vuelto nunca puede superar el efectivo entregado.
    const efectivo = lineas.filter((l) => l.metodo === "cash").reduce((acc, l) => acc + l.montoPyg, 0)
    if (diferencia > efectivo) {
      return rechazo(
        "suma_no_cuadra",
        "Lo cobrado supera el total y el vuelto no puede ser mayor al efectivo recibido: ajustá los montos.",
      )
    }
  } else if (-diferencia > TOLERANCIA_PAGOS_PYG) {
    return rechazo("suma_no_cuadra", "Todavía falta cobrar: la suma de los pagos no llega al total.")
  }
  return { ok: true }
}
