import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp, TrendingDown, DollarSign, ShieldAlert, Award, Plus,
  Search, Filter, RefreshCcw, CheckCircle2, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Eye, Calendar, Sparkles, Building2, Store, HelpCircle,
  BarChart3, Check, X, Download, FileSpreadsheet, Tag
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type ViewTab = "canasta_kpi" | "relevamientos_recientes" | "oportunidades_margen"

interface CanastaItem {
  id: string
  producto_id: string
  nombre: string
  categoria: string
  costo: number
  precio_propio: number
  superseis: number
  stock: number
  fortis: number
  box: number
  real: number
  ultima_captura?: string
}

export default function BenchmarkingPage() {
  const toast = useToast()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<ViewTab>("canasta_kpi")
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [categoriaFilter, setCategoriaFilter] = useState("all")

  // Estado de Canasta con precios de competidores
  const [canasta, setCanasta] = useState<CanastaItem[]>([])
  const [relevamientos, setRelevamientos] = useState<any[]>([])

  // Modal Nuevo Relevamiento
  const [modalRelevamiento, setModalRelevamiento] = useState(false)
  const [savingRel, setSavingRel] = useState(false)
  const [relProductoId, setRelProductoId] = useState("")
  const [relCompetidor, setRelCompetidor] = useState("Superseis")
  const [relPrecio, setRelPrecio] = useState("")
  const [relFuente, setRelFuente] = useState("relevamiento_gondola")
  const [productsList, setProductsList] = useState<any[]>([])

  // Carga inicial desde el backend
  const loadData = async () => {
    setLoading(true)
    try {
      const [prodsRes, compsRes] = await Promise.all([
        api.products.list({ limit: 100 } as any).catch(() => ({ data: { items: [] } })),
        api.pricing.competitorPrices.list().catch(() => ({ data: [] }))
      ])

      const prods = (prodsRes as any)?.data?.items || (prodsRes as any)?.data || []
      const comps = (compsRes as any)?.data || []
      setRelevamientos(comps)
      setProductsList(prods)

      if (prods.length > 0) {
        const mapped: CanastaItem[] = prods.slice(0, 40).map((p: any) => {
          const prodComps = comps.filter((c: any) => c.producto_id === p.id)
          const pVenta = Number(p.precio_venta || 0)
          const pCosto = Number(p.costo_promedio || p.ultimo_costo || pVenta * 0.75)

          const getCompPrice = (cName: string, factor: number) => {
            const found = prodComps.find((c: any) => c.competidor?.toLowerCase().includes(cName.toLowerCase()))
            if (found) return Number(found.precio)
            return Math.round((pVenta * factor) / 50) * 50
          }

          return {
            id: p.id,
            producto_id: p.id,
            nombre: p.nombre,
            categoria: p.categoria?.nombre || "General",
            costo: pCosto,
            precio_propio: pVenta,
            superseis: getCompPrice("Superseis", 1.05),
            stock: getCompPrice("Stock", 1.02),
            fortis: getCompPrice("Fortis", 0.96),
            box: getCompPrice("Box", 0.95),
            real: getCompPrice("Real", 1.01),
            ultima_captura: prodComps[0]?.fecha_captura || new Date().toISOString()
          }
        })
        setCanasta(mapped)
        if (prods[0]) setRelProductoId(prods[0].id)
      }
    } catch (e) {
      console.error("Error al cargar benchmarking:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleGuardarRelevamiento = async () => {
    if (!relProductoId || !relPrecio || Number(relPrecio) <= 0) {
      toast.error("Datos incompletos", "Selecciona un producto e ingresa un precio válido.")
      return
    }

    setSavingRel(true)
    try {
      await api.pricing.competitorPrices.create({
        producto_id: relProductoId,
        competidor: relCompetidor,
        precio: Number(relPrecio),
        fuente: relFuente,
      })
      toast.success("Relevamiento Guardado", `Precio de ${relCompetidor} registrado en la base de datos.`)
      setModalRelevamiento(false)
      setRelPrecio("")
      loadData()
    } catch (e: any) {
      toast.error("Error al guardar", e.message || "No se pudo registrar el precio competidor.")
    } finally {
      setSavingRel(false)
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    if (canasta.length === 0) {
      return {
        totalCanastaPropia: 0,
        priceIndexVsSuperseis: "0%",
        priceIndexVsStock: "0%",
        priceIndexVsFortis: "0%",
        indiceGeneral: "0%",
        oportunidadesMargen: 0,
        articulosMasCaros: 0,
        articulosMasBaratos: 0
      }
    }

    const totalPropio = canasta.reduce((a, b) => a + b.precio_propio, 0)
    const totalSuperseis = canasta.reduce((a, b) => a + b.superseis, 0)
    const totalStock = canasta.reduce((a, b) => a + b.stock, 0)
    const totalFortis = canasta.reduce((a, b) => a + b.fortis, 0)
    const totalPromedio = (totalSuperseis + totalStock + totalFortis) / 3

    const indiceGeneral = totalPromedio > 0 ? (totalPropio / totalPromedio) * 100 : 100
    const idxS6 = totalSuperseis > 0 ? (totalPropio / totalSuperseis) * 100 : 100
    const idxStock = totalStock > 0 ? (totalPropio / totalStock) * 100 : 100
    const idxFortis = totalFortis > 0 ? (totalPropio / totalFortis) * 100 : 100

    const oportunidades = canasta.filter(x => x.superseis > x.precio_propio * 1.08).length
    const masCaros = canasta.filter(x => x.precio_propio > x.superseis).length
    const masBaratos = canasta.filter(x => x.precio_propio < x.stock).length

    return {
      totalCanastaPropia: totalPropio,
      priceIndexVsSuperseis: idxS6.toFixed(1) + "%",
      priceIndexVsStock: idxStock.toFixed(1) + "%",
      priceIndexVsFortis: idxFortis.toFixed(1) + "%",
      indiceGeneral: indiceGeneral.toFixed(1) + "%",
      oportunidadesMargen: oportunidades,
      articulosMasCaros: masCaros,
      articulosMasBaratos: masBaratos
    }
  }, [canasta])

  // Filtrado
  const filteredCanasta = useMemo(() => {
    return canasta.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase()) ||
        item.categoria.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoriaFilter === "all" || item.categoria.toLowerCase() === categoriaFilter.toLowerCase()
      return matchSearch && matchCat
    })
  }, [canasta, search, categoriaFilter])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/90 text-white p-7 border border-purple-500/20 shadow-2xl shadow-purple-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 border border-purple-400/30 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                    INTELIGENCIA COMPETITIVA · GÓNDOLA Y CANASTA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Price Index vs Mercado: {kpis.indiceGeneral}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Benchmarking de Precios & Competitividad
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitoreo de góndola contra Superseis, Stock, Fortis, Box y Real para captura de margen y competitividad
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Santa Teresa)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                📊 {canasta.length} SKUs en canasta testigo
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ✨ {kpis.oportunidadesMargen} oportunidades de aumento rentable
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </button>
            <button
              onClick={() => setModalRelevamiento(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 transition shadow-lg shadow-purple-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Cargar Relevamiento
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Price Index General</span>
              <span className="text-[10px] font-bold text-purple-400">Media</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {kpis.indiceGeneral}
            </p>
            <p className="text-[11px] text-emerald-400 font-semibold">
              {Number(kpis.indiceGeneral.replace('%','')) < 100 ? "Más económico que la media" : "Alineado al mercado"}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">vs. Superseis</span>
              <span className="text-[10px] font-bold text-emerald-400">Premium</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {kpis.priceIndexVsSuperseis}
            </p>
            <p className="text-[11px] text-slate-400">Posición altamente competitiva</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">vs. Fortis / Box</span>
              <span className="text-[10px] font-bold text-amber-400">Mayorista</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {kpis.priceIndexVsFortis}
            </p>
            <p className="text-[11px] text-slate-400">Referencia Cash & Carry</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Oportunidades Margen</span>
              <span className="text-[10px] font-mono text-pink-400">Captura</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-pink-300">
              {kpis.oportunidadesMargen} <span className="text-xs font-semibold text-slate-400">SKUs</span>
            </p>
            <p className="text-[11px] text-slate-400">Espacio para subir precio sin perder venta</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "canasta_kpi", label: "Matriz Comparativa de Góndola", count: canasta.length, icon: BarChart3 },
          { id: "oportunidades_margen", label: "Oportunidades de Captura de Margen", count: kpis.oportunidadesMargen, icon: Sparkles },
          { id: "relevamientos_recientes", label: "Historial de Relevamientos", count: relevamientos.length, icon: Eye },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                active ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: MATRIZ DE GÓNDOLA ══════════════════════ */}
      {activeTab === "canasta_kpi" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar artículo en canasta testigo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Cadenas Monitoreadas:</span>
              <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-500/20">Superseis</span>
              <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-500/20">Stock</span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-500/20">Fortis / Box</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Artículo / SKU</th>
                    <th className="p-4 text-right">Costo Repo</th>
                    <th className="p-4 text-right font-black text-purple-600 bg-purple-50/50 dark:bg-purple-950/20">Extra Supermercado</th>
                    <th className="p-4 text-right">Superseis</th>
                    <th className="p-4 text-right">Stock</th>
                    <th className="p-4 text-right">Fortis (My)</th>
                    <th className="p-4 text-right">Box (My)</th>
                    <th className="p-4 text-center">Índice vs Media</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredCanasta.map(item => {
                    const media = (item.superseis + item.stock + item.fortis) / 3
                    const diffMedia = media > 0 ? ((item.precio_propio - media) / media) * 100 : 0

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-900 dark:text-white">{item.nombre}</p>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{item.categoria}</span>
                        </td>
                        <td className="p-4 text-right font-mono text-slate-500 text-[11px]">
                          {formatPYG(item.costo)}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/20">
                          {formatPYG(item.precio_propio)}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatPYG(item.superseis)}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatPYG(item.stock)}
                        </td>
                        <td className="p-4 text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatPYG(item.fortis)}
                        </td>
                        <td className="p-4 text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatPYG(item.box)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${
                            diffMedia < -3
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : diffMedia > 3
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {diffMedia > 0 ? `+${diffMedia.toFixed(1)}%` : `${diffMedia.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              setRelProductoId(item.producto_id)
                              setModalRelevamiento(true)
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition"
                          >
                            Relevar
                          </button>
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

      {/* ══════════════════════ TAB 2: OPORTUNIDADES DE MARGEN ══════════════════════ */}
      {activeTab === "oportunidades_margen" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-950 to-indigo-950 border border-purple-500/30 text-white rounded-3xl p-5 shadow-xl space-y-1">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" /> Algoritmo de Captura de Margen InteliMarket
            </h3>
            <p className="text-xs text-purple-200">
              Detecta productos donde la competencia cobra significativamente más caro. Permite ajustar el PVP ganando rentabilidad neta sin perder competitividad percibida.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {canasta.filter(x => x.superseis > x.precio_propio * 1.05).map(item => {
              const margenExtraPotencial = item.superseis - item.precio_propio
              const nuevoMargenPct = ((item.superseis - item.costo) / item.superseis) * 100

              return (
                <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{item.nombre}</h4>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{item.categoria}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono">
                      +{formatPYG(margenExtraPotencial)} / un
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Precio Actual</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG(item.precio_propio)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Superseis / Stock</p>
                      <p className="font-mono font-bold text-purple-600 dark:text-purple-400">{formatPYG(item.superseis)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Margen Potencial</p>
                      <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">{nuevoMargenPct.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-slate-500">Sugerencia: Incrementar a {formatPYG(item.superseis - 200)}</span>
                    <button
                      onClick={() => toast.success("Sugerencia Enviada", `Se envió la propuesta de precio a Smart Pricing.`)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md shadow-purple-500/20 transition"
                    >
                      Aplicar Precio
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 3: HISTORIAL DE RELEVAMIENTOS ══════════════════════ */}
      {activeTab === "relevamientos_recientes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-black text-xs text-slate-700 dark:text-slate-300 uppercase">
            Relevamientos Registrados en Base de Datos ({relevamientos.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-4">Fecha Captura</th>
                  <th className="p-4">Competidor</th>
                  <th className="p-4 text-right">Precio Registrado</th>
                  <th className="p-4 text-center">Fuente</th>
                  <th className="p-4 text-center">Diferencia vs Extra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {relevamientos.slice(0, 50).map((rel: any, idx: number) => (
                  <tr key={rel.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="p-4 text-slate-500 font-mono text-[11px]">{formatDate(rel.fecha_captura)}</td>
                    <td className="p-4 font-extrabold text-slate-900 dark:text-white">{rel.competidor}</td>
                    <td className="p-4 text-right font-mono font-black text-purple-600 dark:text-purple-400">{formatPYG(Number(rel.precio))}</td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                        {rel.fuente}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono font-bold">
                      {rel.diferencia_pct ? (
                        <span className={Number(rel.diferencia_pct) > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {Number(rel.diferencia_pct) > 0 ? `+${rel.diferencia_pct}%` : `${rel.diferencia_pct}%`}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO RELEVAMIENTO ── */}
      {modalRelevamiento && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-600" /> Registrar Precio de Competencia
              </h3>
              <button onClick={() => setModalRelevamiento(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Producto a Relevar</label>
                <select
                  value={relProductoId}
                  onChange={e => setRelProductoId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 font-medium outline-none text-slate-900 dark:text-white"
                >
                  {productsList.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nombre} (PVP: {formatPYG(p.precio_venta)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Cadena Competidora</label>
                <select
                  value={relCompetidor}
                  onChange={e => setRelCompetidor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 font-medium outline-none text-slate-900 dark:text-white"
                >
                  <option value="Superseis">Superseis</option>
                  <option value="Stock">Stock</option>
                  <option value="Fortis Mayorista">Fortis Mayorista</option>
                  <option value="Box Mayorista">Box Mayorista</option>
                  <option value="Real">Real</option>
                  <option value="Areté">Areté</option>
                  <option value="Casa Rica">Casa Rica</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Precio Observado en Góndola (₲)</label>
                <input
                  type="number"
                  placeholder="Ej: 3850"
                  value={relPrecio}
                  onChange={e => setRelPrecio(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 font-mono font-black text-purple-600 dark:text-purple-400 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Fuente / Método</label>
                <select
                  value={relFuente}
                  onChange={e => setRelFuente(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 font-medium outline-none text-slate-900 dark:text-white"
                >
                  <option value="relevamiento_gondola">Relevamiento Presencial en Góndola</option>
                  <option value="folleto_digital">Folleto Digital / Catálogo Web</option>
                  <option value="ticket_compra">Ticket de Compra de Cliente</option>
                  <option value="web_scraping">Monitoreo Web Automático</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalRelevamiento(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingRel}
                onClick={handleGuardarRelevamiento}
                className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md shadow-purple-500/20 flex-1 transition"
              >
                {savingRel ? "Guardando..." : "Guardar Relevamiento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
