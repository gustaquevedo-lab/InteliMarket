import { useState, useEffect, useRef, useCallback } from "react"
import { Barcode, Trash2, Printer, Loader2, CheckCircle2, AlertCircle, Plus, Minus } from "lucide-react"
import { api } from "../../api"
import { renderGondola, canvasAZplGrafico, DISENO_GONDOLA_DEFAULT, type DisenoGondola } from "../../utils/labelCanvas"
// Import estático a propósito: con import dinámico, una estación que quedó
// abierta desde antes de un despliegue fallaba justo al imprimir ("Failed to
// fetch dynamically imported module"), porque el chunk cambia de nombre en
// cada build. Cargarlo junto con la página elimina esa ventana de rotura.
import { printRawViaQz } from "../../utils/qzTray"

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
      let escalas: { min_qty: number; precio_unitario: number }[] = []
      try {
        const resueltos = await api.labelPrinting.resolve({
          producto_ids: [{ product_id: p.id, cantidad: 1 }],
        })
        escalas = ((resueltos?.[0] as any)?.escalas || []).map((e: any) => ({
          min_qty: Number(e.min_qty),
          precio_unitario: Number(e.precio_unitario),
        }))
      } catch {
        // si falla, la etiqueta sale igual con el precio unitario
      }
      // Solo cuenta como mayorista si de verdad es más barato: hay productos
      // con una escala cargada al mismo precio, y mostrarla sería engañoso.
      const precio = Number(p.precio_venta) || 0
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
        const etiqueta = `^XA^PW${anchoDots}^LL${altoDots}^LH${offX},${offY}${grafico}^XZ`
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
        <div className="flex items-center gap-4">
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
              </div>
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
    </div>
  )
}
