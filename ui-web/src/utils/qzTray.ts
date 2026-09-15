// Impresión silenciosa (sin diálogo del navegador/Windows) vía QZ Tray.
// Requiere https://qz.io/download/ instalado y corriendo en la PC donde
// está conectada la impresora, y el nombre exacto de esa impresora
// configurado en Integraciones > Hardware.
//
// InteliMarket se identifica ante QZ Tray con un certificado propio (firmado
// del lado del servidor, la clave privada nunca llega al navegador). Sin
// esto, QZ Tray trata cada conexión como anónima y no permite tildar
// "Remember this decision" -- el usuario tendría que aceptar el diálogo
// cada vez que imprime.

import { api } from "../api"

let qzModule: any = null
let securityConfigured = false

async function getQz(): Promise<any> {
  if (!qzModule) {
    qzModule = (await import("qz-tray")).default
  }
  if (!securityConfigured) {
    qzModule.security.setCertificatePromise((resolve: (v: string) => void, reject: (e: any) => void) => {
      api.labelPrinting
        .getQzCertificate()
        .then((r) => resolve(r.certificate))
        .catch(reject)
    })
    qzModule.security.setSignatureAlgorithm("SHA512")
    qzModule.security.setSignaturePromise((toSign: string) => (resolve: (v: string) => void, reject: (e: any) => void) => {
      api.labelPrinting
        .signQzRequest(toSign)
        .then((r) => resolve(r.signature))
        .catch(reject)
    })
    securityConfigured = true
  }
  return qzModule
}

export async function ensureQzConnected(): Promise<any> {
  const qz = await getQz()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
  return qz
}

export interface QzPrintOptions {
  printerName: string
  htmlContent: string
  widthMm: number
  heightMm: number
}

/**
 * Envía un fragmento HTML autocontenido (sin depender de Tailwind ni de
 * ningún CSS externo -- todo inline) a una impresora ya registrada en
 * Windows, rasterizado al tamaño físico exacto. No abre ningún diálogo.
 */
export async function printHtmlViaQz({ printerName, htmlContent, widthMm, heightMm }: QzPrintOptions): Promise<void> {
  const qz = await ensureQzConnected()
  // OJO: no fijar "density" acá -- pedirle a QZ un DPI alto (ej. 203, el
  // nativo de la Pantum) fuerza un nivel de zoom interno que la PC de
  // Compras no puede sostener en memoria, y QZ lo recorta agresivamente
  // ("Zoom level X decreased to Y due to physical memory limitations" en su
  // debug.log), dando una etiqueta mucho más chica de lo pedido. Se deja que
  // QZ elija su propio nivel de detalle.
  const config = qz.configs.create(printerName, {
    size: { width: widthMm, height: heightMm },
    units: "mm",
    margins: 0,
    scaleContent: true,
    rasterize: true,
  })
  await qz.print(config, [
    {
      type: "pixel",
      format: "html",
      flavor: "plain",
      data: htmlContent,
    },
  ])
}

export function isQzAvailableError(e: any): boolean {
  // Solo cuando de verdad no hay con quien hablar. Antes bastaba con que el
  // texto dijera "qz" o "connect", y un certificado rechazado o un error del
  // driver se mostraba como "QZ Tray no esta abierto", escondiendo la causa.
  const msg = String(e?.message || e || "")
  return /Unable to establish connection|websocket.*(closed|not active)|connection (refused|closed)/i.test(msg)
}

/** Explicacion para el usuario de un error de QZ Tray, sin esconder el mensaje real. */
export function qzErrorLegible(e: any): string {
  const msg = String(e?.message || e || "error desconocido")
  if (isQzAvailableError(e)) return "QZ Tray no está abierto en esta PC (o no responde). Abrilo e intentá de nuevo."
  if (/blocked|sign|certificate|untrusted|anonymous/i.test(msg)) {
    return `QZ Tray rechazó el pedido: falta el certificado de InteliMarket en esta PC. (${msg})`
  }
  return msg
}

/**
 * Impresion RAW: manda comandos nativos de la impresora (TSPL en la Pantum,
 * ZPL en la Zebra) sin rasterizar nada. Es el unico camino que permite
 * posicionar en milimetros exactos -- el rasterizado de HTML pasa por el
 * driver, que reescala el diseno y descalibra la etiqueta.
 */
export async function printRawViaQz(printerName: string, comandos: string): Promise<void> {
  const qz = await ensureQzConnected()
  await verificarImpresora(printerName)
  const config = qz.configs.create(printerName)
  // format debe ser "command" (no "plain": eso es un flavor, y QZ tira
  // "No enum constant PrintingUtilities.Format.PLAIN")
  await qz.print(config, [{ type: "raw", format: "command", flavor: "plain", data: comandos }])
}

/** Impresoras que ve QZ Tray en ESTA PC. */
export async function listarImpresoras(): Promise<string[]> {
  const qz = await ensureQzConnected()
  const res = await qz.printers.find()
  return Array.isArray(res) ? res : [res]
}

/**
 * Verifica que la impresora exista en esta PC antes de mandarle nada.
 *
 * QZ, si no encuentra el nombre pedido, cae silenciosamente en la impresora
 * POR DEFECTO ("Matched default printer, skipping further search" en su log).
 * Eso hace que un trabajo destinado a la Zebra pueda salir por la Pantum --o
 * peor, por una impresora de papel-- sin ningun aviso. Preferimos fallar con
 * un mensaje claro que imprimir en el lugar equivocado.
 */
export async function verificarImpresora(printerName: string): Promise<void> {
  const disponibles = await listarImpresoras()
  const existe = disponibles.some((p) => p?.toLowerCase() === printerName.toLowerCase())
  if (!existe) {
    throw new Error(
      `En esta PC no hay ninguna impresora llamada "${printerName}". ` +
      `Las disponibles son: ${disponibles.join(", ") || "(ninguna)"}.`
    )
  }
}


export interface QzImagenOptions {
  printerName: string
  imagenBase64: string // PNG sin el prefijo data:
  widthMm: number
  heightMm: number
}

/**
 * Imprime una imagen ya compuesta (PNG) por el driver de Windows. Es el camino
 * de la Zebra ZC300: las impresoras de tarjetas no hablan ZPL sino ZMotif, un
 * protocolo binario propio, asi que no se les puede mandar comandos crudos como
 * a la ZD220. El driver recibe la imagen y se encarga de los paneles de la
 * cinta (color, negro, protector).
 *
 * OJO con la orientacion: la tarjeta es apaisada (85,6 x 53,98). Si la primera
 * prueba sale rotada o recortada, el ajuste va aca (orientation) y no en el
 * dibujo: el dibujo es correcto a su tamaño real.
 */
export async function printImageViaQz({ printerName, imagenBase64, widthMm, heightMm }: QzImagenOptions): Promise<void> {
  const qz = await ensureQzConnected()
  await verificarImpresora(printerName)
  const datos = [{ type: "pixel", format: "image", flavor: "base64", data: imagenBase64 }]
  const horizontal = widthMm > heightMm
  // Los drivers de tarjetas (ZC300) no aceptan un papel inventado: si se le
  // pasa 85,6 x 53,98 mm Java lo valida contra el driver, el area imprimible
  // queda en cero y QZ tira "Paper's imageable width is too small". Se prueba
  // primero con la tarjeta que ya define el driver, solo girada; si el driver
  // no trae tamaño propio, con el tamaño en vertical (como lo describe el
  // driver) y orientacion horizontal.
  const intentos = [
    { orientation: horizontal ? "landscape" : "portrait", margins: 0, scaleContent: true, colorType: "color" },
    {
      size: { width: Math.min(widthMm, heightMm), height: Math.max(widthMm, heightMm) },
      units: "mm",
      orientation: horizontal ? "landscape" : "portrait",
      margins: 0,
      scaleContent: true,
      colorType: "color",
    },
  ]
  let ultimoError: any = null
  for (const opciones of intentos) {
    try {
      await qz.print(qz.configs.create(printerName, opciones), datos)
      return
    } catch (e: any) {
      ultimoError = e
      if (!/imageable|paper/i.test(String(e?.message || e))) throw e
    }
  }
  throw ultimoError
}
