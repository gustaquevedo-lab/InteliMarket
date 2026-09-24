import { useState, useEffect, useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Search, ShoppingCart, Filter, Sparkles, Tag, ChevronRight,
  Truck, ShieldCheck, Clock, Zap, Check, Plus, Minus,
  ArrowRight, Heart, Flame, Star, Package, Layers, RefreshCw
} from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import EcommerceLayout from "./EcommerceLayout"

const HERO_BANNERS = [
  {
    id: 1,
    title: "OFERTAS DE LA SEMANA",
    subtitle: "Descuentos de hasta 35% en Almacén, Bebidas y Lácteos",
    badge: "SUPER EXTRA DEALS",
    color: "from-red-600 to-amber-600",
    bgPattern: "bg-radial-gradient",
    cta: "Ver Ofertas",
    tag: "Ahorro Garantizado"
  },
  {
    id: 2,
    title: "MIÉRCOLES DE FRESCOS",
    subtitle: "Frutas y verduras recién cosechadas directo de huerta",
    badge: "100% NATURAL",
    color: "from-emerald-600 to-teal-700",
    bgPattern: "bg-radial-gradient",
    cta: "Comprar Frescos",
    tag: "Calidad Premium"
  },
  {
    id: 3,
    title: "ESPECIAL CARNICERÍA & ASADO",
    subtitle: "Cortes de novillo seleccionados y envasados al vacío",
    badge: "CORTE SUPREMO",
    color: "from-rose-700 to-red-900",
    bgPattern: "bg-radial-gradient",
    cta: "Elegir Cortes",
    tag: "Cadena de Frío"
  },
]

const DEPARTMENTS = [
  { id: "all", name: "Todos", icon: "🛒" },
  { id: "carnes", name: "Carnicería", icon: "🥩" },
  { id: "frescos", name: "Verdulería & Frutas", icon: "🥬" },
  { id: "lacteos", name: "Lácteos & Quesos", icon: "🥛" },
  { id: "panaderia", name: "Panadería & Rotisería", icon: "🍞" },
  { id: "almacen", name: "Almacén & Despensa", icon: "🥫" },
  { id: "bebidas", name: "Bebidas & Licores", icon: "🍷" },
  { id: "limpieza", name: "Limpieza del Hogar", icon: "🧼" },
]

export default function EcommerceCatalog() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get("q") || "")
  const [selectedDept, setSelectedDept] = useState("all")
  const [currentBanner, setCurrentBanner] = useState(0)
  const [loading, setLoading] = useState(true)

  // Cantidades por producto para agregar al carrito
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [addingId, setAddingId] = useState<string | null>(null)
  const perPage = 24

  // Rotación de banner
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % HERO_BANNERS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const loadCatalog = async () => {
    setLoading(true)
    try {
      // Intentar cargar del endpoint de ecommerce o fallback al catálogo general de productos
      const [catData, catsData] = await Promise.allSettled([
        ecommerceApi.catalog(search, selectedDept !== "all" ? selectedDept : "", page),
        ecommerceApi.categories(),
      ])

      let loadedProducts: any[] = []
      let loadedTotal = 0

      if (catData.status === "fulfilled" && catData.value?.products?.length > 0) {
        loadedProducts = catData.value.products
        loadedTotal = catData.value.total || loadedProducts.length
      } else {
        // Fallback a productos generales si ecommerce aún no tiene asignados
        const fallback = await api.products.list({ limit: perPage })
        loadedProducts = fallback || []
        loadedTotal = fallback?.length || 0
      }

      if (catsData.status === "fulfilled" && catsData.value) {
        setCategories(catsData.value)
      }

      setProducts(loadedProducts)
      setTotal(loadedTotal)
    } catch {
      // Fallback limpio
      try {
        const fallback = await api.products.list({ limit: perPage })
        setProducts(fallback || [])
        setTotal(fallback?.length || 0)
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [page, selectedDept])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadCatalog()
  }

  const handleQuantityChange = (productId: string, delta: number) => {
    const current = quantities[productId] || 1
    const next = Math.max(1, current + delta)
    setQuantities({ ...quantities, [productId]: next })
  }

  const handleAddToCart = async (product: any) => {
    const token = localStorage.getItem("ecommerce_token")
    const qty = quantities[product.id] || 1

    setAddingId(product.id)
    try {
      if (token) {
        await ecommerceApi.addToCart(product.id, qty)
      } else {
        // Guardar en carrito local
        const localCart = JSON.parse(localStorage.getItem("super_extra_cart") || "[]")
        const existing = localCart.find((i: any) => i.id === product.id)
        if (existing) {
          existing.cantidad += qty
        } else {
          localCart.push({
            id: product.id,
            nombre: product.nombre,
            precio: product.precio,
            imagen_url: product.imagen_url,
            cantidad: qty,
          })
        }
        localStorage.setItem("super_extra_cart", JSON.stringify(localCart))
      }
      toast.success("Agregado al carrito", `${qty}x ${product.nombre}`)
    } catch {
      toast.error("Error", "No se pudo agregar el producto al carrito")
    } finally {
      setAddingId(null)
    }
  }

  const activeBanner = HERO_BANNERS[currentBanner]

  return (
    <EcommerceLayout>
      <div className="space-y-8">
        {/* ── HERO BANNER PROMOVIONAL SUPER EXTRA ──────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden shadow-lg border border-red-900/10">
          <div className={`p-8 md:p-12 bg-gradient-to-r ${activeBanner.color} text-white transition-all duration-700 flex flex-col md:flex-row items-center justify-between gap-6 relative`}>
            {/* Elementos decorativos */}
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute left-1/3 -top-12 w-48 h-48 bg-yellow-400/10 rounded-full blur-xl pointer-events-none" />

            <div className="space-y-4 max-w-xl z-10 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>{activeBanner.badge}</span>
                <span className="opacity-60">·</span>
                <span className="text-yellow-200">{activeBanner.tag}</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight uppercase">
                {activeBanner.title}
              </h2>

              <p className="text-white/90 text-sm md:text-base font-medium">
                {activeBanner.subtitle}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <button
                  onClick={() => {
                    const el = document.getElementById("catalog-section")
                    el?.scrollIntoView({ behavior: "smooth" })
                  }}
                  className="px-6 py-3 rounded-2xl bg-white text-gray-900 font-extrabold text-xs uppercase tracking-wider shadow-lg hover:bg-yellow-300 transition-all flex items-center gap-2 active:scale-95"
                >
                  <span>{activeBanner.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-black/20 backdrop-blur-sm text-xs font-bold text-white/90">
                  <Clock className="w-4 h-4 text-yellow-300" />
                  <span>Entrega en 60 min</span>
                </div>
              </div>
            </div>

            {/* Paginadores del Banner */}
            <div className="flex md:flex-col gap-2 z-10">
              {HERO_BANNERS.map((b, idx) => (
                <button
                  key={b.id}
                  onClick={() => setCurrentBanner(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentBanner === idx ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── BARRA DE BENEFICIOS EXTRA SUPERMERCADO ───────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Truck, title: "Envío en el Día", desc: "Pedro Juan Caballero & Ponta Porã", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40" },
            { icon: ShieldCheck, title: "Cadena de Frío", desc: "Carnes y frescos garantizados", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
            { icon: Zap, title: "Pick-up en Local", desc: "Retirá rápido sin filas en caja", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
            { icon: Tag, title: "Precios Mayoristas", desc: "Escalas por unidad y fardo cerrado", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
          ].map((b, idx) => (
            <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${b.color}`}>
                <b.icon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="font-extrabold text-xs text-gray-900 dark:text-white leading-tight">{b.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── SELECTOR DE DEPARTAMENTOS / CATEGORÍAS ───────────────────────── */}
        <div className="space-y-3" id="catalog-section">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-lg text-gray-900 dark:text-white tracking-tight uppercase">
                Departamentos & Categorías
              </h3>
              <p className="text-xs text-gray-400">Seleccioná una sección para ver los productos frescos y envasados</p>
            </div>
            <span className="text-xs font-bold text-red-600">{total} productos listados</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {DEPARTMENTS.map((dept) => {
              const active = selectedDept === dept.id
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setSelectedDept(dept.id)
                    setPage(1)
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 ${
                    active
                      ? "bg-red-600 text-white shadow-md shadow-red-600/20 scale-105"
                      : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base">{dept.icon}</span>
                  <span>{dept.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── BUSCADOR & FILTROS ────────────────────────────────────────────── */}
        <div className="card p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
          <form onSubmit={handleSearch} className="relative flex-1 w-full">
            <Search className="absolute left-3.5 w-4 h-4 text-gray-400 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre de producto, marca, corte o código de barra..."
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-24 py-2.5 text-xs font-medium outline-none focus:border-red-500 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded-lg shadow-xs transition"
            >
              Buscar
            </button>
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setSearch("")
                setSelectedDept("all")
                loadCatalog()
              }}
              className="p-2.5 text-gray-400 hover:text-red-600 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 transition"
              title="Limpiar filtros"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── GRID DE PRODUCTOS DE SUPERMERCADO ─────────────────────────────── */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 font-bold">Cargando góndolas y productos en tiempo real...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="card p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto text-xl">
              🛒
            </div>
            <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">No se encontraron productos</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Probá ajustando el término de búsqueda o cambiando el departamento seleccionado.
            </p>
            <button
              onClick={() => {
                setSearch("")
                setSelectedDept("all")
                loadCatalog()
              }}
              className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              Ver Todo el Catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {products.map((p) => {
              const qty = quantities[p.id] || 1
              const precio = Number(p.precio || p.precio_unitario || 0)
              const precioOferta = p.descuento ? precio * (1 - p.descuento / 100) : precio
              const hasStock = p.stock === undefined || p.stock > 0

              return (
                <div
                  key={p.id}
                  className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-red-500/30 transition-all flex flex-col justify-between group"
                >
                  {/* FOTO / ICONO & BADGES */}
                  <div className="relative aspect-square bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center p-4 overflow-hidden">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center text-3xl">
                        🛒
                      </div>
                    )}

                    {/* Badge de Oferta */}
                    {p.descuento ? (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                        -{p.descuento}% OFF
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                        FRESCO
                      </span>
                    )}
                  </div>

                  {/* INFO DEL PRODUCTO */}
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">
                        {p.categoria_nombre || p.categoria || "Super Extra"}
                      </p>
                      <Link to={`/tienda/producto/${p.id}`}>
                        <h4 className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-2 hover:text-red-600 transition leading-snug">
                          {p.nombre}
                        </h4>
                      </Link>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {p.unidad_medida ? `x ${p.unidad_medida}` : "Unidad"}
                      </p>
                    </div>

                    {/* PRECIOS & ACCIÓN DE COMPRA */}
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                      <div className="flex flex-col leading-none">
                        {p.descuento ? (
                          <span className="text-[10px] text-gray-400 line-through font-mono">
                            {formatPYG(precio)}
                          </span>
                        ) : null}
                        <span className="text-sm font-black font-mono text-brandOrange dark:text-orange-400">
                          {formatPYG(precioOferta)}
                        </span>
                        
                        {/* ESTRUCTURA PLANIFICADA FASE 3: PRECIO SOCIO EXTRA CLUB (SIN EFECTO AÚN) */}
                        {p.precio_extra_club && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Extra Club: {formatPYG(p.precio_extra_club)}</span>
                          </div>
                        )}
                      </div>

                      {/* SELECTOR DE CANTIDAD & BOTÓN */}
                      {hasStock ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
                            <button
                              onClick={() => handleQuantityChange(p.id, -1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-xs hover:bg-gray-200"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs">{qty}</span>
                            <button
                              onClick={() => handleQuantityChange(p.id, 1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-xs hover:bg-gray-200"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleAddToCart(p)}
                            disabled={addingId === p.id}
                            className="w-full py-2 bg-gradient-to-r from-brandOrange to-brandRed hover:from-orange-600 hover:to-red-600 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="py-1.5 px-2 bg-gray-100 dark:bg-slate-800 rounded-xl text-center text-[10px] font-bold text-gray-400">
                          Agotado Temporalmente
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── PAGINACIÓN ───────────────────────────────────────────────────── */}
        {total > perPage && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-bold disabled:opacity-30 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="text-xs font-mono font-bold text-gray-500">
              Página {page} de {Math.ceil(total / perPage)}
            </span>
            <button
              disabled={page >= Math.ceil(total / perPage)}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-bold disabled:opacity-30 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </EcommerceLayout>
  )
}
