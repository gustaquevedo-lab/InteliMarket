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

function rechazo(codigo: CodigoRechazo, mensaje: string): ResultadoCierre {
  return { ok: false, codigo, mensaje }
}

export function validarCierre(lineas: LineaCobro[], ctx: ContextoCierre): ResultadoCierre {
  if (lineas.some((l) => l.esExtra && !ctx.metodosActivos.includes(l.metodo))) {
    return rechazo(
      "linea_extra_sin_metodo_activo",
      "Hay un cobro con un método que no está habilitado en esta caja: quitalo antes de continuar.",
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
  if (diferencia > 0) {
    // Exceso solo es válido si hay efectivo (se da vuelto).
    if (!lineas.some((l) => l.metodo === "cash")) {
      return rechazo(
        "suma_no_cuadra",
        "Lo cobrado supera el total y no hay efectivo para dar vuelto: ajustá los montos.",
      )
    }
  } else if (-diferencia > TOLERANCIA_PAGOS_PYG) {
    return rechazo("suma_no_cuadra", "Todavía falta cobrar: la suma de los pagos no llega al total.")
  }
  return { ok: true }
}
