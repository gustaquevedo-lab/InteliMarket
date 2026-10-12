import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Gift, Plus, Search, Loader2, X, Trash2, Edit, RefreshCw,
  Package, Tag, Layers, Barcode, DollarSign, CheckCircle2, ShieldAlert,
  Info, HelpCircle, ArrowRight, BookOpen, Filter, Box, Calculator,
  TrendingUp, Percent, Sparkles, ShoppingCart, Copy, Check, Eye
} from "lucide-react"
import { api, type Product } from "../api"
import { useToast } from "../context/ToastContext"
import { useConfirm } from "../components/ConfirmDialog"
import { formatPYG } from "../utils/format"
import KitModal from "./kits/KitModal"

export default function KitsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [kits, setKits] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modalidadFilter, setModalidadFilter] = useState<string>("todos")
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null)

  // Estado del Modal Constructor/Editor
  const [showModal, setShowModal] = useState(false)
  const [kitToEdit, setKitToEdit] = useState<any | null>(null)

  // Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [kitsList, prods] = await Promise.all([
        api.kits.list(),
        api.products.list({ limit: 1000 }),
      ])
      setKits(kitsList || [])
      setProducts(prods || [])
    } catch (e: any) {
      toast.error("Error al cargar kits", e.message || "No se pudieron obtener los combos.")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrado
  const filteredKits = useMemo(() => {
    return kits.filter(k => {
      const q = search.toLowerCase().trim()
      const matchesSearch = !q ||
        k.nombre?.toLowerCase().includes(q) ||
        k.descripcion?.toLowerCase().includes(q) ||
        k.sku?.toLowerCase().includes(q) ||
        k.codigo_barra?.toLowerCase().includes(q) ||
        (k.items || []).some((it: any) => it.nombre?.toLowerCase().includes(q))

      const matchesModalidad = modalidadFilter === "todos" ||
        k.modalidad_facturacion === modalidadFilter

      return matchesSearch && matchesModalidad
    })
  }, [kits, search, modalidadFilter])

  // KPIs Ejecutivos
  const totalKits = kits.length
  const avgMargenPct = kits.length > 0
    ? (kits.reduce((acc, k) => acc + Number(k.margen_pct || 0), 0) / kits.length).toFixed(1)
    : "0.0"
  const totalAhorroClientes = kits.reduce((acc, k) => acc + Number(k.ahorro_cliente_monto || 0), 0)
  const totalCombosArmables = kits.reduce((acc, k) => acc + Number(k.stock_potencial_kits || 0), 0)

  // Handlers
  const handleOpenCreate = () => {
    setKitToEdit(null)
    setShowModal(true)
  }

  const handleOpenEdit = (kit: any) => {
    setKitToEdit(kit)
    setShowModal(true)
  }

  const handleDeleteKit = async (k: any) => {
    const ok = await confirm({
      title: "Eliminar Kit Promocional",
      message: `¿Estás seguro de eliminar el combo "${k.nombre}"? Esta acción desactivará el artículo en caja.`,
      confirmText: "Eliminar",
    })
    if (!ok) return

    try {
      await api.kits.delete(k.id)
      toast.success("Kit eliminado", `El combo "${k.nombre}" ha sido eliminado.`)
      fetchData()
    } catch (e: any) {
      toast.error("Error al eliminar", e.message || "No se pudo eliminar el kit.")
    }
  }

  const handleCopyBarcode = (barcode: string) => {
    if (!barcode) return
    navigator.clipboard.writeText(barcode)
    setCopiedBarcode(barcode)
    setTimeout(() => setCopiedBarcode(null), 2000)
    toast.success("Código copiado", barcode)
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/90 text-white p-7 border border-purple-500/20 shadow-2xl shadow-purple-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 border border-purple-400/30 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Gift className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                    OFERTAS COMPUESTAS · FACTURACIÓN DNIT
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    {totalKits} Combos Promocionales Activos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Kits & Combos Promocionales
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Armado de packs comerciales, explosión de IVA en caja POS y cálculo de rentabilidad compuesta
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                ✨ Margen promedio {avgMargenPct}%
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚡ Modalidades: Ítem Único (IVA 10%) y Desglosado en Factura
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 transition shadow-lg shadow-purple-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear Nuevo Combo
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kits Activos</span>
              <Gift className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {totalKits.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">Combos listos para facturar</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Promedio</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {avgMargenPct}%
            </p>
            <p className="text-[11px] text-slate-400">Rentabilidad compuesta sobre PVP</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Clientes</span>
              <DollarSign className="w-4 h-4 text-pink-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-pink-300 truncate">
              {formatPYG(totalAhorroClientes)}
            </p>
            <p className="text-[11px] text-slate-400">Descuento promocional acumulado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Combos Armables</span>
              <Box className="w-4 h-4 text-purple-300" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {totalCombosArmables.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">Capacidad total según stock físico</p>
          </div>
        </div>
      </div>

      {/* 🔍 BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, EAN o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="text-xs text-slate-400 font-bold">Modalidad:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setModalidadFilter("todos")}
              className={`px-3 py-1 rounded-lg transition ${modalidadFilter === "todos" ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs" : "text-slate-500"}`}
            >
              Todas
            </button>
            <button
              onClick={() => setModalidadFilter("item_unico")}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${modalidadFilter === "item_unico" ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs" : "text-slate-500"}`}
            >
              <Package className="w-3 h-3" /> Ítem Único (10%)
            </button>
            <button
              onClick={() => setModalidadFilter("desglosado")}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${modalidadFilter === "desglosado" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs" : "text-slate-500"}`}
            >
              <Layers className="w-3 h-3" /> Desglosado
            </button>
          </div>
        </div>
      </div>

      {/* 📦 LISTA O GRILLA DE KITS */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-xs font-bold text-slate-400">Cargando catálogo de combos...</p>
        </div>
      ) : filteredKits.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {search ? "No se encontraron combos para la búsqueda" : "Aún no hay kits promocionales dados de alta"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Crea ofertas compuestas para armar canastas, combos de asado o promociones comerciales con deducción de stock en caja POS.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Crear Primer Combo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKits.map((kit) => (
            <div
              key={kit.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 shadow-sm hover:shadow-xl transition flex flex-col justify-between space-y-4 relative overflow-hidden group"
            >
              {/* Franja superior decorativa */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 opacity-60 group-hover:opacity-100 transition" />

              <div className="space-y-3.5">
                {/* Cabecera del Kit */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Badge de Modalidad */}
                      {kit.modalidad_facturacion === "desglosado" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Layers className="w-3 h-3" /> Desglosado en Factura
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Package className="w-3 h-3" /> Ítem Único (IVA 10%)
                        </span>
                      )}

                      {/* Margen % */}
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                        kit.margen_pct < 0
                          ? "bg-rose-100 text-rose-700"
                          : kit.margen_pct >= 25
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                      }`}>
                        Margen {kit.margen_pct?.toFixed(1)}%
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      {kit.nombre}
                    </h3>
                    {kit.descripcion && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {kit.descripcion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Código de Barras y SKU */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <Barcode className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {kit.codigo_barra || "Sin código EAN"}
                      </div>
                      <div className="text-[9px] text-slate-400">SKU: {kit.sku || "—"}</div>
                    </div>
                  </div>
                  {kit.codigo_barra && (
                    <button
                      onClick={() => handleCopyBarcode(kit.codigo_barra)}
                      className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="Copiar código de barras para pistola"
                    >
                      {copiedBarcode === kit.codigo_barra ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Badge de Stock Potencial / Cuello de Botella */}
                <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Box className={`w-3.5 h-3.5 ${kit.stock_potencial_kits > 0 ? "text-emerald-500" : "text-rose-500"}`} />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {kit.stock_potencial_kits > 0 ? `${kit.stock_potencial_kits} combos disponibles` : "Sin stock para armar"}
                    </span>
                  </div>
                  {kit.producto_cuello_botella && kit.stock_potencial_kits > 0 && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={`Cuello de botella: ${kit.producto_cuello_botella}`}>
                      Límite: {kit.producto_cuello_botella}
                    </span>
                  )}
                </div>

                {/* Componentes */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Componentes ({kit.items?.length || 0}):
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {kit.items?.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between py-1">
                        <div className="truncate mr-2 flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1 rounded font-mono ${
                            item.iva_tasa === 5 ? "bg-emerald-100 text-emerald-700" :
                            item.iva_tasa === 0 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {item.iva_tasa === 0 ? "EX" : `${item.iva_tasa}%`}
                          </span>
                          <span className="truncate">{item.nombre}</span>
                        </div>
                        <span className="font-mono font-black text-purple-600 dark:text-purple-400 shrink-0">
                          ×{item.cantidad}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Financiero y Acciones */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Precio Oferta Kit:</span>
                  <strong className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">
                    {formatPYG(kit.precio_venta)}
                  </strong>
                  {kit.ahorro_cliente_monto > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      Ahorro cliente: {formatPYG(kit.ahorro_cliente_monto)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(kit)}
                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition-colors"
                    title="Editar combo"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteKit(kit)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Eliminar combo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL CONSTRUCTOR / EDITOR DE KITS & COMBOS ── */}
      <KitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchData}
        kitToEdit={kitToEdit}
        allProducts={products}
      />
    </div>
  )
}
