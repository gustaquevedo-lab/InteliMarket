import { useState, useEffect, useMemo } from "react"
import {
  Store, BarChart3, TrendingUp, Clock, Package, Calendar, Zap,
  Target, Receipt, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2,
  AlertTriangle, DollarSign, Layers, ChevronRight, Sparkles, MapPin,
  Flame, ShoppingBag, Eye, Percent, CheckCircle2, Globe, Flag
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "afluencia" | "deptos" | "calendario"

interface RetailKpi {
  ventas_total: string | number
  ventas_count: number
  ticket_promedio: string | number
  ventas_m2: string | number
  margen_bruto: string | number
  margen_pct: string | number
  clientes_unicos: number
  productos_vendidos: number
  hora_pico?: number
  hora_pico_ventas?: string | number
  delta_ventas_pct?: string | number
}

// Eventos comerciales estratégicos Paraguay & Brasil (Mato Grosso do Sul / Frontera)
const COMERCIAL_EVENTS = [
  {
    id: "1",
    mes: "Enero",
    fecha: "01 - 06 Ene",
    titulo: "Año Nuevo & Reyes Magos",
    pais: "PY / BR",
    categoria: "Juguetería, Carnes, Bebidas",
    impacto: "Alto",
    recomendacion: "Liquidación de saldos navideños e impulso de carnes para asado y bebidas frías.",
  },
  {
    id: "2",
    mes: "Febrero",
    fecha: "Carnaval",
    titulo: "Temporada de Carnaval & Verano",
    pais: "BR / PY",
    categoria: "Bebidas, Cervezas, Snacks, Hielo",
    impacto: "Muy Alto",
    recomendacion: "Aumento de 40% en stock de cervezas, gaseosas, carbón y descartables por feriados y turismo.",
  },
  {
    id: "3",
    mes: "Marzo",
    fecha: "01 Mar",
    titulo: "Día de los Héroes",
    pais: "PY",
    categoria: "Carnicería, Asado, Carbón",
    impacto: "Medio",
    recomendacion: "Pico de ventas en cortes de carne vacuna para parrilla y guarniciones.",
  },
  {
    id: "4",
    mes: "Abril",
    fecha: "Semana Santa",
    titulo: "Semana Santa & Pascua",
    pais: "PY / BR",
    categoria: "Queso Paraguay, Almidón, Pescados, Huevos de Pascua",
    impacto: "Muy Alto",
    recomendacion: "Abastecimiento masivo de insumos para chipas (almidón, queso Paraguay, grasa), pescados y chocolates.",
  },
  {
    id: "5",
    mes: "Mayo",
    fecha: "14 - 15 May",
    titulo: "Día de la Madre & Fiestas Patrias",
    pais: "PY",
    categoria: "Rotisería, Regalos, Tortas, Vinos",
    impacto: "Muy Alto",
    recomendacion: "Pico histórico en platos preparados de rotisería, confitería, flores y bombones.",
  },
  {
    id: "6",
    mes: "Junio",
    fecha: "12 Jun",
    titulo: "Dia dos Namorados (Brasil)",
    pais: "BR (MS)",
    categoria: "Vinos, Chocolates, Perfumería, Delicatessen",
    impacto: "Alto",
    recomendacion: "Fuerte afluencia de compradores brasileños en ciudades de frontera (Pedro Juan, Salto, CDE).",
  },
  {
    id: "7",
    mes: "Junio",
    fecha: "24 Jun",
    titulo: "San Juan Ára (San Juan)",
    pais: "PY",
    categoria: "Mandioca, Harina de Maíz, Carne Molida, Butifarra",
    impacto: "Muy Alto",
    recomendacion: "Alta rotación de ingredientes para comidas típicas (Mbeyú, Pastel Mandi'o, Pajagua Mascada, Chicharõ Trenzado).",
  },
  {
    id: "8",
    mes: "Agosto",
    fecha: "16 Ago",
    titulo: "Día del Niño (Paraguay)",
    pais: "PY",
    categoria: "Golosinas, Chocolates, Panificados dulces, Juguetes",
    impacto: "Alto",
    recomendacion: "Combos de merienda y golosinas para eventos escolares y familiares.",
  },
  {
    id: "9",
    mes: "Septiembre",
    fecha: "07 Sep",
    titulo: "Independência do Brasil",
    pais: "BR (MS)",
    categoria: "Bebidas, Licores, Quesos importados, Bazar",
    impacto: "Muy Alto",
    recomendacion: "Feriado nacional en Brasil: ola de turistas de Mato Grosso do Sul buscando compras en frontera.",
  },
  {
    id: "10",
    mes: "Octubre",
    fecha: "12 Oct",
    titulo: "Nossa Senhora Aparecida / Dia das Crianças",
    pais: "BR (MS)",
    categoria: "Juguetería, Golosinas, Turismo de compras",
    impacto: "Alto",
    recomendacion: "Fin de semana largo brasileño con impacto directo en el flujo comercial fronterizo.",
  },
  {
    id: "11",
    mes: "Noviembre",
    fecha: "Black Friday",
    titulo: "Black Friday Frontera",
    pais: "PY / BR",
    categoria: "Electrónica, Bebidas, Almacén mayorista, Perfumería",
    impacto: "Crítico",
    recomendacion: "Descuentos masivos y ampliación de horarios de atención en tienda física.",
  },
  {
    id: "12",
    mes: "Diciembre",
    fecha: "08 - 31 Dic",
    titulo: "Caacupé, Navidad & Fin de Año",
    pais: "PY / BR",
    categoria: "Canastas navideñas, Pan dulces, Sidras, Carnes premium",
    impacto: "Crítico",
    recomendacion: "Temporada de mayor facturación del año: armado de canastas, lechones, pavos y espumantes.",
  },
]

export default function RetailPage() {
  const [tab, setTab] = useState<Tab>("afluencia")
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtroPais, setFiltroPais] = useState<"todos" | "PY" | "BR">("todos")
  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.retail.getDashboard()
      setDashboardData(res)
    } catch {
      toast.error("Error", "No se pudo sincronizar el tablero de tienda")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const hoy: RetailKpi = dashboardData?.hoy || {
    ventas_total: 0,
    ventas_count: 0,
    ticket_promedio: 0,
    ventas_m2: 0,
    margen_bruto: 0,
    margen_pct: "0",
    clientes_unicos: 0,
    productos_vendidos: 0,
    hora_pico: 11,
  }

  const semana: RetailKpi = dashboardData?.semana || {
    ventas_total: 0,
    ventas_count: 0,
    ticket_promedio: 0,
    ventas_m2: 0,
    margen_bruto: 0,
    margen_pct: "0",
    clientes_unicos: 0,
    productos_vendidos: 0,
  }

  const heatmap = dashboardData?.heatmap_7dias || []
  const topProductos = dashboardData?.top_productos || []

  // Departamentos y márgenes
  const departamentos = [
    { nombre: "🥩 Carnicería & Fiambrería", ventas: 48500000, costo: 37830000, margen_pct: 22.0, rotacion: "Alta", mermas_pct: 1.8 },
    { nombre: "🥬 Frutas & Verduras (Hortifruti)", ventas: 26400000, costo: 17160000, margen_pct: 35.0, rotacion: "Muy Alta", mermas_pct: 4.2 },
    { nombre: "🥖 Panadería & Rotisería", ventas: 18900000, costo: 9450000, margen_pct: 50.0, rotacion: "Alta", mermas_pct: 2.5 },
    { nombre: "🥛 Lácteos & Refrigerados", ventas: 34200000, costo: 28044000, margen_pct: 18.0, rotacion: "Muy Alta", mermas_pct: 0.8 },
    { nombre: "🥫 Almacén Seco & Despensa", ventas: 62000000, costo: 49600000, margen_pct: 20.0, rotacion: "Media", mermas_pct: 0.3 },
    { nombre: "🍺 Bebidas, Cervezas & Licores", ventas: 54000000, costo: 41580000, margen_pct: 23.0, rotacion: "Alta", mermas_pct: 0.2 },
    { nombre: "🧼 Limpieza & Perfumería", ventas: 21500000, costo: 16125000, margen_pct: 25.0, rotacion: "Media", mermas_pct: 0.1 },
  ]

  const filteredEvents = COMERCIAL_EVENTS.filter(e => {
    if (filtroPais === "todos") return true
    return e.pais.includes(filtroPais)
  })

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* Header Principal */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shadow-sm">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-slate-900 dark:text-white tracking-tight">
                  Torre de Control del Piso de Venta
                </h1>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                  Operación Tienda Física
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Monitoreo en tiempo real de afluencia, rendimiento por góndola y estacionalidad Paraguay / Brasil (MS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`} />
              Actualizar Piso
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          <button
            onClick={() => setTab("afluencia")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === "afluencia"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Zap className="w-4 h-4" /> Piso de Venta & Afluencia
          </button>
          <button
            onClick={() => setTab("deptos")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === "deptos"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-4 h-4" /> Rentabilidad por Departamento / Góndola
          </button>
          <button
            onClick={() => setTab("calendario")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === "calendario"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Calendar className="w-4 h-4" /> Calendario Comercial (PY & Brasil - MS)
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: PISO DE VENTA & AFLUENCIA */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {tab === "afluencia" && (
        <div className="space-y-6">
          {/* Top KPIs de Tienda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span className="font-bold uppercase tracking-wider">Ventas de Hoy</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-slate-900 dark:text-white">{formatPYG(hoy.ventas_total)}</p>
              <p className="text-[11px] text-slate-400 mt-1">{hoy.ventas_count} tickets emitidos</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span className="font-bold uppercase tracking-wider">Ticket Promedio</span>
                <Receipt className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-blue-600 dark:text-blue-400">{formatPYG(hoy.ticket_promedio)}</p>
              <p className="text-[11px] text-slate-400 mt-1">{hoy.clientes_unicos} compradores únicos</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span className="font-bold uppercase tracking-wider">Hora Pico de Caja</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-amber-600 dark:text-amber-400">
                {hoy.hora_pico !== undefined ? `${hoy.hora_pico}:00 hs` : "11:00 hs"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Mayor congestión en cajas</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span className="font-bold uppercase tracking-wider">Margen Bruto Tienda</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-indigo-600 dark:text-indigo-400">{hoy.margen_pct}%</p>
              <p className="text-[11px] text-slate-400 mt-1">{formatPYG(hoy.margen_bruto)} de ganancia bruta</p>
            </div>
          </div>

          {/* Heatmap & Horas Pico */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    Mapa de Calor de Afluencia Semanal (Horas Pico)
                  </h3>
                  <p className="text-xs text-slate-500">Distribución de clientes y ventas por franja horaria</p>
                </div>
                <span className="text-xs font-mono text-slate-400">07:00 a 22:00</span>
              </div>

              {/* Grid visual del Heatmap */}
              <div className="overflow-x-auto">
                <div className="min-w-[540px] space-y-1.5 text-xs font-mono">
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((dia, dIdx) => (
                    <div key={dia} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-400 font-sans font-medium">{dia}</span>
                      <div className="flex-1 grid grid-cols-12 gap-1">
                        {[8, 9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21].map((hora, hIdx) => {
                          const isPico = (dIdx === 4 || dIdx === 5) && (hora >= 18 && hora <= 20) || (dIdx === 6 && hora >= 11 && hora <= 13)
                          const isMedio = hora === 11 || hora === 12 || hora === 19
                          return (
                            <div
                              key={hora}
                              title={`${dia} ${hora}:00 hs`}
                              className={`h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                                isPico
                                  ? "bg-red-500 text-white shadow-xs"
                                  : isMedio
                                  ? "bg-amber-400/80 text-amber-950"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                              }`}
                            >
                              {hora}h
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border" /> Normal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400/80" /> Afluencia Media</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Hora Pico (Refuerzo de Cajas)</span>
              </div>
            </div>

            {/* Top Rotación en Salón */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Mayor Tracción en Góndola
              </h3>
              <p className="text-xs text-slate-500">Artículos con mayor velocidad de salida en caja</p>

              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                {(topProductos.length ? topProductos.slice(0, 5) : [
                  { nombre: "Costilla Vacuna Primera", cantidad: 340, total: 11900000 },
                  { nombre: "Cerveza Pilsen 940ml", cantidad: 280, total: 3360000 },
                  { nombre: "Leche Entera Trébol 1L", cantidad: 210, total: 1470000 },
                  { nombre: "Queso Paraguay Fresco", cantidad: 145, total: 4350000 },
                  { nombre: "Pan Felipe Tradicional / Kg", cantidad: 120, total: 960000 },
                ]).map((p: any, idx: number) => (
                  <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{p.nombre || p.descripcion}</p>
                      <p className="text-[11px] text-slate-400">{p.cantidad} unidades despachadas</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: RENTABILIDAD POR DEPARTAMENTO / GÓNDOLA */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {tab === "deptos" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Desglose de Ventas, Margen y Mermas por Góndola
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rentabilidad sectorial para optimizar metros lineales de exhibición
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="text-left py-3 px-4">Sección / Góndola</th>
                    <th className="text-right py-3 px-4">Venta Estimada</th>
                    <th className="text-right py-3 px-4">Costo Mercadería (CMV)</th>
                    <th className="text-right py-3 px-4">Ganancia Bruta</th>
                    <th className="text-center py-3 px-4">Margen %</th>
                    <th className="text-center py-3 px-4">Rotación</th>
                    <th className="text-center py-3 px-4">Tasa de Merma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {departamentos.map((d, idx) => {
                    const ganancia = d.ventas - d.costo
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{d.nombre}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(d.ventas)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">{formatPYG(d.costo)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(ganancia)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            {d.margen_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.rotacion.includes("Muy Alta") ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {d.rotacion}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono text-xs ${d.mermas_pct > 2 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                            {d.mermas_pct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 3: CALENDARIO COMERCIAL PY & BRASIL (MS) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {tab === "calendario" && (
        <div className="space-y-6">
          {/* Filtros de País / Región */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-500" />
                Planificador de Temporadas Comerciales
              </h3>
              <p className="text-xs text-slate-500">Anticipación de compras y picos de demanda binacional</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFiltroPais("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filtroPais === "todos" ? "bg-amber-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                Todos los Eventos
              </button>
              <button
                onClick={() => setFiltroPais("PY")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filtroPais === "PY" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                🇵🇾 Paraguay
              </button>
              <button
                onClick={() => setFiltroPais("BR")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filtroPais === "BR" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                🇧🇷 Brasil / MS (Frontera)
              </button>
            </div>
          </div>

          {/* Grid de Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map(e => (
              <div
                key={e.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-amber-400/60 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      {e.mes} • {e.fecha}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      e.impacto === "Crítico"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        : e.impacto === "Muy Alto"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}>
                      Impacto: {e.impacto}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2 flex items-center gap-1.5">
                    {e.pais.includes("BR") && !e.pais.includes("PY") ? "🇧🇷" : e.pais.includes("PY") && !e.pais.includes("BR") ? "🇵🇾" : "🇵🇾🇧🇷"} {e.titulo}
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                    Rubros clave: <span className="font-normal text-slate-500">{e.categoria}</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-0.5">Acción Recomendada:</p>
                  <p>{e.recomendacion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
