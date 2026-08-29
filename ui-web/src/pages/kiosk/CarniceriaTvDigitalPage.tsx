import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Flame, Beef, Award, Sparkles, Volume2, VolumeX, Maximize2,
  Clock, ShieldCheck, Tag, ShoppingBag, ChevronRight, Layers, Users,
  Sun, Moon
} from "lucide-react"
import { api, type Product } from "../../api"

export interface MeatProduct {
  id: string
  nombre: string
  categoria: "bovino" | "porcino" | "ave" | "embutido" | "elaborado" | "otros"
  precio: number
  precio_club?: number
  stock_kg: number
  foto_url?: string
  etiqueta?: string
  origen?: string
  destacado?: boolean
  descripcion?: string
  sku?: string
}

export interface TvCarniceriaConfig {
  theme: "dark" | "light"
  intervalo_segundos: number
  mostrar_club_extra: boolean
  mostrar_turnero: boolean
  mostrar_combo_banner: boolean
  combo_titulo: string
  combo_descripcion: string
  combo_precio: string
  productos_visibles_ids: string[]
  custom_products?: MeatProduct[]
}

export const DEFAULT_TV_CONFIG: TvCarniceriaConfig = {
  theme: "light",
  intervalo_segundos: 8,
  mostrar_club_extra: false,
  mostrar_turnero: false,
  mostrar_combo_banner: true,
  combo_titulo: "COMBO ASADO DEL DOMINGO",
  combo_descripcion: "Costilla de Primera (5 Kg) + 1 Bolsa Carbón 5Kg + Sal Parrillera",
  combo_precio: "₲ 195.000",
  productos_visibles_ids: [
    "bov-1", "bov-2", "bov-3", "bov-4", "bov-5", "bov-6", "bov-7",
    "por-1", "por-2", "por-3", "por-4",
    "ave-1", "ave-2", "ave-3",
    "emb-1", "emb-2", "emb-3", "emb-4", "emb-5"
  ],
  custom_products: []
}

export const DEFAULT_CORTES: MeatProduct[] = [
  // ── BOVINOS / VACUNOS ──
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
    descripcion: "Corte premium con capa de grasa uniforme ideal para sellar y servir a punto."
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
    descripcion: "Sabor y terneza inigualable para el asado del fin de semana."
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
  {
    id: "bov-6",
    nombre: "Bife de Chorizo / Ojo de Bife",
    categoria: "bovino",
    precio: 58000,
    precio_club: 54000,
    stock_kg: 25.0,
    foto_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
    etiqueta: "PARRILLERO",
    origen: "Novillo Liviano",
    destacado: false,
    descripcion: "Corte central del lomo con grasa intramuscular de altísimo sabor."
  },
  {
    id: "bov-7",
    nombre: "Matambre Vacuno Tierno",
    categoria: "bovino",
    precio: 41000,
    precio_club: 38000,
    stock_kg: 20.0,
    foto_url: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80",
    etiqueta: "AL LIMÓN",
    origen: "Frigorífico Nacional",
    destacado: false,
    descripcion: "Ideal para preparar a la pizza o arrollado con condimentos."
  },
  {
    id: "bov-8",
    nombre: "Colita de Cuadril Selección",
    categoria: "bovino",
    precio: 52000,
    precio_club: 49000,
    stock_kg: 19.0,
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80",
    etiqueta: "GOURMET",
    origen: "Novillo Seleccionado",
    destacado: false,
    descripcion: "Corte magro y tierno, excelente para horno o asador cruz."
  },
  {
    id: "bov-9",
    nombre: "Peceto / Bola de Lomo de Primera",
    categoria: "bovino",
    precio: 47000,
    precio_club: 44000,
    stock_kg: 35.0,
    foto_url: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&auto=format&fit=crop&q=80",
    etiqueta: "MILANESAS",
    origen: "Novillo Seleccionado",
    destacado: false,
    descripcion: "Corte sin nervios ni grasa, perfecto para milanesas y estofados."
  },
  {
    id: "bov-10",
    nombre: "Puchero Especial / Carnaza Negra",
    categoria: "bovino",
    precio: 26000,
    precio_club: 23500,
    stock_kg: 40.0,
    foto_url: "https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80",
    etiqueta: "ECONÓMICO",
    origen: "Faena Nacional",
    destacado: false,
    descripcion: "Rendidor con hueso y carne para caldos y guisados nutritivos."
  },

  // ── PORCINOS / CERDO ──
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
  {
    id: "por-3",
    nombre: "Bondiola de Cerdo Entera",
    categoria: "porcino",
    precio: 38000,
    precio_club: 35000,
    stock_kg: 28.0,
    foto_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80",
    etiqueta: "MARMOLADO",
    origen: "Granja Santa Teresa",
    destacado: false,
    descripcion: "Sabor supremo con infiltración de grasa suave, ideal para ahumar o asar."
  },
  {
    id: "por-4",
    nombre: "Panceta de Cerdo con Cuero (Pork Belly)",
    categoria: "porcino",
    precio: 32000,
    precio_club: 29500,
    stock_kg: 22.0,
    foto_url: "https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80",
    etiqueta: "CROCANTE",
    origen: "Granja Santa Teresa",
    destacado: false,
    descripcion: "Corte perfecto para chicharrón crocante o asado a fuego lento."
  },

  // ── AVES / POLLO ──
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
  {
    id: "ave-3",
    nombre: "Alitas de Pollo para Grill",
    categoria: "ave",
    precio: 21000,
    precio_club: 19000,
    stock_kg: 35.0,
    foto_url: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&auto=format&fit=crop&q=80",
    etiqueta: "BOTANA",
    origen: "Faena Diaria",
    destacado: false,
    descripcion: "Crocantes y sabrosas con salsa barbacoa o limón a la parrilla."
  },
  {
    id: "ave-4",
    nombre: "Pollo Entero Faenado del Día",
    categoria: "ave",
    precio: 15500,
    precio_club: 13900,
    stock_kg: 70.0,
    foto_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&auto=format&fit=crop&q=80",
    etiqueta: "AL ESPIEDO",
    origen: "Faena Diaria",
    destacado: true,
    descripcion: "Pollo fresco seleccionado para horno, espiedo o parrilla."
  },

  // ── EMBUTIDOS & ELABORADOS CASEROS ──
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
    nombre: "Morcilla Tradicional con Verdeo",
    categoria: "embutido",
    precio: 25000,
    precio_club: 22500,
    stock_kg: 20.0,
    foto_url: "https://images.unsplash.com/photo-1597393353415-b3730f3719fe?w=800&auto=format&fit=crop&q=80",
    etiqueta: "TRADICIONAL",
    origen: "Elaboración Propia Extra",
    destacado: false,
    descripcion: "Cremosa con verdeo fresco y nuez moscada."
  },
  {
    id: "emb-4",
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
  },
  {
    id: "emb-5",
    nombre: "Milanesas de Bola de Lomo Preparadas",
    categoria: "elaborado",
    precio: 37000,
    precio_club: 34000,
    stock_kg: 25.0,
    foto_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    etiqueta: "LISTAS PARA FREIR",
    origen: "Elaboración Propia Extra",
    destacado: false,
    descripcion: "Rebozado crujiente con huevo de campo y perejil fresco."
  }
]

const formatPYG = (n: number) => `₲ ${Math.round(n || 0).toLocaleString("es-PY")}`
const displayFont = { fontFamily: "'Archivo Expanded', system-ui, sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', 'SF Mono', monospace" }

export default function CarniceriaTvDigitalPage() {
  const [searchParams] = useSearchParams()

  // Configuración de la TV (con soporte de live reload desde localStorage)
  const [config, setConfig] = useState<TvCarniceriaConfig>(() => {
    try {
      const saved = localStorage.getItem("extra_tv_carniceria_config")
      if (saved) return { ...DEFAULT_TV_CONFIG, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_TV_CONFIG
  })

  // Escuchar cambios de configuración en vivo
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("extra_tv_carniceria_config")
        if (saved) setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }))
      } catch {}
    }
    window.addEventListener("storage", handleStorage)
    const interval = setInterval(handleStorage, 3000)
    return () => {
      window.removeEventListener("storage", handleStorage)
      clearInterval(interval)
    }
  }, [])

  // Combinación de la lista base con los productos agregados desde el sistema
  const allAvailableCortes = useMemo(() => {
    const custom = config.custom_products || []
    const combined = [...DEFAULT_CORTES]
    for (const cp of custom) {
      if (!combined.some((c) => c.id === cp.id)) {
        combined.push(cp)
      }
    }
    return combined
  }, [config.custom_products])

  const [cortes, setCortes] = useState<MeatProduct[]>(allAvailableCortes)
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0)
  const [time, setTime] = useState(new Date())

  // Turnero Digital (Encausador de Filas)
  const [currentTurn, setCurrentTurn] = useState<string>("A-042")
  const [turnBoca, setTurnBoca] = useState<string>("Balanza 02")

  // Reloj en pantalla
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sincronización en vivo con la base de datos real de productos de Intelimarket
  const fetchLivePrices = useCallback(async () => {
    try {
      const res = await api.products.list({ limit: 200 })
      const dbProducts = Array.isArray(res) ? res : ((res as any)?.items || [])
      
      setCortes((prev) =>
        prev.map((c) => {
          // Coincidencia exacta por ID o por coincidencia de nombre en la BD
          const match = dbProducts.find((p: Product) =>
            p.id === c.id ||
            p.nombre.toLowerCase().trim() === c.nombre.toLowerCase().trim() ||
            p.nombre.toLowerCase().includes(c.nombre.toLowerCase().split(" ")[0]) ||
            c.nombre.toLowerCase().includes(p.nombre.toLowerCase().split(" ")[0])
          )
          if (match) {
            const dbPrice = match.precio_venta || match.precio || c.precio
            return {
              ...c,
              precio: dbPrice,
              stock_kg: match.stock !== undefined ? match.stock : c.stock_kg,
              foto_url: match.imagen_url || c.foto_url
            }
          }
          return c
        })
      )
    } catch {}
  }, [])

  useEffect(() => {
    fetchLivePrices()
    const interval = setInterval(fetchLivePrices, 15000)
    return () => clearInterval(interval)
  }, [fetchLivePrices])

  // ── FILTRO ESTRICTO: Solo productos habilitados en el configurador ──
  const activeCortes = useMemo(() => {
    return cortes.filter((c) => {
      const isVisibleInConfig = !config.productos_visibles_ids || config.productos_visibles_ids.includes(c.id)
      return isVisibleInConfig
    })
  }, [cortes, config.productos_visibles_ids])

  // Categorías que realmente tienen productos disponibles
  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(activeCortes.map((c) => c.categoria)))
    return cats.length > 0 ? cats : ["bovino"]
  }, [activeCortes])

  const currentCategory = availableCategories[currentCategoryIndex % availableCategories.length] || "bovino"

  // ── BUCLE AUTOMÁTICO DE ROTACIÓN DE SECTORES ──
  useEffect(() => {
    const secInterval = (config.intervalo_segundos || 8) * 1000
    const timer = setInterval(() => {
      setCurrentCategoryIndex((prev) => (prev + 1) % Math.max(1, availableCategories.length))
    }, secInterval)
    return () => clearInterval(timer)
  }, [availableCategories, config.intervalo_segundos])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const isLight = config.theme === "light"

  const currentCategoryCortes = activeCortes.filter((c) => c.categoria === currentCategory)
  const destacadoDeCategoria = currentCategoryCortes.find((c) => c.destacado) || currentCategoryCortes[0] || activeCortes[0]

  const categoryLabels: Record<string, string> = {
    bovino: "Cortes Bovinos Seleccionados",
    porcino: "Cortes de Cerdo & Porcinos",
    ave: "Pollo & Aves Frescas",
    embutido: "Chorizos Caseros de la Casa",
    elaborado: "Elaborados Artesanales Extra",
    otros: "Ofertas Especiales de Salón"
  }

  return (
    <div className={`fixed inset-0 flex flex-col justify-between overflow-hidden select-none font-sans transition-colors duration-500 ${
      isLight ? "bg-[#F8F9FA] text-slate-900" : "bg-[#0A0C10] text-white"
    }`}>
      
      {/* ── HEADER SUPERIOR ── */}
      <div className={`p-6 pb-3 flex items-center justify-between z-20 border-b ${
        isLight ? "bg-white/95 border-slate-200 shadow-xs" : "bg-black/90 border-slate-800/80"
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-black shadow-lg shadow-red-600/30">
            <Beef className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`font-black text-2xl tracking-wider uppercase ${isLight ? "text-slate-950" : "text-white"}`} style={displayFont}>
                BOUTIQUE DE CARNES
              </h1>
              <span className={`px-3 py-1 rounded-full font-black text-xs flex items-center gap-1.5 uppercase tracking-widest ${
                isLight ? "bg-red-50 text-red-600 border border-red-200" : "bg-red-600/30 text-red-400 border border-red-500/40"
              }`}>
                <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Calidad & Frescura Garantizada
              </span>
            </div>
            <div className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              EXTRA SUPERMERCADO · Precios Oficiales del Sistema en Vivo
            </div>
          </div>
        </div>

        {/* Turnero Digital (Opcional por Toggle) & Reloj */}
        <div className="flex items-center gap-5">
          {config.mostrar_turnero && (
            <div className={`rounded-2xl px-5 py-2 flex items-center gap-3 shadow-md animate-pulse ${
              isLight ? "bg-red-50 border-2 border-red-500/40 text-slate-950" : "bg-red-950/80 border-2 border-red-500 text-white"
            }`}>
              <div className="p-2 rounded-xl bg-red-600 text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                  TURNO ATENDIENDO
                </div>
                <div className="font-black text-2xl tracking-widest" style={monoFont}>
                  {currentTurn}
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-500 border-l border-slate-300 dark:border-slate-700 pl-3">
                {turnBoca}
              </div>
            </div>
          )}

          <div className="text-right">
            <div className={`font-black text-2xl ${isLight ? "text-red-600" : "text-amber-400"}`} style={monoFont}>
              {time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              {time.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "short" })}
            </div>
          </div>

          <button
            onClick={toggleFullScreen}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              isLight ? "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL (DUAL COLUMN 16:9) ── */}
      <div className="flex-1 px-6 py-4 grid grid-cols-12 gap-6 items-stretch min-h-0 z-10">
        
        {/* COLUMNA IZQUIERDA: SPOTLIGHT DEL CORTE DESTACADO (5 COLUMNAS) */}
        <div className={`col-span-5 flex flex-col justify-between rounded-3xl p-6 relative overflow-hidden shadow-xl border ${
          isLight
            ? "bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50"
            : "bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-black border-slate-800 text-white shadow-2xl"
        }`}>
          {destacadoDeCategoria && (
            <div className="flex flex-col justify-between h-full relative z-10 animate-fade-in">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs uppercase tracking-widest shadow-md shadow-red-600/20 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> {destacadoDeCategoria.etiqueta || "RECOMENDADO DEL DÍA"}
                  </span>
                  <span className={`text-xs font-bold ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    {destacadoDeCategoria.origen || "Extra Selección"}
                  </span>
                </div>

                <h2 className={`font-black text-3xl leading-tight mb-2 ${isLight ? "text-slate-950" : "text-white"}`} style={displayFont}>
                  {destacadoDeCategoria.nombre}
                </h2>
                <p className={`text-sm font-medium line-clamp-2 mb-3 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                  {destacadoDeCategoria.descripcion || "Corte fresco seleccionado con los más altos estándares de calidad."}
                </p>
              </div>

              {/* Imagen HD del Corte */}
              <div className="w-full h-56 rounded-2xl overflow-hidden my-auto border-2 border-slate-200 dark:border-slate-800 shadow-lg relative group">
                <img
                  src={destacadoDeCategoria.foto_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80"}
                  alt={destacadoDeCategoria.nombre}
                  className="w-full h-full object-cover transform scale-100 hover:scale-105 transition duration-700"
                />
              </div>

              {/* Bloque de Precio Gigante (Precios del Sistema) */}
              <div className={`p-4 rounded-2xl border mt-3 ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/90 border-slate-800"
              }`}>
                <div className={`text-[11px] font-black uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Precio por Kilo / Unidad:
                </div>
                <div className={`font-black text-4xl tracking-tight mt-0.5 ${isLight ? "text-red-600" : "text-white"}`} style={monoFont}>
                  {formatPYG(destacadoDeCategoria.precio)}
                </div>

                {config.mostrar_club_extra && destacadoDeCategoria.precio_club && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Socio Extra Club:
                    </span>
                    <span className="font-black text-2xl text-amber-600 dark:text-amber-400" style={monoFont}>
                      {formatPYG(destacadoDeCategoria.precio_club)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: MENUBOARD DINÁMICO DE PRECIOS POR SECTOR (7 COLUMNAS) */}
        <div className={`col-span-7 flex flex-col justify-between rounded-3xl p-6 relative overflow-hidden shadow-xl border ${
          isLight
            ? "bg-white border-slate-200/90 shadow-slate-200/50"
            : "bg-slate-950/90 border-slate-800/90 shadow-2xl"
        }`}>
          <div>
            {/* Píldoras de Categorías */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {availableCategories.map((cat) => {
                const active = currentCategory === cat
                return (
                  <div
                    key={cat}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-600/30 scale-105"
                        : isLight
                        ? "bg-slate-100 text-slate-500 border border-slate-200"
                        : "bg-slate-900 text-slate-400 border border-slate-800"
                    }`}
                  >
                    <span>{categoryLabels[cat] || cat}</span>
                  </div>
                )
              })}
            </div>

            {/* Listado de Precios Limpio y Nítido */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-none">
              {currentCategoryCortes.map((c) => (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all duration-300 ${
                    isLight
                      ? "bg-slate-50/80 border-slate-200/80 hover:border-red-400"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-red-500/50"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border ${
                      isLight ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700"
                    }`}>
                      {c.foto_url ? (
                        <img src={c.foto_url} alt={c.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <Beef className="w-6 h-6 text-slate-400 m-auto mt-3" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-base truncate ${isLight ? "text-slate-900" : "text-white"}`} style={displayFont}>
                          {c.nombre}
                        </span>
                        {c.etiqueta && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                            isLight ? "bg-red-100 text-red-700 border border-red-200" : "bg-red-600/20 text-red-400 border border-red-500/30"
                          }`}>
                            {c.etiqueta}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        {c.origen || "Extra Calidad Seleccionada"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-[9px] font-black uppercase ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      Precio / Kg
                    </div>
                    <div className={`font-black text-2xl ${isLight ? "text-red-600" : "text-white"}`} style={monoFont}>
                      {formatPYG(c.precio)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Banner Opcional de Combo Parrillero */}
          {config.mostrar_combo_banner && (
            <div className={`mt-4 p-3.5 rounded-2xl border flex items-center justify-between ${
              isLight
                ? "bg-gradient-to-r from-red-50 to-amber-50 border-red-200 text-slate-900"
                : "bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 border-red-500/30 text-white"
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 text-white font-black">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-xs uppercase tracking-wider text-red-600 dark:text-amber-400">
                    {config.combo_titulo}
                  </div>
                  <div className={`text-xs font-medium ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                    {config.combo_descripcion} = <strong className="font-black text-red-600 dark:text-amber-400" style={monoFont}>{config.combo_precio}</strong>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-red-600 text-white tracking-wider">
                Pedilo en Mostrador
              </span>
            </div>
          )}
        </div>

      </div>

      {/* ── FOOTER DE LA TV ── */}
      <div className={`px-6 py-2 flex items-center justify-between text-xs border-t z-20 ${
        isLight ? "bg-white border-slate-200 text-slate-500" : "bg-black/90 border-slate-800/80 text-slate-400"
      }`}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Precios Oficiales Sincronizados
          </span>
          <span>·</span>
          <span>Rotación automática cada {config.intervalo_segundos || 8}s</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span>Extra Digital Signage</span>
          <span>·</span>
          <span>Google TV 55"</span>
        </div>
      </div>

    </div>
  )
}
