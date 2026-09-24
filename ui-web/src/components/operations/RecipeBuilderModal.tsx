import React, { useState, useEffect, useMemo } from "react"
import {
  ChefHat, X, Plus, Trash2, Loader2, Sparkles, Layers,
  DollarSign, Package, Warehouse as WarehouseIcon, Info,
  Search, Check, AlertCircle, ArrowRight, TrendingUp, Percent
} from "lucide-react"
import { api, type Product, type SupermerRecipe, type SupermerRecipeItem } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface RecipeBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialArea?: string
  recipeToEdit?: SupermerRecipe | null
}

const PRODUCTION_AREAS = [
  { id: "panaderia", label: "Panadería & Confitería", icon: "🥖", color: "amber" },
  { id: "rotiseria", label: "Rotisería & Cocina Caliente", icon: "🍗", color: "orange" },
  { id: "carniceria", label: "Carnicería & Embutidos", icon: "🥩", color: "rose" },
  { id: "verduleria", label: "Verdulería & Frutas Pre-pack", icon: "🥗", color: "emerald" },
  { id: "pre_pack", label: "Fraccionamiento & Pre-pack", icon: "📦", color: "blue" },
  { id: "otros", label: "Otros Procesos", icon: "⚙️", color: "slate" },
]

export default function RecipeBuilderModal({
  isOpen,
  onClose,
  onSuccess,
  initialArea = "panaderia",
  recipeToEdit = null,
}: RecipeBuilderModalProps) {
  const toast = useToast()

  const [loadingInitial, setLoadingInitial] = useState(false)
  const [saving, setSaving] = useState(false)

  // Catalogs
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])

  // Form State
  const [area, setArea] = useState<string>(initialArea)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [productoTerminadoId, setProductoTerminadoId] = useState("")
  const [cantidadEsperada, setCantidadEsperada] = useState<number>(100)
  const [unidadMedida, setUnidadMedida] = useState("UN")
  const [rendimientoEsperado, setRendimientoEsperado] = useState<number>(100)
  const [depositoOrigenId, setDepositoOrigenId] = useState("")
  const [depositoDestinoId, setDepositoDestinoId] = useState("")

  // Ingredients rows
  interface IngredientRow {
    producto_id: string
    producto_nombre: string
    producto_sku: string
    cantidad: number
    unidad_medida: string
    costo_unitario: number
    es_opcional: boolean
  }
  const [items, setItems] = useState<IngredientRow[]>([])

  // Ingredient picker search & add
  const [itemSearch, setItemSearch] = useState("")
  const [selectedIngredientId, setSelectedIngredientId] = useState("")
  const [ingredientQty, setIngredientQty] = useState<number>(1)
  const [ingredientUnit, setIngredientUnit] = useState("KG")

  // Load catalogs on open
  useEffect(() => {
    if (!isOpen) return
    const fetchCatalogs = async () => {
      setLoadingInitial(true)
      try {
        const [prodsRes, whsRes] = await Promise.all([
          api.products.list({ limit: 1000 }),
          api.warehouses.list().catch(() => []),
        ])
        setProducts(prodsRes || [])
        const activeWhs = (whsRes || []).filter((w: any) => w.activo !== false)
        setWarehouses(activeWhs)

        if (recipeToEdit) {
          setArea(recipeToEdit.area || initialArea)
          setNombre(recipeToEdit.nombre || "")
          setDescripcion(recipeToEdit.descripcion || "")
          setProductoTerminadoId(recipeToEdit.producto_terminado_id || "")
          setCantidadEsperada(Number(recipeToEdit.cantidad_esperada || 100))
          setUnidadMedida(recipeToEdit.unidad_medida || "UN")
          setRendimientoEsperado(Number(recipeToEdit.rendimiento_esperado || 100))
          setDepositoOrigenId(recipeToEdit.deposito_origen_id || (activeWhs[0]?.id || ""))
          setDepositoDestinoId(recipeToEdit.deposito_destino_id || (activeWhs[0]?.id || ""))

          if (recipeToEdit.items && recipeToEdit.items.length > 0) {
            setItems(
              recipeToEdit.items.map(it => {
                const prod = (prodsRes || []).find(p => p.id === it.producto_id)
                const cost = Number(it.costo_unitario || prod?.costo_promedio || prod?.ultimo_costo || 0)
                return {
                  producto_id: it.producto_id || "",
                  producto_nombre: it.producto_nombre || prod?.nombre || "Insumo",
                  producto_sku: it.producto_sku || prod?.sku || "",
                  cantidad: Number(it.cantidad || 1),
                  unidad_medida: it.unidad_medida || prod?.unidad_medida || "KG",
                  costo_unitario: cost,
                  es_opcional: !!it.es_opcional,
                }
              })
            )
          } else {
            setItems([])
          }
        } else {
          // Defaults for new recipe
          setArea(initialArea)
          setNombre("")
          setDescripcion("")
          setProductoTerminadoId("")
          setCantidadEsperada(100)
          setUnidadMedida("UN")
          setRendimientoEsperado(100)
          setDepositoOrigenId(activeWhs[0]?.id || "")
          setDepositoDestinoId(activeWhs[0]?.id || "")
          setItems([])
        }
      } catch (err: any) {
        toast.error("Error al cargar catálogos", err.message)
      } finally {
        setLoadingInitial(false)
      }
    }
    fetchCatalogs()
  }, [isOpen, recipeToEdit, initialArea, toast])

  // Finished product details
  const selectedFinishedProduct = useMemo(() => {
    return products.find(p => p.id === productoTerminadoId) || null
  }, [products, productoTerminadoId])

  // Auto-fill recipe name when finished product is selected if name is empty
  const handleSelectFinishedProduct = (prodId: string) => {
    setProductoTerminadoId(prodId)
    const p = products.find(prod => prod.id === prodId)
    if (p) {
      if (!nombre || nombre.trim() === "") {
        setNombre(`Fórmula: ${p.nombre}`)
      }
      if (p.unidad_medida) {
        setUnidadMedida(p.unidad_medida)
      }
    }
  }

  // Filtered raw materials for picker
  const filteredRawMaterials = useMemo(() => {
    if (!itemSearch.trim()) {
      return products
        .filter(p => p.id !== productoTerminadoId)
        .slice(0, 30)
    }
    const q = itemSearch.toLowerCase()
    return products
      .filter(p => p.id !== productoTerminadoId && (
        p.nombre?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.codigo_barra?.toLowerCase().includes(q)
      ))
      .slice(0, 30)
  }, [products, itemSearch, productoTerminadoId])

  // Add ingredient row
  const handleAddIngredient = () => {
    if (!selectedIngredientId) {
      toast.error("Seleccione un insumo", "Debe elegir un producto para agregar a la receta.")
      return
    }
    const prod = products.find(p => p.id === selectedIngredientId)
    if (!prod) return

    const existingIdx = items.findIndex(i => i.producto_id === prod.id)
    const cost = Number(prod.costo_promedio || prod.ultimo_costo || 0)

    if (existingIdx >= 0) {
      const updated = [...items]
      updated[existingIdx].cantidad += Number(ingredientQty || 1)
      setItems(updated)
    } else {
      setItems(prev => [
        ...prev,
        {
          producto_id: prod.id,
          producto_nombre: prod.nombre,
          producto_sku: prod.sku || "",
          cantidad: Number(ingredientQty || 1),
          unidad_medida: ingredientUnit || prod.unidad_medida || "KG",
          costo_unitario: cost,
          es_opcional: false,
        }
      ])
    }

    setSelectedIngredientId("")
    setItemSearch("")
    setIngredientQty(1)
  }

  const handleRemoveIngredient = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleUpdateItemQty = (index: number, qty: number) => {
    setItems(prev => prev.map((item, idx) => idx === index ? { ...item, cantidad: Math.max(0.001, qty) } : item))
  }

  const handleUpdateItemUnit = (index: number, unit: string) => {
    setItems(prev => prev.map((item, idx) => idx === index ? { ...item, unidad_medida: unit } : item))
  }

  // Live Costing Calculations
  const costoTotalInsumos = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.cantidad * item.costo_unitario), 0)
  }, [items])

  const costoUnitarioEstimado = useMemo(() => {
    if (!cantidadEsperada || cantidadEsperada <= 0) return 0
    return costoTotalInsumos / cantidadEsperada
  }, [costoTotalInsumos, cantidadEsperada])

  const precioVentaPT = useMemo(() => {
    return Number(selectedFinishedProduct?.precio_venta || 0)
  }, [selectedFinishedProduct])

  const margenMonto = useMemo(() => {
    return precioVentaPT - costoUnitarioEstimado
  }, [precioVentaPT, costoUnitarioEstimado])

  const margenPct = useMemo(() => {
    if (precioVentaPT <= 0) return 0
    return (margenMonto / precioVentaPT) * 100
  }, [margenMonto, precioVentaPT])

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre.trim()) {
      toast.error("Falta nombre", "Indique el nombre de la fórmula o receta.")
      return
    }
    if (!productoTerminadoId) {
      toast.error("Falta producto terminado", "Debe vincular la receta a un producto terminado del catálogo.")
      return
    }
    if (items.length === 0) {
      toast.error("Sin ingredientes", "Debe agregar al menos una materia prima o insumo a la receta.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        area,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        producto_terminado_id: productoTerminadoId,
        cantidad_esperada: Number(cantidadEsperada),
        unidad_medida: unidadMedida,
        rendimiento_esperado: Number(rendimientoEsperado || 100),
        deposito_origen_id: depositoOrigenId || undefined,
        deposito_destino_id: depositoDestinoId || undefined,
        items: items.map(it => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          unidad_medida: it.unidad_medida,
          es_opcional: it.es_opcional,
        })),
      }

      if (recipeToEdit) {
        await api.supermer.recipes.update(recipeToEdit.id, payload)
        toast.success("Receta actualizada", `La fórmula "${nombre}" fue guardada correctamente.`)
      } else {
        await api.supermer.recipes.create(payload)
        toast.success("Receta creada", `La fórmula "${nombre}" fue registrada con éxito en ${area.toUpperCase()}.`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Error al guardar receta", err.message || "No se pudo registrar la receta")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* 🌟 MODAL HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white p-5 sm:p-6 border-b border-amber-500/20 flex-shrink-0">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                  FICHA TÉCNICA INDUSTRIAL · BILL OF MATERIALS (BOM)
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {recipeToEdit ? "Editar Fórmula de Producción" : "Constructor de Receta & Costeo"}
                </h2>
                <p className="text-xs text-slate-400">
                  Definí materias primas, proporciones, mermas esperadas y depósitos de stock
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 📋 MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {loadingInitial ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              <p className="text-xs font-bold">Cargando catálogos de materias primas y depósitos...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="recipe-builder-form" className="space-y-6">
              {/* 1. SECTOR / ÁREA DE PRODUCCIÓN */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" /> 1. Sector Productivo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {PRODUCTION_AREAS.map(a => {
                    const isSelected = area === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setArea(a.id)}
                        className={`p-2.5 rounded-2xl text-left border transition flex flex-col gap-1 ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-lg">{a.icon}</span>
                        <span className="text-xs font-bold leading-tight">{a.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. CABECERA: PRODUCTO TERMINADO Y NOMBRE */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-500" /> 2. Producto Terminado & Rendimiento Estándar
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Artículo del catálogo que se genera para la venta
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Selector Producto Terminado */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      Producto Terminado (Catálogo) *
                    </label>
                    <select
                      required
                      value={productoTerminadoId}
                      onChange={e => handleSelectFinishedProduct(e.target.value)}
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs outline-none focus:border-amber-500 transition"
                    >
                      <option value="">-- Seleccionar producto del catálogo --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.sku ? `(SKU: ${p.sku})` : ""} - PVP: {formatPYG(p.precio_venta || 0)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nombre de la Receta */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      Nombre de la Receta / Ficha *
                    </label>
                    <input
                      required
                      type="text"
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Ej: Pan Baguette Tradicional 250g (Batch 50 unid)"
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {/* Rendimiento, Unidad y Rendimiento % */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      Rendimiento Esperado *
                    </label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.001"
                      value={cantidadEsperada}
                      onChange={e => setCantidadEsperada(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      Unidad de Rendimiento
                    </label>
                    <select
                      value={unidadMedida}
                      onChange={e => setUnidadMedida(e.target.value)}
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                    >
                      <option value="UN">UN (Unidades)</option>
                      <option value="KG">KG (Kilogramos)</option>
                      <option value="GR">GR (Gramos)</option>
                      <option value="LT">LT (Litros)</option>
                      <option value="DOCENA">DOCENA</option>
                      <option value="BANDEJA">BANDEJA</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      % Eficiencia Esperada
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max="100"
                      value={rendimientoEsperado}
                      onChange={e => setRendimientoEsperado(parseFloat(e.target.value) || 100)}
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      Precio Venta Actual
                    </label>
                    <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      {formatPYG(precioVentaPT)}
                    </div>
                  </div>
                </div>

                {/* 3. DEPÓSITOS DE CONTROL DE STOCK */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block flex items-center gap-1">
                      <WarehouseIcon className="w-3.5 h-3.5 text-amber-500" /> Depósito Origen (Consumo de Insumos)
                    </label>
                    <select
                      value={depositoOrigenId}
                      onChange={e => setDepositoOrigenId(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs outline-none mt-1"
                    >
                      <option value="">-- Sin depósito asignado --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block flex items-center gap-1">
                      <WarehouseIcon className="w-3.5 h-3.5 text-emerald-500" /> Depósito Destino (Alta de Producto Terminado)
                    </label>
                    <select
                      value={depositoDestinoId}
                      onChange={e => setDepositoDestinoId(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs outline-none mt-1"
                    >
                      <option value="">-- Sin depósito asignado --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. CONSTRUCTOR DE INSUMOS / MATERIAS PRIMAS (BOM) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> 3. Materias Primas e Insumos ({items.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Componentes que se descuentan del inventario al procesar la receta
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Costo Subtotal: <strong className="text-amber-600 dark:text-amber-400 font-black">{formatPYG(costoTotalInsumos)}</strong>
                  </span>
                </div>

                {/* Buscador y agregador rápido de ingredientes */}
                <div className="bg-slate-100/80 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row items-stretch md:items-center gap-2 text-xs">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar materia prima / insumo (harina, levadura, sal, manteca...)"
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium outline-none text-xs"
                    />
                  </div>

                  <select
                    value={selectedIngredientId}
                    onChange={e => {
                      setSelectedIngredientId(e.target.value)
                      const prod = products.find(p => p.id === e.target.value)
                      if (prod && prod.unidad_medida) setIngredientUnit(prod.unidad_medida)
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs md:max-w-xs outline-none"
                  >
                    <option value="">-- Seleccionar de la lista --</option>
                    {filteredRawMaterials.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} (Costo: {formatPYG(p.costo_promedio || p.ultimo_costo || 0)})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="Cant."
                      value={ingredientQty}
                      onChange={e => setIngredientQty(parseFloat(e.target.value) || 1)}
                      className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-center text-xs"
                    />
                    <select
                      value={ingredientUnit}
                      onChange={e => setIngredientUnit(e.target.value)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                    >
                      <option value="KG">KG</option>
                      <option value="GR">GR</option>
                      <option value="LT">LT</option>
                      <option value="ML">ML</option>
                      <option value="UN">UN</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                </div>

                {/* Tabla de Insumos */}
                {items.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
                    <p className="font-bold">Aún no se han agregado materias primas a esta receta.</p>
                    <p className="text-[11px] mt-0.5">Utilizá el buscador superior para agregar harina, levadura, agua, etc.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">Materia Prima / Insumo</th>
                          <th className="p-3 text-right">Cantidad</th>
                          <th className="p-3 text-center">Unidad</th>
                          <th className="p-3 text-right">Costo Unit. (PPP)</th>
                          <th className="p-3 text-right">Subtotal Costo</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {items.map((item, idx) => {
                          const subtotal = item.cantidad * item.costo_unitario
                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="p-3">
                                <p className="font-extrabold text-slate-900 dark:text-white">{item.producto_nombre}</p>
                                {item.producto_sku && <p className="text-[10px] font-mono text-slate-400">SKU: {item.producto_sku}</p>}
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={item.cantidad}
                                  onChange={e => handleUpdateItemQty(idx, parseFloat(e.target.value) || 0)}
                                  className="w-20 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-right text-xs"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <select
                                  value={item.unidad_medida}
                                  onChange={e => handleUpdateItemUnit(idx, e.target.value)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                                >
                                  <option value="KG">KG</option>
                                  <option value="GR">GR</option>
                                  <option value="LT">LT</option>
                                  <option value="ML">ML</option>
                                  <option value="UN">UN</option>
                                </select>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                {formatPYG(item.costo_unitario)}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                {formatPYG(subtotal)}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredient(idx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
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

              {/* 5. DESCRIPCIÓN Y NOTAS TÉCNICAS */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  Instrucciones de Elaboración / Parámetros HACCP / Temperatura de Horno
                </label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Ej: Mezclar secos durante 5 min. Agregar agua helada y amasar 10 min. Hornear a 220°C con vapor por 18 minutos."
                  rows={2}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              {/* 📊 RESUMEN FINANCIERO EN VIVO */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950 text-white p-4 sm:p-5 rounded-3xl border border-amber-500/30 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo Total Batch</span>
                  <p className="text-lg font-black font-mono text-amber-300">{formatPYG(costoTotalInsumos)}</p>
                  <p className="text-[10px] text-slate-400">Por {cantidadEsperada} {unidadMedida}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Costo x Unidad / Kg</span>
                  <p className="text-lg font-black font-mono text-white">{formatPYG(costoUnitarioEstimado)}</p>
                  <p className="text-[10px] text-slate-400">Costo unitario teórico</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Precio Venta (PVP)</span>
                  <p className="text-lg font-black font-mono text-emerald-400">{formatPYG(precioVentaPT)}</p>
                  <p className="text-[10px] text-slate-400">Precio en mostrador</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Margen Bruto</span>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-lg font-black font-mono ${margenPct >= 35 ? "text-emerald-400" : margenPct >= 15 ? "text-amber-400" : "text-rose-400"}`}>
                      {margenPct.toFixed(1)}%
                    </p>
                    <span className="text-[10px] font-mono text-slate-400">({formatPYG(margenMonto)})</span>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    margenPct >= 35 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                    margenPct >= 15 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                    "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}>
                    {margenPct >= 35 ? "Alta Rentabilidad" : margenPct >= 15 ? "Rentabilidad Normal" : "Margen Crítico"}
                  </span>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* 🌟 MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {items.length} materia(s) prima(s) agregada(s)
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="recipe-builder-form"
              disabled={saving || loadingInitial}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {recipeToEdit ? "Actualizar Fórmula" : "Guardar Ficha Técnica"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
