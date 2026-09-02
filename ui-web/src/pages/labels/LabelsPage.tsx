import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Tags,
  Search,
  Loader2,
  Printer,
  Truck,
  FileText,
  Layers,
  Trash2,
  Plus,
  Minus,
  Settings,
  Sparkles,
  Sliders,
  Eye,
  RefreshCw,
  Copy,
  Zap,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Columns,
  Grid,
  TrendingUp,
  X,
  ChevronRight,
  Barcode,
  ShoppingBag,
  Clock,
  LayoutGrid,
  Check,
  Tag,
  ArrowUpDown,
  Edit3,
} from "lucide-react"
import { api, type Product, type Supplier, type Category } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

// ── GENERADOR CODE128 VECTORIAL NATIVO (100% OFFLINE & ZERO-DEPENDENCY) ─────
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
]

function renderCode128Svg(code: string): string {
  if (!code) return ""
  let checksum = 104
  const patterns: string[] = [CODE128_PATTERNS[104]]
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i) - 32
    if (charCode >= 0 && charCode <= 95) {
      patterns.push(CODE128_PATTERNS[charCode])
      checksum += charCode * (i + 1)
    }
  }
  patterns.push(CODE128_PATTERNS[checksum % 103])
  patterns.push(CODE128_PATTERNS[106]) // STOP
  
  const fullSequence = patterns.join("")
  let x = 0
  const bars: string[] = []
  for (let i = 0; i < fullSequence.length; i++) {
    const width = parseInt(fullSequence[i], 10) || 1
    if (i % 2 === 0) {
      bars.push(`<rect x="${x}" y="0" width="${width}" height="24" fill="#000" />`)
    }
    x += width
  }
  return `<svg viewBox="0 0 ${x} 24" preserveAspectRatio="none" style="width: 100%; height: 16px; display: block;">${bars.join("")}</svg>`
}

type Origen = "productos" | "proveedor" | "recepcion" | "categoria"
type TipoImpresora = "pantum_rollo" | "zebra_zpl"
type JerarquiaPrecio = "minorista_gigante" | "mayorista_gigante" | "doble_destacado"

interface PriceScaleTier {
  min_qty: number
  precio_unitario: number
}

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
  categoria_nombre?: string
  escalas?: PriceScaleTier[]
}

const DEFAULT_CAMPOS = {
  mostrar_nombre: true,
  mostrar_precio: true,
  mostrar_escalas: true,
  jerarquia_precio: "minorista_gigante" as JerarquiaPrecio,
  mostrar_costo: false,
  mostrar_barcode: true,
  mostrar_sku: false,
  mostrar_proveedor: false,
  mostrar_fecha: false,
  mostrar_encabezado: true,
  texto_encabezado: "EXTRA SUPERMERCADO",
  fuente_tamano_nombre: 8,
  fuente_tamano_precio: 14,
  fuente_tamano_escala: 8,
}

const MM_TO_PX = 3.7795

// ── CELDA DE PREVIEW REALISTA DE ALTA FIDELIDAD ─────────────────────────────
function LabelPreviewCell({
  item,
  campos,
  anchoMm,
  altoMm,
  scale = 3.5,
  showRuler = false,
}: {
  item: ResolvedItem
  campos: typeof DEFAULT_CAMPOS
  anchoMm: number
  altoMm: number
  scale?: number
  showRuler?: boolean
}) {
  const anchoPx = anchoMm * MM_TO_PX
  const altoPx = altoMm * MM_TO_PX

  const escalaMayorista = item.escalas && item.escalas.length > 0 ? item.escalas[0] : null
  const escalaFardo = item.escalas && item.escalas.length > 1 ? item.escalas[1] : null

  return (
    <div className="relative flex flex-col items-center">
      {/* Cotas / Regla Milimétrica Superior */}
      {showRuler && (
        <div
          className="flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400 mb-1 px-1 border-b border-dashed border-slate-300 dark:border-slate-700"
          style={{ width: anchoPx * scale }}
        >
          <span>0mm</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">{anchoMm} mm</span>
        </div>
      )}

      <div
        className="shrink-0 relative rounded-lg shadow-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-white"
        style={{
          width: anchoPx * scale,
          height: altoPx * scale,
        }}
      >
        <div
          className="bg-white flex flex-col justify-between items-center text-slate-900 select-none h-full"
          style={{
            width: anchoPx,
            height: altoPx,
            padding: "2.5px 3px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Encabezado de Fantasía */}
          {campos.mostrar_encabezado && (
            <div className="w-full text-center tracking-wider text-slate-900 border-b border-black pb-0.5 uppercase" style={{ fontSize: 5.5, fontWeight: 900 }}>
              {campos.texto_encabezado || "EXTRA SUPERMERCADO"}
            </div>
          )}

          {/* Nombre del Producto */}
          {campos.mostrar_nombre && (
            <div
              className="text-center w-full leading-tight font-black uppercase text-black line-clamp-2 px-0.5 mt-0.5"
              style={{ fontSize: campos.fuente_tamano_nombre, lineHeight: "1.05" }}
            >
              {item.nombre}
            </div>
          )}

          {/* Metadata secundaria (SKU / Proveedor / Fecha) */}
          <div className="flex items-center justify-between w-full px-1 text-slate-700" style={{ fontSize: 5, fontWeight: 600 }}>
            {campos.mostrar_sku && item.sku && <span>SKU: {item.sku}</span>}
            {campos.mostrar_proveedor && item.proveedor_nombre && (
              <span className="truncate max-w-[70px]">{item.proveedor_nombre}</span>
            )}
            {campos.mostrar_fecha && <span>{item.fecha || new Date().toISOString().slice(0, 10)}</span>}
          </div>

          {/* Código de Barras Vectorial Nativo */}
          {campos.mostrar_barcode && item.codigo_barra && (
            <div className="w-full flex flex-col items-center justify-center my-0.5 overflow-hidden">
              <div
                className="w-full flex justify-center px-1"
                dangerouslySetInnerHTML={{ __html: renderCode128Svg(item.codigo_barra) }}
              />
              <div className="font-mono text-center tracking-widest text-black" style={{ fontSize: 5.5, fontWeight: 700 }}>
                {item.codigo_barra}
              </div>
            </div>
          )}

          {/* ── BLOQUE DE PRECIOS CON ESCALAS CONFIGURABLES ────────────────────── */}
          {campos.mostrar_precio && (
            <div className="w-full mt-auto space-y-0.5">
              {/* CASO 1: MINORISTA GIGANTE (Mayorista abajo en badge más chico) */}
              {campos.jerarquia_precio === "minorista_gigante" && (
                <>
                  <div className="w-full bg-slate-900 text-white rounded-[2px] py-0.5 text-center flex items-center justify-center gap-1 shadow-xs">
                    <span style={{ fontSize: 5.5, fontWeight: 700 }}>Gs.</span>
                    <span className="font-black tracking-tight" style={{ fontSize: campos.fuente_tamano_precio }}>
                      {formatPYG(item.precio_venta).replace("₲", "").trim()}
                    </span>
                    <span style={{ fontSize: 5, fontWeight: 600 }} className="text-slate-300">/un</span>
                  </div>

                  {campos.mostrar_escalas && escalaMayorista && (
                    <div className="w-full bg-amber-100 border border-amber-400 text-amber-950 rounded-[2px] px-1 py-0.2 flex items-center justify-between text-center font-black" style={{ fontSize: campos.fuente_tamano_escala }}>
                      <span className="font-bold uppercase text-[5px]">Llevando {escalaMayorista.min_qty}+:</span>
                      <span>{formatPYG(escalaMayorista.precio_unitario)} c/u</span>
                    </div>
                  )}
                </>
              )}

              {/* CASO 2: MAYORISTA GIGANTE (Para Supermercado Mayorista) */}
              {campos.jerarquia_precio === "mayorista_gigante" && (
                <>
                  <div className="flex items-center justify-between px-1 text-slate-800" style={{ fontSize: 5.5, fontWeight: 700 }}>
                    <span>Minorista (1 un):</span>
                    <span className="font-black">{formatPYG(item.precio_venta)}</span>
                  </div>

                  <div className="w-full bg-amber-500 text-slate-950 rounded-[2px] py-0.5 text-center flex items-center justify-center gap-1 shadow-xs border border-amber-600">
                    <span className="font-black uppercase" style={{ fontSize: 5 }}>MAYORISTA ({escalaMayorista?.min_qty || 3}+):</span>
                    <span className="font-black tracking-tight" style={{ fontSize: campos.fuente_tamano_precio }}>
                      {formatPYG(escalaMayorista ? escalaMayorista.precio_unitario : item.precio_venta * 0.9).replace("₲", "").trim()}
                    </span>
                  </div>
                </>
              )}

              {/* CASO 3: DOBLE PRECIO EQUITATIVO (50 / 50) */}
              {campos.jerarquia_precio === "doble_destacado" && (
                <div className="grid grid-cols-2 gap-1 w-full">
                  <div className="bg-slate-900 text-white rounded-[2px] p-0.5 text-center">
                    <div style={{ fontSize: 4.5 }} className="uppercase text-slate-300 font-bold">1 Unidad</div>
                    <div className="font-black" style={{ fontSize: campos.fuente_tamano_precio * 0.75 }}>
                      {formatPYG(item.precio_venta).replace("₲", "").trim()}
                    </div>
                  </div>
                  <div className="bg-amber-500 text-slate-950 rounded-[2px] p-0.5 text-center border border-amber-600">
                    <div style={{ fontSize: 4.5 }} className="uppercase font-black text-slate-900">
                      {escalaMayorista?.min_qty || 3}+ Unidades
                    </div>
                    <div className="font-black" style={{ fontSize: campos.fuente_tamano_precio * 0.75 }}>
                      {formatPYG(escalaMayorista ? escalaMayorista.precio_unitario : item.precio_venta * 0.9).replace("₲", "").trim()}
                    </div>
                  </div>
                </div>
              )}

              {/* Fardo / Escala 2 adicional si existe */}
              {campos.mostrar_escalas && escalaFardo && (
                <div className="text-[4.5px] text-center font-bold text-slate-600">
                  Pack {escalaFardo.min_qty}+: {formatPYG(escalaFardo.precio_unitario)} c/u
                </div>
              )}
            </div>
          )}

          {/* Costo oculto / referencia */}
          {campos.mostrar_costo && item.costo_unitario != null && (
            <div className="text-[5px] font-mono text-slate-500 text-right w-full pr-1">
              Costo: {formatPYG(item.costo_unitario)}
            </div>
          )}
        </div>
      </div>

      {/* Cota Lateral */}
      {showRuler && (
        <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-1">
          Alto: <span className="font-bold text-amber-600 dark:text-amber-400">{altoMm} mm</span>
        </div>
      )}
    </div>
  )
}

const SAMPLE_ITEM: ResolvedItem = {
  product_id: "sample",
  nombre: "YERBA MATE KURUPÍ MENTA Y LIMÓN 500G",
  sku: "010482",
  codigo_barra: "7840058001887",
  precio_venta: 15000,
  costo_unitario: 9800,
  proveedor_nombre: "SANTA TERESA S.A.",
  fecha: "2026-09-02",
  cantidad: 1,
  categoria_nombre: "Almacén",
  escalas: [
    { min_qty: 3, precio_unitario: 13500 },
    { min_qty: 12, precio_unitario: 12000 },
  ],
}

export default function LabelsPage() {
  const toast = useToast()

  const [origen, setOrigen] = useState<Origen>("productos")
  const [tipoImpresora, setTipoImpresora] = useState<TipoImpresora>("pantum_rollo")
  const [campos, setCampos] = useState(DEFAULT_CAMPOS)
  const [previewScale, setPreviewScale] = useState<number>(3.5)

  // Productos sueltos
  const [productSearch, setProductSearch] = useState("")
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Proveedores, Recepciones, Categorías
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

  // Modal para edición manual de escalas de precio por producto
  const [editingScalesItem, setEditingScalesItem] = useState<ResolvedItem | null>(null)

  useEffect(() => {
    api.purchases.listSuppliers().then(setSuppliers).catch(() => {})
    api.purchases.listReceipts().then((r) => setReceipts(r.slice(0, 40))).catch(() => {})
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

  const runResolve = useCallback(
    async (filtro: Record<string, any>) => {
      setLoadingResolve(true)
      try {
        const resolved = await api.labelPrinting.resolve(filtro)
        setItems(resolved as ResolvedItem[])
        if (!resolved.length) {
          toast.warning("Sin resultados", "No se encontraron productos para los filtros seleccionados.")
        } else {
          toast.success("Cola Cargada", `Se agregaron ${resolved.length} productos con sus escalas de precio.`)
        }
      } catch (e: any) {
        toast.error("Error", "No se pudo resolver la lista de etiquetas.")
      } finally {
        setLoadingResolve(false)
      }
    },
    [toast]
  )

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
    if (q.trim().length < 2) {
      setProductResults([])
      return
    }
    setSearchingProducts(true)
    try {
      const results = await api.products.list({ search: q, limit: 15 })
      setProductResults(results)
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  const addProduct = (p: Product, qty: number = 1) => {
    const precio = Number(p.precio_venta) || 0
    // Generar escala mayorista estándar sugerida si no trae
    const defaultScales: PriceScaleTier[] = [
      { min_qty: 3, precio_unitario: Math.round(precio * 0.9) },
    ]

    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id)
      if (existing) {
        return prev.map((i) => (i.product_id === p.id ? { ...i, cantidad: i.cantidad + qty } : i))
      }
      return [
        ...prev,
        {
          product_id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          codigo_barra: p.codigo_barra,
          precio_venta: precio,
          costo_unitario: Number((p as any).costo_promedio) || undefined,
          cantidad: qty,
          categoria_nombre: (p as any).categoria?.nombre || "General",
          escalas: (p as any).escalas || defaultScales,
        },
      ]
    })
    setProductSearch("")
    setProductResults([])
  }

  const updateCantidad = (productId: string, cantidad: number) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, cantidad: Math.max(1, cantidad) } : i))
    )
  }

  const setFixedQuantityToAll = (qty: number) => {
    setItems((prev) => prev.map((i) => ({ ...i, cantidad: qty })))
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId))
  }

  const clearQueue = () => {
    setItems([])
    toast.info("Cola vaciada", "Se eliminaron todos los productos de la lista.")
  }

  const saveEditedScales = (productId: string, newScales: PriceScaleTier[]) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, escalas: newScales } : i))
    )
    setEditingScalesItem(null)
    toast.success("Escalas actualizadas", "Se aplicaron los nuevos precios por cantidad para este producto.")
  }

  const totalEtiquetas = useMemo(() => items.reduce((sum, i) => sum + i.cantidad, 0), [items])

  // ── IMPRESIÓN PANTUM (Rollo 3 Columnas) ──────────────────────────────────
  const handlePrintPantum = () => {
    if (!items.length) {
      toast.warning("Sin productos", "Agregá al menos un producto antes de imprimir.")
      return
    }
    const anchoMm = printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 33
    const altoMm = printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 22
    const columnas = printerConfig?.columnas || 3
    const anchoTotalMm = anchoMm * columnas

    const celdas: { item: ResolvedItem }[] = []
    items.forEach((item) => {
      for (let i = 0; i < item.cantidad; i++) celdas.push({ item })
    })

    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) {
      toast.error("Error", "El navegador bloqueó la ventana emergente de impresión.")
      return
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Etiquetas — InteliMarket</title>
          <style>
            @page { size: ${anchoTotalMm}mm auto; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; }
            .grid {
              display: grid;
              grid-template-columns: repeat(${columnas}, ${anchoMm}mm);
              width: ${anchoTotalMm}mm;
            }
            .cell {
              width: ${anchoMm}mm;
              height: ${altoMm}mm;
              padding: 2px 2.5px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              overflow: hidden;
              page-break-inside: avoid;
            }
            .header-title {
              font-size: 5.5pt;
              font-weight: 900;
              text-align: center;
              border-bottom: 0.5px solid #000;
              width: 100%;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .prod-name {
              font-size: ${campos.fuente_tamano_nombre}pt;
              font-weight: 800;
              text-align: center;
              line-height: 1.05;
              text-transform: uppercase;
              max-height: 8mm;
              overflow: hidden;
            }
            .barcode-box {
              width: 100%;
              text-align: center;
              margin: 1px 0;
            }
            .barcode-num {
              font-family: monospace;
              font-size: 5.5pt;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .price-pill {
              background: #000;
              color: #fff;
              font-size: ${campos.fuente_tamano_precio}pt;
              font-weight: 900;
              border-radius: 2px;
              width: 100%;
              text-align: center;
              padding: 1px 0;
              line-height: 1;
            }
            .scale-pill {
              background: #fef3c7;
              border: 0.5px solid #d97706;
              color: #78350f;
              font-size: ${campos.fuente_tamano_escala}pt;
              font-weight: 900;
              border-radius: 2px;
              width: 100%;
              display: flex;
              justify-content: space-between;
              padding: 0.5px 2px;
            }
            .meta {
              font-size: 5pt;
              font-weight: 600;
              color: #333;
              display: flex;
              justify-content: space-between;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${celdas
              .map((c) => {
                const esc1 = c.item.escalas && c.item.escalas.length > 0 ? c.item.escalas[0] : null
                return `
              <div class="cell">
                ${campos.mostrar_encabezado ? `<div class="header-title">${campos.texto_encabezado || "EXTRA SUPERMERCADO"}</div>` : ""}
                ${campos.mostrar_nombre ? `<div class="prod-name">${c.item.nombre}</div>` : ""}
                
                <div class="meta">
                  ${campos.mostrar_sku && c.item.sku ? `<span>SKU: ${c.item.sku}</span>` : ""}
                  ${campos.mostrar_fecha ? `<span>${c.item.fecha || new Date().toISOString().slice(0, 10)}</span>` : ""}
                </div>

                ${
                  campos.mostrar_barcode && c.item.codigo_barra
                    ? `
                  <div class="barcode-box">
                    ${renderCode128Svg(c.item.codigo_barra)}
                    <div class="barcode-num">${c.item.codigo_barra}</div>
                  </div>
                `
                    : ""
                }

                ${
                  campos.mostrar_precio
                    ? `
                  <div class="price-pill">
                    <span style="font-size: 5pt; font-weight: 700;">Gs.</span> ${formatPYG(c.item.precio_venta).replace("₲", "").trim()}
                  </div>
                  ${
                    campos.mostrar_escalas && esc1
                      ? `
                    <div class="scale-pill">
                      <span>Llevando ${esc1.min_qty}+:</span>
                      <span>${formatPYG(esc1.precio_unitario)}</span>
                    </div>
                  `
                      : ""
                  }
                `
                    : ""
                }
              </div>
            `
              })
              .join("")}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 250);
            }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  // ── IMPRESIÓN ZEBRA (ZPL Directo por Red) ────────────────────────────────
  const handlePrintZebra = async () => {
    if (!items.length) {
      toast.warning("Sin productos", "Agregá al menos un producto antes de imprimir.")
      return
    }
    setPrinting(true)
    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          nombre: i.nombre,
          sku: i.sku,
          codigo_barra: i.codigo_barra,
          precio_venta: i.precio_venta,
          costo_unitario: i.costo_unitario,
          proveedor_nombre: i.proveedor_nombre,
          cantidad: i.cantidad,
        })),
      }
      const res = await api.labelPrinting.printZebra(payload)
      if (res.enviado_por_red) {
        toast.success("Impresión Enviada", `Se enviaron ${totalEtiquetas} etiquetas ZPL a la impresora Zebra por red.`)
      } else {
        toast.info("Comando ZPL Generado", "Se generó el código ZPL (la impresora no tiene IP de red configurada).")
      }
    } catch (e: any) {
      toast.error("Error al imprimir Zebra", e?.message || "Verifique la conexión con la impresora.")
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 font-sans transition-colors">
      {/* ── HEADER PRINCIPAL INTEGRADO AL DISEÑO DEL ERP ───────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shadow-xs">
              <Tags className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-posDisplay">
                  Impresión de Etiquetas & Góndola
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  Precios & Escalas Mayoristas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configuración visual de precios escalonados (minorista / mayorista / fardo), código de barras y formato de rollo.
              </p>
            </div>
          </div>

          {/* KPI Mini-Cards Coherentes con el ERP */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Productos</div>
                <div className="text-base font-black font-posMono text-slate-900 dark:text-white">{items.length}</div>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Barcode className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Total Etiquetas</div>
                <div className="text-base font-black font-posMono text-amber-600 dark:text-amber-400">{totalEtiquetas}</div>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Formato</div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  {tipoImpresora === "pantum_rollo" ? "Pantum 3-Col (33×22)" : "Zebra Góndola (50×30)"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL: 2 COLUMNAS ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: ORIGEN Y CONTROL DE PRECIOS/JERARQUÍA (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Selector de Origen */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-posDisplay">
                  1. Selección de Productos
                </h2>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Buscar / Filtrar</span>
            </div>

            {/* Segmented Switch de Origen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
              {[
                { id: "productos", label: "Manual", icon: Search },
                { id: "recepcion", label: "Recepción", icon: FileText },
                { id: "proveedor", label: "Proveedor", icon: Truck },
                { id: "categoria", label: "Categoría", icon: Layers },
              ].map((tab) => {
                const Icon = tab.icon
                const active = origen === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setOrigen(tab.id as Origen)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Búsqueda Manual */}
            {origen === "productos" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => searchProducts(e.target.value)}
                    placeholder="Buscar por código de barras, SKU o nombre..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                  />
                  {searchingProducts && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />
                  )}
                </div>

                {/* Dropdown de Resultados */}
                {productResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-lg">
                    {productResults.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.nombre}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                              {p.sku || "Sin SKU"}
                            </span>
                            {p.codigo_barra && <span>{p.codigo_barra}</span>}
                            <span className="font-bold text-amber-600 dark:text-amber-400 ml-auto font-posMono text-xs">
                              {formatPYG(p.precio_venta)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => addProduct(p, 1)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> 1
                          </button>
                          <button
                            onClick={() => addProduct(p, 10)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recepción de Mercadería */}
            {origen === "recepcion" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                  Recepción de Compra:
                </label>
                <select
                  value={selectedReceiptId}
                  onChange={(e) => setSelectedReceiptId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Elegí una recepción reciente...</option>
                  {receipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.numero} · {r.supplier?.razon_social || r.proveedor_ref || "Proveedor"} ({r.fecha ? r.fecha.slice(0, 10) : ""})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Proveedor */}
            {origen === "proveedor" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                  Proveedor:
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Elegí un proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razon_social} ({s.ruc || "Sin RUC"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Categoría */}
            {origen === "categoria" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                  Categoría:
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Elegí una categoría...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loadingResolve && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando productos y escalas...
              </div>
            )}
          </div>

          {/* Card: Control de Escalas y Jerarquía de Precios (NUEVO) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-500" />
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-posDisplay">
                  2. Jerarquía de Precios en Góndola
                </h2>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Escalas & Tamaños</span>
            </div>

            {/* Selector de Jerarquía Visual */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                ¿Qué precio destacar en tamaño Gigante?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: "minorista_gigante",
                    title: "Minorista Gigante",
                    desc: "1 un. Grande + Mayorista compacto",
                  },
                  {
                    id: "mayorista_gigante",
                    title: "Mayorista Gigante",
                    desc: "x3+ Grande + Minorista chico",
                  },
                  {
                    id: "doble_destacado",
                    title: "Doble Precio",
                    desc: "50% Minorista / 50% Mayorista",
                  },
                ].map((tier) => {
                  const active = campos.jerarquia_precio === tier.id
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setCampos((c) => ({ ...c, jerarquia_precio: tier.id as JerarquiaPrecio }))}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        active
                          ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-slate-900 dark:text-white"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{tier.title}</span>
                        {active && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{tier.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sliders de Tamaño de Fuente */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                  Precio Ppal ({campos.fuente_tamano_precio}pt)
                </label>
                <input
                  type="range"
                  min={10}
                  max={24}
                  step={1}
                  value={campos.fuente_tamano_precio}
                  onChange={(e) => setCampos((c) => ({ ...c, fuente_tamano_precio: parseInt(e.target.value, 10) }))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                  Escala ({campos.fuente_tamano_escala}pt)
                </label>
                <input
                  type="range"
                  min={6}
                  max={14}
                  step={0.5}
                  value={campos.fuente_tamano_escala}
                  onChange={(e) => setCampos((c) => ({ ...c, fuente_tamano_escala: parseFloat(e.target.value) }))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                  Nombre ({campos.fuente_tamano_nombre}pt)
                </label>
                <input
                  type="range"
                  min={6}
                  max={12}
                  step={0.5}
                  value={campos.fuente_tamano_nombre}
                  onChange={(e) => setCampos((c) => ({ ...c, fuente_tamano_nombre: parseFloat(e.target.value) }))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles de Campos Visibles */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                Elementos en la Etiqueta:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: "mostrar_escalas", label: "Precios por Escala" },
                  { key: "mostrar_encabezado", label: "Logo / Encabezado" },
                  { key: "mostrar_barcode", label: "Código de Barras" },
                  { key: "mostrar_sku", label: "Código SKU" },
                  { key: "mostrar_fecha", label: "Fecha de Emisión" },
                  { key: "mostrar_costo", label: "Costo Oculto" },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer ${
                      (campos as any)[key]
                        ? "bg-amber-50/50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-slate-900 dark:text-white font-bold"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(campos as any)[key]}
                      onChange={(e) => setCampos((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded accent-amber-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] truncate">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Selector de Impresora */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block mb-2">
                Hardware de Salida:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoImpresora("pantum_rollo")}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    tipoImpresora === "pantum_rollo"
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-slate-900 dark:text-white"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="font-bold text-xs">Pantum (Rollo)</div>
                  <div className="text-[10px] text-slate-500">3 Columnas · 33×22 mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoImpresora("zebra_zpl")}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    tipoImpresora === "zebra_zpl"
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-slate-900 dark:text-white"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="font-bold text-xs">Zebra Góndola</div>
                  <div className="text-[10px] text-slate-500">1 Columna · 50×30 mm (ZPL)</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: COLA DE IMPRESIÓN Y PREVIEW INTERACTIVO (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Visor de Simulación Térmica en Vivo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-posDisplay">
                  Simulador en Vivo de la Etiqueta
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {tipoImpresora === "pantum_rollo" ? "33×22 mm (x3 Col)" : "50×30 mm (Zebra)"}
                </span>
                <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
                  {[2.5, 3.5, 4.5].map((z) => (
                    <button
                      key={z}
                      onClick={() => setPreviewScale(z)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                        previewScale === z
                          ? "bg-amber-500 text-white dark:text-slate-950"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vista del Mockup Térmico */}
            <div className="p-6 rounded-2xl bg-slate-100/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-x-auto min-h-[190px]">
              <div className="flex items-center gap-4">
                {tipoImpresora === "pantum_rollo" ? (
                  <div className="flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <LabelPreviewCell
                      item={items[0] || SAMPLE_ITEM}
                      campos={campos}
                      anchoMm={printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 33}
                      altoMm={printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 22}
                      scale={previewScale}
                      showRuler
                    />
                    <LabelPreviewCell
                      item={items[1] || items[0] || SAMPLE_ITEM}
                      campos={campos}
                      anchoMm={printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 33}
                      altoMm={printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 22}
                      scale={previewScale}
                    />
                    <LabelPreviewCell
                      item={items[2] || items[0] || SAMPLE_ITEM}
                      campos={campos}
                      anchoMm={printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 33}
                      altoMm={printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 22}
                      scale={previewScale}
                    />
                  </div>
                ) : (
                  <LabelPreviewCell
                    item={items[0] || SAMPLE_ITEM}
                    campos={campos}
                    anchoMm={printerConfig?.ancho_mm ? Number(printerConfig.ancho_mm) : 50}
                    altoMm={printerConfig?.alto_mm ? Number(printerConfig.alto_mm) : 30}
                    scale={previewScale}
                    showRuler
                  />
                )}
              </div>
            </div>
          </div>

          {/* Card: Tabla de Cola de Impresión */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-amber-500" />
                  <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-posDisplay">
                    Cola de Impresión ({items.length} productos · {totalEtiquetas} etiquetas)
                  </h2>
                </div>
              </div>

              {items.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFixedQuantityToAll(1)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Todos x1
                  </button>
                  <button
                    onClick={() => setFixedQuantityToAll(10)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Todos x10
                  </button>
                  <button
                    onClick={clearQueue}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Vaciar
                  </button>
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 text-slate-400 flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-800">
                  <Tags className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">La cola de etiquetas está vacía</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Buscá productos manualmente a la izquierda o seleccioná una recepción para cargar la lista de góndola.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-right">Precio Minorista</th>
                      <th className="p-3 text-center">Escalas Mayoristas</th>
                      <th className="p-3 text-center">Cant. Etiquetas</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {items.map((item) => (
                      <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{item.nombre}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>{item.sku || "Sin SKU"}</span>
                            {item.codigo_barra && <span>· {item.codigo_barra}</span>}
                          </div>
                        </td>

                        <td className="p-3 text-right font-posMono font-black text-slate-900 dark:text-white">
                          {formatPYG(item.precio_venta)}
                        </td>

                        <td className="p-3 text-center">
                          {item.escalas && item.escalas.length > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {item.escalas.map((sc, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/20"
                                >
                                  {sc.min_qty}+ un: {formatPYG(sc.precio_unitario)}
                                </span>
                              ))}
                              <button
                                onClick={() => setEditingScalesItem(item)}
                                className="text-[9px] text-slate-400 hover:text-amber-600 underline cursor-pointer mt-0.5"
                              >
                                Modificar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingScalesItem(item)}
                              className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition cursor-pointer"
                            >
                              + Agregar Escala
                            </button>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => updateCantidad(item.product_id, item.cantidad - 1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) => updateCantidad(item.product_id, parseInt(e.target.value, 10) || 1)}
                              className="w-12 py-1 text-center font-posMono font-black bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                            <button
                              onClick={() => updateCantidad(item.product_id, item.cantidad + 1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-black cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* BOTÓN MAESTRO DE IMPRESIÓN */}
            <div className="pt-2">
              <button
                type="button"
                onClick={tipoImpresora === "pantum_rollo" ? handlePrintPantum : handlePrintZebra}
                disabled={printing || items.length === 0}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm font-posDisplay flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg disabled:opacity-40 bg-amber-500 hover:bg-amber-600 text-slate-950 active:scale-[0.99]"
              >
                {printing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Enviando comandos a la impresora...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span>
                      IMPRIMIR {totalEtiquetas > 0 ? `${totalEtiquetas} ETIQUETAS` : "LOTE"}{" "}
                      {tipoImpresora === "pantum_rollo" ? "(PANTUM ROLLO)" : "(ZEBRA ZPL)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL PARA EDITAR ESCALAS DE PRECIO POR PRODUCTO ─────────────────── */}
      {editingScalesItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white font-posDisplay">
                  Configurar Escalas de Precio
                </h3>
              </div>
              <button
                onClick={() => setEditingScalesItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="font-bold text-xs text-slate-900 dark:text-white">{editingScalesItem.nombre}</div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Precio Minorista (x1 un): <span className="font-bold text-slate-800 dark:text-slate-200">{formatPYG(editingScalesItem.precio_venta)}</span>
              </div>
            </div>

            {/* Formulario de Escalas */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as any
                const qty1 = parseInt(form.qty1.value, 10) || 3
                const price1 = parseInt(form.price1.value.replace(/\D/g, ""), 10) || 0
                const qty2 = parseInt(form.qty2.value, 10) || 0
                const price2 = parseInt(form.price2.value.replace(/\D/g, ""), 10) || 0

                const newScales: PriceScaleTier[] = []
                if (price1 > 0) newScales.push({ min_qty: qty1, precio_unitario: price1 })
                if (price2 > 0 && qty2 > 0) newScales.push({ min_qty: qty2, precio_unitario: price2 })

                saveEditedScales(editingScalesItem.product_id, newScales)
              }}
              className="space-y-4"
            >
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-3">
                <div className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
                  Escala Mayorista 1 (Pack / Lote)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1">A partir de (unidades):</label>
                    <input
                      name="qty1"
                      type="number"
                      min={2}
                      defaultValue={editingScalesItem.escalas?.[0]?.min_qty || 3}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1">Precio Unitario (Gs):</label>
                    <input
                      name="price1"
                      type="text"
                      defaultValue={editingScalesItem.escalas?.[0]?.precio_unitario || Math.round(editingScalesItem.precio_venta * 0.9)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold font-posMono text-slate-900 dark:text-white text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                  Escala Mayorista 2 (Fardo / Caja Completa - Opcional)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1">A partir de (unidades):</label>
                    <input
                      name="qty2"
                      type="number"
                      min={4}
                      defaultValue={editingScalesItem.escalas?.[1]?.min_qty || 12}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1">Precio Unitario (Gs):</label>
                    <input
                      name="price2"
                      type="text"
                      defaultValue={editingScalesItem.escalas?.[1]?.precio_unitario || ""}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold font-posMono text-slate-900 dark:text-white text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingScalesItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md cursor-pointer"
                >
                  Guardar Escalas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
