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

// Paleta y medidas del generador Extra Club (intelicard), que es el diseño que
// el cliente usa. Alli la tarjeta se arma en milimetros con jsPDF; aca se
// dibuja a 300 dpi, asi que todo se convierte con mm() y pt().
const FONDO = "#0B1638"
const PANEL = "#101E46"
const BANDA = "#0E1A40"
const NARANJA = "#EE7B1D"
const ETIQUETA = "#EE963C"
const BLANCO = "#FFFFFF"
const NUMERO = "#93A3C9"
const FUENTE = "Arial, Helvetica, sans-serif"
const MONO = "'Courier New', Consolas, monospace"

const PX_POR_MM = TARJETA_PX.ancho / TARJETA_MM.ancho
const mm = (v: number) => v * PX_POR_MM
const pt = (v: number) => (v * 300) / 72

/** Rectangulo redondeado, con respaldo por si el navegador no trae roundRect. */
function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === "function") {
    ;(ctx as any).roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

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

/**
 * QR dibujado modulo por modulo en pixeles ENTEROS. Escalar un QR ya generado
 * deja modulos de 9,4 px que el driver redondea distinto en cada fila y el
 * codigo sale con bordes sucios. Asi cada modulo es un bloque exacto de
 * pixeles, y la ZC300 lo imprime con el panel negro (K) nitido.
 *
 * Correccion de errores H: tolera ~30% del codigo dañado. Una tarjeta vive en
 * una billetera y se raya; el QR tiene que seguir leyendose.
 */
function crearQR(texto: string, ladoMax: number) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "H" })
  const n = qr.modules.size
  // Modulos de pixeles enteros, sin zona de silencio propia: la aporta el
  // recuadro blanco, que se dibuja del tamaño exacto del QR mas 2,5 mm. Asi
  // el QR llena su recuadro y el margen blanco queda parejo, sin depender de
  // que el lado pedido sea multiplo de la cantidad de modulos.
  const modulo = Math.max(1, Math.floor(ladoMax / n))
  return { qr, n, modulo, lado: modulo * n }
}

function pintarQR(ctx: CanvasRenderingContext2D, m: ReturnType<typeof crearQR>, x: number, y: number) {
  ctx.fillStyle = "#000000" // negro puro: el driver lo manda al panel K
  for (let f = 0; f < m.n; f++) {
    for (let c = 0; c < m.n; c++) {
      if (m.qr.modules.get(f, c)) {
        ctx.fillRect(x + c * m.modulo, y + f * m.modulo, m.modulo, m.modulo)
      }
    }
  }
}

export async function renderTarjeta(canvas: HTMLCanvasElement, d: DatosTarjeta, o: OpcionesTarjeta): Promise<void> {
  const W = TARJETA_PX.ancho
  const H = TARJETA_PX.alto
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = true
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  // Fondo: azul profundo, panel izquierdo mas claro y banda de transicion.
  ctx.fillStyle = FONDO
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = PANEL
  ctx.fillRect(0, 0, W * 0.61, H)
  ctx.fillStyle = BANDA
  ctx.fillRect(W * 0.61 - mm(4), 0, mm(8), H)

  // Franjas naranjas al ras, arriba y abajo.
  ctx.fillStyle = NARANJA
  ctx.fillRect(0, 0, W, mm(1.6))
  ctx.fillRect(0, H - mm(1.6), W, mm(1.6))

  // Titulo centrado y linea punteada debajo.
  ctx.fillStyle = BLANCO
  ctx.font = `bold ${pt(6.2)}px ${FUENTE}`
  ctx.textAlign = "center"
  ctx.fillText("TARJETA DE FIDELIDAD  ·  EXTRA CLUB", W / 2, mm(5.6))
  ctx.textAlign = "left"
  ctx.strokeStyle = BLANCO
  ctx.lineWidth = Math.max(1, mm(0.12))
  ctx.setLineDash([mm(0.8), mm(1.4)])
  ctx.beginPath()
  ctx.moveTo(mm(5), mm(7.8))
  ctx.lineTo(W - mm(5), mm(7.8))
  ctx.stroke()
  ctx.setLineDash([])

  const fx = mm(5)
  const qrLado = mm(24)
  const qrX = W - qrLado - mm(5)
  const qrY = (H - qrLado) / 2 + mm(1)
  const anchoTexto = qrX - fx - mm(5)

  // Campo: etiqueta naranja chica arriba, valor blanco en negrita debajo.
  const campo = (etiqueta: string, valor: string, etiquetaY: number, tamañoPt: number) => {
    ctx.fillStyle = ETIQUETA
    ctx.font = `bold ${pt(5.2)}px ${FUENTE}`
    ctx.fillText(etiqueta, fx, mm(etiquetaY))
    ctx.fillStyle = BLANCO
    const t = ajustar(ctx, valor, pt(tamañoPt), pt(tamañoPt * 0.7), anchoTexto)
    ctx.font = `bold ${t}px ${FUENTE}`
    let txt = valor
    while (txt.length > 2 && ctx.measureText(txt).width > anchoTexto) txt = txt.slice(0, -1)
    ctx.fillText(txt, fx, mm(etiquetaY + 1.8 + tamañoPt * 0.38))
  }

  campo("BENEFICIARIO", (d.nombre || "").toUpperCase().trim(), 11.5, 10)

  // Dos renglones mas, con lo que este elegido. Mas no entran sin pisar el logo.
  const extras: [string, string][] = []
  if (o.mostrarEmpresa) extras.push(["EMPRESA", d.empresa || "—"])
  if (o.mostrarDocumento) extras.push(["CÉDULA / RUC", d.documento || "—"])
  if (o.mostrarCiudad && d.ciudad) extras.push(["CIUDAD", d.ciudad])
  if (o.mostrarLimite && d.limite != null) extras.push(["LÍNEA DE CRÉDITO", `Gs. ${fmtGs(d.limite)}`])
  const renglones = [23, 32.5]
  extras.slice(0, 2).forEach(([etiqueta, valor], i) => campo(etiqueta, valor, renglones[i], 7.8))

  // Numero de socio en texto chico, para cargarlo a mano si el QR no se lee.
  if (o.mostrarNumero && d.numero) {
    ctx.fillStyle = NUMERO
    ctx.font = `${pt(4.6)}px ${MONO}`
    let num = d.numero.toUpperCase()
    while (ctx.measureText(num).width > anchoTexto && num.length > 8) num = num.slice(0, -1)
    ctx.fillText(num, fx, mm(40.5))
  }

  // QR sobre recuadro blanco: sobre el azul no lo lee ningun escaner.
  if (d.numero) {
    const m = crearQR(d.numero.toLowerCase(), qrLado)
    // 2,5 mm de blanco alrededor, pero nunca menos de 4 modulos: esa es la
    // zona de silencio que exige el lector, y con QR de pocos modulos (numeros
    // con muchos ceros) 2,5 mm se quedaban cortos.
    const pad = Math.max(mm(2.5), m.modulo * 4)
    const caja = m.lado + pad * 2
    const cx = qrX + qrLado / 2
    const cy = qrY + qrLado / 2
    ctx.fillStyle = BLANCO
    rectRedondeado(ctx, cx - caja / 2, cy - caja / 2, caja, caja, mm(1.5))
    ctx.fill()
    pintarQR(ctx, m, cx - m.lado / 2, cy - m.lado / 2)
  }

  // Logo sobre pastilla blanca, abajo a la izquierda.
  const logo = await cargarLogo()
  const logoW = mm(18)
  const logoH = (logoW * 328) / 1000
  const logoY = H - logoH - mm(3.4)
  ctx.fillStyle = BLANCO
  rectRedondeado(ctx, fx - mm(1), logoY - mm(0.8), logoW + mm(2), logoH + mm(1.6), mm(1.2))
  ctx.fill()
  if (logo) ctx.drawImage(logo, fx, logoY, logoW, logoH)
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
