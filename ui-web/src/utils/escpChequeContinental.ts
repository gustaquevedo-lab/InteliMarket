// ── GENERADOR DE TRAMAS ESC/P PARA CHEQUES BANCO CONTINENTAL (PARAGUAY) ──
// Diseñado para Epson LX-300+ / LX-300+II conectada por USB en formulario continuo.
// Medida física: 2.75 pulgadas (69.85 mm = 7.0 cm) por 9.5 pulgadas de ancho.
// A 6 LPI (ESC 2) o 8 LPI (ESC 0), ajustado para que NINGUNA línea supere 72 columnas
// y evitar terminantemente el auto-wrap del carro de 80 columnas de la LX-300+.

export interface ChequeContinentalData {
  numero: string
  monto: number
  beneficiario: string
  esDiferido: boolean
  fechaEmision: string // YYYY-MM-DD
  fechaPago?: string // YYYY-MM-DD (para diferido)
  cruzado: boolean
  noALaOrden: boolean
  concepto?: string
  plaza?: string // Defecto: "Pedro Juan Caballero"
  imprimirTalon?: boolean // Si se llena el talón izquierdo de control (default: false para evitar desborde de 80 col)
  // Calibración fina (guardada en localStorage por PC)
  offsetX?: number // Columnas (+ a la derecha, - a la izquierda)
  offsetY?: number // Líneas (+ abajo, - arriba)
  // Posiciones individuales calibrables (en columnas relativas al cheque)
  colMonto?: number // Default: 52
  colFechasEmi?: number // Default: 26
  colFechasPago?: number // Default: 44
  colBeneficiario?: number // Default: 4
  colLetras?: number // Default: 3
}

/**
 * Convierte un importe entero en Guaraníes a su expresión en letras.
 * REGLA CANÓNICA: NO agrega la palabra "GUARANÍES" porque el formulario
 * preimpreso de Banco Continental ya dice "La suma de Guaraníes".
 */
export function numeroALetrasContinental(monto: number): string {
  const entero = Math.round(Math.abs(monto))
  if (entero === 0) return "CERO"

  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
  const diez_a_diecinueve = [
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
    "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"
  ]
  const veintis = [
    "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO",
    "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"
  ]
  const decenas = [
    "", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
    "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"
  ]
  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
    "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
  ]

  function seccion(num: number): string {
    if (num === 0) return ""
    if (num === 100) return "CIEN"
    let str = ""
    const c = Math.floor(num / 100)
    const d = Math.floor((num % 100) / 10)
    const u = num % 10
    if (c > 0) str += centenas[c] + " "
    const resto = num % 100
    if (resto >= 10 && resto <= 19) {
      str += diez_a_diecinueve[resto - 10]
    } else if (resto >= 20 && resto <= 29) {
      str += veintis[resto - 20]
    } else if (resto >= 30) {
      str += decenas[d]
      if (u > 0) str += " Y " + unidades[u]
    } else if (u > 0) {
      str += unidades[u]
    }
    return str.trim()
  }

  function convertir(n: number): string {
    if (n === 0) return ""
    if (n < 1000) return seccion(n)
    if (n < 1000000) {
      const miles = Math.floor(n / 1000)
      const resto = n % 1000
      const milesStr = miles === 1 ? "UN MIL" : seccion(miles) + " MIL"
      return resto > 0 ? milesStr + " " + seccion(resto) : milesStr
    }
    if (n < 1000000000000) {
      const millones = Math.floor(n / 1000000)
      const resto = n % 1000000
      const millStr = millones === 1 ? "UN MILLÓN" : convertir(millones) + " MILLONES";
      return resto > 0 ? millStr + " " + convertir(resto) : millStr
    }
    return n.toString()
  }

  return convertir(entero).replace(/\s+/g, " ").trim()
}

/**
 * Da formato de seguridad al monto en letras con asteriscos y guiones de relleno.
 * Máximo 50 caracteres por línea para NUNCA desbordar el carro de 80 columnas.
 */
export function formatearLetrasSeguridad(monto: number, maxChars = 50): { linea1: string; linea2: string } {
  const letras = numeroALetrasContinental(monto)
  const base = `*${letras}`
  
  if (base.length <= maxChars - 2) {
    const relleno = "-".repeat(Math.max(2, maxChars - base.length - 1))
    return { linea1: `${base}${relleno}*`, linea2: "" }
  }

  // Si excede una línea, partimos por palabras
  const palabras = letras.split(" ")
  let l1 = "*"
  let l2 = ""
  for (const pal of palabras) {
    if ((l1 + " " + pal).length < maxChars - 2) {
      l1 += (l1 === "*" ? "" : " ") + pal
    } else {
      l2 += (l2 === "" ? "" : " ") + pal
    }
  }
  l1 += "*"
  if (l2) {
    const relleno2 = "-".repeat(Math.max(2, maxChars - l2.length - 2))
    l2 = `*${l2}${relleno2}*`
  }
  return { linea1: l1, linea2: l2 }
}

function parsearFecha(fechaStr?: string) {
  if (!fechaStr) {
    const hoy = new Date()
    const dd = String(hoy.getDate()).padStart(2, "0")
    const mm = String(hoy.getMonth() + 1).padStart(2, "0")
    const aaaa = String(hoy.getFullYear())
    return { dd, mm, aaaa, aa: aaaa.slice(-2) }
  }
  const partes = fechaStr.split("-")
  if (partes.length === 3) {
    return {
      dd: partes[2].padStart(2, "0"),
      mm: partes[1].padStart(2, "0"),
      aaaa: partes[0],
      aa: partes[0].slice(-2)
    }
  }
  return { dd: "01", mm: "01", aaaa: "2026", aa: "26" }
}

const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"
]

/**
 * Genera el payload de comandos ESC/P para Epson LX-300+ optimizado y calibrado.
 * 
 * ESTRATEGIA ANTI-DESBORDE Y PRECISIÓN MILIMÉTRICA:
 * 1. Ancho máximo estricto por línea: 72 columnas (el carro de LX-300+ a 10 CPI tiene 80 col).
 *    Esto garantiza CERO auto-wraps no deseados, cero saltos extra y cero letras desparramadas.
 * 2. Si se activa el talón izquierdo (imprimirTalon=true), se activa automáticamente
 *    modo Condensado (17.1 CPI, 136 col) para que ambos sectores quepan sin desbordar.
 * 3. En modo estándar (solo cuerpo del cheque), la impresión arranca directo en las casillas
 *    del cheque con 10 CPI Draft nítido y claro.
 */
export function generarEscpChequeContinental(data: ChequeContinentalData): string {
  const offX = Math.max(-25, Math.min(25, data.offsetX || 0))
  const offY = Math.max(-5, Math.min(5, data.offsetY || 0))
  const imprimirTalon = data.imprimirTalon ?? false // Por defecto false: enfocado en el cuerpo del cheque
  const plaza = data.plaza || "Pedro Juan Caballero"

  // Fechas parseadas
  const fEmi = parsearFecha(data.fechaEmision)
  const fPago = parsearFecha(data.fechaPago || data.fechaEmision)
  const mesEmiNombre = MESES[parseInt(fEmi.mm, 10)] || "Noviembre"

  // Monto formateado con asteriscos de seguridad
  const montoNumStr = `*${Math.round(data.monto).toLocaleString("es-PY")}*`
  
  // Monto en letras (máx 50 caracteres para no romper margen)
  const { linea1: letrasL1, linea2: letrasL2 } = formatearLetrasSeguridad(data.monto, 50)

  // Beneficiario
  let beneText = data.beneficiario.toUpperCase().trim()
  if (data.noALaOrden) {
    beneText += "   *** NO A LA ORDEN ***"
  }
  // Truncar beneficiario a máx 48 caracteres para evitar desborde
  if (beneText.length > 48) {
    beneText = beneText.slice(0, 48)
  }

  // Matriz de líneas (12 líneas útiles para cubrir la altura del cheque)
  const TOTAL_LINEAS = 14
  const lineas: string[] = Array(TOTAL_LINEAS).fill("")

  // Columnas base calibradas (relativas al cuerpo del cheque)
  // En la LX-300+, con el tractor en posición normal, el cheque arranca en col 0-4.
  const COL_BASE = imprimirTalon ? 24 : 0
  const cMonto = (data.colMonto ?? 52) + COL_BASE
  const cFechasEmi = (data.colFechasEmi ?? 26) + COL_BASE
  const cFechasPago = (data.colFechasPago ?? 44) + COL_BASE
  const cBene = (data.colBeneficiario ?? 4) + COL_BASE
  const cLetras = (data.colLetras ?? 3) + COL_BASE

  // Helper de escritura seguro con límite estricto de 76 caracteres
  const MAX_COL = imprimirTalon ? 120 : 75
  function escribir(lineaIdx: number, col: number, texto: string) {
    const lActual = lineaIdx + offY
    if (lActual < 0 || lActual >= TOTAL_LINEAS) return
    const cActual = Math.max(0, Math.min(MAX_COL - texto.length, col + offX))
    let cur = lineas[lActual]
    if (cur.length < cActual) {
      cur = cur.padEnd(cActual, " ")
    }
    const nueva = cur.slice(0, cActual) + texto + cur.slice(cActual + texto.length)
    lineas[lActual] = nueva.slice(0, MAX_COL) // Nunca excede MAX_COL
  }

  // ── 1. TALÓN IZQUIERDO (Opcional, en columnas 0 a 22) ──
  if (imprimirTalon) {
    if (data.esDiferido) {
      escribir(1, 1, `Venc:${fPago.dd}/${fPago.mm}/${fPago.aaaa}`)
    }
    escribir(2, 1, `Fec:${fEmi.dd}/${fEmi.mm}/${fEmi.aaaa}`)
    escribir(3, 1, `Ord:${beneText.slice(0, 16)}`)
    if (data.concepto) {
      escribir(4, 1, `Cpto:${data.concepto.slice(0, 16)}`)
    }
    escribir(5, 1, `Gs:${montoNumStr.slice(0, 18)}`)
  }

  // ── 2. CUERPO DEL CHEQUE BANCO CONTINENTAL ──
  // A. Renglón 1: Cruzado a la izquierda + Monto numérico en la casilla derecha al lado de ₲
  if (data.cruzado) {
    escribir(1, COL_BASE + 1, "//")
  }
  escribir(1, cMonto, montoNumStr)

  // B. Renglón 2: Fechas en casillas superiores
  // FECHA DE EMISIÓN: DD  MM  AA
  // FECHA DE PAGO (Diferido): DD  MM  AA
  if (data.esDiferido) {
    escribir(2, cFechasEmi, `${fEmi.dd}   ${fEmi.mm}   ${fEmi.aa}`)
    escribir(2, cFechasPago, `${fPago.dd}   ${fPago.mm}   ${fPago.aa}`)
  } else {
    escribir(2, cFechasEmi, `${fEmi.dd}   ${fEmi.mm}   ${fEmi.aa}`)
  }

  // C. Renglón 4: "Páguese a la orden de"
  escribir(4, cBene, beneText)

  // D. Renglón 5 y 6: "La suma de Guaraníes" (Sin redundancia "GUARANÍES")
  escribir(5, cLetras, letrasL1)
  if (letrasL2) {
    escribir(6, cLetras, letrasL2)
  }

  // E. Renglón 8: Plaza y fecha (solo si es a la vista)
  if (!data.esDiferido) {
    escribir(8, cBene + 6, `${plaza}, ${fEmi.dd} de ${mesEmiNombre} de ${fEmi.aaaa}`)
  }

  // ── 3. COMPILACIÓN DE COMANDOS ESC/P ──
  const ESC = "\x1B"
  const FF = "\x0C"

  let escp = ""
  // Inicializar impresora
  escp += `${ESC}@`
  // Longitud de página a 2.75 pulgadas (22 líneas a 8 LPI o 16.5 a 6 LPI) -> fijamos 17 líneas
  escp += `${ESC}C\x11`
  // Interlineado 1/6 pulgada (6 LPI) -> estándar de formularios
  escp += `${ESC}2`

  // Si incluye talón, activamos condensado para soportar más de 80 col sin wrap
  if (imprimirTalon) {
    escp += "\x0F" // SI = Condensed on (17.1 CPI)
  } else {
    escp += `${ESC}P` // 10 CPI Pica estándar
  }

  // Imprimir renglones
  for (let i = 0; i < TOTAL_LINEAS; i++) {
    const linea = lineas[i]
    if (linea.trim().length > 0) {
      if (linea.includes(montoNumStr)) {
        const partes = linea.split(montoNumStr)
        escp += partes[0] + `${ESC}E${montoNumStr}${ESC}F` + (partes[1] || "")
      } else {
        escp += linea
      }
    }
    escp += "\r\n"
  }

  // Avanzar al siguiente cheque
  escp += FF

  return escp
}

/**
 * Genera una REGLA / GRID DE CALIBRACIÓN física con numeración de líneas y columnas.
 * Al imprimir esto sobre papel continuo y superponer el cheque Continental a trasluz,
 * el usuario puede leer con total exactitud la línea (L1..L9) y columna (0..70)
 * de cada una de las casillas físicas de su talonario.
 */
export function generarEscpReglaCalibracion(): string {
  const ESC = "\x1B"
  const FF = "\x0C"

  let escp = ""
  escp += `${ESC}@`
  escp += `${ESC}2` // 6 LPI
  escp += `${ESC}C\x11` // 17 líneas
  escp += `${ESC}P` // 10 CPI

  // Encabezado de regla
  escp += "REGLA DE CALIBRACION CHEQUE CONTINENTAL (EPSON LX-300+)\r\n"
  escp += "    ....+....1....+....2....+....3....+....4....+....5....+....6....+....7\r\n"
  
  for (let i = 1; i <= 9; i++) {
    const lnum = `L${i}:`
    // Marcador cada 10 columnas
    escp += `${lnum} ....+....1....+....2....+....3....+....4....+....5....+....6....+....7\r\n`
  }

  escp += FF
  return escp
}

/**
 * Genera cheque de prueba en borrador con las posiciones canónicas compactas.
 */
export function generarEscpPruebaAlineacion(offsetX = 0, offsetY = 0): string {
  return generarEscpChequeContinental({
    numero: "935451",
    monto: 12345678,
    beneficiario: "EMPRESA DE PRUEBA S.A.",
    esDiferido: true,
    fechaEmision: "2026-11-03",
    fechaPago: "2026-11-25",
    cruzado: true,
    noALaOrden: true,
    concepto: "CALIBRACION CONTINENTAL",
    plaza: "Pedro Juan Caballero",
    imprimirTalon: false, // Desactivado por defecto para garantizar cero desborde
    offsetX,
    offsetY,
  })
}
