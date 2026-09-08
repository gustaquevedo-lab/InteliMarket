import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Search, Plus, Package, AlertTriangle, AlertCircle, Edit, Trash2, Loader2, Eye, X,
  Save, Tag, Barcode, DollarSign, Layers, Upload, Download, Shirt,
  TrendingUp, TrendingDown, Percent, Sparkles, Building2, ShoppingCart,
  ArrowUpDown, CheckCircle2, ShieldAlert, Scale, ChevronDown, ChevronRight,
  Filter, Calendar, Clock, RefreshCw, Box, ExternalLink, ArrowRight,
  HelpCircle, Info, BookOpen, Gift, Check, Palette, Cpu, Zap, Copy,
  Lock, Unlock, Calculator, Boxes, Truck, FileText, Image as ImageIcon
} from "lucide-react"
import {
  api,
  type Product,
  type Category,
  type ProductVariant,
  type PackBarcode,
  type Supplier,
  type ProductsStatsResponse,
  type Product360Response,
} from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG } from "../../utils/format"
import { Modal, ModalFooter } from "../../components/Modal"
import { useAuth } from "../../context/AuthContext"
import Product360Modal from "./Product360Modal"

// Presets rápidos para carga veloz de códigos de pack/caja
const PACK_PRESETS = [
  { label: "Pack x6", unidades: 6, tag: "Pack x6" },
  { label: "Pack x12", unidades: 12, tag: "Pack x12" },
  { label: "Fardo x12", unidades: 12, tag: "Fardo x12" },
  { label: "Caja x24", unidades: 24, tag: "Caja x24" },
  { label: "Caja x48", unidades: 48, tag: "Caja x48" },
  { label: "Display x12", unidades: 12, tag: "Display x12" },
  { label: "Six-Pack", unidades: 6, tag: "Six-Pack" },
  { label: "Pack x4", unidades: 4, tag: "Pack x4" },
]

// Buscador de productos con autocompletado por código de barra / SKU / nombre.
// Soporta lectura ultra-rápida por pistola/lector (Enter automático con coincidencia exacta o 1 resultado),
// selección directa y mensaje claro e inequívoco si el código no existe en el catálogo.
function ProductSearchPicker({
  selectedProduct,
  onSelect,
  onClear,
  placeholder = "Buscar por código de barra, SKU o nombre...",
  disabled = false,
  autoFocus = false,
  onAfterSelect,
}: {
  selectedProduct: Product | null
  onSelect: (p: Product) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  onAfterSelect?: (p: Product) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<any>(null)

  const selectProduct = useCallback((p: Product) => {
    setQuery("")
    setResults([])
    setOpen(false)
    setErrorMessage(null)
    setSelectedIndex(-1)
    onSelect(p)
    onAfterSelect?.(p)
  }, [onSelect, onAfterSelect])

  const executeSearchAndSelect = useCallback(async (term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    const cleanTerm = term.trim()
    if (!cleanTerm) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const res = (await api.products.list({ search: cleanTerm, limit: 25 })) || []
      const qLower = cleanTerm.toLowerCase()

      // 1. Coincidencia exacta por código de barra
      const exactBarcode = res.find(p => p.codigo_barra && p.codigo_barra.trim().toLowerCase() === qLower)
      if (exactBarcode) {
        selectProduct(exactBarcode)
        return
      }

      // 2. Coincidencia exacta por SKU
      const exactSku = res.find(p => p.sku && p.sku.trim().toLowerCase() === qLower)
      if (exactSku) {
        selectProduct(exactSku)
        return
      }

      // 3. Coincidencia exacta por nombre
      const exactName = res.find(p => p.nombre && p.nombre.trim().toLowerCase() === qLower)
      if (exactName) {
        selectProduct(exactName)
        return
      }

      // 4. Si hay exactamente 1 resultado
      if (res.length === 1) {
        selectProduct(res[0])
        return
      }

      // 5. Si no se encontró ningún producto
      if (res.length === 0) {
        setResults([])
        setOpen(false)
        setErrorMessage(`No se encontró ningún producto con el código "${cleanTerm}"`)
        inputRef.current?.select()
        return
      }

      // 6. Múltiples resultados sin coincidencia exacta: desplegar para que el operador elija
      setResults(res)
      setSelectedIndex(0)
      setOpen(true)
      setErrorMessage(null)
    } catch (err: any) {
      setResults([])
      setOpen(false)
      setErrorMessage("Error al conectar con el servidor para buscar el producto.")
    } finally {
      setLoading(false)
    }
  }, [selectProduct])

  // Debounce para búsqueda interactiva por tipeo normal
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      setSelectedIndex(-1)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      api.products.list({ search: query.trim(), limit: 20 })
        .then((res) => {
          if (!cancelled) {
            setResults(res || [])
            setSelectedIndex(-1)
          }
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    searchTimeoutRef.current = timer
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  // Manejador de teclado para lector de código de barras (Enter) y navegación con flechas
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        selectProduct(results[selectedIndex])
        return
      }
      executeSearchAndSelect(query)
    } else if (e.key === "ArrowDown") {
      if (!open && results.length > 0) {
        setOpen(true)
        setSelectedIndex(0)
      } else if (results.length > 0) {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      }
    } else if (e.key === "ArrowUp") {
      if (results.length > 0) {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setErrorMessage(null)
    }
  }

  if (disabled && selectedProduct) {
    return (
      <div className="input-field w-full text-xs font-bold opacity-60 flex items-center justify-between">
        <span>{selectedProduct.nombre} (SKU: {selectedProduct.sku})</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {selectedProduct && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setQuery(""); setErrorMessage(null); setOpen(true) }}
          className="input-field w-full text-xs font-bold flex items-center justify-between disabled:opacity-60 bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
        >
          <span className="truncate text-left">
            {selectedProduct.nombre}{" "}
            <span className="font-mono text-slate-400 font-normal">
              ({selectedProduct.codigo_barra ? `Cód: ${selectedProduct.codigo_barra} · ` : ""}SKU: {selectedProduct.sku})
            </span>
          </span>
          {!disabled && (
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 shrink-0 ml-2"
              onClick={(e) => { e.stopPropagation(); setQuery(""); setErrorMessage(null); onClear?.() }}
            />
          )}
        </button>
      ) : (
        <div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              autoFocus={autoFocus || open}
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`input-field w-full text-xs font-bold pl-8 pr-8 ${
                errorMessage ? "border-rose-400 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20 focus:border-rose-500" : ""
              }`}
            />
            {loading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {errorMessage && (
            <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-fade-in shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute z-[100] mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl">
          {loading ? (
            <div className="p-3.5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Buscando productos...
            </div>
          ) : results.length === 0 ? (
            <div className="p-3.5 text-center text-xs text-rose-500 font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              Sin resultados para "{query}"
            </div>
          ) : (
            results.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectProduct(p) }}
                className={`w-full text-left px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex items-center justify-between gap-3 transition-colors ${
                  selectedIndex === idx
                    ? "bg-amber-100 dark:bg-amber-900/50"
                    : "hover:bg-amber-50 dark:hover:bg-amber-950/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.nombre}</div>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                    {p.codigo_barra && <span>Cod: <strong className="text-slate-600 dark:text-slate-300">{p.codigo_barra}</strong></span>}
                    {p.sku && <span>SKU: {p.sku}</span>}
                  </div>
                </div>
                {p.precio_venta != null && (
                  <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    Gs. {Number(p.precio_venta).toLocaleString("es-PY")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const isManagerOrAdmin = Boolean(
    user?.is_superadmin ||
    user?.rol === "admin" ||
    user?.rol === "gerente" ||
    user?.rol === "supervisor"
  )

  // Pestaña Principal
  const [mainTab, setMainTab] = useState<"catalogo" | "variantes" | "packs" | "kits" | "guia">("catalogo")

  // Datos principales
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [variantsList, setVariantsList] = useState<ProductVariant[]>([])
  const [packBarcodesList, setPackBarcodesList] = useState<PackBarcode[]>([])
  const [stats, setStats] = useState<ProductsStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [loadingPackBarcodes, setLoadingPackBarcodes] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)

  // Filtros y Búsqueda
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [filterStockTag, setFilterStockTag] = useState<"todos" | "con_stock" | "quiebre" | "bajo_stock" | "pesables" | "perecederos">("todos")
  const [sortBy, setSortBy] = useState<"nombre" | "precio_desc" | "precio_asc" | "margen_desc">("nombre")
  
  // Paginación Catálogo
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Ficha 360° del Producto
  const [selectedProduct360Id, setSelectedProduct360Id] = useState<string | null>(null)
  const [product360Data, setProduct360Data] = useState<Product360Response | null>(null)
  const [loading360, setLoading360] = useState(false)
  const [tab360, setTab360] = useState<"rentabilidad" | "stock_depositos" | "compras" | "ventas" | "kardex">("rentabilidad")

  // Modal Alta / Edición Producto
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [costoUnlocked, setCostoUnlocked] = useState(false)
  const [formTab, setFormTab] = useState<"general" | "empaque" | "precios" | "inventario">("general")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState({
    sku: "",
    nombre: "",
    codigo_barra: "",
    categoria_id: "",
    supplier_id: "",
    tipo: "producto",
    unidad_medida: "UN",
    iva_tasa: 10,
    stock_minimo: 5,
    stock_maximo: 0,
    peso_kg: 0,
    descripcion: "",
    imagen_url: "",
    costo_promedio: 0,
    precio_venta: 0,
    plu_codigo: "",
    plu_balanza: null as number | null,
    es_perecedero: false,
    vida_util_dias: 0,
    tiene_lotes: false,
    tipo_venta: "unidad",
    // Configuración Bulto / Pack Mayorista
    tiene_pack: false,
    pack_id: null as string | null,
    pack_cantidad: 12,
    pack_codigo_barra: "",
    pack_etiqueta: "Caja x12",
  })

  // Carga de Imagen local desde computadora
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadImageFile = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido", "Por favor selecciona un archivo de imagen (PNG, JPG, WEBP o GIF).")
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Archivo muy pesado", "La imagen no debe superar los 12MB.")
      return
    }

    try {
      setUploadingImage(true)
      const res = await api.products.uploadImage(file, editingProduct?.id, form.sku)
      setForm((prev) => ({ ...prev, imagen_url: res.url }))
      toast.success("Foto Cargada", "La imagen ha sido optimizada y asignada al producto.")
    } catch (err: any) {
      toast.error("Error al subir imagen", err.message || "No se pudo subir la foto.")
    } finally {
      setUploadingImage(false)
      if (imageFileInputRef.current) imageFileInputRef.current.value = ""
    }
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUploadImageFile(file)
  }

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) handleUploadImageFile(file)
  }

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, imagen_url: "" }))
    if (imageFileInputRef.current) imageFileInputRef.current.value = ""
  }

  // Módulo de Variantes
  const [selectedParentProductId, setSelectedParentProductId] = useState<string>("")
  const [selectedParentProduct, setSelectedParentProduct] = useState<Product | null>(null)
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [savingVariant, setSavingVariant] = useState(false)
  const [variantForm, setVariantForm] = useState({
    tipo: "talle",
    valor: "",
    sku_variante: "",
    codigo_barra: "",
    precio_extra: 0,
    stock: 0,
  })

  // Módulo de Códigos de Pack/Caja (1 codigo = N unidades del mismo producto)
  // Estado del Filtro de la Tabla:
  const [packFilterProductId, setPackFilterProductId] = useState<string>("")
  const [packFilterProduct, setPackFilterProduct] = useState<Product | null>(null)
  const [packSearchQuery, setPackSearchQuery] = useState<string>("")

  // Estado del Modal de Creación / Edición:
  const [packModalProductId, setPackModalProductId] = useState<string>("")
  const [packModalProduct, setPackModalProduct] = useState<Product | null>(null)
  const [showPackBarcodeModal, setShowPackBarcodeModal] = useState(false)
  const [savingPackBarcode, setSavingPackBarcode] = useState(false)
  const [editingPackBarcode, setEditingPackBarcode] = useState<PackBarcode | null>(null)
  const [packBarcodeForm, setPackBarcodeForm] = useState({
    codigo_barra: "",
    etiqueta: "",
    unidades_por_paquete: 1,
  })
  const packBarcodeInputRef = useRef<HTMLInputElement>(null)
  const packEtiquetaInputRef = useRef<HTMLInputElement>(null)

  // Módulo de Kits / Combos
  const [kitForm, setKitForm] = useState({
    nombre: "",
    sku: "",
    precio_venta: 0,
    items: [] as Array<{ product_id: string; product_nombre: string; cantidad: number; costo_unitario: number; precio_unitario: number }>,
  })
  const [kitSelectedComponentId, setKitSelectedComponentId] = useState<string>("")
  const [kitSelectedComponent, setKitSelectedComponent] = useState<Product | null>(null)
  const [kitComponentQty, setKitComponentQty] = useState<number>(1)
  const [kitsSaved, setKitsSaved] = useState<any[]>([])
  const [loadingKits, setLoadingKits] = useState(false)

  const loadKits = useCallback(async () => {
    setLoadingKits(true)
    try {
      const kits = await api.kits.list()
      setKitsSaved((kits || []).map((k: any) => ({
        id: k.id,
        nombre: k.nombre,
        descripcion: k.descripcion || "",
        precio_venta: k.precio_venta || 0,
        costo_total: k.costo_total || 0,
        margen_pct: k.margen_pct != null ? Number(k.margen_pct).toFixed(1) : "0.0",
        componentes: (k.items || []).map((i: any) => ({ nombre: i.nombre || "Producto", cantidad: i.cantidad, costo: i.costo_unitario })),
      })))
    } catch (e: any) {
      toast.error("Error", "No se pudieron cargar los kits.")
    } finally {
      setLoadingKits(false)
    }
  }, [toast])

  useEffect(() => { loadKits() }, [loadKits])

  // Carga de Datos
  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const s = await api.products.getStats()
      setStats(s)
    } catch {
      // fallback
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [prodsRes, catsRes, suppsRes] = await Promise.allSettled([
        api.products.list({ search: search || undefined, categoria_id: selectedCategory || undefined, limit: 1000 }),
        api.categories.list(),
        api.purchases.suppliers(),
      ])

      if (prodsRes.status === "fulfilled" && Array.isArray(prodsRes.value)) {
        // Filtrar nombres válidos y dar prioridad a productos con precio/stock
        const validProds = prodsRes.value.filter(p => p.nombre && p.nombre.replace(/\./g, "").trim().length > 0)
        setProducts(validProds.length > 0 ? validProds : prodsRes.value)
        if (validProds.length > 0 && !selectedParentProductId) {
          setSelectedParentProductId(validProds[0].id)
          setSelectedParentProduct(validProds[0])
        }
      } else {
        setProducts([])
      }

      if (catsRes.status === "fulfilled" && Array.isArray(catsRes.value)) {
        setCategories(catsRes.value)
      } else {
        setCategories([])
      }

      if (suppsRes.status === "fulfilled" && Array.isArray(suppsRes.value)) {
        setSuppliers(suppsRes.value)
      }
    } catch (e: any) {
      toast.error("Error al cargar productos", e.message)
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, selectedParentProductId])

  const loadVariants = useCallback(async () => {
    setLoadingVariants(true)
    try {
      const v = await api.products.variants.list(selectedParentProductId || undefined)
      setVariantsList(v)
    } catch (e: any) {
      // fallback
    } finally {
      setLoadingVariants(false)
    }
  }, [selectedParentProductId])

  const loadPackBarcodes = useCallback(async () => {
    setLoadingPackBarcodes(true)
    try {
      const v = await api.products.packBarcodes.list(packFilterProductId || undefined)
      setPackBarcodesList(v || [])
    } catch (e: any) {
      // fallback
    } finally {
      setLoadingPackBarcodes(false)
    }
  }, [packFilterProductId])

  useEffect(() => {
    loadStats()
    fetchData()
  }, [loadStats, fetchData])

  useEffect(() => {
    if (mainTab === "variantes") {
      loadVariants()
    }
  }, [mainTab, loadVariants])

  useEffect(() => {
    if (mainTab === "packs") {
      loadPackBarcodes()
    }
  }, [mainTab, loadPackBarcodes])

  // Abrir Ficha 360°
  const openProduct360 = async (prodId: string) => {
    setSelectedProduct360Id(prodId)
    setLoading360(true)
    setTab360("rentabilidad")
    try {
      const res = await api.products.get360(prodId)
      setProduct360Data(res)
    } catch (e: any) {
      toast.error("Error al cargar Ficha 360°", e.message)
      setProduct360Data(null)
    } finally {
      setLoading360(false)
    }
  }

  // Filtrado y Ordenación en Memoria
  const filteredAndSortedProducts = useMemo(() => {
    let list = [...products]

    // Filtro por Tags de Estado de Stock
    if (filterStockTag === "con_stock") {
      list = list.filter(p => (Number((p as any).stock_actual) || 0) > 0)
    } else if (filterStockTag === "quiebre") {
      list = list.filter(p => (Number((p as any).stock_actual) || 0) <= 0)
    } else if (filterStockTag === "bajo_stock") {
      list = list.filter(p => {
        const s = Number((p as any).stock_actual) || 0
        const min = Number(p.stock_minimo) || 0
        return s > 0 && s <= min
      })
    } else if (filterStockTag === "pesables") {
      list = list.filter(p => ["KG", "Kg", "kg", "LT", "Lt"].includes(p.unidad_medida || "") || p.tipo_venta === "peso")
    } else if (filterStockTag === "perecederos") {
      list = list.filter(p => (p as any).es_perecedero)
    }

    // Ordenación
    list.sort((a, b) => {
      if (sortBy === "nombre") return (a.nombre || "").localeCompare(b.nombre || "")
      if (sortBy === "precio_desc") return Number(b.precio_venta || 0) - Number(a.precio_venta || 0)
      if (sortBy === "precio_asc") return Number(a.precio_venta || 0) - Number(b.precio_venta || 0)
      if (sortBy === "margen_desc") {
        const margA = Number(a.precio_venta || 0) > 0 ? (Number(a.precio_venta) - Number(a.costo_promedio || 0)) / Number(a.precio_venta) : 0
        const margB = Number(b.precio_venta || 0) > 0 ? (Number(b.precio_venta) - Number(b.costo_promedio || 0)) / Number(b.precio_venta) : 0
        return margB - margA
      }
      return 0
    })

    return list
  }, [products, filterStockTag, sortBy])

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedProducts.length / pageSize) || 1
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSortedProducts.slice(start, start + pageSize)
  }, [filteredAndSortedProducts, page, pageSize])

  // Guardar Formulario Alta / Edición
  const handleSaveProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.sku?.trim() || !form.nombre?.trim()) {
      toast.error("Datos incompletos", "El SKU y Nombre del producto son obligatorios.")
      return
    }
    setSaving(true)
    try {
      const isPeso = form.tipo_venta === "peso"
      const payload: Partial<Product> & { sku: string; nombre: string } = {
        sku: form.sku.trim(),
        nombre: form.nombre.trim(),
        codigo_barra: form.codigo_barra?.trim() || undefined,
        descripcion: form.descripcion?.trim() || null,
        categoria_id: form.categoria_id && form.categoria_id.trim() !== "" ? form.categoria_id : null,
        supplier_id: form.supplier_id && form.supplier_id.trim() !== "" ? form.supplier_id : undefined,
        tipo: form.tipo || "producto",
        tipo_venta: isPeso ? "peso" : "unidad",
        unidad_medida: isPeso ? "KG" : (form.unidad_medida === "KG" ? "UN" : (form.unidad_medida || "UN")),
        plu_balanza: isPeso && form.plu_balanza ? Number(form.plu_balanza) : null,
        costo_promedio: Number(form.costo_promedio) || 0,
        precio_venta: Number(form.precio_venta) || 0,
        stock_minimo: Number(form.stock_minimo) || 0,
        stock_maximo: form.stock_maximo ? Number(form.stock_maximo) : undefined,
        peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
        imagen_url: form.imagen_url?.trim() || null,
        iva_tasa: Number(form.iva_tasa) !== undefined ? Number(form.iva_tasa) : 10,
        tiene_vencimiento: !!form.es_perecedero,
        tiene_lotes: !!form.tiene_lotes,
      }

      let savedProduct: Product
      if (editingProduct) {
        savedProduct = await api.products.update(editingProduct.id, payload)
        toast.success("Producto Actualizado", `${form.nombre} guardado correctamente.`)
      } else {
        savedProduct = await api.products.create(payload)
        toast.success("Producto Creado", `${form.nombre} registrado en el catálogo.`)
      }

      // Sincronizar o crear Pack Barcode si se configuró venta/recepción por caja
      const targetProductId = editingProduct ? editingProduct.id : savedProduct.id
      if (targetProductId && form.tiene_pack && Number(form.pack_cantidad) > 1 && form.pack_codigo_barra?.trim()) {
        const packPayload = {
          codigo_barra: form.pack_codigo_barra.trim(),
          unidades_por_paquete: Number(form.pack_cantidad),
          etiqueta: form.pack_etiqueta?.trim() || `Caja x${form.pack_cantidad}`,
        }
        try {
          if (form.pack_id) {
            await api.products.packBarcodes.update(targetProductId, form.pack_id, packPayload)
          } else {
            await api.products.packBarcodes.create(targetProductId, packPayload)
          }
        } catch (packErr: any) {
          console.warn("Pack barcode warning:", packErr)
        }
      }

      setShowForm(false)
      setEditingProduct(null)
      fetchData()
      loadStats()
    } catch (e: any) {
      toast.error("Error al guardar", e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = (p: Product) => {
    setEditingProduct(p)
    setCostoUnlocked(false)
    const nombreUpper = (p.nombre || "").toUpperCase()
    const bc = (p.codigo_barra || "").trim()
    const esNombreKg = nombreUpper.endsWith(" KG") || nombreUpper.includes(" KG ") || nombreUpper.includes("/KG")
    const esPatronBalanza = bc.startsWith("2000") && bc.length === 7 && /^\d+$/.test(bc)
    const isPesable = p.tipo_venta === "peso" || ["KG", "Kg", "kg"].includes(p.unidad_medida || "") || (esPatronBalanza && esNombreKg)

    let pluCalculado = (p as any).plu_balanza ? Number((p as any).plu_balanza) : null
    if (!pluCalculado && esPatronBalanza && (isPesable || esNombreKg)) {
      pluCalculado = parseInt(bc.slice(4), 10) || null
    }

    setForm({
      sku: p.sku || "",
      nombre: p.nombre || "",
      codigo_barra: p.codigo_barra || "",
      categoria_id: p.categoria_id || "",
      supplier_id: p.supplier_id || "",
      tipo: p.tipo || "producto",
      unidad_medida: isPesable ? "KG" : (p.unidad_medida || "UN"),
      iva_tasa: Number(p.iva_tasa) !== undefined ? Number(p.iva_tasa) : 10,
      stock_minimo: Number(p.stock_minimo) || 5,
      stock_maximo: Number(p.stock_maximo) || 0,
      peso_kg: p.peso_kg ? Number(p.peso_kg) : 0,
      descripcion: p.descripcion || "",
      imagen_url: p.imagen_url || "",
      costo_promedio: Number(p.costo_promedio) || 0,
      precio_venta: Number(p.precio_venta) || 0,
      plu_codigo: (p as any).plu_codigo || "",
      plu_balanza: pluCalculado,
      es_perecedero: !!(p as any).es_perecedero || !!(p as any).tiene_vencimiento,
      vida_util_dias: (p as any).vida_util_dias || 0,
      tiene_lotes: !!(p as any).tiene_lotes,
      tipo_venta: isPesable ? "peso" : (p.tipo_venta || "unidad"),
      tiene_pack: false,
      pack_id: null,
      pack_cantidad: 12,
      pack_codigo_barra: "",
      pack_etiqueta: "Caja x12",
    })
    setFormTab("general")
    setShowForm(true)

    // Cargar si ya tiene código de caja/pack registrado
    api.products.packBarcodes.list(p.id).then((packs: PackBarcode[]) => {
      if (packs && packs.length > 0) {
        const firstPack = packs[0]
        setForm((prev) => ({
          ...prev,
          tiene_pack: true,
          pack_id: firstPack.id,
          pack_cantidad: Number(firstPack.unidades_por_paquete) || 12,
          pack_codigo_barra: firstPack.codigo_barra || "",
          pack_etiqueta: firstPack.etiqueta || `Caja x${firstPack.unidades_por_paquete}`,
        }))
      }
    }).catch(() => {})
  }

  const handleNewClick = () => {
    setEditingProduct(null)
    setCostoUnlocked(true)
    setForm({
      sku: "",
      nombre: "",
      codigo_barra: "",
      categoria_id: "",
      supplier_id: "",
      tipo: "producto",
      unidad_medida: "UN",
      iva_tasa: 10,
      stock_minimo: 5,
      stock_maximo: 0,
      peso_kg: 0,
      descripcion: "",
      imagen_url: "",
      costo_promedio: 0,
      precio_venta: 0,
      plu_codigo: "",
      plu_balanza: null,
      es_perecedero: false,
      vida_util_dias: 0,
      tiene_lotes: false,
      tipo_venta: "unidad",
      tiene_pack: false,
      pack_id: null,
      pack_cantidad: 12,
      pack_codigo_barra: "",
      pack_etiqueta: "Caja x12",
    })
    setFormTab("general")
    setShowForm(true)
  }

  const handleDeleteProduct = async (p: Product) => {
    const ok = await confirm({
      title: "Eliminar Producto",
      message: `¿Estás seguro de eliminar "${p.nombre}"? Esta acción no se puede deshacer si tiene historial.`,
      confirmText: "Eliminar",
    })
    if (!ok) return

    try {
      await api.products.delete(p.id)
      toast.success("Producto Eliminado", `${p.nombre} fue removido.`)
      fetchData()
      loadStats()
    } catch (e: any) {
      toast.error("No se pudo eliminar", e.message)
    }
  }

  // Guardar Variante
  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedParentProductId || !variantForm.valor) {
      toast.error("Datos requeridos", "Seleccioná el producto padre y el valor de la variante (ej. XL, Rojo).")
      return
    }
    setSavingVariant(true)
    try {
      await api.products.variants.create(selectedParentProductId, {
        tipo: variantForm.tipo,
        valor: variantForm.valor,
        sku_variante: variantForm.sku_variante || undefined,
        codigo_barra: variantForm.codigo_barra || undefined,
        precio_extra: Number(variantForm.precio_extra),
        stock: Number(variantForm.stock),
      })
      toast.success("Variante Creada", `Variante "${variantForm.valor}" agregada al producto.`)
      setShowVariantModal(false)
      setVariantForm({ tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
      loadVariants()
    } catch (e: any) {
      toast.error("Error al crear variante", e.message)
    } finally {
      setSavingVariant(false)
    }
  }

  const handleDeleteVariant = async (v: ProductVariant) => {
    const ok = await confirm({
      title: "Eliminar Variante",
      message: `¿Desea eliminar la variante "${v.valor}"?`,
      confirmText: "Eliminar",
    })
    if (!ok) return
    try {
      await api.products.variants.delete(v.id)
      toast.success("Variante eliminada", "")
      loadVariants()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  // Abrir Modal de Alta de Pack (opcionalmente con producto pre-cargado)
  const handleOpenCreatePackModal = (preselected?: Product | null) => {
    setEditingPackBarcode(null)
    setPackBarcodeForm({ codigo_barra: "", etiqueta: "", unidades_por_paquete: 1 })
    const prod = preselected !== undefined ? preselected : (packFilterProduct || null)
    setPackModalProduct(prod)
    setPackModalProductId(prod?.id || "")
    setShowPackBarcodeModal(true)
  }

  // Guardar Código de Pack/Caja (soporta modo normal y modo "guardar y añadir otro")
  const handleSavePackBarcode = async (e?: React.FormEvent, keepProduct = false) => {
    if (e) e.preventDefault()
    if (!packModalProductId || !packBarcodeForm.codigo_barra.trim() || !packBarcodeForm.etiqueta.trim()) {
      toast.error("Datos requeridos", "Seleccioná el producto base y completá el código de barras y la etiqueta.")
      return
    }
    if (Number(packBarcodeForm.unidades_por_paquete) <= 0) {
      toast.error("Cantidad inválida", "Las unidades por paquete deben ser mayores a cero.")
      return
    }
    setSavingPackBarcode(true)
    try {
      if (editingPackBarcode) {
        await api.products.packBarcodes.update(packModalProductId, editingPackBarcode.id, {
          codigo_barra: packBarcodeForm.codigo_barra.trim(),
          etiqueta: packBarcodeForm.etiqueta.trim(),
          unidades_por_paquete: Number(packBarcodeForm.unidades_por_paquete),
        })
        toast.success("Código de Pack Actualizado", `"${packBarcodeForm.etiqueta}" guardado correctamente.`)
      } else {
        await api.products.packBarcodes.create(packModalProductId, {
          codigo_barra: packBarcodeForm.codigo_barra.trim(),
          etiqueta: packBarcodeForm.etiqueta.trim(),
          unidades_por_paquete: Number(packBarcodeForm.unidades_por_paquete),
        })
        toast.success("Código de Pack Creado", `"${packBarcodeForm.etiqueta}" agregado al producto.`)
      }

      await loadPackBarcodes()

      if (keepProduct && !editingPackBarcode) {
        // Mantiene el producto base seleccionado y resetea solo los datos del pack para el siguiente
        setPackBarcodeForm({ codigo_barra: "", etiqueta: "", unidades_por_paquete: 1 })
        setTimeout(() => packBarcodeInputRef.current?.focus(), 80)
        toast.info("Listo para el siguiente", `Podés escanear o cargar la siguiente presentación para "${packModalProduct?.nombre || 'este producto'}".`)
      } else {
        setShowPackBarcodeModal(false)
        setEditingPackBarcode(null)
        setPackModalProductId("")
        setPackModalProduct(null)
        setPackBarcodeForm({ codigo_barra: "", etiqueta: "", unidades_por_paquete: 1 })
      }
    } catch (e: any) {
      toast.error("Error al guardar código de pack", e.message)
    } finally {
      setSavingPackBarcode(false)
    }
  }

  const handleEditPackBarcodeClick = (pb: PackBarcode) => {
    setEditingPackBarcode(pb)
    setPackModalProductId(pb.product_id)
    setPackModalProduct({
      id: pb.product_id,
      nombre: pb.product_nombre || "Producto Base",
      sku: pb.product_sku || "",
      codigo_barra: (pb as any).product_codigo_barra || "",
    } as Product)
    setPackBarcodeForm({
      codigo_barra: pb.codigo_barra,
      etiqueta: pb.etiqueta,
      unidades_por_paquete: Number(pb.unidades_por_paquete),
    })
    setShowPackBarcodeModal(true)
  }

  const handleDeletePackBarcode = async (pb: PackBarcode) => {
    const ok = await confirm({
      title: "Eliminar Código de Pack",
      message: `¿Desea eliminar el código de pack "${pb.etiqueta}" (${pb.codigo_barra}) de "${pb.product_nombre || 'Producto'}"?`,
      confirmText: "Eliminar",
    })
    if (!ok) return
    try {
      await api.products.packBarcodes.delete(pb.product_id, pb.id)
      toast.success("Código de pack eliminado", "")
      loadPackBarcodes()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  // Componentes Kit
  const handleAddKitComponent = () => {
    if (!kitSelectedComponentId) return
    const compProd = kitSelectedComponent || products.find(p => p.id === kitSelectedComponentId)
    if (!compProd) return

    setKitForm(prev => {
      const exists = prev.items.find(i => i.product_id === compProd.id)
      if (exists) {
        return {
          ...prev,
          items: prev.items.map(i => i.product_id === compProd.id ? { ...i, cantidad: i.cantidad + kitComponentQty } : i)
        }
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: compProd.id,
            product_nombre: compProd.nombre,
            cantidad: kitComponentQty,
            costo_unitario: Number(compProd.costo_promedio || 0),
            precio_unitario: Number(compProd.precio_venta || 0),
          }
        ]
      }
    })
    setKitSelectedComponentId("")
    setKitSelectedComponent(null)
    setKitComponentQty(1)
  }

  const kitCostoAcumulado = kitForm.items.reduce((acc, item) => acc + (item.costo_unitario * item.cantidad), 0)
  const kitPrecioIndividualTotal = kitForm.items.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0)
  const kitMargenMonto = Number(kitForm.precio_venta || 0) - kitCostoAcumulado
  const kitMargenPct = Number(kitForm.precio_venta || 0) > 0 ? (kitMargenMonto / Number(kitForm.precio_venta)) * 100 : 0

  const [savingKit, setSavingKit] = useState(false)

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kitForm.nombre || kitForm.items.length < 2 || !kitForm.precio_venta) {
      toast.error("Kit incompleto", "El kit debe tener un nombre, al menos 2 componentes y un precio de venta.")
      return
    }

    setSavingKit(true)
    try {
      await api.kits.create({
        nombre: kitForm.nombre,
        descripcion: kitForm.sku || undefined,
        precio_venta: Number(kitForm.precio_venta),
        items: kitForm.items.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
      })
      toast.success("Kit Promocional Creado", `${kitForm.nombre} registrado con éxito.`)
      setKitForm({ nombre: "", sku: "", precio_venta: 0, items: [] })
      await loadKits()
    } catch (e: any) {
      toast.error("Error al crear el kit", e?.message || "No se pudo guardar el kit.")
    } finally {
      setSavingKit(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Tag className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    MAESTRO DE ARTÍCULOS · GÓNDOLA & BALANZA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {stats?.total_productos?.toLocaleString() || products.length.toLocaleString()} Artículos Activos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Catálogo de Productos & Precios
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Artículos, códigos EAN/PLU de balanza, variantes por empaque, kits y márgenes en góndola
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⚖️ {stats?.total_pesables || 0} pesables / balanza
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💰 {formatPYG(stats?.total_valorizado_costo || 0)} valorizado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => {
                fetchData()
                loadStats()
                if (mainTab === "variantes") loadVariants()
              }}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={handleNewClick}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Catálogo Activo</span>
              <Package className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {stats?.total_productos?.toLocaleString() || products.length.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">
              <strong className="text-indigo-400 font-mono font-bold">{stats?.total_pesables || 0}</strong> pesables / balanza
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor Inventario</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(stats?.total_valorizado_costo || 0)}
            </p>
            <p className="text-[11px] text-slate-400">Costo promedio ponderado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quiebres de Stock</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {stats?.total_quiebres?.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-400">
              <strong className="text-amber-400 font-bold font-mono">{stats?.total_bajos || 0}</strong> en stock crítico
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Bruto</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {stats?.margen_promedio_pct || 0}%
            </p>
            <p className="text-[11px] text-slate-400">Rentabilidad media góndola</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "catalogo", label: "Catálogo General", icon: Package, count: products.length },
          { key: "variantes", label: "Variantes (Talles / Sabores)", icon: Palette, count: variantsList.length },
          { key: "packs", label: "Códigos de Pack / Caja", icon: Box, count: packBarcodesList.length },
          { key: "kits", label: "Kits & Combos Promocionales", icon: Gift, count: kitsSaved.length },
          { key: "guia", label: "Manual Operativo & Ayuda", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon
          const active = mainTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 1: CATÁLOGO GENERAL & PRECIOS
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === "catalogo" && (
        <div className="space-y-4">
          {/* Barra de Herramientas: Búsqueda y Filtros */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3">
            <div className="flex flex-col lg:flex-row items-center gap-3">
              {/* Buscador */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por Nombre, SKU, Código de Barras o PLU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-9 pr-8 w-full text-xs font-medium py-2.5"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selector de Categoría */}
              <div className="w-full lg:w-64">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2.5 truncate"
                >
                  <option value="">Todas las Categorías ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Ordenación */}
              <div className="w-full lg:w-52">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2.5"
                >
                  <option value="nombre">Ordenar: Nombre (A-Z)</option>
                  <option value="precio_desc">Mayor Precio Venta</option>
                  <option value="precio_asc">Menor Precio Venta</option>
                  <option value="margen_desc">Mayor Margen %</option>
                </select>
              </div>
            </div>

            {/* Pastillas de Filtro Interactivas (Tags) */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Filtro Rápido:
              </span>

              {[
                { key: "todos", label: `Todos (${products.length})` },
                { key: "con_stock", label: "Con Stock Físico" },
                { key: "quiebre", label: `Quiebres / Stock 0 (${stats?.total_quiebres || 0})` },
                { key: "pesables", label: `Pesables / Balanza (${stats?.total_pesables || 0})` },
                { key: "perecederos", label: "Perecederos" },
              ].map((tag) => {
                const isSelected = filterStockTag === tag.key
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => setFilterStockTag(tag.key as any)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tabla de Productos de Alta Densidad */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mostrando {paginatedProducts.length} de {filteredAndSortedProducts.length} productos
              </span>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Por página:</span>
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSize(size)
                      setPage(1)
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-colors ${
                      pageSize === size
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Cargando catálogo...</p>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron productos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 min-w-[240px]">Producto & SKU</th>
                      <th className="p-3.5">Categoría</th>
                      <th className="p-3.5">Proveedor</th>
                      <th className="p-3.5">Código de Barras / PLU</th>
                      <th className="p-3.5 text-center">Stock Físico</th>
                      <th className="p-3.5 text-center">Unidad</th>
                      <th className="p-3.5 text-right">Costo Promedio</th>
                      <th className="p-3.5 text-right text-slate-800 dark:text-slate-200">PVP (Minorista)</th>
                      <th className="p-3.5 text-right text-indigo-600 dark:text-indigo-400">Precio Mayorista</th>
                      <th className="p-3.5 text-center">Margen Bruto %</th>
                      <th className="p-3.5 text-right pr-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedProducts.map((p, idx) => {
                      const costo = Number(p.costo_promedio || p.ultimo_costo || 0)
                      const precio = Number(p.precio_venta || 0)
                      const margenMonto = precio - costo
                      const margenPct = precio > 0 ? (margenMonto / precio) * 100 : 0
                      const esPesable = ["KG", "Kg", "kg", "LT", "Lt"].includes(p.unidad_medida || "") || p.tipo_venta === "peso"
                      const isEven = idx % 2 === 0

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/60 ${
                            isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/40"
                          } hover:!bg-indigo-50 dark:hover:!bg-indigo-950/30 hover:shadow-md cursor-pointer group`}
                          onClick={() => openProduct360(p.id)}
                        >
                          {/* Producto & SKU */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/50 group-hover:text-indigo-600 transition-colors">
                                {esPesable ? <Scale className="w-4 h-4 text-amber-500" /> : <Box className="w-4 h-4 text-indigo-500" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate text-xs flex items-center gap-1.5">
                                  <span>{p.nombre}</span>
                                  {(p as any).es_perecedero && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                                      Perecedero
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                  <span>SKU: <strong className="text-slate-600 dark:text-slate-300">{p.sku}</strong></span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Categoría */}
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {p.categoria?.nombre || "Sin Categoría"}
                            </span>
                          </td>

                          {/* Proveedor */}
                          <td className="p-3.5">
                            {p.supplier_nombre ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 block truncate max-w-[130px]" title={p.supplier_nombre}>
                                {p.supplier_nombre}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-[10px] italic">Sin asignar</span>
                            )}
                          </td>

                          {/* Código de Barras / PLU */}
                          <td className="p-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {p.codigo_barra ? (
                              <div className="flex items-center gap-1">
                                <Barcode className="w-3.5 h-3.5 text-slate-400" />
                                <span>{p.codigo_barra}</span>
                              </div>
                            ) : (p as any).plu_codigo ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 font-bold">
                                PLU: {(p as any).plu_codigo}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Stock Físico Real */}
                          <td className="p-3.5 text-center">
                            <div className="flex flex-col items-center">
                              {Number((p as any).stock_actual || 0) <= 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-mono">
                                  0 {p.unidad_medida || "UN"} (Quiebre)
                                </span>
                              ) : Number((p as any).stock_actual || 0) <= Number(p.stock_minimo || 0) ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-mono">
                                  {Number((p as any).stock_actual).toLocaleString("es-PY")} {p.unidad_medida || "UN"} (Bajo)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono">
                                  {Number((p as any).stock_actual).toLocaleString("es-PY")} {p.unidad_medida || "UN"}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 mt-0.5">Mín reposición: {p.stock_minimo || 0}</span>
                            </div>
                          </td>

                          {/* Unidad de Medida */}
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                              {p.unidad_medida || "UN"}
                            </span>
                          </td>

                          {/* Costo Promedio */}
                          <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {costo > 0 ? formatPYG(costo) : "—"}
                          </td>

                          {/* PVP (Precio de Venta al Público) */}
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {precio > 0 ? formatPYG(precio) : <span className="text-amber-500 font-normal">Sin Precio</span>}
                          </td>

                          {/* Precio Mayorista */}
                          <td className="p-3.5 text-right font-mono">
                            {p.precio_mayorista != null && Number(p.precio_mayorista) > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                  {formatPYG(Number(p.precio_mayorista))}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                  (a partir de {p.precio_mayorista_min_qty || 1} un.)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
                            )}
                          </td>

                          {/* Margen Bruto % */}
                          <td className="p-3.5 text-center">
                            {precio > 0 && costo > 0 ? (
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold inline-flex items-center gap-1 ${
                                  margenPct >= 20
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                    : margenPct >= 10
                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                                    : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                                }`}
                              >
                                {margenPct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="p-3.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setMainTab("packs"); setPackFilterProductId(p.id); setPackFilterProduct(p) }}
                                className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
                                title="Ver o gestionar Códigos de Pack / Caja de este producto"
                              >
                                <Box className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openProduct360(p.id) }}
                                className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                title="Ver Ficha 360° del Producto"
                              >
                                <Sparkles className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditClick(p) }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar producto"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                                title="Eliminar producto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginador Inferior */}
            {!loading && filteredAndSortedProducts.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-500">
                  Página <strong className="text-slate-800 dark:text-slate-200">{page}</strong> de <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 2: VARIANTES DE PRODUCTO
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === "variantes" && (
        <div className="space-y-6">
          {/* BANNER EDUCATIVO E INSTRUCCIONES */}
          <div className="card p-5 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 rounded-3xl space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  ¿Cómo usar el Módulo de Variantes? (Talles, Colores, Sabores, Packs)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Las variantes te permiten agrupar múltiples presentaciones de un mismo producto matriz bajo un solo artículo base. 
                  Cada variante cuenta con su propio <strong>SKU derivado</strong>, <strong>Código de barras individual</strong>, <strong>Stock propio</strong> y la opción de aplicar un <strong>Sobreprecio (+Gs.)</strong>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">1. Producto Padre</strong>
                    Creá el producto matriz (ej. "Remera Básica Algodón" o "Cerveza Lata 269ml").
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">2. Atributos</strong>
                    Definí el tipo (Talle, Color, Sabor, Presentación) y el valor (S, M, L, XL, Six-pack).
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">3. Facturación POS</strong>
                    Al pistolear el código de barras de la variante, el POS descuenta su stock exacto.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel de Control de Variantes */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-96">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Filtrar por Producto Padre:
              </label>
              <ProductSearchPicker
                selectedProduct={selectedParentProduct}
                onSelect={(p) => { setSelectedParentProductId(p.id); setSelectedParentProduct(p) }}
                onClear={() => { setSelectedParentProductId(""); setSelectedParentProduct(null) }}
                placeholder="Todos los productos con variantes... (buscar por código, SKU o nombre)"
              />
            </div>

            <button
              onClick={() => setShowVariantModal(true)}
              className="btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-md self-end sm:self-auto"
            >
              <Plus className="w-4 h-4" /> + Nueva Variante
            </button>
          </div>

          {/* Tabla de Variantes */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            {loadingVariants ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Cargando variantes...</p>
              </div>
            ) : variantsList.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <Palette className="w-10 h-10 mx-auto opacity-40 text-indigo-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay variantes registradas</p>
                <p className="text-xs">Hacé clic en "+ Nueva Variante" para crear talles, colores o sabores para tus productos.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Producto Padre</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Valor / Opción</th>
                    <th className="p-3.5">SKU Variante</th>
                    <th className="p-3.5">Código de Barras</th>
                    <th className="p-3.5 text-right">Precio Extra</th>
                    <th className="p-3.5 text-right">Stock</th>
                    <th className="p-3.5 text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {variantsList.map((v: any) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {v.product_nombre || "Producto Base"}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {v.tipo}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {v.valor}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{v.sku_variante || "—"}</td>
                      <td className="p-3.5 font-mono text-slate-600">{v.codigo_barra || "—"}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                        {Number(v.precio_extra || 0) > 0 ? `+${formatPYG(Number(v.precio_extra))}` : "—"}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {v.stock || 0}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <button
                          onClick={() => handleDeleteVariant(v)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA: CÓDIGOS DE PACK / CAJA
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === "packs" && (
        <div className="space-y-6">
          {/* BANNER EDUCATIVO E INSTRUCCIONES */}
          <div className="card p-5 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-3xl space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-amber-600 text-white shadow-md shrink-0">
                <Box className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  ¿Para qué sirve esto? Códigos de Pack / Caja
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Muchos productos llegan en cajas o packs cerrados con un <strong>código de barras propio, distinto</strong> al del producto suelto.
                  Registrá acá ese código y cuántas unidades trae — el stock siempre queda expresado en unidades sueltas, esto es solo
                  una forma más rápida de cargarlo. (Próximamente: al escanear ese código en Caja, se van a agregar automáticamente
                  esas unidades al carrito.)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-amber-600 dark:text-amber-400 block font-mono">1. Producto Base</strong>
                    Elegí el producto suelto que ya está cargado (ej. "Coca Cola 500ml").
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-amber-600 dark:text-amber-400 block font-mono">2. Código de la Caja</strong>
                    Escaneá o tipeá el código impreso en la caja/pack (no el del producto suelto).
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-amber-600 dark:text-amber-400 block font-mono">3. Unidades por Paquete</strong>
                    Cuántas unidades sueltas trae esa caja/pack (ej. 24).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel de Control y Filtros */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
              <div className="w-full sm:w-80">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Filtrar por Producto Base:
                </label>
                <ProductSearchPicker
                  selectedProduct={packFilterProduct}
                  onSelect={(p) => { setPackFilterProductId(p.id); setPackFilterProduct(p) }}
                  onClear={() => { setPackFilterProductId(""); setPackFilterProduct(null) }}
                  placeholder="Todos los productos... (código, SKU o nombre)"
                />
              </div>

              <div className="w-full sm:w-64">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Buscar en la lista:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={packSearchQuery}
                    onChange={(e) => setPackSearchQuery(e.target.value)}
                    placeholder="Filtrar por etiqueta o código..."
                    className="input-field w-full text-xs pl-8 py-2"
                  />
                  {packSearchQuery && (
                    <button
                      onClick={() => setPackSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenCreatePackModal()}
              className="btn-primary text-xs px-4 py-2.5 flex items-center gap-2 shadow-md shrink-0 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> + Nuevo Código de Pack
            </button>
          </div>

          {/* Tabla de Códigos de Pack */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            {loadingPackBarcodes ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Cargando códigos de pack...</p>
              </div>
            ) : packBarcodesList.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                  <Box className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No hay códigos de pack registrados</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    {packFilterProduct
                      ? `No hay presentaciones registradas para "${packFilterProduct.nombre}". Podés crear la primera ahora.`
                      : "Hacé clic en \"+ Nuevo Código de Pack\" para registrar cajas, packs o fardos asociados a productos sueltos."}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenCreatePackModal()}
                  className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear presentación
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Producto Base</th>
                      <th className="p-3.5">Presentación / Etiqueta</th>
                      <th className="p-3.5 text-center">Multiplicador</th>
                      <th className="p-3.5">Código de Barras (Caja/Pack)</th>
                      <th className="p-3.5 text-right pr-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {packBarcodesList
                      .filter((pb) => {
                        if (!packSearchQuery.trim()) return true
                        const q = packSearchQuery.trim().toLowerCase()
                        return (
                          (pb.product_nombre || "").toLowerCase().includes(q) ||
                          (pb.product_sku || "").toLowerCase().includes(q) ||
                          (pb.codigo_barra || "").toLowerCase().includes(q) ||
                          (pb.etiqueta || "").toLowerCase().includes(q)
                        )
                      })
                      .map((pb) => (
                        <tr key={pb.id} className="hover:bg-amber-50/30 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-xs">{pb.product_nombre || "Producto Base"}</span>
                            </div>
                            {pb.product_sku && (
                              <span className="block text-[10px] font-mono text-slate-400 font-normal mt-0.5">
                                SKU: {pb.product_sku}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1.5 font-black text-amber-700 dark:text-amber-300 text-xs bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
                              <Box className="w-3.5 h-3.5 text-amber-500" />
                              {pb.etiqueta}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center font-mono font-black text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              × {Number(pb.unidades_por_paquete)} un.
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold bg-slate-100/80 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                              {pb.codigo_barra}
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenCreatePackModal({ id: pb.product_id, nombre: pb.product_nombre || "Producto", sku: pb.product_sku || "" } as Product)}
                                className="px-2 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-amber-200/50 dark:border-amber-900/40"
                                title="Agregar otra presentación (pack/caja) a este mismo producto"
                              >
                                <Plus className="w-3.5 h-3.5" /> + Pack
                              </button>
                              <button
                                onClick={() => handleEditPackBarcodeClick(pb)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePackBarcode(pb)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 3: KITS & COMBOS PROMOCIONALES
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === "kits" && (
        <div className="space-y-6">
          {/* BANNER EDUCATIVO E INSTRUCCIONES */}
          <div className="card p-5 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 rounded-3xl space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  ¿Cómo armar Kits y Combos Promocionales con Explosión de Stock?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Un <strong>Kit o Combo</strong> es un producto comercial agrupado compuesto por 2 o más artículos individuales del catálogo 
                  (ej. "Pack Asado: 2kg Costilla + 1 Carbón + 2 Gaseosas").
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-purple-600 dark:text-purple-400 block font-mono">1. Descuento Automático</strong>
                    Al venderse el Kit en caja, el sistema descuenta automáticamente cada producto componente de su stock.
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-purple-600 dark:text-purple-400 block font-mono">2. Margen Garantizado</strong>
                    El constructor suma el costo de cada ítem en tiempo real para asegurarte que el precio de oferta siempre deje ganancia.
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    <strong className="text-purple-600 dark:text-purple-400 block font-mono">3. Aumento del Ticket</strong>
                    Los combos aumentan la rotación de artículos complementarios e impulsan el ticket promedio de compra.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Constructor de Kits y Lista Existente */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Formulario Creador de Kits */}
            <div className="lg:col-span-5 card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600" /> Crear Nuevo Kit / Combo
              </h3>

              <form onSubmit={handleSaveKit} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre del Kit / Combo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pack Merienda Familiar"
                    value={kitForm.nombre}
                    onChange={(e) => setKitForm({ ...kitForm, nombre: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">SKU del Kit</label>
                    <input
                      type="text"
                      placeholder="KIT-1001"
                      value={kitForm.sku}
                      onChange={(e) => setKitForm({ ...kitForm, sku: e.target.value })}
                      className="input-field w-full text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Precio Venta Kit (Gs.) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={kitForm.precio_venta}
                      onChange={(e) => setKitForm({ ...kitForm, precio_venta: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono font-black text-purple-600"
                    />
                  </div>
                </div>

                {/* Agregar Componentes */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agregar Componentes al Pack:</span>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ProductSearchPicker
                        selectedProduct={kitSelectedComponent}
                        onSelect={(p) => { setKitSelectedComponentId(p.id); setKitSelectedComponent(p) }}
                        onClear={() => { setKitSelectedComponentId(""); setKitSelectedComponent(null) }}
                        placeholder="Buscar producto por código, SKU o nombre..."
                      />
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={kitComponentQty}
                      onChange={(e) => setKitComponentQty(Math.max(1, Number(e.target.value)))}
                      className="input-field w-16 text-center text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleAddKitComponent}
                      className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                      title="Agregar componente"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Lista de Componentes en el Kit */}
                  {kitForm.items.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                      {kitForm.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.product_nombre}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {item.cantidad} un. × Costo: {formatPYG(item.costo_unitario)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setKitForm({ ...kitForm, items: kitForm.items.filter((_, i) => i !== idx) })}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Métricas de Rentabilidad del Kit */}
                {kitForm.items.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Costo Acumulado:</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{formatPYG(kitCostoAcumulado)}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Suma Precios Sueltos:</span>
                      <strong className="font-mono text-slate-400 line-through">{formatPYG(kitPrecioIndividualTotal)}</strong>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-purple-200/60">
                      <span className="font-bold text-purple-700 dark:text-purple-300">Margen Bruto Kit:</span>
                      <strong className="font-mono font-black text-purple-700 dark:text-purple-300">
                        {kitMargenPct.toFixed(1)}% ({formatPYG(kitMargenMonto)})
                      </strong>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingKit}
                  className="btn-primary w-full text-xs py-2.5 font-bold shadow-md bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  {savingKit ? "Guardando..." : "Guardar Kit / Combo"}
                </button>
              </form>
            </div>

            {/* Kits Guardados */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Kits & Combos Activos ({kitsSaved.length}){loadingKits ? " -- cargando..." : ""}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kitsSaved.map((kit) => (
                  <div key={kit.id} className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 font-bold text-xs">
                        <Gift className="w-4 h-4" />
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-600">
                        Margen: {kit.margen_pct}%
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{kit.nombre}</h4>
                      {kit.descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{kit.descripcion}</p>}
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Componentes del pack:</span>
                      {kit.componentes.map((c: any, i: number) => (
                        <p key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                          <span>• {c.nombre}</span>
                          <span className="font-mono text-slate-400">×{c.cantidad}</span>
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Precio Oferta:</span>
                        <strong className="text-base font-black font-mono text-purple-600">{formatPYG(kit.precio_venta)}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Costo Total:</span>
                        <strong className="text-xs font-bold font-mono text-slate-500">{formatPYG(kit.costo_total)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑA 4: MANUAL OPERATIVO & AYUDA INTEGRADA
      ────────────────────────────────────────────────────────────────────────── */}
      {mainTab === "guia" && (
        <div className="space-y-6 max-w-4xl">
          <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Manual Operativo del Módulo de Catálogo & Precios</h3>
                <p className="text-xs text-slate-500">Guía práctica de mejores prácticas para la gestión del inventario y la rentabilidad comercial.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Sección 1: Balanzas y PLU */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4" /> 1. Artículos Pesables y Códigos de Balanza (PLU)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Para productos fraccionables (Carnicería, Verdulería, Panadería), la unidad de medida debe ser <strong>KG</strong> o <strong>LT</strong>.
                  El sistema genera o lee códigos de barras con el estándar de balanzas electrónicas (prefijo <code>2000xxx</code>). Al escanear la etiqueta en el Punto de Venta (POS), el sistema descompone el código en PLU y peso exacto facturando automáticamente el total correspondiente.
                </p>
              </div>

              {/* Sección 2: Rentabilidad y Márgenes */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-4 h-4" /> 2. Cálculo de Márgenes Comerciales y Mark-up
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  • <strong>Margen Bruto (%)</strong>: <code>(Precio Venta - Costo) / Precio Venta × 100</code>. Indica qué porcentaje del dinero ingresado en caja queda como utilidad bruta.<br />
                  • <strong>Mark-up (%)</strong>: <code>(Precio Venta - Costo) / Costo × 100</code>. Es el multiplicador que le aplicás al costo de compra para determinar el precio en góndola.
                </p>
              </div>

              {/* Sección 3: Perecederos y Vencimientos */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> 3. Productos Perecederos y Control de Mermas
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Al tildar la opción <strong>"Producto Perecedero"</strong>, podés definir los días de vida útil. El sistema alertará en la Gestión de Inventario los lotes próximos a vencer para aplicar descuentos dinámicos preventivos o registrar mermas operativas sin distorsionar el balance general.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ALTA / EDICIÓN DE CÓDIGO DE PACK
      ────────────────────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ALTA / EDICIÓN DE CÓDIGO DE PACK
      ────────────────────────────────────────────────────────────────────────── */}
      {showPackBarcodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full flex flex-col my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingPackBarcode ? "Editar Código de Pack" : "Nuevo Código de Pack / Caja"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asignar código de barra a una presentación por cantidad (ej. Six-Pack, Caja x24)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPackBarcodeModal(false)
                  setEditingPackBarcode(null)
                  setPackModalProductId("")
                  setPackModalProduct(null)
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSavePackBarcode(e, false)} className="p-6 space-y-5">
              {/* Selector o Ficha del Producto Base */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Producto Base *
                </label>
                {packModalProduct ? (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-xs">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {packModalProduct.nombre}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                          {packModalProduct.codigo_barra && (
                            <span>
                              Cod: <strong className="text-slate-600 dark:text-slate-300">{packModalProduct.codigo_barra}</strong>
                            </span>
                          )}
                          {packModalProduct.sku && <span>SKU: {packModalProduct.sku}</span>}
                        </div>
                      </div>
                    </div>
                    {!editingPackBarcode && (
                      <button
                        type="button"
                        onClick={() => { setPackModalProduct(null); setPackModalProductId("") }}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline shrink-0"
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                ) : (
                  <ProductSearchPicker
                    autoFocus={!packModalProduct}
                    selectedProduct={packModalProduct}
                    onSelect={(p) => { setPackModalProductId(p.id); setPackModalProduct(p) }}
                    onAfterSelect={() => {
                      setTimeout(() => packBarcodeInputRef.current?.focus(), 80)
                    }}
                    onClear={() => { setPackModalProductId(""); setPackModalProduct(null) }}
                    disabled={!!editingPackBarcode}
                    placeholder="Escanear con lectora o buscar por código de barra, SKU o nombre..."
                  />
                )}
              </div>

              {/* Presets Rápidos */}
              <div className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/50 dark:border-amber-900/40 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Atajos de Presentación Frecuentes:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PACK_PRESETS.map((pr) => (
                    <button
                      key={pr.label}
                      type="button"
                      onClick={() => {
                        setPackBarcodeForm(prev => ({
                          ...prev,
                          etiqueta: pr.tag,
                          unidades_por_paquete: pr.unidades,
                        }))
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Código de Barras de la Caja */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Código de Barras de la Caja/Pack *
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={packBarcodeInputRef}
                    type="text"
                    required
                    autoFocus={!!packModalProduct}
                    placeholder="Escaneá con la lectora o tipeá el código impreso en la caja"
                    value={packBarcodeForm.codigo_barra}
                    onChange={(e) => setPackBarcodeForm({ ...packBarcodeForm, codigo_barra: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!packBarcodeForm.etiqueta.trim()) {
                          e.preventDefault()
                          packEtiquetaInputRef.current?.focus()
                        }
                      }
                    }}
                    className="input-field w-full text-xs font-mono font-bold pl-9 py-2.5"
                  />
                </div>
              </div>

              {/* Etiqueta y Unidades */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Etiqueta Descriptiva *
                  </label>
                  <input
                    ref={packEtiquetaInputRef}
                    type="text"
                    required
                    placeholder="Ej. Caja x24, Six-Pack, Fardo x12"
                    value={packBarcodeForm.etiqueta}
                    onChange={(e) => setPackBarcodeForm({ ...packBarcodeForm, etiqueta: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Unidades sueltas contenidas *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={packBarcodeForm.unidades_por_paquete}
                      onChange={(e) => setPackBarcodeForm({ ...packBarcodeForm, unidades_por_paquete: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono font-black text-amber-600 dark:text-amber-400 text-right pr-14"
                    />
                    <span className="text-[10px] font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      unidades
                    </span>
                  </div>
                </div>
              </div>

              {/* Botonera de Acciones */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPackBarcodeModal(false)
                    setEditingPackBarcode(null)
                    setPackModalProductId("")
                    setPackModalProduct(null)
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!editingPackBarcode && (
                    <button
                      type="button"
                      disabled={savingPackBarcode}
                      onClick={() => handleSavePackBarcode(undefined, true)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                      title="Guarda este pack y deja el producto listo para agregar la siguiente presentación"
                    >
                      {savingPackBarcode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Guardar y agregar otro pack
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingPackBarcode}
                    className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5 shadow-md disabled:opacity-60"
                  >
                    {savingPackBarcode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingPackBarcode ? "Guardar Cambios" : "Guardar y Cerrar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ALTA DE VARIANTE
      ────────────────────────────────────────────────────────────────────────── */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-600" /> Nueva Variante de Producto
              </h3>
              <button onClick={() => setShowVariantModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Producto Padre *</label>
                <ProductSearchPicker
                  selectedProduct={selectedParentProduct}
                  onSelect={(p) => { setSelectedParentProductId(p.id); setSelectedParentProduct(p) }}
                  onClear={() => { setSelectedParentProductId(""); setSelectedParentProduct(null) }}
                  placeholder="Buscar producto por código de barra, SKU o nombre..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo de Variante *</label>
                  <select
                    value={variantForm.tipo}
                    onChange={(e) => setVariantForm({ ...variantForm, tipo: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  >
                    <option value="talle">Talle (S, M, L, XL)</option>
                    <option value="color">Color</option>
                    <option value="sabor">Sabor</option>
                    <option value="presentacion">Presentación / Pack</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Valor / Opción *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. XL, Rojo, 6-Pack"
                    value={variantForm.valor}
                    onChange={(e) => setVariantForm({ ...variantForm, valor: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">SKU Derivado</label>
                  <input
                    type="text"
                    placeholder="Auto o Ej. 120480-XL"
                    value={variantForm.sku_variante}
                    onChange={(e) => setVariantForm({ ...variantForm, sku_variante: e.target.value })}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Código de Barras</label>
                  <input
                    type="text"
                    placeholder="784..."
                    value={variantForm.codigo_barra}
                    onChange={(e) => setVariantForm({ ...variantForm, codigo_barra: e.target.value })}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Precio Extra (+Gs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={variantForm.precio_extra}
                    onChange={(e) => setVariantForm({ ...variantForm, precio_extra: Number(e.target.value) })}
                    className="input-field w-full text-xs font-mono font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={variantForm.stock}
                    onChange={(e) => setVariantForm({ ...variantForm, stock: Number(e.target.value) })}
                    className="input-field w-full text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingVariant}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {savingVariant && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Crear Variante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: FICHA 360° DEL PRODUCTO (componente dedicado)
      ────────────────────────────────────────────────────────────────────────── */}
      {selectedProduct360Id && product360Data && !loading360 && (
        <Product360Modal
          data={product360Data}
          onClose={() => { setSelectedProduct360Id(null) }}
          onPriceUpdated={(productId, newPrice) => {
            setProducts(prev => prev.map(p =>
              p.id === productId ? { ...p, precio_venta: newPrice } : p
            ))
            setSelectedProduct360Id(null)
          }}
        />
      )}
      {selectedProduct360Id && loading360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Cargando Ficha 360°...</p>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL ESTÁNDAR: ALTA / EDICIÓN DE PRODUCTO (PORTAL LOCK)
      ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingProduct ? `Editar Producto: ${editingProduct.nombre}` : "Nuevo Producto en Catálogo"}
        subtitle={
          editingProduct
            ? `SKU: ${editingProduct.sku} ${editingProduct.codigo_barra ? `| EAN: ${editingProduct.codigo_barra}` : ""}`
            : "Alta oficial de producto para Supermercado & Retail"
        }
        icon={editingProduct ? <Edit className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
        size="2xl"
        footer={
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSaveProduct()}
              disabled={saving}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingProduct ? "Guardar Cambios" : "Crear Producto"}
            </button>
          </ModalFooter>
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* BARRA SUPERIOR DE PESTAÑAS DEL PRODUCTO */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFormTab("general")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${
                formTab === "general"
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Identificación & Proveedor</span>
            </button>

            <button
              type="button"
              onClick={() => setFormTab("empaque")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${
                formTab === "empaque"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Caja, Bulto & Balanza</span>
              {form.tipo_venta === "peso" && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
              {form.tiene_pack && (
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFormTab("precios")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${
                formTab === "precios"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Precios, Costo & SIFEN</span>
            </button>

            <button
              type="button"
              onClick={() => setFormTab("inventario")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${
                formTab === "inventario"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Stock & Perecederos</span>
              {form.es_perecedero && (
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              )}
            </button>
          </div>

          {/* ──────────────────────────────────────────────────────────
              TAB 1: IDENTIFICACIÓN, PROVEEDOR Y DATOS BÁSICOS
          ────────────────────────────────────────────────────────── */}
          {formTab === "general" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      SKU / Código Interno *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="input-field w-full text-xs font-mono font-bold"
                      placeholder="Ej. 120550"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Código de Barras Unitario (EAN-13 / UPC)
                    </label>
                    <input
                      type="text"
                      value={form.codigo_barra}
                      onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                      className="input-field w-full text-xs font-mono"
                      placeholder="Ej. 7840001002345"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Nombre Comercial del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                    placeholder="Ej. BRAHMITA CERVEZA ULTRA CERO 269ML"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Categoría
                    </label>
                    <select
                      value={form.categoria_id}
                      onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                      className="input-field w-full text-xs"
                    >
                      <option value="">Seleccionar Categoría...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Proveedor Habitual
                    </label>
                    <select
                      value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                      className="input-field w-full text-xs"
                    >
                      <option value="">Sin proveedor habitual asignado...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.razon_social || s.nombre_fantasia || "Proveedor"} {s.ruc ? `(${s.ruc})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Unidad de Medida Base
                    </label>
                    <select
                      value={form.unidad_medida}
                      onChange={(e) => {
                        const newUm = e.target.value
                        const isKg = newUm === "KG"
                        setForm((prev) => {
                          let autoPlu = prev.plu_balanza
                          if (isKg && !autoPlu && prev.codigo_barra && prev.codigo_barra.startsWith("2000") && prev.codigo_barra.length === 7 && /^\d+$/.test(prev.codigo_barra)) {
                            autoPlu = parseInt(prev.codigo_barra.slice(4), 10) || null
                          }
                          return {
                            ...prev,
                            unidad_medida: newUm,
                            tipo_venta: isKg ? "peso" : (prev.tipo_venta === "peso" ? "unidad" : prev.tipo_venta),
                            plu_balanza: isKg ? (autoPlu ?? prev.plu_balanza) : prev.plu_balanza,
                          }
                        })
                      }}
                      className="input-field w-full text-xs font-bold"
                    >
                      <option value="UN">Unidad (UN)</option>
                      <option value="KG">Kilogramo (KG) - Balanza / Pesable</option>
                      <option value="LT">Litro (LT)</option>
                      <option value="PQ">Paquete (PQ)</option>
                      <option value="CJ">Caja (CJ)</option>
                      <option value="MT">Metro (MT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Modalidad de Venta
                    </label>
                    <div className="flex items-center gap-2 h-[38px] px-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {form.unidad_medida === "KG" || form.tipo_venta === "peso" ? "⚖️ Venta por Peso (Balanza)" : "📦 Venta Unitaria / Bulto"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Foto del Producto desde archivo de computadora */}
                <div className="bg-slate-50/80 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Foto del Producto (Kiosko & POS)
                    </label>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                      Carga directa desde esta computadora
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={imageFileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    className="hidden"
                  />

                  {form.imagen_url ? (
                    <div className="flex items-center gap-4 p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0 flex items-center justify-center">
                        <img
                          src={form.imagen_url}
                          alt={form.nombre || "Preview"}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.target as any).style.display = "none" }}
                        />
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            Foto vinculada correctamente
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mb-2">
                          {form.imagen_url}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => imageFileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {uploadingImage ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            Cambiar foto de la PC
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            disabled={uploadingImage}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg border border-rose-200 dark:border-rose-800/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Quitar foto
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageFileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                      onDrop={handleImageDrop}
                      className={`group border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        uploadingImage
                          ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20"
                          : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white/60 dark:bg-slate-800/40 hover:bg-emerald-50/20"
                      }`}
                    >
                      {uploadingImage ? (
                        <div className="py-2 flex flex-col items-center justify-center gap-1.5">
                          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Subiendo y optimizando foto desde tu equipo...
                          </p>
                        </div>
                      ) : (
                        <div className="py-1 flex flex-col items-center justify-center gap-1">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Haz clic para seleccionar la foto desde esta computadora
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Arrastra aquí el archivo o haz clic para buscarlo • PNG, JPG, WEBP
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Descripción / Especificaciones / Notas Internas
                  </label>
                  <textarea
                    rows={2}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className="input-field w-full text-xs"
                    placeholder="Detalles sobre presentación, sabor, graduación alcohólica o notas de reposición..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 2: CAJA, BULTO MAYORISTA & BALANZA
          ────────────────────────────────────────────────────────── */}
          {formTab === "empaque" && (
            <div className="space-y-4 animate-fade-in">
              {/* CASO 1: PRODUCTO PESABLE / BALANZA */}
              {(form.tipo_venta === "peso" || form.unidad_medida === "KG") ? (
                <div className="rounded-2xl p-4 border bg-amber-500/10 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Venta Pesable & Balanza (Fiambrería, Verdulería, Carnicería, Panadería)</span>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                            Pesable Activo
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Venta fraccionada por peso en balanzas etiquetadoras (Balmak Edge / Toledo) y lectores POS
                        </div>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={form.tipo_venta === "peso"}
                        onChange={(e) => {
                          const isPeso = e.target.checked
                          setForm((prev) => {
                            let autoPlu = prev.plu_balanza
                            if (isPeso && !autoPlu && prev.codigo_barra && prev.codigo_barra.startsWith("2000") && prev.codigo_barra.length === 7 && /^\d+$/.test(prev.codigo_barra)) {
                              autoPlu = parseInt(prev.codigo_barra.slice(4), 10) || null
                            }
                            return {
                              ...prev,
                              tipo_venta: isPeso ? "peso" : "unidad",
                              unidad_medida: isPeso ? "KG" : (prev.unidad_medida === "KG" ? "UN" : prev.unidad_medida),
                              plu_balanza: isPeso ? (autoPlu ?? prev.plu_balanza) : prev.plu_balanza,
                            }
                          })
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-amber-200/60 dark:border-amber-800/40 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block mb-1">
                          Código PLU Balanza (1 a 99999)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99999"
                          value={form.plu_balanza || ""}
                          onChange={(e) => setForm({ ...form, plu_balanza: e.target.value ? parseInt(e.target.value) : null })}
                          className="input-field w-full text-xs font-mono font-bold bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
                          placeholder="Ej. 988"
                        />
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                          Número de memoria en balanza para emitir etiqueta con código 20...
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Regla de Balanza:</strong> En productos pesables, el <em>Precio de Venta</em> equivale al <strong>Precio por Kilogramo (Gs./KG)</strong>. Tanto la balanza como el POS fraccionan el peso automáticamente.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASO 2: PRODUCTO POR UNIDAD / CAJA / PACK MAYORISTA */
                <div className="space-y-4">
                  <div className="rounded-2xl p-4 border bg-indigo-500/5 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Boxes className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Presentación Mayorista & Caja Cerrada (DUN-14 / Bulto)</span>
                            {form.tiene_pack && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                                Bulto Activo ({form.pack_cantidad} UN)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Configure la cantidad que contiene la caja del fabricante para compras, recepción y venta por bulto cerrado
                          </div>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={form.tiene_pack}
                          onChange={(e) => setForm({ ...form, tiene_pack: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {form.tiene_pack && (
                      <div className="pt-3 border-t border-indigo-200/60 dark:border-indigo-800/40 space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 block mb-1">
                              Cantidad por Caja / Pack (UN) *
                            </label>
                            <input
                              type="number"
                              min="2"
                              required={form.tiene_pack}
                              value={form.pack_cantidad}
                              onChange={(e) => {
                                const q = Number(e.target.value)
                                setForm({
                                  ...form,
                                  pack_cantidad: q,
                                  pack_etiqueta: form.pack_etiqueta.startsWith("Caja x") ? `Caja x${q}` : form.pack_etiqueta,
                                })
                              }}
                              className="input-field w-full text-xs font-mono font-bold bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700"
                              placeholder="Ej. 12"
                            />
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {[6, 12, 24, 48].map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => setForm({ ...form, pack_cantidad: q, pack_etiqueta: `Caja x${q}` })}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                                    form.pack_cantidad === q
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  x{q}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 block mb-1">
                              Código de Barras de la Caja (DUN-14 / EAN-14)
                            </label>
                            <input
                              type="text"
                              value={form.pack_codigo_barra}
                              onChange={(e) => setForm({ ...form, pack_codigo_barra: e.target.value })}
                              className="input-field w-full text-xs font-mono bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700"
                              placeholder="Ej. 17840001002342"
                            />
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                              Código impreso en la caja de cartón o fardo
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 block mb-1">
                              Etiqueta / Descripción del Bulto
                            </label>
                            <input
                              type="text"
                              value={form.pack_etiqueta}
                              onChange={(e) => setForm({ ...form, pack_etiqueta: e.target.value })}
                              className="input-field w-full text-xs bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 font-semibold"
                              placeholder="Ej. Caja x12 o Fardo x6"
                            />
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-indigo-100/50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-2 text-[11px] text-indigo-950 dark:text-indigo-200 leading-snug">
                          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Regla de Fraccionamiento:</strong> Al escanear este código de caja en el Punto de Venta (POS) o en Recepción de Mercaderías, el sistema computará o descontará automáticamente <strong>{form.pack_cantidad || 1} unidades</strong> del stock individual del producto.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 3: PRECIOS, COSTO BLINDADO & FISCAL SIFEN
          ────────────────────────────────────────────────────────── */}
          {formTab === "precios" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span>Precios, Costo & Rentabilidad</span>
                  </div>

                  {editingProduct && !costoUnlocked && (
                    <div className="flex items-center gap-1.5">
                      {isManagerOrAdmin ? (
                        <button
                          type="button"
                          onClick={() => setCostoUnlocked(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Desbloquear Costo (Gerencia)
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          <Lock className="w-3 h-3 text-slate-400" />
                          Costo Protegido (Solo Gerencia)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Costo Unitario */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Costo Promedio (Gs.)
                      </label>
                      {editingProduct && !costoUnlocked && (
                        <span title="Bloqueado contra edición no autorizada">
                          <Lock className="w-3 h-3 text-slate-400" />
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      disabled={editingProduct ? !costoUnlocked : false}
                      value={form.costo_promedio}
                      onChange={(e) => setForm({ ...form, costo_promedio: Number(e.target.value) })}
                      className={`input-field w-full text-xs font-mono font-bold ${
                        editingProduct && !costoUnlocked
                          ? "bg-slate-100 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700"
                          : "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-600 text-slate-900 dark:text-white"
                      }`}
                    />
                    {costoUnlocked && editingProduct && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Edición manual de costo habilitada
                      </div>
                    )}
                  </div>

                  {/* Precio de Venta al Público */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      {form.tipo_venta === "peso" ? "Precio Venta / KG (Gs.) *" : "Precio Venta Unitario (Gs.) *"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.precio_venta}
                      onChange={(e) => setForm({ ...form, precio_venta: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700"
                    />
                  </div>

                  {/* Tasa de IVA */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Tasa de IVA SIFEN (DNIT)
                    </label>
                    <select
                      value={form.iva_tasa}
                      onChange={(e) => setForm({ ...form, iva_tasa: Number(e.target.value) })}
                      className="input-field w-full text-xs font-semibold"
                    >
                      <option value={10}>10% (General Supermercado / Bebidas / Limpieza)</option>
                      <option value={5}>5% (Canasta Familiar / Frutas / Carnes / Agro)</option>
                      <option value={0}>0% (Exenta - Libros / Insumos agropecuarios)</option>
                    </select>
                  </div>
                </div>

                {/* Widget de Cálculo Dinámico de Margen */}
                {(() => {
                  const costo = Number(form.costo_promedio) || 0
                  const precio = Number(form.precio_venta) || 0
                  const ganancia = precio - costo
                  const margenBruto = precio > 0 ? (ganancia / precio) * 100 : 0
                  const markup = costo > 0 ? (ganancia / costo) * 100 : 0
                  const badgeColor =
                    margenBruto >= 25
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-300 dark:border-emerald-800"
                      : margenBruto >= 10
                      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-300 dark:border-amber-800"
                      : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-300 dark:border-red-800"

                  return (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Ganancia Bruta</div>
                        <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {formatPYG(ganancia)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Margen Bruto</div>
                        <div className={`text-xs font-mono font-black mt-0.5 inline-block px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {margenBruto.toFixed(1)}%
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Markup s/ Costo</div>
                        <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                          {markup > 0 ? `+${markup.toFixed(1)}%` : "0%"}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              TAB 4: INVENTARIO, CAPACIDAD DE GÓNDOLA & PERECEDEROS
          ────────────────────────────────────────────────────────── */}
          {formTab === "inventario" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>Control de Stock & Capacidad de Góndola</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Stock Mínimo de Alerta
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.stock_minimo}
                      onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono font-bold"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Dispara reposición y orden de compra</div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Stock Máximo / Capacidad Góndola
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.stock_maximo}
                      onChange={(e) => setForm({ ...form, stock_maximo: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono"
                      placeholder="0 = Sin límite"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Capacidad máxima del estante o salón</div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Peso Unitario en Kg
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={form.peso_kg || ""}
                      onChange={(e) => setForm({ ...form, peso_kg: Number(e.target.value) })}
                      className="input-field w-full text-xs font-mono"
                      placeholder="Ej. 0.250"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Para cálculo de fletes y logística</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-500" />
                    <span>Trazabilidad, Lotes & Vencimiento</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.es_perecedero}
                          onChange={(e) => setForm({ ...form, es_perecedero: e.target.checked })}
                          className="rounded text-rose-600 focus:ring-rose-500 mt-0.5"
                        />
                        <div>
                          <div>Producto Perecedero</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                            Exige control de fecha de caducidad en recepción de depósito y auditoría de góndola
                          </div>
                        </div>
                      </label>

                      {form.es_perecedero && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Vida Útil Estimada (en Días)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.vida_util_dias || ""}
                            onChange={(e) => setForm({ ...form, vida_util_dias: Number(e.target.value) })}
                            className="input-field w-full text-xs font-mono font-bold"
                            placeholder="Ej. 90"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.tiene_lotes}
                          onChange={(e) => setForm({ ...form, tiene_lotes: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                        />
                        <div>
                          <div>Control de Lotes y Partidas</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                            Exige registrar el número de lote de fábrica en remisiones y recepciones para trazabilidad sanitaria
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
