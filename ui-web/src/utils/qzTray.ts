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
  //
  // Sin acceso al log de QZ en la PC no hay forma de saber de antemano que
  // combinacion acepta cada driver, asi que se prueban todas las validas en
  // orden. Fallan al validar el trabajo, ANTES de mandar nada a la impresora,
  // asi que un intento fallido no gasta tarjeta ni cinta. La que funciona se
  // recuerda en esta PC y se usa primero la proxima vez.
  const orient = horizontal ? "landscape" : "portrait"
  const vertical = { width: Math.min(widthMm, heightMm), height: Math.max(widthMm, heightMm) }
  const apaisado = { width: Math.max(widthMm, heightMm), height: Math.min(widthMm, heightMm) }
  const base = { scaleContent: true, colorType: "color" }
  const intentos: Record<string, any> = {
    driver_girado: { ...base, orientation: orient },
    vertical_girado: { ...base, size: vertical, units: "mm", orientation: orient },
    apaisado: { ...base, size: horizontal ? apaisado : vertical, units: "mm" },
    vertical_girado_sin_margen: { ...base, size: vertical, units: "mm", orientation: orient, margins: 0 },
    driver_solo: { ...base },
  }
  const CLAVE = `qz_pixel_config_${printerName}`
  let preferida: string | null = null
  try { preferida = localStorage.getItem(CLAVE) } catch {}
  const orden = Object.keys(intentos).sort((a, b) => (a === preferida ? -1 : b === preferida ? 1 : 0))

  const fallas: string[] = []
  for (const nombre of orden) {
    try {
      await qz.print(qz.configs.create(printerName, intentos[nombre]), datos)
      try { localStorage.setItem(CLAVE, nombre) } catch {}
      console.info(`[qz] impresion de imagen OK con la configuracion "${nombre}"`)
      return
    } catch (e: any) {
      const msg = String(e?.message || e)
      // Sin QZ o sin certificado no tiene sentido seguir probando tamaños.
      if (isQzAvailableError(e) || /blocked|sign|certificate|untrusted|anonymous/i.test(msg)) throw e
      fallas.push(`${nombre}: ${msg}`)
    }
  }
  reportarDiagnostico(qz, printerName, fallas)
  throw new Error(`La impresora rechazó todas las configuraciones. ${fallas.join(" | ")}`)
}

/**
 * Deja el detalle de la falla en el log del servidor web, para diagnosticar sin
 * que nadie tenga que copiar ni fotografiar errores. Va como consulta a una
 * ruta que no existe: nginx la anota igual. Solo mensajes tecnicos de QZ y del
 * driver, ningun dato de clientes.
 */
async function reportarDiagnostico(qz: any, printerName: string, fallas: string[]): Promise<void> {
  let detalles: any = null
  try {
    const todos = await qz.printers.details()
    detalles = (Array.isArray(todos) ? todos : [todos]).find((p: any) => p?.name?.toLowerCase() === printerName.toLowerCase()) || null
  } catch (e: any) {
    detalles = { error: String(e?.message || e) }
  }
  let version: any = null
  try { version = await qz.api.getVersion() } catch {}
  // Tope corto: codificado en la URL crece ~3 veces y nginx corta pedidos de mas de 8 KB.
  const info = JSON.stringify({ printerName, version, fallas, detalles }).slice(0, 2400)
  try {
    fetch(`/__diag/qz?d=${encodeURIComponent(info)}`, { cache: "no-store" }).catch(() => {})
  } catch {}
}
