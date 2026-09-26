import { useState, useEffect, useRef, useCallback } from "react"
import { Barcode, Trash2, Printer, Loader2, CheckCircle2, AlertCircle, Plus, Minus, Wrench, RefreshCw, X, Sliders, ArrowUp, ArrowDown, HelpCircle, FileText, Check } from "lucide-react"
import { api } from "../../api"
import { renderGondola, canvasAZplGrafico, DISENO_GONDOLA_DEFAULT, type DisenoGondola } from "../../utils/labelCanvas"
// Import estático a propósito: con import dinámico, una estación que quedó
// abierta desde antes de un despliegue fallaba justo al imprimir ("Failed to
// fetch dynamically imported module"), porque el chunk cambia de nombre en
// cada build. Cargarlo junto con la página elimina esa ventana de rotura.
import { printRawViaQz } from "../../utils/qzTray"
import { precioEstandar, estaEnPromocion } from "../../utils/precios"

/**
 * Estación de etiquetas de góndola.
 *
 * Pensada para una máquina dedicada, operada por el gondolero: escanear,
 * ajustar cantidad, imprimir. A propósito NO tiene diseñador -- imprime
 * siempre el modelo aprobado. Quien diseña lo hace desde el módulo Etiquetas.
 */

interface ItemCola {
  product_id: string
  nombre: string
  sku?: string
  codigo_barra?: string
  precio_venta: number
  cantidad: number
  escalas?: { min_qty: number; precio_unitario: number }[]
  // null = no se pudo consultar. Se distingue de 0, que es un dato real y
  // justamente el que el gondolero necesita ver.
  stock: number | null
  stock_reservado: number
  stock_minimo: number
  // El cartel lleva el precio de lista. Esto es solo para avisarle al
  // gondolero que hoy se vende mas barato, y que eso es a proposito.
  en_promocion: boolean
}

/**
 * Stock a la vista del gondolero. Va destacado a proposito: es lo que decide
 * si ademas de cambiar el cartel hay que reponer la gondola.
 *
 * Se muestra el disponible (total menos reservado). El cero es un dato, no un
 * error, asi que se distingue de "no se pudo consultar".
 */
function StockBadge({ item }: { item: ItemCola }) {
  const s = item.stock
  const desconocido = s === null
  const agotado = !desconocido && s <= 0
  const bajo = !desconocido && !agotado && s <= item.stock_minimo

  const tono = desconocido
    ? "bg-slate-800 border-slate-700 text-slate-500"
    : agotado
      ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
      : bajo
        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"

  return (
    <div className={`shrink-0 w-24 px-2 py-1.5 rounded-xl border text-center ${tono}`}>
      <div className="text-[9px] uppercase font-bold tracking-wider opacity-70">
        {agotado ? "Sin stock" : bajo ? "Stock bajo" : "Stock"}
      </div>
      <div className="text-2xl font-black tabular-nums leading-tight">
        {desconocido ? "—" : s.toLocaleString("es-PY")}
      </div>
      {!desconocido && item.stock_reservado > 0 && (
        <div className="text-[9px] opacity-70 tabular-nums">{item.stock_reservado} reservadas</div>
      )}
    </div>
  )
}

export default function GondolaPage() {
  const [cola, setCola] = useState<ItemCola[]>([])
  const [codigo, setCodigo] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [printerConfig, setPrinterConfig] = useState<any>(null)
  // Diseño APROBADO: esta pantalla no puede modificarlo, solo imprimirlo.
  const [diseno, setDiseno] = useState<DisenoGondola>(DISENO_GONDOLA_DEFAULT)
  const [nombreDiseno, setNombreDiseno] = useState<string>("por defecto")
  const inputRef = useRef<HTMLInputElement>(null)
  const [puedeInstalar, setPuedeInstalar] = useState<any>(null)

  useEffect(() => {
    api.labelPrinting.getPrinterConfig("zebra_zpl").then(setPrinterConfig).catch(() => setPrinterConfig(null))
    api.labelPrinting
      .getTemplateAprobada("zebra_zpl")
      .then((t) => {
        if (t?.campos) {
          setDiseno({ ...DISENO_GONDOLA_DEFAULT, ...(t.campos as any) })
          setNombreDiseno(t.nombre)
        }
      })
      .catch(() => {})
  }, [])

  const [modalMantenimiento, setModalMantenimiento] = useState(false)
  const [accionMantenimiento, setAccionMantenimiento] = useState<string | null>(null)
  const [offsetMm, setOffsetMm] = useState<number>(-2)

  useEffect(() => {
    if (printerConfig?.offset_vertical_mm !== undefined && printerConfig?.offset_vertical_mm !== null) {
      setOffsetMm(Number(printerConfig.offset_vertical_mm))
    }
  }, [printerConfig])

  const ejecutarAccionMantenimiento = async (modo: "medio" | "minimo" | "regla") => {
    setAccionMantenimiento(modo)
    try {
      const nombreImpresora = printerConfig?.qz_printer_name || "Etiqueta"
      const { comandos } = await api.labelPrinting.calibracion("zebra_zpl", modo)
      await printRawViaQz(nombreImpresora, comandos)
      if (modo === "medio") {
        mostrar("ok", "Orden de calibración enviada. La Zebra avanzará 2-3 etiquetas y quedará en verde fijo.")
      } else if (modo === "minimo") {
        mostrar("ok", "Etiqueta de prueba enviada con éxito.")
      } else {
        mostrar("ok", "Regla milimétrica ZPL enviada.")
      }
    } catch (e: any) {
      mostrar("error", `Error enviando comando a Zebra: ${e?.message || e}`)
    } finally {
      setAccionMantenimiento(null)
      devolverFoco()
    }
  }

  const cambiarOffsetVertical = async (deltaMm: number) => {
    const nuevo = Math.round((offsetMm + deltaMm) * 10) / 10
    setAccionMantenimiento("offset")
    try {
      const nombreImpresora = printerConfig?.qz_printer_name || "Etiqueta"
      const dy = Number(printerConfig?.dpmm_y) || 8
      const ltDots = Math.round(nuevo * dy)
      // Manda comando ZPL directo para ajustar y guardar en NVRAM permanente
      const zpl = `^XA^LT${ltDots}^JUS^XZ`
      await printRawViaQz(nombreImpresora, zpl)
      setOffsetMm(nuevo)
      if (printerConfig) {
        const updated = { ...printerConfig, offset_vertical_mm: nuevo }
        setPrinterConfig(updated)
        await api.labelPrinting.updatePrinterConfig("zebra_zpl", updated).catch(() => {})
      }
      mostrar("ok", `Offset vertical fijado en ${nuevo} mm. Guardado en la memoria de la impresora.`)
    } catch (e: any) {
      mostrar("error", `Error ajustando altura: ${e?.message || e}`)
    } finally {
      setAccionMantenimiento(null)
      devolverFoco()
    }
  }

  // Manifiesto propio para que esta pantalla se instale como app aparte.
  // La PWA principal apunta al depósito, así que sin esto se instalaría esa.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const original = link?.getAttribute("href") || null
    link?.setAttribute("href", "/etiquetas.webmanifest")
    const onPrompt = (e: any) => {
      e.preventDefault()
      setPuedeInstalar(e)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => {
      if (original) link?.setAttribute("href", original)
      window.removeEventListener("beforeinstallprompt", onPrompt)
    }
  }, [])

  // El foco vuelve siempre al campo: el lector de código de barras escribe
  // como si fuera un teclado, y si el foco se pierde el escaneo se pierde.
  const devolverFoco = useCallback(() => inputRef.current?.focus(), [])
  useEffect(() => {
    devolverFoco()
    const t = setInterval(devolverFoco, 1500)
    return () => clearInterval(t)
  }, [devolverFoco])

  const mostrar = (tipo: "ok" | "error", texto: string) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 4000)
  }

  const agregar = async (code: string) => {
    const limpio = code.trim()
    if (!limpio) return
    setCodigo("")
    setBuscando(true)
    try {
      const encontrados = await api.products.list({ search: limpio, limit: 5 })
      const p =
        encontrados.find((x: any) => x.codigo_barra === limpio || x.sku === limpio) || encontrados[0]
      if (!p) {
        mostrar("error", `No encontré ningún producto con "${limpio}"`)
        return
      }
      // Segunda llamada a propósito: products.list NO trae las escalas de
      // precio (viven en otra tabla). Sin esto la etiqueta salía siempre sin
      // el precio mayorista, que es justamente lo que más se destaca.
      // Las dos consultas van juntas: el gondolero escanea en rafaga y una
      // detras de otra se le nota la espera.
      const [resueltos, stockResp] = await Promise.all([
        api.labelPrinting
          .resolve({ producto_ids: [{ product_id: p.id, cantidad: 1 }] })
          .catch(() => null), // si falla, la etiqueta sale igual con el precio unitario
        api.inventory.getProductStock(p.id).catch(() => null),
      ])

      let escalas: { min_qty: number; precio_unitario: number }[] = []
      escalas = ((resueltos?.[0] as any)?.escalas || []).map((e: any) => ({
        min_qty: Number(e.min_qty),
        precio_unitario: Number(e.precio_unitario),
      }))

      const stock = stockResp ? Number(stockResp.cantidad_disponible) : null
      const stockReservado = stockResp ? Number(stockResp.cantidad_reservada) || 0 : 0
      // Solo cuenta como mayorista si de verdad es más barato: hay productos
      // con una escala cargada al mismo precio, y mostrarla sería engañoso.
      // Precio de LISTA, nunca el promocional: la etiqueta sobrevive a la
      // oferta. El backend ya lo resuelve asi; el fallback repite el criterio
      // por si la consulta de escalas fallo.
      // Se toma del producto y no de la respuesta de escalas: products.list ya
      // trae precio_regular, asi que el criterio no depende de que el backend
      // este al dia. Un solo lugar decide que es "el precio estandar".
      const precio = precioEstandar(p)
      escalas = escalas.filter((e) => e.precio_unitario > 0 && e.precio_unitario < precio)

      setCola((prev) => {
        const ya = prev.find((i) => i.product_id === p.id)
        if (ya) return prev.map((i) => (i.product_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
        return [
          {
            product_id: p.id,
            nombre: p.nombre,
            sku: p.sku,
            codigo_barra: p.codigo_barra,
            precio_venta: precio,
            cantidad: 1,
            escalas,
            stock: Number.isFinite(stock as number) ? stock : null,
            stock_reservado: stockReservado,
            stock_minimo: Number(p.stock_minimo) || 0,
            en_promocion: estaEnPromocion(p),
          },
          ...prev,
        ]
      })
      mostrar("ok", `${p.nombre} agregado`)
    } catch {
      mostrar("error", "Error buscando el producto")
    } finally {
      setBuscando(false)
      devolverFoco()
    }
  }

  const cambiarCantidad = (id: string, delta: number) =>
    setCola((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
    )

  const quitar = (id: string) => setCola((prev) => prev.filter((i) => i.product_id !== id))

  const total = cola.reduce((s, i) => s + i.cantidad, 0)

  const imprimir = async () => {
    if (!cola.length) return
    setImprimiendo(true)
    try {
      const nombre = printerConfig?.qz_printer_name
      if (!nombre) {
        mostrar("error", "Falta configurar el nombre de la impresora en Integraciones > Hardware")
        return
      }
      // Se dibuja cada etiqueta al tamaño exacto de la impresora y se manda
      // como gráfico ZPL: así sale idéntica al diseño aprobado.
      const dx = Number(printerConfig?.dpmm_x) || 8
      const dy = Number(printerConfig?.dpmm_y) || 8
      const anchoDots = Math.min(Math.round((Number(printerConfig?.ancho_mm) || 105) * dx), 832)
      const altoDots = Math.round((Number(printerConfig?.alto_mm) || 30) * dy)
      const offX = Math.round((Number(printerConfig?.margen_izquierdo_mm) || 0) * dx)
      const offY = Math.round((Number(printerConfig?.offset_vertical_mm) || 0) * dy)

      const canvas = document.createElement("canvas")
      const partes: string[] = []
      for (const item of cola) {
        renderGondola(canvas, item, diseno, anchoDots, altoDots)
        const grafico = canvasAZplGrafico(canvas)
        const etiqueta = `^XA^MMT^MNY^MTD^PR3,3^PW${anchoDots}^LL${altoDots}^LH${offX},${offY}${grafico}^XZ`
        for (let n = 0; n < item.cantidad; n++) partes.push(etiqueta)
      }
      const zpl = partes.join("")

      await printRawViaQz(nombre, zpl)
      mostrar("ok", `${total} etiqueta${total === 1 ? "" : "s"} enviada${total === 1 ? "" : "s"}`)
      setCola([])
    } catch (e: any) {
      // Mensajes por etapa: "no se pudo imprimir" a secas obliga a adivinar
      // si falló el servidor, QZ Tray o la impresora.
      const msg = String(e?.message || e)
      if (msg.includes("dynamically imported module")) {
        mostrar("error", "Hay una versión nueva del sistema. Recargá la página (Ctrl+Shift+R) y volvé a intentar.")
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        mostrar("error", "No se pudo hablar con el servidor. Verificá que la dirección de esta pantalla sea la del sistema (no una copia local) y que haya red.")
      } else if (msg.includes("WebSocket") || msg.toLowerCase().includes("connect")) {
        mostrar("error", "QZ Tray no responde en esta PC. Verificá que esté abierto (ícono junto al reloj).")
      } else if (msg.includes("no hay ninguna impresora")) {
        mostrar("error", msg)
      } else {
        mostrar("error", msg)
      }
    } finally {
      setImprimiendo(false)
      devolverFoco()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Etiquetas de Góndola</h1>
          <p className="text-xs text-slate-400 mt-0.5">Escaneá un producto para agregarlo a la cola</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Diseño aprobado: <span className="text-slate-300 font-bold">{nombreDiseno}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalMantenimiento(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer shadow-sm"
            title="Calibrar y Mantenimiento de Zebra ZD220"
          >
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Mantenimiento Zebra</span>
          </button>
          {puedeInstalar && (
            <button
              onClick={async () => { puedeInstalar.prompt(); setPuedeInstalar(null) }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold cursor-pointer"
            >
              Instalar como app
            </button>
          )}
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">En cola</div>
            <div className="text-3xl font-black text-amber-400 tabular-nums">{total}</div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          agregar(codigo)
        }}
        className="relative"
      >
        <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
        <input
          ref={inputRef}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escaneá o escribí el código..."
          autoFocus
          // El Enter se captura explícitamente en vez de confiar en el envío
          // implícito del formulario: el lector de código de barras manda la
          // tecla como parte de la ráfaga y el envío implícito no siempre se
          // dispara, con lo cual el escaneo se perdía sin ningún aviso.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              agregar(codigo)
            }
          }}
          className="w-full pl-14 pr-4 py-5 rounded-2xl bg-slate-900 border-2 border-slate-700 focus:border-amber-500 outline-none text-xl font-mono tracking-wide"
        />
        {buscando && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 animate-spin text-amber-400" />}
      </form>

      {aviso && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${
            aviso.tipo === "ok" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          }`}
        >
          {aviso.tipo === "ok" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {aviso.texto}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 divide-y divide-slate-800">
        {cola.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Barcode className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">La cola está vacía. Escaneá el primer producto.</p>
          </div>
        ) : (
          cola.map((i) => (
            <div key={i.product_id} className="flex items-center gap-3 p-3 bg-slate-900/60">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{i.nombre}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {i.codigo_barra || i.sku} · Gs. {i.precio_venta.toLocaleString("es-PY")}
                  {i.escalas?.[0] ? (
                    <span className="text-amber-400"> · {i.escalas[0].min_qty}+ Gs. {i.escalas[0].precio_unitario.toLocaleString("es-PY")}</span>
                  ) : (
                    <span className="text-slate-600"> · sin mayorista</span>
                  )}
                </div>
                {i.en_promocion && (
                  <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-300 text-[10px] font-bold">
                    Hoy en promoción — el cartel lleva el precio normal
                  </div>
                )}
              </div>
              <StockBadge item={i} />
              <div className="flex items-center gap-1.5">
                <button onClick={() => cambiarCantidad(i.product_id, -1)} className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 font-black cursor-pointer">
                  <Minus className="w-4 h-4 mx-auto" />
                </button>
                <span className="w-10 text-center text-xl font-black tabular-nums">{i.cantidad}</span>
                <button onClick={() => cambiarCantidad(i.product_id, 1)} className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 font-black cursor-pointer">
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
                <button onClick={() => quitar(i.product_id)} className="w-9 h-9 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                  <Trash2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={imprimir}
        disabled={imprimiendo || cola.length === 0}
        className="w-full py-6 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 text-xl font-black flex items-center justify-center gap-3 cursor-pointer"
      >
        {imprimiendo ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
        IMPRIMIR {total > 0 ? `${total} ETIQUETA${total === 1 ? "" : "S"}` : ""}
      </button>

      {/* ── MODAL DE MANTENIMIENTO Y CALIBRACIÓN ZEBRA ZD220 ── */}
      {modalMantenimiento && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Mantenimiento Zebra ZD220</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Impresora activa: <span className="text-amber-400 font-mono font-bold">{printerConfig?.qz_printer_name || "Etiqueta"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMantenimiento(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Acciones Rápidas Principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botón Maestro de Calibración */}
              <button
                type="button"
                disabled={accionMantenimiento !== null}
                onClick={() => ejecutarAccionMantenimiento("medio")}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition cursor-pointer text-left shadow-lg shadow-amber-500/10"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-slate-950/20 flex items-center justify-center">
                    {accionMantenimiento === "medio" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-950/20 px-2 py-0.5 rounded-full">Paso 1</span>
                </div>
                <div>
                  <div className="text-sm font-black leading-tight">Calibrar Rollo y Sensor</div>
                  <div className="text-[11px] font-medium opacity-80 mt-0.5 leading-snug">
                    Rescata la impresora si titila en rojo o tira muchas etiquetas seguidas.
                  </div>
                </div>
              </button>

              {/* Botón Prueba Rápida */}
              <button
                type="button"
                disabled={accionMantenimiento !== null}
                onClick={() => ejecutarAccionMantenimiento("minimo")}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 disabled:opacity-50 text-white transition cursor-pointer text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center text-slate-300">
                    {accionMantenimiento === "minimo" ? <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> : <Printer className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full">Paso 2</span>
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight">Imprimir Prueba</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Verifica que imprima 1 sola etiqueta y frene justo en el corte.
                  </div>
                </div>
              </button>
            </div>

            {/* Ajuste fino de Altura (Offset Vertical) */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Ajuste Fino de Altura (Offset Vertical)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Actualmente: <span className="font-mono font-bold text-amber-400">{offsetMm} mm</span> {offsetMm < 0 ? "(hacia arriba)" : offsetMm > 0 ? "(hacia abajo)" : "(centrado)"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={accionMantenimiento !== null}
                  onClick={() => cambiarOffsetVertical(-1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50 transition"
                  title="Mover el contenido 1mm más arriba (lejos del troquel inferior)"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                  Subir 1 mm
                </button>
                <button
                  type="button"
                  disabled={accionMantenimiento !== null}
                  onClick={() => cambiarOffsetVertical(1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50 transition"
                  title="Mover el contenido 1mm más abajo"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                  Bajar 1 mm
                </button>
              </div>
            </div>

            {/* Guía Visual Paso a Paso */}
            <div className="flex flex-col gap-3">
              <div className="text-[11px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Guía de Resolución Rápida (Para el Operador)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-1.5">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                    Luz Roja Titilando
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    El sensor no ve el corte. Abre la tapa y revisa que <strong>no haya una etiqueta pegada en el piso plástico</strong>. Luego pulsa "Calibrar Rollo".
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Avanza Muchas Etiquetas
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    La máquina perdió el modo de etiqueta. Pulsa el botón amarillo <strong>"Calibrar Rollo y Sensor"</strong> para que avance 2 etiquetas y guarde el corte.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-1.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Cerrado Correcto
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Al poner el rollo nuevo, presiona la tapa firmemente hacia abajo hasta escuchar un <strong>clic en ambos costados</strong> para que el sensor quede alineado.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalMantenimiento(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
