// ── GENERADOR DE TRAMAS ESC/P PARA CHEQUES BANCO CONTINENTAL (PARAGUAY) ──
// Diseñado para Epson LX-300+ / LX-300+II conectada por USB en formulario continuo.
// Medida física: 2.75 pulgadas (69.85 mm = 7.0 cm) por 9.5 pulgadas de ancho.
//
// FORMATO DUAL INTEGRADO (TALÓN IZQUIERDO + CUERPO DE CHEQUE):
// En 12 CPI (Elite, ESC M), el carro de 8 pulgadas de la LX-300+ rinde exactamente
// 96 COLUMNAS FÍSICAS sin hacer retorno de carro automático (auto-wrap).
// - Columnas 1 a 22: Talón de control izquierdo (Vencimiento, Fecha, Orden, Concepto, Este Cheque)
// - Columnas 23 a 25: Perforación troquelada divisoria
// - Columnas 26 a 92: Cuerpo del Cheque Banco Continental (Monto, Fechas, Beneficiario, Letras)

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
  imprimirTalon?: boolean // Si se llena el talón izquierdo de control (default: true)
  // Calibración fina (guardada en localStorage por PC)
  offsetX?: number // Columnas (+ a la derecha, - a la izquierda)
  offsetY?: number // Líneas (+ abajo, - arriba)
  // Posiciones de columnas calibrables (modo 12 CPI, 96 columnas totales)
  colTalon?: number // Default: 1
  colCheque?: number // Default: 26
  colMonto?: number // Default: 76
  colFechasEmi?: number // Default: 48
  colFechasPago?: number // Default: 68
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
      const millStr = millones === 1 ? "UN MILLÓN" : convertir(millones) + " MILLONES"
      return resto > 0 ? millStr + " " + convertir(resto) : millStr
    }
    return n.toString()
  }

  return convertir(entero).replace(/\s+/g, " ").trim()
}

/**
 * Da formato de seguridad al monto en letras con asteriscos y guiones de relleno.
 * Máximo 58 caracteres por línea para encajar con holgura dentro de las 96 columnas a 12 CPI.
 */
export function formatearLetrasSeguridad(monto: number, maxChars = 56): { linea1: string; linea2: string } {
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
 * Genera el payload ESC/P para Banco Continental imprimiendo TALÓN + CHEQUE simultáneamente.
 * Utiliza 12 CPI (Elite, 96 columnas) para garantizar que NUNCA desborde el carro de 80 col
 * y no se produzca retorno de carro automático involuntario.
 */
export function generarEscpChequeContinental(data: ChequeContinentalData): string {
  const offX = Math.max(-20, Math.min(25, data.offsetX || 0))
  const offY = Math.max(-5, Math.min(5, data.offsetY || 0))
  const imprimirTalon = data.imprimirTalon ?? true
  const plaza = data.plaza || "Pedro Juan Caballero"

  // Fechas parseadas
  const fEmi = parsearFecha(data.fechaEmision)
  const fPago = parsearFecha(data.fechaPago || data.fechaEmision)
  const mesEmiNombre = MESES[parseInt(fEmi.mm, 10)] || "Noviembre"

  // Monto formateado con asteriscos de seguridad
  const montoNumStr = `*${Math.round(data.monto).toLocaleString("es-PY")}*`
  
  // Monto en letras (máx 56 chars a 12 CPI)
  const { linea1: letrasL1, linea2: letrasL2 } = formatearLetrasSeguridad(data.monto, 56)

  // Beneficiario
  let beneText = data.beneficiario.toUpperCase().trim()
  if (data.noALaOrden) {
    beneText += "   *** NO A LA ORDEN ***"
  }
  // En 12 CPI, el beneficiario puede tener hasta 55 caracteres
  if (beneText.length > 55) {
    beneText = beneText.slice(0, 55)
  }

  // Matriz de 12 líneas útiles (cubre exactamente las casillas físicas del cheque)
  const TOTAL_LINEAS = 12
  const lineas: string[] = Array(TOTAL_LINEAS).fill("")

  // Posiciones de columna calibradas (en modo 12 CPI, ancho máximo seguro = 92 cols)
  const cTalon = Math.max(0, (data.colTalon ?? 1))
  const cCheque = Math.max(cTalon + (imprimirTalon ? 22 : 0), (data.colCheque ?? (imprimirTalon ? 26 : 4)))
  const cMonto = Math.min(92 - montoNumStr.length, (data.colMonto ?? 76))
  const cFechasEmi = data.colFechasEmi ?? (imprimirTalon ? 48 : 28)
  const cFechasPago = data.colFechasPago ?? (imprimirTalon ? 68 : 48)

  // Helper de escritura seguro con límite estricto de 94 columnas (carro 12 CPI = 96 col)
  const MAX_COL = 93
  function escribir(lineaIdx: number, col: number, texto: string) {
    const lActual = lineaIdx + offY
    if (lActual < 0 || lActual >= TOTAL_LINEAS) return
    const cActual = Math.max(0, Math.min(MAX_COL - texto.length, col + offX))
    let cur = lineas[lActual]
    if (cur.length < cActual) {
      cur = cur.padEnd(cActual, " ")
    }
    const nueva = cur.slice(0, cActual) + texto + cur.slice(cActual + texto.length)
    lineas[lActual] = nueva.slice(0, MAX_COL) // NUNCA excede MAX_COL
  }

  // ── 1. TALÓN IZQUIERDO DE CONTROL (COLUMNAS 1 A 22) ──
  if (imprimirTalon) {
    // Línea 2: Vencimiento (si es diferido)
    if (data.esDiferido) {
      escribir(2, cTalon, `Venc:${fPago.dd}/${fPago.mm}/${fPago.aaaa}`)
    }
    // Línea 3: Fecha de emisión
    escribir(3, cTalon, `Fec:${fEmi.dd}/${fEmi.mm}/${fEmi.aaaa}`)
    // Línea 4: Orden (proveedor/beneficiario corto)
    const beneTalon = data.beneficiario.toUpperCase().trim().slice(0, 16)
    escribir(4, cTalon, `Ord:${beneTalon}`)
    // Línea 5: Concepto
    if (data.concepto) {
      escribir(5, cTalon, `Cpto:${data.concepto.slice(0, 15)}`)
    }
    // Línea 7 y 8: Este Cheque
    escribir(7, cTalon, `Este Chq:`)
    escribir(8, cTalon, montoNumStr.slice(0, 18))
  }

  // ── 2. CUERPO DEL CHEQUE BANCO CONTINENTAL ──
  // Renglón 1: Cruzado // a la izquierda + Monto numérico en recuadro ₲ a la derecha
  if (data.cruzado) {
    escribir(1, cCheque, "//")
  }
  escribir(1, cMonto, montoNumStr)

  // Renglón 2: Fechas en casillas superiores
  // FECHA DE EMISIÓN: DD  MM  AA
  // FECHA DE PAGO (Diferido): DD  MM  AA
  escribir(2, cFechasEmi, `${fEmi.dd}   ${fEmi.mm}   ${fEmi.aa}`)
  if (data.esDiferido) {
    escribir(2, cFechasPago, `${fPago.dd}   ${fPago.mm}   ${fPago.aa}`)
  }

  // Renglón 4: "Páguese a la orden de"
  escribir(4, cCheque, beneText)

  // Renglón 5 y 6: "La suma de Guaraníes" (Sin redundancia "GUARANÍES")
  escribir(5, cCheque, letrasL1)
  if (letrasL2) {
    escribir(6, cCheque, letrasL2)
  }

  // Renglón 8: Plaza y fecha (solo si es a la vista)
  if (!data.esDiferido) {
    escribir(8, cCheque + 8, `${plaza}, ${fEmi.dd} de ${mesEmiNombre} de ${fEmi.aaaa}`)
  }

  // ── 3. COMPILACIÓN DE COMANDOS ESC/P ──
  const ESC = "\x1B"
  const FF = "\x0C"

  let escp = ""
  // Inicializar impresora
  escp += `${ESC}@`
  // Fijar longitud de página en 17 líneas a 6 LPI (2.75 pulgadas exactas)
  escp += `${ESC}C\x11`
  // Interlineado 1/6 pulgada (6 LPI) estándar
  escp += `${ESC}2`
  // MODO 12 CPI (ELITE): Habilita 96 columnas físicas en el carro de 8 pulgadas
  escp += `${ESC}M`

  // Imprimir renglones
  for (let i = 0; i < TOTAL_LINEAS; i++) {
    const linea = lineas[i]
    if (linea.trim().length > 0) {
      if (linea.includes(montoNumStr)) {
        const partes = linea.split(montoNumStr)
        // Negrita en el monto
        escp += partes[0] + `${ESC}E${montoNumStr}${ESC}F` + (partes[1] || "")
      } else {
        escp += linea
      }
    }
    escp += "\r\n"
  }

  // Form Feed: avanza al siguiente cheque exacto
  escp += FF

  return escp
}

/**
 * Genera la REGLA / GRID DE CALIBRACIÓN física completa a 12 CPI (96 columnas).
 * Imprime líneas numeradas L1..L9 con reglas horizontales de 90 columnas
 * para que el usuario pueda cotejar a trasluz con el cheque Continental.
 */
export function generarEscpReglaCalibracion(): string {
  const ESC = "\x1B"
  const FF = "\x0C"

  let escp = ""
  escp += `${ESC}@`
  escp += `${ESC}2` // 6 LPI
  escp += `${ESC}C\x11` // 17 líneas (2.75 pulgadas)
  escp += `${ESC}M` // 12 CPI (96 columnas)

  escp += "REGLA 12 CPI (TALON + CHEQUE CONTINENTAL)\r\n"
  escp += "   ...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....8....+....9\r\n"
  
  for (let i = 1; i <= 8; i++) {
    escp += `L${i}: ...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....8....+....9\r\n`
  }

  escp += FF
  return escp
}

/**
 * Emite un bip sonoro físico (\x07) y una línea de verificación corta en la Epson LX-300+
 * sin expulsar toda la página. Sirve para validar comunicación USB y spooler al instante.
 */
export function generarEscpTestRapido(): string {
  const ESC = "\x1B"
  return `${ESC}@\x07=== INTELIMARKET: EPSON LX-300+ CONECTADA Y RESPONDIENDO ===\r\n`
}

/**
 * Genera cheque de prueba en borrador con TALÓN + CHEQUE simultáneos a 12 CPI.
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
    imprimirTalon: true, // ¡Talón activado con 12 CPI!
    offsetX,
    offsetY,
  })
}
