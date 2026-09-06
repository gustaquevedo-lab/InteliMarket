// Dibujo de la etiqueta de góndola sobre canvas, a la resolución EXACTA de la
// impresora (1 pixel = 1 dot). El mismo canvas alimenta la vista previa en
// pantalla y lo que se manda a imprimir, así que el diseñador es fiel de
// verdad: no hay dos motores que puedan desincronizarse.
//
// Solo sirve para la Zebra: acepta imágenes en hexadecimal (^GFA). La Pantum
// rechaza cualquier dato binario, por eso allá se usa TSPL nativo.

import { code128Widths } from "./code128"

/**
 * Fuentes elegibles. Es una lista corta a propósito: en térmica a 203dpi las
 * fuentes finas o con serifas se empastan y pierden legibilidad. Todas estas
 * son de trazo grueso y existen en Windows, que es donde corre la estación.
 */
export const FUENTES_ETIQUETA = [
  { id: "Arial Black, Arial, sans-serif", label: "Arial Black — máximo impacto" },
  { id: "Impact, Haettenschweiler, sans-serif", label: "Impact — condensada, muy fuerte" },
  { id: "Arial Narrow, Arial, sans-serif", label: "Arial Narrow — entra más texto" },
  { id: "Arial, Helvetica, sans-serif", label: "Arial — neutra" },
  { id: "Verdana, Geneva, sans-serif", label: "Verdana — legible en chico" },
  { id: "Tahoma, Geneva, sans-serif", label: "Tahoma — compacta y clara" },
] as const

export interface DisenoGondola {
  mostrar_encabezado: boolean
  texto_encabezado: string
  mostrar_nombre: boolean
  fuente_nombre: number
  mostrar_barcode: boolean
  mostrar_precio: boolean
  fuente_precio: number
  mostrar_escalas: boolean
  mostrar_fecha: boolean
  fuente_precio_unitario: number
  familia_texto: string
  familia_precio: string
  unitario_afuera: boolean // el unitario fuera del bloque negro, más visible
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
  mostrar_fecha: true,
  fuente_precio_unitario: 34,
  familia_texto: "Arial Narrow, Arial, sans-serif",
  familia_precio: "Arial Black, Arial, sans-serif",
  unitario_afuera: true,
  ancho_precio_pct: 40,
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

  let y = 10
  if (d.mostrar_encabezado) {
    ctx.font = `bold 22px ${d.familia_texto}`
    ctx.textBaseline = "top"
    ctx.fillText(d.texto_encabezado || "", 22, y)
    y += 28
  }

  if (d.mostrar_nombre) {
    ctx.font = `bold ${d.fuente_nombre}px ${d.familia_texto}`
    for (const linea of ajustarTexto(ctx, item.nombre, anchoTexto, 2)) {
      ctx.fillText(linea, 22, y)
      y += d.fuente_nombre + 4
    }
  }

  const esc = d.mostrar_escalas ? item.escalas?.[0] : undefined

  // JERARQUIA: el precio de escala es el gancho (es el mas barato), asi que
  // se lleva el bloque negro. El unitario queda visible pero en segundo plano.
  // Si el producto no tiene escala, el bloque negro lo ocupa el unitario.
  if (d.mostrar_precio) {
    ctx.fillStyle = "#000"
    ctx.fillRect(xPrecio, 10, anchoPrecio - 16, altoDots - 20)

    const destacado = esc ? esc.precio_unitario : item.precio_venta
    const rotulo = esc ? `LLEVANDO ${esc.min_qty}+` : "PRECIO"

    ctx.fillStyle = "#fff"
    ctx.font = `bold 24px ${d.familia_texto}`
    ctx.fillText(rotulo, xPrecio + 20, 22)

    ctx.font = `bold 22px ${d.familia_precio}`
    ctx.fillText("Gs.", xPrecio + 20, 56)

    let tam = d.fuente_precio
    const texto = fmtGs(destacado)
    ctx.font = `bold ${tam}px ${d.familia_precio}`
    while (ctx.measureText(texto).width > anchoPrecio - 44 && tam > 24) {
      tam -= 2
      ctx.font = `bold ${tam}px ${d.familia_precio}`
    }
    ctx.fillText(texto, xPrecio + 20, 80)

    // el unitario adentro del bloque solo si se eligió no sacarlo afuera
    if (esc && !d.unitario_afuera) {
      ctx.font = `bold ${Math.min(d.fuente_precio_unitario, 26)}px ${d.familia_precio}`
      ctx.fillText(`1 un: Gs. ${fmtGs(item.precio_venta)}`, xPrecio + 20, altoDots - 34)
    }
    ctx.fillStyle = "#000"
  }

  // Unitario afuera del bloque negro: se lee mucho mejor que metido adentro,
  // y sigue quedando claro que el precio grande es el de escala.
  if (d.mostrar_precio && esc && d.unitario_afuera) {
    ctx.fillStyle = "#000"
    ctx.font = `bold ${d.fuente_precio_unitario}px ${d.familia_precio}`
    ctx.fillText(`1 un: Gs. ${fmtGs(item.precio_venta)}`, 22, y + 2)
    y += d.fuente_precio_unitario + 6
  }

  // Codigo de barras con su numero: se usa para reponer y para auditar.
  if (d.mostrar_barcode && item.codigo_barra) {
    const anchos = code128Widths(item.codigo_barra)
    const modulos = anchos.reduce((a, b) => a + b, 0)
    const modulo = Math.max(2, Math.floor((anchoTexto - 20) / modulos))
    const altoBarras = 42
    const yBarras = altoDots - altoBarras - 46
    let x = 22
    anchos.forEach((w, i) => {
      if (i % 2 === 0) ctx.fillRect(x, yBarras, w * modulo, altoBarras)
      x += w * modulo
    })
    ctx.font = `bold 20px monospace`
    ctx.fillText(item.codigo_barra, 22, yBarras + altoBarras + 2)
  }

  // Fecha de impresion: permite saber de cuando es el precio en la gondola.
  if (d.mostrar_fecha) {
    ctx.font = `bold 20px ${d.familia_texto}`
    const f = new Date().toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" })
    ctx.fillText(f, 22, altoDots - 26)
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
