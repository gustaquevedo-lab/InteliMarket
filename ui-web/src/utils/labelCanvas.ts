// Dibujo de la etiqueta de góndola sobre canvas, a la resolución EXACTA de la
// impresora (1 pixel = 1 dot). El mismo canvas alimenta la vista previa en
// pantalla y lo que se manda a imprimir, así que el diseñador es fiel de
// verdad: no hay dos motores que puedan desincronizarse.
//
// Solo sirve para la Zebra: acepta imágenes en hexadecimal (^GFA). La Pantum
// rechaza cualquier dato binario, por eso allá se usa TSPL nativo.

import { code128Widths } from "./code128"

export interface DisenoGondola {
  mostrar_encabezado: boolean
  texto_encabezado: string
  mostrar_nombre: boolean
  fuente_nombre: number
  mostrar_barcode: boolean
  mostrar_precio: boolean
  fuente_precio: number
  mostrar_escalas: boolean
  ancho_precio_pct: number // qué porción del ancho ocupa el bloque de precio
}

export const DISENO_GONDOLA_DEFAULT: DisenoGondola = {
  mostrar_encabezado: true,
  texto_encabezado: "EXTRA SUPERMERCADO",
  mostrar_nombre: true,
  fuente_nombre: 46,
  mostrar_barcode: true,
  mostrar_precio: true,
  fuente_precio: 72,
  mostrar_escalas: true,
  ancho_precio_pct: 38,
}

export interface ItemEtiqueta {
  nombre: string
  codigo_barra?: string | null
  precio_venta: number
  escalas?: { min_qty: number; precio_unitario: number }[]
}

const fmtGs = (v: number) => Math.round(Number(v) || 0).toLocaleString("es-PY")

function ajustarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMax: number,
  maxLineas: number
): string[] {
  const palabras = (texto || "").trim().split(/\s+/)
  const lineas: string[] = []
  let actual = ""
  for (const p of palabras) {
    const cand = actual ? `${actual} ${p}` : p
    if (ctx.measureText(cand).width <= anchoMax) {
      actual = cand
    } else {
      if (actual) lineas.push(actual)
      actual = p
      if (lineas.length >= maxLineas) break
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual)
  return lineas.slice(0, maxLineas)
}

/** Dibuja la etiqueta a tamaño real de impresora (1 px = 1 dot). */
export function renderGondola(
  canvas: HTMLCanvasElement,
  item: ItemEtiqueta,
  d: DisenoGondola,
  anchoDots: number,
  altoDots: number
): void {
  canvas.width = anchoDots
  canvas.height = altoDots
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, anchoDots, altoDots)
  ctx.fillStyle = "#000"
  ctx.strokeStyle = "#000"

  // marco
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, anchoDots - 5, altoDots - 5)

  const anchoPrecio = d.mostrar_precio ? Math.round((anchoDots * d.ancho_precio_pct) / 100) : 0
  const xPrecio = anchoDots - anchoPrecio
  const anchoTexto = (d.mostrar_precio ? xPrecio : anchoDots) - 40

  let y = 14
  if (d.mostrar_encabezado) {
    ctx.font = `bold 22px Arial, Helvetica, sans-serif`
    ctx.textBaseline = "top"
    ctx.fillText(d.texto_encabezado || "", 22, y)
    y += 30
  }

  if (d.mostrar_nombre) {
    ctx.font = `bold ${d.fuente_nombre}px Arial, Helvetica, sans-serif`
    for (const linea of ajustarTexto(ctx, item.nombre, anchoTexto, 2)) {
      ctx.fillText(linea, 22, y)
      y += d.fuente_nombre + 6
    }
  }

  if (d.mostrar_barcode && item.codigo_barra) {
    const anchos = code128Widths(item.codigo_barra)
    const modulos = anchos.reduce((a, b) => a + b, 0)
    // el módulo se ajusta al espacio disponible, mínimo 2 dots para que el
    // lector pueda resolverlo
    const modulo = Math.max(2, Math.floor(anchoTexto / modulos))
    const altoBarras = 44
    const yBarras = Math.min(y + 6, altoDots - altoBarras - 34)
    let x = 22
    anchos.forEach((w, i) => {
      if (i % 2 === 0) ctx.fillRect(x, yBarras, w * modulo, altoBarras)
      x += w * modulo
    })
    ctx.font = `bold 20px monospace`
    ctx.fillText(item.codigo_barra, 22, yBarras + altoBarras + 2)
  }

  if (d.mostrar_precio) {
    ctx.fillStyle = "#000"
    ctx.fillRect(xPrecio, 12, anchoPrecio - 16, altoDots - 24)
    ctx.fillStyle = "#fff"
    ctx.font = `bold 26px Arial, Helvetica, sans-serif`
    ctx.fillText("Gs.", xPrecio + 22, 28)
    let tam = d.fuente_precio
    const texto = fmtGs(item.precio_venta)
    ctx.font = `bold ${tam}px Arial, Helvetica, sans-serif`
    // si no entra, se achica sola en vez de desbordar el bloque
    while (ctx.measureText(texto).width > anchoPrecio - 44 && tam > 24) {
      tam -= 2
      ctx.font = `bold ${tam}px Arial, Helvetica, sans-serif`
    }
    ctx.fillText(texto, xPrecio + 22, 58)
    ctx.fillStyle = "#000"
  }

  const esc = item.escalas?.[0]
  if (d.mostrar_escalas && esc) {
    ctx.font = `bold 24px Arial, Helvetica, sans-serif`
    ctx.fillText(`LLEVANDO ${esc.min_qty}+: Gs. ${fmtGs(esc.precio_unitario)}`, 22, altoDots - 34)
  }
}

/**
 * Convierte el canvas en un campo gráfico ZPL (^GFA).
 *
 * Va en hexadecimal, no binario: es la razón por la que este camino funciona
 * en la Zebra y no en la Pantum, que aborta el trabajo ante datos crudos.
 */
export function canvasAZplGrafico(canvas: HTMLCanvasElement, umbral = 128): string {
  const { width: w, height: h } = canvas
  const px = canvas.getContext("2d")!.getImageData(0, 0, w, h).data
  const anchoBytes = Math.ceil(w / 8)
  const hex: string[] = []
  for (let y = 0; y < h; y++) {
    for (let bx = 0; bx < anchoBytes; bx++) {
      let b = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = bx * 8 + bit
        let negro = 0
        if (x < w) {
          const i = (y * w + x) * 4
          const lum = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
          negro = lum < umbral ? 1 : 0
        }
        b = (b << 1) | negro
      }
      hex.push(b.toString(16).padStart(2, "0"))
    }
  }
  const datos = hex.join("").toUpperCase()
  const total = anchoBytes * h
  return `^FO0,0^GFA,${total},${total},${anchoBytes},${datos}^FS`
}
