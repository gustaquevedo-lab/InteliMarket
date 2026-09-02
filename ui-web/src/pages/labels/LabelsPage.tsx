import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Tags, Search, Loader2, Printer, Truck, FileText, Layers, Trash2, Plus, Settings, QrCode } from "lucide-react"
import JsBarcode from "jsbarcode"
import { api, type Product, type Supplier, type Category } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Origen = "productos" | "proveedor" | "recepcion" | "categoria"
type TipoImpresora = "pantum_rollo" | "zebra_zpl"

interface ResolvedItem {
  product_id: string
  nombre: string
  sku?: string
  codigo_barra?: string
  precio_venta: number
  costo_unitario?: number
  proveedor_nombre?: string
  fecha?: string
  cantidad: number
}

const DEFAULT_CAMPOS = {
  mostrar_nombre: true,
  mostrar_precio: true,
  mostrar_costo: false,
  mostrar_barcode: true,
  mostrar_sku: false,
  mostrar_proveedor: false,
  mostrar_fecha: false,
  fuente_tamano_nombre: 8,
  fuente_tamano_precio: 12,
}

export default function LabelsPage() {
  const toast = useToast()

  const [origen, setOrigen] = useState<Origen>("productos")
  const [tipoImpresora, setTipoImpresora] = useState<TipoImpresora>("pantum_rollo")
  const [campos, setCampos] = useState(DEFAULT_CAMPOS)

  // Productos sueltos
  const [productSearch, setProductSearch] = useState("")
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Proveedor / Recepción / Categoría
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [selectedReceiptId, setSelectedReceiptId] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState("")

  const [items, setItems] = useState<ResolvedItem[]>([])
  const [loadingResolve, setLoadingResolve] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<any>(null)
  const [printing, setPrinting] = useState(false)

  const printableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.purchases.listSuppliers().then(setSuppliers).catch(() => {})
    api.purchases.listReceipts().then((r) => setReceipts(r.slice(0, 30))).catch(() => {})
    api.categories.list().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    api.labelPrinting.getPrinterConfig(tipoImpresora).then(setPrinterConfig).catch(() => setPrinterConfig(null))
  }, [tipoImpresora])

  // Precarga desde Compras (recepción) via query param ?receipt_id=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const receiptId = params.get("receipt_id")
    if (receiptId) {
      setOrigen("recepcion")
      setSelectedReceiptId(receiptId)
    }
  }, [])

  const runResolve = useCallback(async (filtro: Record<string, any>) => {
    setLoadingResolve(true)
    try {
      const resolved = await api.labelPrinting.resolve(filtro)
      setItems(resolved as ResolvedItem[])
      if (!resolved.length) toast.warning("Sin resultados", "No se encontraron productos para ese filtro.")
    } catch (e: any) {
      toast.error("Error", "No se pudo resolver la lista de etiquetas.")
    } finally {
      setLoadingResolve(false)
    }
  }, [toast])

  useEffect(() => {
    if (origen === "recepcion" && selectedReceiptId) runResolve({ receipt_id: selectedReceiptId })
  }, [origen, selectedReceiptId, runResolve])

  useEffect(() => {
    if (origen === "proveedor" && selectedSupplierId) runResolve({ proveedor_id: selectedSupplierId, cantidad_default: 1 })
  }, [origen, selectedSupplierId, runResolve])

  useEffect(() => {
    if (origen === "categoria" && selectedCategoryId) runResolve({ categoria_id: selectedCategoryId, cantidad_default: 1 })
  }, [origen, selectedCategoryId, runResolve])

  const searchProducts = useCallback(async (q: string) => {
    setProductSearch(q)
    if (q.trim().length < 2) { setProductResults([]); return }
    setSearchingProducts(true)
    try {
      const results = await api.products.list({ search: q, limit: 20 })
      setProductResults(results)
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  const addProduct = (p: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.product_id === p.id)) return prev
      return [...prev, {
        product_id: p.id, nombre: p.nombre, sku: p.sku, codigo_barra: p.codigo_barra,
        precio_venta: Number(p.precio_venta) || 0, costo_unitario: Number((p as any).costo_promedio) || undefined,
        cantidad: 1,
      }]
    })
    setProductSearch("")
    setProductResults([])
  }

  const updateCantidad = (productId: string, cantidad: number) => {
    setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, cantidad: Math.max(1, cantidad) } : i))
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId))
  }

  const totalEtiquetas = useMemo(() => items.reduce((sum, i) => sum + i.cantidad, 0), [items])

  // ── Impresión Pantum: hoja HTML/CSS, window.print() ────────────────────
  const handlePrintPantum = () => {
    if (!items.length) { toast.warning("Sin productos", "Agregá al menos un producto antes de imprimir."); return }
    const anchoMm = printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 33
    const altoMm = printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 22
    const columnas = printerConfig?.columnas || 3
    const anchoTotalMm = anchoMm * columnas

    const celdas: { item: ResolvedItem }[] = []
    items.forEach((item) => { for (let i = 0; i < item.cantidad; i++) celdas.push({ item }) })

    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) { toast.error("Error", "El navegador bloqueó la ventana de impresión -- permití pop-ups para este sitio."); return }

    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiquetas</title>
      <style>
        @page { size: ${anchoTotalMm}mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(${columnas}, ${anchoMm}mm); }
        .label { width: ${anchoMm}mm; height: ${altoMm}mm; padding: 1mm; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 0.1mm dotted #ccc; }
        .nombre { font-size: ${campos.fuente_tamano_nombre}px; font-weight: bold; text-align: center; line-height: 1.1; max-height: 2.2em; overflow: hidden; }
        .precio { font-size: ${campos.fuente_tamano_precio}px; font-weight: 900; }
        .sub { font-size: 7px; color: #444; }
        svg { max-width: 95%; height: 10mm; }
      </style></head><body><div class="grid" id="grid"></div></body></html>
    `)
    win.document.close()

    const gridEl = win.document.getElementById("grid")!
    celdas.forEach(({ item }, idx) => {
      const cell = win.document.createElement("div")
      cell.className = "label"
      if (campos.mostrar_nombre) {
        const n = win.document.createElement("div"); n.className = "nombre"; n.textContent = item.nombre; cell.appendChild(n)
      }
      if (campos.mostrar_precio) {
        const p = win.document.createElement("div"); p.className = "precio"; p.textContent = `Gs. ${formatPYG(item.precio_venta)}`; cell.appendChild(p)
      }
      if (campos.mostrar_costo && item.costo_unitario) {
        const c = win.document.createElement("div"); c.className = "sub"; c.textContent = `Costo: Gs. ${formatPYG(item.costo_unitario)}`; cell.appendChild(c)
      }
      if (campos.mostrar_proveedor && item.proveedor_nombre) {
        const pr = win.document.createElement("div"); pr.className = "sub"; pr.textContent = item.proveedor_nombre; cell.appendChild(pr)
      }
      if (campos.mostrar_sku && item.sku) {
        const s = win.document.createElement("div"); s.className = "sub"; s.textContent = `SKU ${item.sku}`; cell.appendChild(s)
      }
      if (campos.mostrar_barcode && item.codigo_barra) {
        const svgNs = "http://www.w3.org/2000/svg"
        const svg = win.document.createElementNS(svgNs, "svg")
        svg.setAttribute("id", `bc-${idx}`)
        cell.appendChild(svg)
        try {
          JsBarcode(svg, item.codigo_barra, { format: "CODE128", width: 1, height: 24, displayValue: false, margin: 0 })
        } catch (e) { /* codigo de barras invalido, se omite */ }
      }
      gridEl.appendChild(cell)
    })

    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  // ── Impresión Zebra: backend arma el ZPL, red directa o QZ Tray ────────
  const handlePrintZebra = async () => {
    if (!items.length) { toast.warning("Sin productos", "Agregá al menos un producto antes de imprimir."); return }
    if (!printerConfig) {
      toast.warning("Falta configurar la impresora", "Configurá la impresora Zebra en Integraciones > Hardware de Caja.")
      return
    }
    setPrinting(true)
    try {
      const res = await api.labelPrinting.printZebra({ items: items as any })
      if (res.enviado_por_red) {
        toast.success("Enviado", "Las etiquetas se mandaron directo a la Zebra por red.")
        return
      }
      // Via QZ Tray (impresora USB local)
      const qz = (await import("qz-tray")).default
      if (!qz.websocket.isActive()) await qz.websocket.connect()
      const config = qz.configs.create(printerConfig.qz_printer_name || "Zebra")
      await qz.print(config, [{ type: "raw", format: "plain", data: res.zpl }])
      toast.success("Enviado", "Las etiquetas se mandaron a la Zebra vía QZ Tray.")
    } catch (e: any) {
      toast.error("Error al imprimir", e?.message || "No se pudo conectar con QZ Tray -- confirmá que está instalado y corriendo en esta PC.")
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
            <Tags className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Etiquetas</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pantum (rollo 3 columnas) y Zebra (góndola) -- por producto, proveedor, recepción o categoría</p>
          </div>
        </div>
      </div>

      {/* Selector de origen */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "productos", label: "Productos sueltos", icon: Search },
            { key: "proveedor", label: "Por Proveedor", icon: Truck },
            { key: "recepcion", label: "Por Recepción", icon: FileText },
            { key: "categoria", label: "Por Categoría", icon: Layers },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setOrigen(o.key as Origen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${origen === o.key ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"}`}
            >
              <o.icon className="w-3.5 h-3.5" /> {o.label}
            </button>
          ))}
        </div>

        {origen === "productos" && (
          <div className="relative">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => searchProducts(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o código de barras..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-sm outline-none focus:border-indigo-500"
            />
            {searchingProducts && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-gray-400" />}
            {productResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg">
                {productResults.map((p) => (
                  <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{p.nombre}</span>
                    <span className="text-gray-400 font-mono">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {origen === "proveedor" && (
          <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-sm outline-none">
            <option value="">Elegí un proveedor...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
          </select>
        )}

        {origen === "recepcion" && (
          <select value={selectedReceiptId} onChange={(e) => setSelectedReceiptId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-sm outline-none">
            <option value="">Elegí una recepción...</option>
            {receipts.map((r) => <option key={r.id} value={r.id}>{r.numero} -- {r.supplier?.razon_social || r.proveedor_ref || ""}</option>)}
          </select>
        )}

        {origen === "categoria" && (
          <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-sm outline-none">
            <option value="">Elegí una categoría...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}

        {loadingResolve && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Buscando productos...</div>}
      </div>

      {/* Tabla de previsualización */}
      {items.length > 0 && (
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{items.length} productos · {totalEtiquetas} etiquetas en total</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Precio</th>
                  <th className="p-2">Cantidad</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.product_id}>
                    <td className="p-2 font-medium text-gray-800 dark:text-gray-200">{item.nombre}</td>
                    <td className="p-2 font-mono text-gray-400">{item.sku}</td>
                    <td className="p-2 font-mono">{formatPYG(item.precio_venta)}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => updateCantidad(item.product_id, parseInt(e.target.value, 10) || 1)}
                        className="w-16 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-center font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <button onClick={() => removeItem(item.product_id)} className="text-red-500 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plantilla + impresora + imprimir */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTipoImpresora("pantum_rollo")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${tipoImpresora === "pantum_rollo" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"}`}
          >Pantum (rollo 3 columnas)</button>
          <button
            onClick={() => setTipoImpresora("zebra_zpl")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer ${tipoImpresora === "zebra_zpl" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"}`}
          >Zebra (góndola)</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            ["mostrar_nombre", "Nombre"], ["mostrar_precio", "Precio"], ["mostrar_costo", "Costo"],
            ["mostrar_barcode", "Código de barras"], ["mostrar_sku", "SKU"], ["mostrar_proveedor", "Proveedor"], ["mostrar_fecha", "Fecha"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={(campos as any)[key]} onChange={(e) => setCampos((prev) => ({ ...prev, [key]: e.target.checked }))} />
              {label}
            </label>
          ))}
        </div>

        {!printerConfig && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-600 dark:text-amber-300">
            No hay una impresora {tipoImpresora === "pantum_rollo" ? "Pantum" : "Zebra"} configurada. Configurala en Integraciones &gt; Hardware de Caja.
          </div>
        )}

        <button
          onClick={tipoImpresora === "pantum_rollo" ? handlePrintPantum : handlePrintZebra}
          disabled={printing || !items.length}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
        >
          {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Imprimir {totalEtiquetas > 0 ? `(${totalEtiquetas})` : ""}
        </button>
      </div>
    </div>
  )
}
