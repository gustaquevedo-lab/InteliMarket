import React, { useState, useEffect, useMemo } from "react"
import {
  Flame, X, Loader2, Sparkles, AlertCircle, CheckCircle2,
  Calendar, Layers, Warehouse as WarehouseIcon, AlertTriangle,
  ArrowRight, ShieldCheck, Tag
} from "lucide-react"
import { api, type SupermerRecipe } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface ProduceBatchModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  recipe: SupermerRecipe | null
}

export default function ProduceBatchModal({
  isOpen,
  onClose,
  onSuccess,
  recipe,
}: ProduceBatchModalProps) {
  const toast = useToast()

  const [loadingWhs, setLoadingWhs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])

  // Production inputs
  const [cantidadProducir, setCantidadProducir] = useState<number>(100)
  const [depositoOrigenId, setDepositoOrigenId] = useState("")
  const [depositoDestinoId, setDepositoDestinoId] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [loteCodigo, setLoteCodigo] = useState("")
  const [notas, setNotas] = useState("")

  // Multiplier state
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(1)

  useEffect(() => {
    if (!isOpen || !recipe) return

    const loadWarehouses = async () => {
      setLoadingWhs(true)
      try {
        const whsRes = await api.warehouses.list()
        const activeWhs = (whsRes || []).filter((w: any) => w.activo !== false)
        setWarehouses(activeWhs)

        // Set default warehouses from recipe or first active
        setDepositoOrigenId(recipe.deposito_origen_id || activeWhs[0]?.id || "")
        setDepositoDestinoId(recipe.deposito_destino_id || activeWhs[0]?.id || "")
      } catch (err: any) {
        console.error("Error loading warehouses", err)
      } finally {
        setLoadingWhs(false)
      }
    }
    loadWarehouses()

    // Base quantity to produce
    const baseQty = Number(recipe.cantidad_esperada || 100)
    setCantidadProducir(baseQty)
    setSelectedMultiplier(1)

    // Generate batch code (LOT-YYYYMMDD-HHMM)
    const now = new Date()
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "")
    const hm = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`
    setLoteCodigo(`LOT-${ymd}-${hm}`)

    // Expiration date (default 3 days for bakery/cooked food)
    const defaultExp = new Date()
    defaultExp.setDate(defaultExp.getDate() + (recipe.area === "rotiseria" ? 2 : 5))
    setFechaVencimiento(defaultExp.toISOString().split("T")[0])

    setNotas("")
  }, [isOpen, recipe])

  const handleMultiplierChange = (mult: number) => {
    if (!recipe) return
    setSelectedMultiplier(mult)
    const baseQty = Number(recipe.cantidad_esperada || 100)
    setCantidadProducir(Math.round(baseQty * mult * 100) / 100)
  }

  // Material explosion calculation
  const explosionItems = useMemo(() => {
    if (!recipe || !recipe.items) return []
    const baseYield = Number(recipe.cantidad_esperada || 1)
    const ratio = baseYield > 0 ? cantidadProducir / baseYield : 1

    return recipe.items.map(it => {
      const scaledQty = Number(it.cantidad || 0) * ratio
      const unitCost = Number(it.costo_unitario || 0)
      const subtotal = scaledQty * unitCost
      const stockDisp = Number(it.stock_disponible || 0)
      const hasEnough = stockDisp >= scaledQty

      return {
        ...it,
        scaledQty: Math.round(scaledQty * 1000) / 1000,
        subtotal,
        hasEnough,
      }
    })
  }, [recipe, cantidadProducir])

  const costoTotalEstimadoBatch = useMemo(() => {
    return explosionItems.reduce((acc, it) => acc + it.subtotal, 0)
  }, [explosionItems])

  const costoUnitarioEstimadoBatch = useMemo(() => {
    return cantidadProducir > 0 ? costoTotalEstimadoBatch / cantidadProducir : 0
  }, [costoTotalEstimadoBatch, cantidadProducir])

  const someStockInsufficient = useMemo(() => {
    return explosionItems.some(it => !it.hasEnough && depositoOrigenId)
  }, [explosionItems, depositoOrigenId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipe) return

    if (!cantidadProducir || cantidadProducir <= 0) {
      toast.error("Cantidad inválida", "Indique la cantidad a producir.")
      return
    }

    setSubmitting(true)
    try {
      await api.supermer.orders.produceDirect({
        receta_id: recipe.id,
        cantidad_producir: cantidadProducir,
        deposito_origen_id: depositoOrigenId || undefined,
        deposito_destino_id: depositoDestinoId || undefined,
        fecha_vencimiento: fechaVencimiento || undefined,
        lote_codigo: loteCodigo.trim() || undefined,
        notas: notas.trim() || undefined,
      })

      toast.success(
        "¡Producción Registrada!",
        `Se descontaron los insumos del depósito y se ingresaron ${cantidadProducir} ${recipe.unidad_medida || "UN"} de ${recipe.producto_terminado_nombre || recipe.nombre}.`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Error al registrar producción", err.message || "No se pudo procesar la orden")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !recipe) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white p-5 sm:p-6 border-b border-amber-500/20 flex-shrink-0">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                <Flame className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                  DISPARO DE PRODUCCIÓN · EXPLOSIÓN DE INSUMOS
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Elaborar: {recipe.nombre}
                </h2>
                <p className="text-xs text-slate-400">
                  Producto Terminado: <strong className="text-amber-300">{recipe.producto_terminado_nombre || "—"}</strong>
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

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          <form onSubmit={handleSubmit} id="produce-batch-form" className="space-y-6">
            {/* 1. SELECCIÓN DE CANTIDAD Y MULTIPLICADORES */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" /> Cantidad a Hornear / Producir
                </label>
                <div className="flex items-center gap-1.5">
                  {[0.5, 1, 2, 3, 5].map(mult => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => handleMultiplierChange(mult)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition ${
                        selectedMultiplier === mult
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                      }`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <div className="relative">
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.001"
                      value={cantidadProducir}
                      onChange={e => {
                        setCantidadProducir(parseFloat(e.target.value) || 0)
                        setSelectedMultiplier(0)
                      }}
                      className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-black text-lg text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-black font-mono text-slate-400">
                      {recipe.unidad_medida || "UN"}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Costo Teórico / Unit</span>
                  <p className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                    {formatPYG(costoUnitarioEstimadoBatch)}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. EXPLOSIÓN DE MATERIALES (INSUMOS ESCALADOS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Insumos a Descontar ({explosionItems.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cantidades calculadas automáticamente por explosión de fórmula
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  Total Costo: <strong className="text-slate-900 dark:text-white font-black">{formatPYG(costoTotalEstimadoBatch)}</strong>
                </span>
              </div>

              {someStockInsufficient && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  <span>
                    <strong>Atención:</strong> Uno o más insumos tienen stock registrado menor a la cantidad requerida en el depósito de origen. El sistema permitirá registrar la producción pero generará saldo negativo si no se han cargado compras previas.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Materia Prima</th>
                      <th className="p-3 text-right">Cant. Requerida</th>
                      <th className="p-3 text-right">Stock en Depósito</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {explosionItems.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <p className="font-extrabold text-slate-900 dark:text-white">{it.producto_nombre}</p>
                          {it.producto_sku && <p className="text-[10px] font-mono text-slate-400">SKU: {it.producto_sku}</p>}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {it.scaledQty} {it.unidad_medida}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400">
                          {it.stock_disponible != null ? `${it.stock_disponible} ${it.unidad_medida}` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {formatPYG(it.subtotal)}
                        </td>
                        <td className="p-3 text-center">
                          {it.hasEnough ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" /> Bajo Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. DEPÓSITOS Y TRAZABILIDAD DE LOTE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                  <WarehouseIcon className="w-3.5 h-3.5 text-amber-500" /> Depósito de Insumos (Salida) *
                </label>
                <select
                  required
                  value={depositoOrigenId}
                  onChange={e => setDepositoOrigenId(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar depósito --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                  <WarehouseIcon className="w-3.5 h-3.5 text-emerald-500" /> Depósito de Producto Final (Entrada) *
                </label>
                <select
                  required
                  value={depositoDestinoId}
                  onChange={e => setDepositoDestinoId(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-xs outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar depósito --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-500" /> Código de Lote Generado
                </label>
                <input
                  type="text"
                  value={loteCodigo}
                  onChange={e => setLoteCodigo(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" /> Fecha de Vencimiento de Lote
                </label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={e => setFechaVencimiento(e.target.value)}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Observaciones / Nro. Hornada / Cocinero Responsable
              </label>
              <input
                type="text"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Turno mañana - Horneado maestro Juan Pérez"
                className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:border-amber-500"
              />
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Kardex automático con trazabilidad</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="produce-batch-form"
              disabled={submitting || loadingWhs}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              Confirmar Producción & Descargar Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
