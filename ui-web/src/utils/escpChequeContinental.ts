// ── GENERADOR DE TRAMAS ESC/P PARA CHEQUES BANCO CONTINENTAL (PARAGUAY) ──
// Diseñado para Epson LX-300+ / LX-300+II conectada por USB en formulario continuo.
// Medida física: 2.75 pulgadas (69.85 mm = 7.0 cm) por 9.5 pulgadas de ancho.
// A 8 LPI (ESC 0), 2.75 pulgadas son exactamente 22 líneas (cero desfasaje en continuo).

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
  imprimirTalon?: boolean // Si se llena el talón izquierdo de control
  // Calibración fina (guardada en localStorage por PC)
  offsetX?: number // Columnas (+ a la derecha, - a la izquierda)
  offsetY?: number // Líneas (+ abajo, - arriba)
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
 * Da formato de seguridad al monto en letras con asteriscos y guiones de relleno:
 * Ej: *QUINCE MILLONES QUINIENTOS MIL-------------------------------------*
 */
export function formatearLetrasSeguridad(monto: number, maxChars = 58): { linea1: string; linea2: string } {
  const letras = numeroALetrasContinental(monto)
  const base = `*${letras}`
  
  if (base.length <= maxChars - 1) {
    const relleno = "-".repeat(Math.max(3, maxChars - base.length - 1))
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
    const relleno2 = "-".repeat(Math.max(3, maxChars - l2.length - 3))
    l2 = `*${l2}${relleno2}*`
  }
  return { linea1: l1, linea2: l2 }
}

/**
 * Parsea YYYY-MM-DD y devuelve objeto { dd, mm, aaaa, aa }
 */
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
 * Genera el payload de comandos ESC/P para Epson LX-300+ / matricial de 9 pines.
 * Retorna string con secuencias binarias para ser enviadas por QZ Tray RAW.
 */
export function generarEscpChequeContinental(data: ChequeContinentalData): string {
  const offX = Math.max(-15, Math.min(25, data.offsetX || 0))
  const offY = Math.max(-5, Math.min(5, data.offsetY || 0))
  const imprimirTalon = data.imprimirTalon ?? true
  const plaza = data.plaza || "Pedro Juan Caballero"

  // Fechas parseadas
  const fEmi = parsearFecha(data.fechaEmision)
  const fPago = parsearFecha(data.fechaPago || data.fechaEmision)
  const mesEmiNombre = MESES[parseInt(fEmi.mm, 10)] || "Noviembre"

  // Monto formateado con asteriscos de seguridad: *15.500.000*
  const montoNumStr = `*${Math.round(data.monto).toLocaleString("es-PY")}*`
  
  // Monto en letras
  const { linea1: letrasL1, linea2: letrasL2 } = formatearLetrasSeguridad(data.monto, 56)

  // Beneficiario
  let beneText = data.beneficiario.toUpperCase().trim()
  if (data.noALaOrden) {
    beneText += "   *** NO A LA ORDEN ***"
  }

  // Matriz de 22 líneas (a 8 LPI, 2.75 pulgadas = 22 líneas exactas)
  // Cada línea contendrá hasta 88 caracteres.
  const lineas: string[] = Array(22).fill("")

  // Helper para escribir en una posición específica de una línea
  function escribir(lineaIdx: number, col: number, texto: string) {
    const lActual = lineaIdx + offY
    if (lActual < 0 || lActual >= 22) return
    const cActual = Math.max(0, col + offX)
    let cur = lineas[lActual]
    if (cur.length < cActual) {
      cur = cur.padEnd(cActual, " ")
    }
    lineas[lActual] = cur.slice(0, cActual) + texto + cur.slice(cActual + texto.length)
  }

  // ── 1. TALÓN IZQUIERDO (COLUMNAS 0 A 24) ──
  if (imprimirTalon) {
    if (data.esDiferido) {
      escribir(2, 1, `Venc:${fPago.dd}/${fPago.mm}/${fPago.aaaa}`)
    }
    escribir(4, 1, `Fec:${fEmi.dd}/${fEmi.mm}/${fEmi.aaaa}`)
    escribir(6, 1, `Ord:${beneText.slice(0, 19)}`)
    if (data.concepto) {
      escribir(8, 1, `Cpto:${data.concepto.slice(0, 18)}`)
    }
    escribir(10, 1, `Este Chq:`)
    escribir(11, 1, montoNumStr.slice(0, 20))
  }

  // ── 2. CUERPO DEL CHEQUE BANCO CONTINENTAL (COLUMNAS 26 EN ADELANTE) ──
  // Perforación vertical divisoria está en col 24-25 aprox.
  const COL_INICIO = 26

  // A. Cheque Cruzado (//)
  if (data.cruzado) {
    escribir(1, COL_INICIO + 2, "//")
    escribir(2, COL_INICIO + 2, "//")
  }

  // B. Importe Numérico en Guaraníes (esquina superior derecha, junto al símbolo ₲)
  // Columna ~66-70 a 10 CPI. Usamos negrita en ESC/P
  escribir(2, COL_INICIO + 43, montoNumStr)

  // C. Fechas en Casillas Superiores (Diferido)
  // Casilla FECHA DE EMISIÓN: col ~42 (DD MM AA)
  // Casilla FECHA DE PAGO: col ~59 (DD MM AA)
  if (data.esDiferido) {
    // Los campos preimpresos tienen guiones y el "20"
    escribir(4, COL_INICIO + 21, `${fEmi.dd}   ${fEmi.mm}    ${fEmi.aa}`)
    escribir(4, COL_INICIO + 38, `${fPago.dd}   ${fPago.mm}    ${fPago.aa}`)
  } else {
    // A la vista: solo fecha de emisión en la casilla
    escribir(4, COL_INICIO + 21, `${fEmi.dd}   ${fEmi.mm}    ${fEmi.aa}`)
  }

  // D. "Páguese a la orden de"
  // Renglón 7 del cheque
  escribir(7, COL_INICIO + 7, beneText)

  // E. "La suma de Guaraníes"
  // Renglón 9: La línea comienza después del texto preimpreso
  escribir(9, COL_INICIO + 6, letrasL1)
  if (letrasL2) {
    escribir(10, COL_INICIO + 6, letrasL2)
  }

  // F. Plaza y Fecha (Pie del cheque)
  // Para cheques a la vista o confirmación de emisión en plaza
  const pieFecha = `${plaza}, ${fEmi.dd} de ${mesEmiNombre} de ${fEmi.aaaa}`
  if (!data.esDiferido) {
    escribir(12, COL_INICIO + 12, pieFecha)
  }

  // ── 3. COMPILACIÓN DE COMANDOS ESC/P ──
  const ESC = "\x1B"
  const FF = "\x0C" // Form Feed: avanza al siguiente cheque exacto

  let escp = ""
  // Inicialización (ESC @)
  escp += `${ESC}@`
  // Fijar interlineado a 1/8 pulgada (8 LPI) -> ESC 0
  escp += `${ESC}0`
  // Fijar longitud de página en 22 líneas (2.75 pulgadas) -> ESC C \x16
  escp += `${ESC}C\x16`
  // Fuente Draft 10 CPI (Pica) -> ESC P
  escp += `${ESC}P`

  // Imprimir cada renglón
  for (let i = 0; i < 22; i++) {
    const linea = lineas[i]
    if (linea.trim().length > 0) {
      // Si la línea contiene el monto numérico en la casilla, le aplicamos Negrita (ESC E / ESC F)
      if (linea.includes(montoNumStr)) {
        const partes = linea.split(montoNumStr)
        escp += partes[0] + `${ESC}E${montoNumStr}${ESC}F` + (partes[1] || "")
      } else {
        escp += linea
      }
    }
    // Salto de línea
    escp += "\r\n"
  }

  // Form Feed: avanza al siguiente cheque exacto del tractor
  escp += FF

  return escp
}

/**
 * Genera un cheque de prueba con caracteres de alineación (#, +, -)
 * para imprimir sobre papel continuo borrador y cotejar a trasluz.
 */
export function generarEscpPruebaAlineacion(offsetX = 0, offsetY = 0): string {
  return generarEscpChequeContinental({
    numero: "999999",
    monto: 12345678,
    beneficiario: "EMPRESA DE PRUEBA S.A.",
    esDiferido: true,
    fechaEmision: "2026-11-03",
    fechaPago: "2026-11-25",
    cruzado: true,
    noALaOrden: true,
    concepto: "CALIBRACION CONTINENTAL",
    plaza: "Pedro Juan Caballero",
    imprimirTalon: true,
    offsetX,
    offsetY,
  })
}
