import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Gift, Plus, Search, Loader2, X, Trash2, Edit, RefreshCw,
  Package, Tag, Layers, Barcode, DollarSign, CheckCircle2, ShieldAlert,
  Info, HelpCircle, ArrowRight, BookOpen, Filter, Box, Calculator,
  TrendingUp, Percent, Sparkles, ShoppingCart
} from "lucide-react"
import { api, type Product } from "../api"
import { useToast } from "../context/ToastContext"
import { useConfirm } from "../components/ConfirmDialog"
import { formatPYG } from "../utils/format"

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
      setKits(kitsList)
      setProducts(prods)
      if (prods.length > 0 && !kitForm.product_id) {
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
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in pb-24">
      {/* ──────────────────────────────────────────────────────────────────────────
          HEADER
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Kits & Combos Promocionales
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Armado de packs comerciales, combos con explosión de inventario en POS y cálculo de rentabilidad compuesta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
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
            className="btn-primary text-xs flex items-center gap-2 px-4 py-2.5 shadow-md bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" /> + Crear Nuevo Kit / Combo
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          HERO KPIS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kits Activos</span>
            <Gift className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            {totalKits.toLocaleString()}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Combos listos para facturar</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Margen Promedio Kits</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {avgMargenPct}%
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Rentabilidad comercial compuesta</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ahorro Medio al Cliente</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {formatPYG(totalAhorroClientes)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Beneficio promocional vs ítems sueltos</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Explosión de Stock</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            Automática en POS
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Descuento de componentes en vivo</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          BANNER DE INSTRUCCIONES
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="card p-5 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/30 border border-purple-200/80 dark:border-purple-900/60 rounded-3xl space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              Guía de Uso: ¿Cómo armar y vender Kits / Combos en InteliMarket?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Un Kit o Combo agrupa varios productos del catálogo bajo una oferta conjunta. No necesitas empaquetarlos físicamente por adelantado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-purple-600 dark:text-purple-400 block font-mono">1. Selección de Componentes</strong>
                Elegí los productos que componen el combo (ej. 2kg Carne + 1 Carbón + 2 Bebidas).
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-purple-600 dark:text-purple-400 block font-mono">2. Cálculo de Margen en Vivo</strong>
                El sistema suma el costo de compra de cada artículo para que tu precio de oferta garantice ganancia.
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-purple-600 dark:text-purple-400 block font-mono">3. Venta en Caja (Explosión)</strong>
                Al escanear el Kit en el POS, el sistema descuenta automáticamente la cantidad exacta de cada componente de su stock.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          LISTADO DE KITS EN TARJETAS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar Kit por nombre o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 pr-8 w-full text-xs font-medium py-2.5"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            {filteredKits.length} kits encontrados
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Cargando kits...</p>
          </div>
        ) : filteredKits.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2 card bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Gift className="w-12 h-12 mx-auto opacity-40 text-purple-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay kits registrados</p>
            <p className="text-xs">Hacé clic en "+ Crear Nuevo Kit / Combo" para armar tu primera oferta compuesta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredKits.map((kit) => (
              <div
                key={kit.id}
                className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl space-y-4 hover:border-purple-300 dark:hover:border-purple-800 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 font-bold text-xs">
                      <Gift className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      Margen: {kit.margen_pct}%
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">{kit.nombre}</h3>
                    {kit.descripcion && <p className="text-xs text-slate-500 mt-1">{kit.descripcion}</p>}
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
                          <span className="font-mono font-bold text-purple-600 shrink-0">×{item.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Precio Oferta Kit:</span>
                    <strong className="text-lg font-black font-mono text-purple-600">
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
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Eliminar kit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: CREAR NUEVO KIT
      ────────────────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" /> Crear Nuevo Kit / Combo
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKit} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre del Kit / Combo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Combo Parrillero Completo"
                  value={kitForm.nombre}
                  onChange={(e) => setKitForm({ ...kitForm, nombre: e.target.value })}
                  className="input-field w-full text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Descripción Breve</label>
                  <input
                    type="text"
                    placeholder="Ej. Oferta fin de semana"
                    value={kitForm.descripcion}
                    onChange={(e) => setKitForm({ ...kitForm, descripcion: e.target.value })}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              {/* Agregar Componentes */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Agregar Artículos Componentes:
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedCompId}
                    onChange={(e) => setSelectedCompId(e.target.value)}
                    className="input-field flex-1 text-xs truncate"
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
                    className="input-field w-16 text-center text-xs font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
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
                          <span className="text-[10px] text-slate-400 block">
                            {item.cantidad} un. × Costo: {formatPYG(item.costo_unitario)} (PVP: {formatPYG(item.precio_unitario)})
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

              {/* Indicador de Rentabilidad Compuesta */}
              {kitForm.items.length > 0 && (
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Costo Acumulado:</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{formatPYG(kitCostoAcumulado)}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Suma PVP Ítems Sueltos:</span>
                    <strong className="font-mono text-slate-400 line-through">{formatPYG(kitPrecioIndividualTotal)}</strong>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-purple-200/60">
                    <span className="font-bold text-purple-700 dark:text-purple-300">Margen Bruto del Kit:</span>
                    <strong className="font-mono font-black text-purple-700 dark:text-purple-300">
                      {kitMargenPct.toFixed(1)}% ({formatPYG(kitMargenMonto)})
                    </strong>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2 shadow-md bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
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
