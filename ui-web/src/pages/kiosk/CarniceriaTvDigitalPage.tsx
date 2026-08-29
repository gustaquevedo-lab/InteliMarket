import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Flame, Beef, Award, Sparkles, Volume2, VolumeX, Maximize2,
  Clock, ShieldCheck, Tag, ShoppingBag, ChevronRight, Layers, Users
} from "lucide-react"
import { api, type Product } from "../../api"

interface MeatProduct {
  id: string
  nombre: string
  categoria: "bovino" | "porcino" | "ave" | "embutido" | "elaborado"
  precio: number
  precio_club?: number
  stock_kg: number
  foto_url?: string
  etiqueta?: string
  origen?: string
  destacado?: boolean
  descripcion?: string
}

// Catálogo por defecto de cortes de Extra Supermercado con fotos HD de cortes cárnicos
const DEFAULT_CORTES: MeatProduct[] = [
  // ── BOVINOS ──
  {
    id: "bov-1",
    nombre: "Tapa Cuadril (Picaña) Premium",
    categoria: "bovino",
    precio: 72000,
    precio_club: 68000,
    stock_kg: 28.5,
    foto_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
    etiqueta: "CORTE ESTRELLA",
    origen: "Novillo Seleccionado",
    destacado: true,
    descripcion: "Corte premium con capa de grasa perfecta para parrilla."
  },
  {
    id: "bov-2",
    nombre: "Costilla de Primera (Tira Ancha)",
    categoria: "bovino",
    precio: 42000,
    precio_club: 38900,
    stock_kg: 64.0,
    foto_url: "https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80",
    etiqueta: "OFERTA EXTRA",
    origen: "Frigorífico Nacional",
    destacado: true,
    descripcion: "Sabor y terneza inigualable para el asado del domingo."
  },
  {
    id: "bov-3",
    nombre: "Vacío Entero Parrillero",
    categoria: "bovino",
    precio: 46000,
    precio_club: 43500,
    stock_kg: 32.0,
    foto_url: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80",
    etiqueta: "SELECCIÓN",
    origen: "Chaco Paraguayo",
    destacado: false,
    descripcion: "Corte jugoso y fibroso de cocción lenta a la brasa."
  },
  {
    id: "bov-4",
    nombre: "Lomo Vacuno Especial",
    categoria: "bovino",
    precio: 65000,
    precio_club: 61500,
    stock_kg: 18.0,
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80",
    etiqueta: "EXTRA TIERNO",
    origen: "Novillo Liviano",
    destacado: false,
    descripcion: "Máxima terneza sin grasa, ideal para bifes y medallones."
  },
  {
    id: "bov-5",
    nombre: "Cupim Tradicional Especial",
    categoria: "bovino",
    precio: 36000,
    precio_club: 33000,
    stock_kg: 22.0,
    foto_url: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&auto=format&fit=crop&q=80",
    etiqueta: "TRADICIÓN",
    origen: "Gyr / Nelore",
    destacado: true,
    descripcion: "Corte marmolado con cocción en papel aluminio a fuego lento."
  },

  // ── PORCINOS ──
  {
    id: "por-1",
    nombre: "Costillita de Cerdo Grill",
    categoria: "porcino",
    precio: 34000,
    precio_club: 31000,
    stock_kg: 45.0,
    foto_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
    etiqueta: "PARRILLERO",
    origen: "Granja Santa Teresa",
    destacado: true,
    descripcion: "Tierna, jugosa y con el corte ideal para asar a la parrilla."
  },
  {
    id: "por-2",
    nombre: "Matambrito de Cerdo al Limón",
    categoria: "porcino",
    precio: 45000,
    precio_club: 41900,
    stock_kg: 19.5,
    foto_url: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80",
    etiqueta: "FAVORITO",
    origen: "Granja Santa Teresa",
    destacado: true,
    descripcion: "Crocante por fuera y suave por dentro. Excelente a la chapa."
  },

  // ── AVES ──
  {
    id: "ave-1",
    nombre: "Pechuga de Pollo Fresca",
    categoria: "ave",
    precio: 23000,
    precio_club: 21500,
    stock_kg: 50.0,
    foto_url: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&auto=format&fit=crop&q=80",
    etiqueta: "100% FRESCO",
    origen: "Faena Diaria",
    destacado: false,
    descripcion: "Deshuesada y limpia, lista para milanesas o grill."
  },
  {
    id: "ave-2",
    nombre: "Muslo Entero de Pollo",
    categoria: "ave",
    precio: 16500,
    precio_club: 14900,
    stock_kg: 60.0,
    foto_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&auto=format&fit=crop&q=80",
    etiqueta: "SUPER PRECIO",
    origen: "Faena Diaria",
    destacado: false,
    descripcion: "Ideal para guisados, horno y parrilla."
  },

  // ── ELABORADOS PROPIOS & EMBUTIDOS ──
  {
    id: "emb-1",
    nombre: "Chorizo Casero Extra Parrillero",
    categoria: "embutido",
    precio: 29000,
    precio_club: 26500,
    stock_kg: 35.0,
    foto_url: "https://images.unsplash.com/photo-1597393353415-b3730f3719fe?w=800&auto=format&fit=crop&q=80",
    etiqueta: "RECETA DE LA CASA",
    origen: "Elaboración Propia Extra",
    destacado: true,
    descripcion: "Elaborado a diario con carne seleccionada y condimentos naturales."
  },
  {
    id: "emb-2",
    nombre: "Chorizo Puro Cerdo Toscano",
    categoria: "embutido",
    precio: 36000,
    precio_club: 33000,
    stock_kg: 24.0,
    foto_url: "https://images.unsplash.com/photo-1597393353415-b3730f3719fe?w=800&auto=format&fit=crop&q=80",
    etiqueta: "GOURMET",
    origen: "Elaboración Propia Extra",
    destacado: true,
    descripcion: "Receta tradicional italiana con vino blanco y hierbas finas."
  },
  {
    id: "emb-3",
    nombre: "Hamburguesa Artesanal 100% Picaña",
    categoria: "elaborado",
    precio: 38000,
    precio_club: 35000,
    stock_kg: 15.0,
    foto_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    etiqueta: "BURGER MASTER",
    origen: "Elaboración Propia Extra",
    destacado: true,
    descripcion: "Pack de 4 medallones gruesos de pura picaña sin aditivos."
  }
]

const formatPYG = (n: number) => `₲ ${Math.round(n || 0).toLocaleString("es-PY")}`
const displayFont = { fontFamily: "'Archivo Expanded', system-ui, sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', 'SF Mono', monospace" }

export default function CarniceriaTvDigitalPage() {
  const [searchParams] = useSearchParams()
  const screenMode = searchParams.get("screen") || "1" // "1" = Menuboard | "2" = Spotlight/Combos/Turnero | "all" = Mixto

  const [cortes, setCortes] = useState<MeatProduct[]>(DEFAULT_CORTES)
  const [loading, setLoading] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<string>("bovino")
  const [time, setTime] = useState(new Date())

  // Turnero Digital (Encausador de Filas)
  const [currentTurn, setCurrentTurn] = useState<string>("A-042")
  const [turnBoca, setTurnBoca] = useState<string>("Balanza 02")

  // Reloj en pantalla
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sincronización en vivo con la base de datos de productos de Intelimarket
  const fetchLivePrices = useCallback(async () => {
    try {
      const res = await api.products.list({ limit: 100 })
      const dbProducts = Array.isArray(res) ? res : ((res as any)?.items || [])
      
      // Mapear y actualizar precios y stock en vivo
      setCortes((prev) =>
        prev.map((c) => {
          const match = dbProducts.find((p: Product) =>
            p.nombre.toLowerCase().includes(c.nombre.toLowerCase().split(" ")[0]) ||
            c.nombre.toLowerCase().includes(p.nombre.toLowerCase().split(" ")[0])
          )
          if (match) {
            return {
              ...c,
              precio: match.precio_venta || match.precio || c.precio,
              stock_kg: match.stock !== undefined ? match.stock : c.stock_kg,
            }
          }
          return c
        })
      )
    } catch (e) {
      // Fallback a los datos en memoria
    }
  }, [])

  useEffect(() => {
    fetchLivePrices()
    const interval = setInterval(fetchLivePrices, 15000)
    return () => clearInterval(interval)
  }, [fetchLivePrices])

  // ── FILTRO ESTRICTO DE STOCK: Si un corte no tiene stock (stock <= 0), DESAPARECE DE LA TV ──
  const activeStockCortes = useMemo(() => {
    return cortes.filter((c) => c.stock_kg > 0)
  }, [cortes])

  const categorias = ["bovino", "porcino", "ave", "embutido", "elaborado"]

  // Rotación automática de categorías y diapositivas
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCategory((prev) => {
        const nextIdx = (categorias.indexOf(prev) + 1) % categorias.length
        return categorias[nextIdx]
      })
      setCurrentSlideIndex((prev) => (prev + 1) % 4)
    }, 10000) // Cambia cada 10 segundos
    return () => clearInterval(interval)
  }, [categorias])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const destacados = activeStockCortes.filter((c) => c.destacado)
  const currentDestacado = destacados[currentSlideIndex % Math.max(1, destacados.length)] || activeStockCortes[0]
  const currentCategoryCortes = activeStockCortes.filter((c) => c.categoria === activeCategory)

  return (
    <div className="fixed inset-0 bg-[#0B0D12] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* ── HEADER SUPERIOR DE LA TV ── */}
      <div className="bg-gradient-to-b from-black/90 via-black/50 to-transparent p-6 pb-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-red-600/30">
            <Beef className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-black text-2xl tracking-wider uppercase text-white" style={displayFont}>
                BOUTIQUE DE CARNES
              </h1>
              <span className="px-3 py-1 rounded-full bg-red-600/30 border border-red-500/40 text-red-400 font-bold text-xs flex items-center gap-1.5 uppercase tracking-widest">
                <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Cortes Seleccionados
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              EXTRA SUPERMERCADO · Precios y Stock Sincronizados en Tiempo Real
            </div>
          </div>
        </div>

        {/* Turnero Digital en Pantalla & Reloj */}
        <div className="flex items-center gap-5">
          {/* Módulo de Encausador de Filas (Turnero) */}
          <div className="bg-gradient-to-r from-red-950/80 to-slate-900/90 border-2 border-red-500/60 rounded-2xl px-5 py-2.5 flex items-center gap-3 shadow-xl shadow-red-600/20 animate-pulse">
            <div className="p-2 rounded-xl bg-red-600 text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-red-400">
                TURNO ATENDIENDO
              </div>
              <div className="font-black text-2xl text-white tracking-widest" style={monoFont}>
                {currentTurn}
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 border-l border-slate-700 pl-3">
              {turnBoca}
            </div>
          </div>

          <div className="text-right">
            <div className="font-black text-2xl text-amber-400" style={monoFont}>
              {time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              {time.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "short" })}
            </div>
          </div>

          <button
            onClick={toggleFullScreen}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL DIVIDIDO EN 2 COLUMNAS (16:9 DUAL SCREEN EXPERIENCE) ── */}
      <div className="flex-1 px-6 py-2 grid grid-cols-12 gap-6 items-stretch min-h-0 z-10">
        
        {/* COLUMNA IZQUIERDA: SPOTLIGHT / CORTE DEL DÍA / COMBO PARRILLERO (5 COLUMNAS) */}
        <div className="col-span-5 flex flex-col justify-between rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-black border border-slate-800 p-6 relative overflow-hidden shadow-2xl">
          {/* Fondo de brillo ámbar */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

          {currentDestacado && (
            <div className="flex flex-col justify-between h-full relative z-10 animate-fade-in">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-md shadow-amber-500/30 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> {currentDestacado.etiqueta || "RECOMENDADO DEL CHEF"}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {currentDestacado.origen}
                  </span>
                </div>

                <h2 className="font-black text-3xl text-white leading-tight mb-2" style={displayFont}>
                  {currentDestacado.nombre}
                </h2>
                <p className="text-sm text-slate-300 font-medium line-clamp-2 mb-4">
                  {currentDestacado.descripcion}
                </p>
              </div>

              {/* Imagen en Alta Resolución del Corte */}
              <div className="w-full h-56 rounded-2xl overflow-hidden my-auto border-2 border-slate-800 shadow-xl relative group">
                <img
                  src={currentDestacado.foto_url}
                  alt={currentDestacado.nombre}
                  className="w-full h-full object-cover transform hover:scale-105 transition duration-700"
                />
                <div className="absolute bottom-2 left-2 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md text-[11px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Stock Disponible: {currentDestacado.stock_kg.toFixed(1)} Kg
                </div>
              </div>

              {/* Bloque de Precios Grande y Destacado */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 mt-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Precio por Kilo:
                  </div>
                  <div className="font-black text-3xl text-white tracking-tight" style={monoFont}>
                    {formatPYG(currentDestacado.precio)}
                  </div>
                </div>

                {currentDestacado.precio_club && (
                  <div className="border-l border-slate-800 pl-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Award className="w-3 h-3" /> Socio Extra Club:
                    </div>
                    <div className="font-black text-3xl text-amber-400 tracking-tight" style={monoFont}>
                      {formatPYG(currentDestacado.precio_club)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: MENUBOARD DINÁMICO DE PRECIOS EN VIVO (7 COLUMNAS) */}
        <div className="col-span-7 flex flex-col justify-between rounded-3xl bg-slate-950/80 border border-slate-800/90 p-6 relative overflow-hidden shadow-2xl backdrop-blur-md">
          <div>
            {/* Pestañas / Selector de Categorías en TV */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              {[
                { id: "bovino", label: "Cortes Bovinos", icon: Beef },
                { id: "porcino", label: "Cortes de Cerdo", icon: Flame },
                { id: "ave", label: "Aves & Pollo", icon: Award },
                { id: "embutido", label: "Chorizos Caseros", icon: Layers },
                { id: "elaborado", label: "Elaborados Extra", icon: Sparkles },
              ].map((cat) => {
                const Icon = cat.icon
                const active = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                      active
                        ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30 scale-105"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Listado / Tabla de Precios de Cortes */}
            <div className="space-y-2.5">
              {currentCategoryCortes.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Cortes temporalmente agotados en este sector.
                </div>
              ) : (
                currentCategoryCortes.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-900/40 border border-slate-800/80 flex items-center justify-between gap-4 hover:border-red-500/50 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                        {c.foto_url ? (
                          <img src={c.foto_url} alt={c.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <Beef className="w-6 h-6 text-slate-500 m-auto mt-3" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-white truncate" style={displayFont}>
                            {c.nombre}
                          </span>
                          {c.etiqueta && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/30 text-red-400 shrink-0">
                              {c.etiqueta}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.origen || "Extra Calidad"} · <span className="text-emerald-400 font-bold">En Stock ({c.stock_kg.toFixed(0)} Kg)</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-4">
                      {c.precio_club && (
                        <div className="hidden sm:block">
                          <div className="text-[9px] font-black uppercase text-amber-400">Club Extra</div>
                          <div className="font-black text-lg text-amber-400" style={monoFont}>
                            {formatPYG(c.precio_club)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Precio / Kg</div>
                        <div className="font-black text-2xl text-white" style={monoFont}>
                          {formatPYG(c.precio)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ticker / Banner Inferior de Combos Parrilleros */}
          <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 border border-red-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-xs uppercase tracking-wider text-amber-300">
                  COMBO ASADO DEL DOMINGO
                </div>
                <div className="text-xs text-white font-medium">
                  Costilla de Primera (5 Kg) + 1 Bolsa Carbón 5Kg + Sal Parrillera = <strong className="text-amber-400 font-black" style={monoFont}>₲ 195.000</strong>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 tracking-wider">
              Pedilo al Carnicero
            </span>
          </div>
        </div>

      </div>

      {/* ── FOOTER DE LA TV ── */}
      <div className="bg-black/90 border-t border-slate-800/80 px-6 py-2 flex items-center justify-between text-xs text-slate-400 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Sincronización Automática Activa
          </span>
          <span>·</span>
          <span>Cortes con stock agotado se retiran de forma automática</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span>Extra Digital Signage v2.4</span>
          <span>·</span>
          <span>Google TV 55" Panel</span>
        </div>
      </div>

    </div>
  )
}
