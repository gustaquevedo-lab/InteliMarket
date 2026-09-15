// Tarjeta de socio Extra Club, dibujada a la resolucion EXACTA de la Zebra
// ZC300 (300 dpi). La misma imagen alimenta la vista previa y la impresion, asi
// que lo que se ve en pantalla es lo que sale en el plastico.
//
// Formato CR80 (el de las tarjetas de credito): 85,6 x 53,98 mm.

import QRCode from "qrcode"

export const TARJETA_MM = { ancho: 85.6, alto: 53.98 } as const
export const TARJETA_PX = { ancho: 1011, alto: 638 } as const

export interface DatosTarjeta {
  nombre: string
  numero: string // UUID del socio: es lo que codifica el QR
  documento?: string | null
  empresa?: string | null
  ciudad?: string | null
  limite?: number | null
}

export interface OpcionesTarjeta {
  mostrarDocumento: boolean
  mostrarNumero: boolean
  mostrarEmpresa: boolean
  mostrarCiudad: boolean
  mostrarLimite: boolean
}

export const OPCIONES_DEFAULT: OpcionesTarjeta = {
  mostrarDocumento: true,
  mostrarNumero: true,
  mostrarEmpresa: true,
  mostrarCiudad: false,
  // Apagado a proposito: el limite cambia y la tarjeta dura años. Impreso,
  // queda mintiendo en cuanto se ajusta la linea.
  mostrarLimite: false,
}

const MARCA_CLARO = "#F59E0B"
const MARCA = "#B45309"
const TINTA = "#1C1917"
const TENUE = "#57534E"
const FUENTE = "Arial, Helvetica, sans-serif"
const MONO = "'Courier New', Consolas, monospace"

let logoPromesa: Promise<HTMLImageElement | null> | null = null
function cargarLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromesa) {
    logoPromesa = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null) // sin logo la tarjeta sale igual
      img.src = "/logo_extra.png"
    })
  }
  return logoPromesa
}

const fmtGs = (v: number) => Math.round(Number(v) || 0).toLocaleString("es-PY")

/** Achica la fuente hasta que el texto entre en el ancho disponible. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, maximo: number, minimo: number, ancho: number, peso = "bold"): number {
  let t = maximo
  ctx.font = `${peso} ${t}px ${FUENTE}`
  while (ctx.measureText(texto).width > ancho && t > minimo) {
    t -= 2
    ctx.font = `${peso} ${t}px ${FUENTE}`
  }
  return t
}

/** Parte un nombre largo en dos lineas por la palabra mas cercana a la mitad. */
function partirEnDos(texto: string): [string, string] {
  const palabras = texto.split(/\s+/)
  if (palabras.length < 2) return [texto, ""]
  let mejor = 1
  let dif = Infinity
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ").length
    const b = palabras.slice(i).join(" ").length
    if (Math.abs(a - b) < dif) { dif = Math.abs(a - b); mejor = i }
  }
  return [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")]
}

/**
 * QR dibujado modulo por modulo en pixeles ENTEROS. Escalar un QR ya generado
 * deja modulos de 9,4 px que el driver redondea distinto en cada fila y el
 * codigo sale con bordes sucios. Asi cada modulo es un bloque exacto de
 * pixeles, y la ZC300 lo imprime con el panel negro (K) nitido.
 *
 * Correccion de errores H: tolera ~30% del codigo dañado. Una tarjeta vive en
 * una billetera y se raya; el QR tiene que seguir leyendose.
 */
function dibujarQR(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, ladoMax: number): number {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "H" })
  const n = qr.modules.size
  const margen = 2 // zona de silencio minima que exige el lector
  const modulo = Math.floor(ladoMax / (n + margen * 2))
  const lado = modulo * (n + margen * 2)
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(x, y, lado, lado)
  ctx.fillStyle = "#000000" // negro puro: el driver lo manda al panel K
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(f, c)) {
        ctx.fillRect(x + (c + margen) * modulo, y + (f + margen) * modulo, modulo, modulo)
      }
    }
  }
  return lado
}

export async function renderTarjeta(canvas: HTMLCanvasElement, d: DatosTarjeta, o: OpcionesTarjeta): Promise<void> {
  const W = TARJETA_PX.ancho
  const H = TARJETA_PX.alto
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = true
  ctx.textBaseline = "alphabetic"

  // Fondo y marca. El borde izquierdo y la base van a sangre: la ZC300 imprime
  // de borde a borde.
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, W, H)
  const franja = ctx.createLinearGradient(0, 0, 0, H)
  franja.addColorStop(0, MARCA_CLARO)
  franja.addColorStop(1, MARCA)
  ctx.fillStyle = franja
  ctx.fillRect(0, 0, 36, H)
  ctx.fillStyle = MARCA
  ctx.fillRect(0, H - 16, W, 16)

  const X0 = 78
  // Zona del QR a la derecha; el texto no puede invadirla.
  const QR_LADO_MAX = 300
  const qrX = W - QR_LADO_MAX - 56
  const anchoTexto = qrX - X0 - 34

  // Logo
  const logo = await cargarLogo()
  if (logo) {
    const lh = 74
    const lw = Math.min((logo.width * lh) / logo.height, anchoTexto)
    ctx.drawImage(logo, X0, 50, lw, (logo.height * lw) / logo.width)
  }

  // Rotulo de pertenencia
  ctx.fillStyle = MARCA
  ctx.font = `bold 25px ${FUENTE}`
  ;(ctx as any).letterSpacing = "5px"
  ctx.fillText("SOCIO EXTRA CLUB", X0, 176)
  ;(ctx as any).letterSpacing = "0px"

  // Nombre: una linea si entra con un tamaño digno; si no, dos.
  const nombre = (d.nombre || "").toUpperCase().trim()
  let y = 246
  ctx.fillStyle = TINTA
  const t1 = ajustar(ctx, nombre, 52, 40, anchoTexto)
  ctx.font = `bold ${t1}px ${FUENTE}`
  if (ctx.measureText(nombre).width <= anchoTexto) {
    ctx.fillText(nombre, X0, y)
    y += 20
  } else {
    const [a, b] = partirEnDos(nombre)
    const t2 = Math.min(ajustar(ctx, a, 42, 26, anchoTexto), ajustar(ctx, b, 42, 26, anchoTexto))
    ctx.font = `bold ${t2}px ${FUENTE}`
    ctx.fillText(a, X0, y - 8)
    ctx.fillText(b, X0, y - 8 + t2 + 6)
    y += t2 + 16
  }

  // Datos elegidos, uno por linea
  const lineas: string[] = []
  if (o.mostrarDocumento && d.documento) lineas.push(`Documento  ${d.documento}`)
  if (o.mostrarEmpresa && d.empresa) lineas.push(`Convenio  ${d.empresa}`)
  if (o.mostrarCiudad && d.ciudad) lineas.push(d.ciudad)
  if (o.mostrarLimite && d.limite != null) lineas.push(`Línea de crédito  Gs. ${fmtGs(d.limite)}`)
  ctx.fillStyle = TENUE
  for (const l of lineas) {
    y += 44
    ajustar(ctx, l, 27, 18, anchoTexto, "normal")
    ctx.fillText(l, X0, y)
  }

  // Numero de socio en texto, para cargarlo a mano si el QR no se puede leer.
  if (o.mostrarNumero && d.numero) {
    ctx.fillStyle = TINTA
    ctx.font = `bold 21px ${MONO}`
    let num = d.numero.toUpperCase()
    while (ctx.measureText(num).width > anchoTexto && num.length > 8) num = num.slice(0, -1)
    ctx.fillText(num, X0, H - 50)
  }

  // QR
  if (d.numero) {
    const lado = dibujarQR(ctx, d.numero.toLowerCase(), qrX, 64, QR_LADO_MAX)
    ctx.fillStyle = TENUE
    ctx.font = `bold 19px ${FUENTE}`
    ctx.textAlign = "center"
    ctx.fillText("Presentá en caja", qrX + lado / 2, 64 + lado + 36)
    ctx.textAlign = "left"
  }
}

let anversoPromesa: Promise<HTMLImageElement | null> | null = null
function cargarAnverso(): Promise<HTMLImageElement | null> {
  if (!anversoPromesa) {
    anversoPromesa = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => { anversoPromesa = null; resolve(null) }
      img.src = "/tarjeta_anverso.jpg"
    })
  }
  return anversoPromesa
}

/**
 * Frente de la tarjeta: el diseño fijo de Extra Club, el mismo del generador
 * que se usaba con el legacy (intelicard). Es igual para todos los socios.
 *
 * La ZC300 es de una sola cara: se imprimen los frentes, se dan vuelta las
 * tarjetas, se vuelven a cargar y se imprime el dorso con los datos y el QR.
 *
 * Devuelve false si no se pudo cargar la imagen: en ese caso NO se imprime.
 */
export async function renderAnverso(canvas: HTMLCanvasElement): Promise<boolean> {
  const W = TARJETA_PX.ancho
  const H = TARJETA_PX.alto
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#0E1B57" // azul del diseño: tapa cualquier borde que no cubra la imagen
  ctx.fillRect(0, 0, W, H)
  const img = await cargarAnverso()
  if (!img) return false
  // Cubrir la tarjeta entera sin deformar: la imagen es apenas mas alta que
  // CR80, se recortan ~2 px arriba y abajo.
  const s = Math.max(W / img.width, H / img.height)
  const w = img.width * s
  const h = img.height * s
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  return true
}

/** Copia girada 180°. Al dar vuelta la tarjeta a mano el dorso puede salir cabeza abajo. */
export function girar180(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext("2d")!
  ctx.translate(out.width, out.height)
  ctx.rotate(Math.PI)
  ctx.drawImage(src, 0, 0)
  return out
}

/**
 * Imprime tarjetas con el dialogo de impresion del navegador, una por pagina,
 * todas en un solo trabajo.
 *
 * Existe porque el driver de la ZC300 le informa a Java (QZ Tray) un papel de
 * tamaño cero: QZ falla con "0 or negative value argument" o "Paper's
 * imageable width is too small" en cualquier combinacion. Chrome imprime por
 * el camino normal de Windows, que el driver si entiende.
 */
export function imprimirConNavegador(imagenesDataUrl: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe")
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" })
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) { iframe.remove(); reject(new Error("El navegador no permitió preparar la impresión")); return }
    const { ancho, alto } = TARJETA_MM
    doc.open()
    doc.write(
      `<!doctype html><html><head><title>Tarjetas Extra Club</title><style>` +
      `@page{size:${ancho}mm ${alto}mm;margin:0}` +
      `html,body{margin:0;padding:0;background:#fff}` +
      `img{display:block;width:${ancho}mm;height:${alto}mm;break-after:page;page-break-after:always}` +
      `img:last-child{break-after:auto;page-break-after:auto}` +
      `</style></head><body>` +
      imagenesDataUrl.map((src) => `<img src="${src}">`).join("") +
      `</body></html>`,
    )
    doc.close()
    const imgs = Array.from(doc.images)
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; i.onerror = r }))))
      .then(() => {
        win.focus()
        win.print() // en Chrome bloquea hasta que se cierra el dialogo
        setTimeout(() => { iframe.remove(); resolve() }, 500)
      })
      .catch((e) => { iframe.remove(); reject(e) })
  })
}

/** PNG en base64 sin el prefijo data:, que es lo que pide QZ Tray. */
export function canvasABase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "")
}
