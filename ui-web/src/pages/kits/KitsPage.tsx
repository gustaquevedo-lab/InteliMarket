import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Gift, Plus, Search, Loader2, X, Trash2, Edit, RefreshCw,
  Package, Tag, Layers, Barcode, DollarSign, CheckCircle2, ShieldAlert,
  Info, HelpCircle, ArrowRight, BookOpen, Filter, Box, Calculator,
  TrendingUp, Percent, Sparkles, ShoppingCart
} from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG } from "../../utils/format"

export default function KitsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [kits, setKits] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Formulario Constructor de Kits
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [kitForm, setKitForm] = useState({
    nombre: "",
    descripcion: "",
    product_id: "", // Producto padre para SKU
    precio_venta: 0,
    items: [] as Array<{ product_id: string; product_nombre: string; cantidad: number; costo_unitario: number; precio_unitario: number }>,
  })
  const [selectedCompId, setSelectedCompId] = useState("")
  const [compQty, setCompQty] = useState(1)

  // Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [kitsList, prods] = await Promise.all([
        api.kits.list(),
        api.products.list({ limit: 500 }),
      ])
      setKits(kitsList || [])
      setProducts(prods || [])
      if (prods && prods.length > 0 && !kitForm.product_id) {
        setKitForm(prev => ({ ...prev, product_id: prods[0].id }))
      }
    } catch (e: any) {
      toast.error("Error al cargar kits", e.message)
    } finally {
      setLoading(false)
    }
  }, [kitForm.product_id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrado
  const filteredKits = useMemo(() => {
    return kits.filter(k => {
      return !search || 
        k.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        k.descripcion?.toLowerCase().includes(search.toLowerCase())
    })
  }, [kits, search])

  // KPIs
  const totalKits = kits.length
  const avgMargenPct = kits.length > 0
    ? (kits.reduce((acc, k) => acc + Number(k.margen_pct || 0), 0) / kits.length).toFixed(1)
    : "0.0"
  const totalAhorroClientes = kits.reduce((acc, k) => acc + Number(k.ahorro_cliente_monto || 0), 0)

  // Cálculos en vivo del Constructor de Kit
  const kitCostoAcumulado = kitForm.items.reduce((acc, item) => acc + (item.costo_unitario * item.cantidad), 0)
  const kitPrecioIndividualTotal = kitForm.items.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0)
  const kitMargenMonto = Number(kitForm.precio_venta || 0) - kitCostoAcumulado
  const kitMargenPct = Number(kitForm.precio_venta || 0) > 0 ? (kitMargenMonto / Number(kitForm.precio_venta)) * 100 : 0
  const kitAhorroCliente = Math.max(0, kitPrecioIndividualTotal - Number(kitForm.precio_venta || 0))

  const handleAddComponent = () => {
    if (!selectedCompId) return
    const p = products.find(prod => prod.id === selectedCompId)
    if (!p) return

    setKitForm(prev => {
      const exists = prev.items.find(i => i.product_id === p.id)
      if (exists) {
        return {
          ...prev,
          items: prev.items.map(i => i.product_id === p.id ? { ...i, cantidad: i.cantidad + compQty } : i)
        }
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: p.id,
            product_nombre: p.nombre,
            cantidad: compQty,
            costo_unitario: Number(p.costo_promedio || 0),
            precio_unitario: Number(p.precio_venta || 0),
          }
        ]
      }
    })
    setSelectedCompId("")
    setCompQty(1)
  }

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kitForm.nombre || kitForm.items.length < 2 || !kitForm.precio_venta) {
      toast.error("Datos incompletos", "El Kit debe tener nombre, al menos 2 componentes y un precio de venta.")
      return
    }

    setSaving(true)
    try {
      await api.kits.create({
        product_id: kitForm.product_id || products[0]?.id,
        nombre: kitForm.nombre,
        descripcion: kitForm.descripcion || undefined,
        precio_venta: Number(kitForm.precio_venta),
        items: kitForm.items.map(i => ({
          product_id: i.product_id,
          cantidad: i.cantidad,
        }))
      })

      toast.success("Kit Promocional Creado", `${kitForm.nombre} guardado exitosamente.`)
      setShowModal(false)
      setKitForm({
        nombre: "",
        descripcion: "",
        product_id: products[0]?.id || "",
        precio_venta: 0,
        items: [],
      })
      fetchData()
    } catch (e: any) {
      toast.error("Error al guardar kit", e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKit = async (k: any) => {
    const ok = await confirm({
      title: "Eliminar Kit",
      message: `¿Estás seguro de eliminar el combo "${k.nombre}"?`,
      confirmText: "Eliminar",
    })
    if (!ok) return

    try {
      await api.kits.delete(k.id)
      toast.success("Kit eliminado", "")
      fetchData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
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
                    OFERTAS COMPUESTAS · EXPLOSIÓN EN CAJA POS
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
                  Armado de packs comerciales, combos con explosión de inventario en POS y cálculo de rentabilidad compuesta
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
                ⚡ Descuento automático de componentes en caja
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
              onClick={() => {
                setKitForm({
                  nombre: "",
                  descripcion: "",
                  product_id: products[0]?.id || "",
                  precio_venta: 0,
                  items: [],
                })
                setShowModal(true)
              }}
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
            <p className="text-[11px] text-slate-400">Rentabilidad compuesta</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Percibido</span>
              <DollarSign className="w-4 h-4 text-pink-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-pink-300">
              {formatPYG(totalAhorroClientes)}
            </p>
            <p className="text-[11px] text-slate-400">Ventaja vs ítems sueltos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Explosión de Stock</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              Automática
            </p>
            <p className="text-[11px] text-slate-400">Descuento en POS en vivo</p>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR DE FILTROS ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar kit o combo por nombre o componente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
          />
        </div>

        <span className="text-xs font-bold text-slate-500 font-mono">
          {filteredKits.length} kits disponibles
        </span>
      </div>

      {/* ── LISTADO DE KITS EN TARJETAS LUXURY ── */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Cargando combos...</p>
        </div>
      ) : filteredKits.length === 0 ? (
        <div className="p-16 text-center text-slate-400 space-y-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Gift className="w-12 h-12 mx-auto opacity-40 text-purple-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay kits registrados</p>
          <p className="text-xs">Hacé clic en "+ Crear Nuevo Combo" para armar tu primera oferta compuesta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKits.map((kit) => (
            <div
              key={kit.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 font-bold text-xs">
                    <Gift className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Margen: {kit.margen_pct}%
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug">{kit.nombre}</h3>
                  {kit.descripcion && <p className="text-xs text-slate-400 mt-1">{kit.descripcion}</p>}
                </div>

                {/* Componentes */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Componentes ({kit.items?.length || 0}):
                  </span>
                  <div className="space-y-1">
                    {kit.items?.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span className="truncate mr-2">• {item.nombre}</span>
                        <span className="font-mono font-black text-purple-600 dark:text-purple-400 shrink-0">×{item.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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

                <button
                  onClick={() => handleDeleteKit(kit)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                  title="Eliminar kit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: CREAR NUEVO KIT ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" /> Crear Nuevo Kit / Combo
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-bold mb-1 block">Nombre del Kit / Combo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Combo Parrillero Completo"
                  value={kitForm.nombre}
                  onChange={(e) => setKitForm({ ...kitForm, nombre: e.target.value })}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-bold mb-1 block">Precio Venta Kit (₲) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={kitForm.precio_venta}
                    onChange={(e) => setKitForm({ ...kitForm, precio_venta: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-black text-purple-600 dark:text-purple-400 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold mb-1 block">Descripción Breve</label>
                  <input
                    type="text"
                    placeholder="Ej. Oferta fin de semana"
                    value={kitForm.descripcion}
                    onChange={(e) => setKitForm({ ...kitForm, descripcion: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Agregar Componentes */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Agregar Artículos Componentes:
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedCompId}
                    onChange={(e) => setSelectedCompId(e.target.value)}
                    className="flex-1 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-medium truncate"
                  >
                    <option value="">Seleccionar Producto...</option>
                    {products.slice(0, 200).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} (Costo: {formatPYG(Number(p.costo_promedio || 0))})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={compQty}
                    onChange={(e) => setCompQty(Math.max(1, Number(e.target.value)))}
                    className="w-16 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-center font-mono font-bold outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    className="px-3 rounded-2xl bg-purple-600 text-white hover:bg-purple-700 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Lista de Componentes */}
                {kitForm.items.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {kitForm.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.product_nombre}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {item.cantidad} un. × Costo: {formatPYG(item.costo_unitario)} (PVP: {formatPYG(item.precio_unitario)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKitForm({ ...kitForm, items: kitForm.items.filter((_, i) => i !== idx) })}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Indicador de Rentabilidad Compuesta */}
              {kitForm.items.length > 0 && (
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Costo Acumulado:</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{formatPYG(kitCostoAcumulado)}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Suma PVP Ítems Sueltos:</span>
                    <strong className="font-mono text-slate-400 line-through">{formatPYG(kitPrecioIndividualTotal)}</strong>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-purple-500/20">
                    <span className="font-bold text-purple-600 dark:text-purple-400">Margen Bruto del Kit:</span>
                    <strong className="font-mono font-black text-purple-600 dark:text-purple-400">
                      {kitMargenPct.toFixed(1)}% ({formatPYG(kitMargenMonto)})
                    </strong>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md shadow-purple-500/20 transition flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar Kit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
