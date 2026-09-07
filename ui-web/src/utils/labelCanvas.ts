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
  mostrar_marco: boolean
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
  mostrar_marco: false,
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
  // Siempre arriba: si se dependia de que lo fijara el encabezado, ocultarlo
  // desplazaba todo lo demas.
  ctx.textBaseline = "top"

  if (d.mostrar_marco) {
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, anchoDots - 5, altoDots - 5)
  }

  const anchoPrecio = d.mostrar_precio ? Math.round((anchoDots * d.ancho_precio_pct) / 100) : 0
  const xPrecio = anchoDots - anchoPrecio
  const anchoTexto = (d.mostrar_precio ? xPrecio : anchoDots) - 40

  let y = 10
  if (d.mostrar_encabezado) {
    ctx.font = `bold 22px ${d.familia_texto}`
    ctx.fillText(d.texto_encabezado || "", 22, y)
    y += 28
  }

  // Sin las barras se libera la franja inferior, asi que el nombre --lo primero
  // que mira el cliente-- gana una linea entera.
  const conBarras = d.mostrar_barcode && !!item.codigo_barra

  if (d.mostrar_nombre) {
    ctx.font = `bold ${d.fuente_nombre}px ${d.familia_texto}`
    for (const linea of ajustarTexto(ctx, item.nombre, anchoTexto, conBarras ? 2 : 3)) {
      ctx.fillText(linea, 22, y)
      y += d.fuente_nombre + 4
    }
  }

  const esc = d.mostrar_escalas ? item.escalas?.[0] : undefined

  // JERARQUIA DE PRECIOS
  // El mayorista es el gancho (es el mas barato), asi que va ARRIBA, con la
  // mayor superficie y el fondo negro: es lo primero que cae el ojo. El
  // unitario queda debajo en blanco, legible pero sin competirle.
  // Cada uno rotulado, para que el cliente no tenga que interpretar.
  if (d.mostrar_precio) {
    const bx = xPrecio
    const bw = anchoPrecio - 16
    const by = 10
    const bh = altoDots - 20

    const ajustar = (texto: string, maximo: number, anchoMax: number, familia: string) => {
      let t = maximo
      ctx.font = `bold ${t}px ${familia}`
      while (ctx.measureText(texto).width > anchoMax && t > 16) {
        t -= 2
        ctx.font = `bold ${t}px ${familia}`
      }
      return t
    }

    if (esc && !d.unitario_afuera) {
      // Bloque partido: 60% mayorista en negro arriba, 40% unitario en blanco abajo.
      const hMay = Math.round(bh * 0.6)
      const hUnit = bh - hMay

      // --- mayorista (fondo negro, letras blancas)
      ctx.fillStyle = "#000"
      ctx.fillRect(bx, by, bw, hMay)
      ctx.fillStyle = "#fff"
      ctx.font = `bold 20px ${d.familia_texto}`
      ctx.fillText(`PRECIO MAYORISTA (${esc.min_qty}+)`, bx + 14, by + 8)
      const tm = ajustar(fmtGs(esc.precio_unitario), d.fuente_precio, bw - 28, d.familia_precio)
      ctx.fillText(`Gs. ${fmtGs(esc.precio_unitario)}`, bx + 14, by + hMay - tm - 10)

      // --- unitario (fondo blanco, letras negras, con borde para delimitar)
      const uy = by + hMay
      ctx.fillStyle = "#fff"
      ctx.fillRect(bx, uy, bw, hUnit)
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 3
      ctx.strokeRect(bx + 1, uy + 1, bw - 2, hUnit - 2)
      ctx.fillStyle = "#000"
      ctx.font = `bold 20px ${d.familia_texto}`
      ctx.fillText("PRECIO UNITARIO", bx + 14, uy + 8)
      const tu = ajustar(fmtGs(item.precio_venta), d.fuente_precio_unitario, bw - 28, d.familia_precio)
      ctx.fillText(`Gs. ${fmtGs(item.precio_venta)}`, bx + 14, uy + hUnit - tu - 8)
      ctx.fillStyle = "#000"
    } else {
      // Sin escala (o con el unitario afuera): el bloque negro lleva el precio
      // que corresponda destacar.
      const destacado = esc ? esc.precio_unitario : item.precio_venta
      const rotulo = esc ? `PRECIO MAYORISTA (${esc.min_qty}+)` : "PRECIO UNITARIO"
      ctx.fillStyle = "#000"
      ctx.fillRect(bx, by, bw, bh)
      ctx.fillStyle = "#fff"
      ctx.font = `bold 22px ${d.familia_texto}`
      ctx.fillText(rotulo, bx + 16, by + 12)
      ctx.font = `bold 22px ${d.familia_precio}`
      ctx.fillText("Gs.", bx + 16, by + 44)
      const t = ajustar(fmtGs(destacado), d.fuente_precio, bw - 32, d.familia_precio)
      ctx.fillText(fmtGs(destacado), bx + 16, by + 70)
      ctx.fillStyle = "#000"
    }
  }

  // Unitario afuera del bloque: se lee mejor y no le compite al mayorista.
  if (d.mostrar_precio && esc && d.unitario_afuera) {
    ctx.fillStyle = "#000"
    ctx.font = `bold 20px ${d.familia_texto}`
    ctx.fillText("PRECIO UNITARIO", 22, y + 2)
    ctx.font = `bold ${d.fuente_precio_unitario}px ${d.familia_precio}`
    ctx.fillText(`Gs. ${fmtGs(item.precio_venta)}`, 22, y + 24)
    y += d.fuente_precio_unitario + 30
  }

  // Codigo de barras con su numero: se usa para reponer y para auditar.
  if (conBarras) {
    const anchos = code128Widths(item.codigo_barra!)
    const modulos = anchos.reduce((a, b) => a + b, 0)
    const modulo = Math.max(2, Math.floor((anchoTexto - 20) / modulos))
    const altoBarras = 42
    // 2mm mas arriba (16 dots): pegado al borde quedaba muy al filo del troquel
    const yBarras = altoDots - altoBarras - 62
    let x = 22
    anchos.forEach((w, i) => {
      if (i % 2 === 0) ctx.fillRect(x, yBarras, w * modulo, altoBarras)
      x += w * modulo
    })
    ctx.font = `bold 20px monospace`
    ctx.fillText(item.codigo_barra!, 22, yBarras + altoBarras + 2)
  }

  // Fecha de impresion: permite saber de cuando es el precio en la gondola.
  const fecha = new Date().toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" })

  if (conBarras) {
    if (d.mostrar_fecha) {
      ctx.font = `bold 20px ${d.familia_texto}`
      ctx.fillText(fecha, 22, altoDots - 42)
    }
  } else {
    // Sin barras: el numero y la fecha comparten una sola linea al pie y van
    // mas grandes. Se leen de lejos, que es para lo que se usan en la gondola,
    // y ocupan menos alto que las barras.
    const yPie = altoDots - 40
    if (item.codigo_barra) {
      ctx.font = `bold 30px monospace`
      ctx.fillText(item.codigo_barra, 22, yPie)
    }
    if (d.mostrar_fecha) {
      ctx.font = `bold 26px ${d.familia_texto}`
      const w = ctx.measureText(fecha).width
      ctx.fillText(fecha, Math.max(22, anchoTexto + 22 - w), yPie + 3)
    }
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
