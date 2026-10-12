import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Gift, X, Plus, Minus, Trash2, Check, Copy, AlertTriangle, ShieldAlert,
  Sparkles, Layers, Package, Barcode, DollarSign, Percent, TrendingUp,
  Box, Info, Search, RefreshCw, Lock, CheckCircle2, ArrowRight, Zap,
  Calculator, Receipt
} from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export interface KitModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  kitToEdit?: any | null
  allProducts: Product[]
}

interface ComponentRow {
  product_id: string
  nombre: string
  sku: string
  codigo_barra?: string
  iva_tasa: number
  stock_actual: number
  cantidad: number
  costo_unitario: number
  precio_unitario: number
}

function generateRetailEan13(): string {
  const core = `28${Math.floor(Date.now() % 100000000).toString().padStart(8, "0")}${Math.floor(Math.random() * 90 + 10)}`
  let sumOdd = 0
  let sumEven = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10)
    if (i % 2 === 0) {
      sumOdd += digit
    } else {
      sumEven += digit * 3
    }
  }
  const check = (10 - ((sumOdd + sumEven) % 10)) % 10
  return `${core}${check}`
}

function generateKitSku(): string {
  return `KIT-${Math.floor(1000 + Math.random() * 9000)}`
}

export default function KitModal({
  open,
  onClose,
  onSuccess,
  kitToEdit,
  allProducts,
}: KitModalProps) {
  const toast = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 1. Estados principales del formulario
  const [modalidad, setModalidad] = useState<"item_unico" | "desglosado">("item_unico")
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [codigoBarra, setCodigoBarra] = useState("")
  const [sku, setSku] = useState("")
  const [precioVenta, setPrecioVenta] = useState<number>(0)
  const [items, setItems] = useState<ComponentRow[]>([])

  // 2. Buscador y agregado de componentes
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addQty, setAddQty] = useState<number>(1)
  const [copiedCode, setCopiedCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allowBelowCost, setAllowBelowCost] = useState(false)

  // Inicialización (Creación vs Edición)
  useEffect(() => {
    if (!open) return

    if (kitToEdit) {
      setModalidad(kitToEdit.modalidad_facturacion || "item_unico")
      setNombre(kitToEdit.nombre || "")
      setDescripcion(kitToEdit.descripcion || "")
      setCodigoBarra(kitToEdit.codigo_barra || "")
      setSku(kitToEdit.sku || "")
      setPrecioVenta(Number(kitToEdit.precio_venta || 0))

      // Mapear items existentes
      const loadedItems: ComponentRow[] = (kitToEdit.items || []).map((it: any) => {
        const prod = allProducts.find(p => p.id === it.product_id)
        return {
          product_id: it.product_id,
          nombre: it.nombre || prod?.nombre || "Producto",
          sku: it.sku || prod?.sku || "—",
          codigo_barra: it.codigo_barra || prod?.codigo_barra,
          iva_tasa: Number(it.iva_tasa !== undefined ? it.iva_tasa : prod?.iva_tasa ?? 10),
          stock_actual: Number(it.stock_actual !== undefined ? it.stock_actual : (prod as any)?.stock_actual ?? 0),
          cantidad: Number(it.cantidad || 1),
          costo_unitario: Number(it.costo_unitario !== undefined ? it.costo_unitario : prod?.costo_promedio ?? 0),
          precio_unitario: Number(it.precio_unitario !== undefined ? it.precio_unitario : prod?.precio_venta ?? 0),
        }
      })
      setItems(loadedItems)
    } else {
      // Nuevo Kit: Valores predeterminados sugeridos
      setModalidad("item_unico")
      setNombre("")
      setDescripcion("")
      setCodigoBarra(generateRetailEan13())
      setSku(generateKitSku())
      setPrecioVenta(0)
      setItems([])
    }
    setSearchQuery("")
    setSelectedProduct(null)
    setAddQty(1)
    setAllowBelowCost(false)
  }, [open, kitToEdit, allProducts])

  // Filtrado de productos para agregar
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return allProducts
      .filter(p => {
        const n = (p.nombre || "").toLowerCase()
        const s = (p.sku || "").toLowerCase()
        const b = (p.codigo_barra || "").toLowerCase()
        return n.includes(q) || s.includes(q) || b.includes(q)
      })
      .slice(0, 15)
  }, [searchQuery, allProducts])

  // Agregar componente al combo
  const handleAddComponent = (prodToAdd?: Product) => {
    const p = prodToAdd || selectedProduct
    if (!p) return

    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.product_id === p.id)
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx].cantidad += addQty
        return updated
      }
      return [
        ...prev,
        {
          product_id: p.id,
          nombre: p.nombre,
          sku: p.sku || "—",
          codigo_barra: p.codigo_barra,
          iva_tasa: Number(p.iva_tasa ?? 10),
          stock_actual: Number((p as any)?.stock_actual ?? 0),
          cantidad: addQty,
          costo_unitario: Number(p.costo_promedio || p.ultimo_costo || 0),
          precio_unitario: Number(p.precio_venta || 0),
        }
      ]
    })

    setSelectedProduct(null)
    setSearchQuery("")
    setAddQty(1)
    if (searchInputRef.current) searchInputRef.current.focus()
  }

  // Soporte directo para pistola lectora en el buscador
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const clean = searchQuery.trim()
      if (!clean) return

      // Buscar coincidencia exacta por código de barra o SKU
      const exactMatch = allProducts.find(
        p => (p.codigo_barra && p.codigo_barra.trim() === clean) || (p.sku && p.sku.trim() === clean)
      )
      if (exactMatch) {
        handleAddComponent(exactMatch)
        toast.success("Producto escaneado", exactMatch.nombre)
        return
      }

      // Si no es exacto pero hay 1 solo resultado
      if (searchResults.length === 1) {
        handleAddComponent(searchResults[0])
        return
      }
    }
  }

  const handleUpdateQty = (idx: number, delta: number) => {
    setItems(prev => {
      const copy = [...prev]
      const newQty = copy[idx].cantidad + delta
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== idx)
      }
      copy[idx].cantidad = newQty
      return copy
    })
  }

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Cálculos financieros en vivo
  const totalCostoAcumulado = items.reduce((sum, i) => sum + i.costo_unitario * i.cantidad, 0)
  const totalPVPIndividual = items.reduce((sum, i) => sum + i.precio_unitario * i.cantidad, 0)
  const margenMonto = precioVenta - totalCostoAcumulado
  const margenPct = precioVenta > 0 ? (margenMonto / precioVenta) * 100 : 0
  const ahorroCliente = Math.max(0, totalPVPIndividual - precioVenta)
  const descuentoPct = totalPVPIndividual > 0 && ahorroCliente > 0 ? (ahorroCliente / totalPVPIndividual) * 100 : 0

  // Alerta de dumping (precio por debajo del costo de adquisición)
  const isDumping = precioVenta > 0 && precioVenta < totalCostoAcumulado

  // Cuello de botella y stock potencial
  const { stockPotencial, cuelloBotella } = useMemo(() => {
    if (items.length === 0) return { stockPotencial: 0, cuelloBotella: null }
    let minStock = 999999
    let bottleneckItem: ComponentRow | null = null

    for (const item of items) {
      const itemQty = item.cantidad > 0 ? item.cantidad : 1
      const pot = Math.floor(item.stock_actual / itemQty)
      if (pot < minStock) {
        minStock = pot
        bottleneckItem = item
      }
    }

    return {
      stockPotencial: minStock === 999999 ? 0 : Math.max(0, minStock),
      cuelloBotella: bottleneckItem?.nombre || null,
    }
  }, [items])

  // Presets de margen rápido
  const applyMarginPreset = (targetPct: number) => {
    if (totalCostoAcumulado <= 0) {
      toast.warning("Sin costo", "Agregue componentes antes de calcular el margen.")
      return
    }
    const suggested = Math.round(totalCostoAcumulado / (1 - targetPct / 100))
    const rounded = Math.ceil(suggested / 100) * 100
    setPrecioVenta(rounded)
    toast.success(`Margen fijado al ${targetPct}%`, `Precio sugerido: ${formatPYG(rounded)}`)
  }

  // Copiar código al portapapeles
  const handleCopyBarcode = () => {
    if (!codigoBarra) return
    navigator.clipboard.writeText(codigoBarra)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success("Código copiado", codigoBarra)
  }

  // Guardar Kit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre.trim()) {
      toast.error("Nombre requerido", "Debe ingresar el nombre del combo.")
      return
    }
    if (items.length < 2) {
      toast.error("Componentes insuficientes", "Un kit debe tener al menos 2 artículos componentes.")
      return
    }
    if (precioVenta <= 0) {
      toast.error("Precio inválido", "El precio de venta del kit debe ser mayor a 0.")
      return
    }
    if (isDumping && !allowBelowCost) {
      toast.error(
        "Precio por debajo del costo",
        "El precio está por debajo del costo acumulado. Marque la casilla de confirmación para forzar la venta a pérdida."
      )
      return
    }

    setSaving(true)
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        modalidad_facturacion: modalidad,
        codigo_barra: codigoBarra.trim() || undefined,
        sku: sku.trim() || undefined,
        precio_venta: precioVenta,
        items: items.map(i => ({
          product_id: i.product_id,
          cantidad: i.cantidad,
        })),
      }

      if (kitToEdit) {
        await api.kits.update(kitToEdit.id, payload)
        toast.success("Combo actualizado", `${nombre} se modificó correctamente.`)
      } else {
        await api.kits.create(payload)
        toast.success("Combo creado", `${nombre} listo para facturar en caja con modalidad ${modalidad === "item_unico" ? "Ítem Único" : "Desglosado"}.`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Error al guardar kit", err.message || "Ocurrió un error inesperado.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* CABECERA DECK DE CONTROL */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-widest text-purple-300 uppercase bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  RETAIL SUPERMERCADO · COMBOS DNIT
                </span>
                <span className="text-[10px] text-slate-300 font-mono">
                  {kitToEdit ? "Modo Edición" : "Alta Nuevo Combo"}
                </span>
              </div>
              <h2 className="text-lg font-black text-white">
                {kitToEdit ? `Editar Combo: ${kitToEdit.nombre}` : "Constructor de Kits & Combos Promocionales"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO CON SCROLL */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* PASO 1: SELECCIÓN DE MODALIDAD FISCAL (DNIT PARAGUAY) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-purple-500" />
                Modalidad de Facturación e Impacto de IVA (DNIT) *
              </label>
              <span className="text-[11px] text-slate-400">
                Determina cómo se procesa el ticket en caja y la deducción de impuestos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Opción 1: Ítem Único (IVA 10%) */}
              <div
                onClick={() => setModalidad("item_unico")}
                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  modalidad === "item_unico"
                    ? "bg-purple-50/50 dark:bg-purple-950/30 border-purple-600 shadow-md shadow-purple-500/10 ring-1 ring-purple-600/30"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${modalidad === "item_unico" ? "bg-purple-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        Ítem Único (IVA 10% Fija)
                      </h4>
                      {modalidad === "item_unico" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Seleccionado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      En el ticket de caja y factura electrónica sale <strong className="text-purple-600 dark:text-purple-400">1 sola línea</strong> con el nombre del combo y tasa fija IVA 10% (norma DNIT para canastas y packs comerciales).
                    </p>
                    <div className="pt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                      <Zap className="w-3 h-3" />
                      Deducción automática de stock de los componentes al vender.
                    </div>
                  </div>
                </div>
              </div>

              {/* Opción 2: Desglosado en Factura */}
              <div
                onClick={() => setModalidad("desglosado")}
                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  modalidad === "desglosado"
                    ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-600 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-600/30"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${modalidad === "desglosado" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        Desglosado en Factura (IVA por Producto)
                      </h4>
                      {modalidad === "desglosado" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Seleccionado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Al escanear el combo en caja, <strong className="text-emerald-600 dark:text-emerald-400">se agregan todos los productos componentes</strong> con su tasa original de IVA (5%, 10% o Exenta) y un descuento prorrateado proporcional.
                    </p>
                    <div className="pt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Receipt className="w-3 h-3" />
                      Total de factura coincide exactamente con el precio de oferta del combo.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PASO 2: DATOS DEL COMBO Y CÓDIGO DE BARRAS */}
          <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Nombre */}
              <div className="md:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Nombre Comercial del Combo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Combo Parrillero Completo Fin de Semana"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Código de Barras Retail */}
              <div className="md:col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-purple-500" />
                    Código EAN-13 (Caja POS) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCodigoBarra(generateRetailEan13())}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Generar Prefijo 28
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="2800000000000"
                    value={codigoBarra}
                    onChange={e => setCodigoBarra(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    className="absolute right-2 p-1 text-slate-400 hover:text-purple-600"
                    title="Copiar código de barras"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* SKU */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  SKU
                </label>
                <input
                  type="text"
                  placeholder="KIT-0001"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Descripción */}
              <div className="md:col-span-12 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Descripción / Observaciones Comerciales
                </label>
                <input
                  type="text"
                  placeholder="Ej: Incluye 2kg de asado de primera, 1 carbón 5kg y 1 gaseosa 2L. Promoción válida hasta agotar stock."
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* PASO 3: BUSCADOR & AGREGADO RÁPIDO DE COMPONENTES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-500" />
                Componentes del Combo ({items.length} artículos agregados) *
              </label>
              <span className="text-[11px] text-slate-400">
                Pistola lectora activa: escanee el código de barras y presione Enter
              </span>
            </div>

            {/* Barra de Búsqueda Rápida */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Escanear código de barras o buscar por nombre / SKU..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Cant:</span>
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 text-center bg-transparent font-mono font-bold text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAddComponent()}
                  disabled={!selectedProduct && searchResults.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>

              {/* Dropdown de Resultados de Búsqueda */}
              {searchQuery && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddComponent(prod)}
                      className="p-3 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer flex items-center justify-between transition text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{prod.nombre}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded font-mono ${
                            prod.iva_tasa === 5 ? "bg-emerald-100 text-emerald-700" :
                            prod.iva_tasa === 0 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            IVA {prod.iva_tasa ?? 10}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                          <span>SKU: {prod.sku || "—"}</span>
                          <span>EAN: {prod.codigo_barra || "—"}</span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            Stock: {(prod as any)?.stock_actual ?? 0} un.
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          PVP: {formatPYG(prod.precio_venta)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Costo: {formatPYG(prod.costo_promedio || prod.ultimo_costo || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TABLA DETALLADA DE COMPONENTES */}
            {items.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                <Box className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-bold text-slate-500">Ningún componente agregado al combo aún</p>
                <p className="text-[11px]">
                  Use el buscador arriba o escanee los códigos con su pistola lectora para confeccionar el combo.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Artículo Componente</th>
                      <th className="p-3 text-center">IVA</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3 text-right">Costo Unit.</th>
                      <th className="p-3 text-right">PVP Normal</th>
                      <th className="p-3 text-center">Cant.</th>
                      {modalidad === "desglosado" && (
                        <th className="p-3 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                          PVP Factura
                        </th>
                      )}
                      <th className="p-3 text-right">Subtotal Costo</th>
                      <th className="p-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const factorDesc = totalPVPIndividual > 0 && precioVenta < totalPVPIndividual
                        ? precioVenta / totalPVPIndividual
                        : 1.0
                      const pvpFacturado = Math.round(it.precio_unitario * factorDesc)

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850 transition">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{it.nombre}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                              <span>SKU: {it.sku}</span>
                              {it.codigo_barra && <span>EAN: {it.codigo_barra}</span>}
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                              it.iva_tasa === 5 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300" :
                              it.iva_tasa === 0 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300" :
                              "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                            }`}>
                              {it.iva_tasa === 0 ? "EXENTA" : `${it.iva_tasa}%`}
                            </span>
                          </td>

                          <td className="p-3 text-right font-mono">
                            <span className={it.stock_actual < it.cantidad ? "text-rose-500 font-bold" : "text-slate-600 dark:text-slate-300"}>
                              {it.stock_actual}
                            </span>
                          </td>

                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatPYG(it.costo_unitario)}
                          </td>

                          <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">
                            {formatPYG(it.precio_unitario)}
                          </td>

                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, -1)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center font-mono font-black text-xs text-purple-600 dark:text-purple-400">
                                {it.cantidad}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, 1)}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {modalidad === "desglosado" && (
                            <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
                              {formatPYG(pvpFacturado)}
                            </td>
                          )}

                          <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatPYG(it.costo_unitario * it.cantidad)}
                          </td>

                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded transition"
                              title="Eliminar del combo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PASO 4: STOCK POTENCIAL Y CUELLO DE BOTELLA */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stockPotencial > 0 ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border border-rose-500/20"}`}>
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Stock Potencial de Armado</div>
                  <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                    {stockPotencial} {stockPotencial === 1 ? "combo armable" : "combos armables"}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Cuello de Botella de Inventario</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate" title={cuelloBotella || "Sin cuello de botella"}>
                    {cuelloBotella || "Stock balanceado"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 5: PANEL FINANCIERO, FIJACIÓN DE PRECIO & MARGEN */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/40 via-white to-pink-50/30 dark:from-slate-850 dark:via-slate-900 dark:to-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-purple-600" />
                Fijación de Precio de Venta & Rentabilidad Compuesta
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Presets de Margen:</span>
                {[20, 25, 30, 35].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyMarginPreset(pct)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white transition shadow-xs"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Input Grande de Precio Venta */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 space-y-1">
                <label className="text-[11px] font-black uppercase text-purple-700 dark:text-purple-300">
                  Precio Oferta del Combo (₲) *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 font-mono font-black text-purple-600 text-base">₲</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={precioVenta || ""}
                    onChange={e => setPrecioVenta(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-purple-400 dark:border-purple-600 bg-white dark:bg-slate-950 font-mono font-black text-xl text-purple-600 dark:text-purple-400 outline-none focus:ring-4 focus:ring-purple-500/20 shadow-inner"
                  />
                </div>
              </div>

              {/* Indicadores Financieros */}
              <div className="md:col-span-7 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Costo Acumulado</span>
                  <strong className="font-mono text-xs text-slate-800 dark:text-slate-200 block">
                    {formatPYG(totalCostoAcumulado)}
                  </strong>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Suma PVP Sueltos</span>
                  <strong className="font-mono text-xs text-slate-400 line-through block">
                    {formatPYG(totalPVPIndividual)}
                  </strong>
                  {ahorroCliente > 0 && (
                    <span className="text-[9px] font-bold text-emerald-600 block">
                      Ahorro: {descuentoPct.toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className={`p-3 rounded-xl border space-y-0.5 ${
                  margenPct < 0
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-600"
                    : "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                }`}>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Margen Bruto</span>
                  <strong className="font-mono text-xs font-black block">
                    {margenPct.toFixed(1)}% ({formatPYG(margenMonto)})
                  </strong>
                </div>
              </div>
            </div>

            {/* GUARDA ANTI-DUMPING */}
            {isDumping && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-500 text-rose-700 dark:text-rose-300 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="text-xs font-black uppercase">
                    Alerta de Dumping: Venta por debajo del costo de adquisición
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  El precio de venta ({formatPYG(precioVenta)}) es inferior al costo acumulado ({formatPYG(totalCostoAcumulado)}).
                  Está generando una pérdida bruta de <strong className="font-mono">{formatPYG(Math.abs(margenMonto))}</strong> por combo.
                </p>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowBelowCost}
                    onChange={e => setAllowBelowCost(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300"
                  />
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                    Autorizo expresamente la venta a pérdida comercial para este combo.
                  </span>
                </label>
              </div>
            )}
          </div>
        </form>

        {/* FOOTER CON ACCIONES */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (isDumping && !allowBelowCost) || items.length < 2 || precioVenta <= 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-purple-600/25 transition flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Guardando Combo...
              </>
            ) : isDumping && !allowBelowCost ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                Bloqueado por Dumping
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                {kitToEdit ? "Guardar Cambios" : "Crear Combo Promocional"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
