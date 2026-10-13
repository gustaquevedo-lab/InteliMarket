import React, { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  X, Check, AlertCircle, TrendingDown, DollarSign,
  Building2, Sparkles, Tag, ArrowRight, CheckCircle2,
  Calendar, Phone, ShieldCheck, Loader2, RefreshCw
} from "lucide-react"
import { api, type ProductSupplierComparisonResponse, type SupplierPriceComparisonItem } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface Props {
  productId: string
  productNombre?: string
  onClose: () => void
  onSelectSupplierPrice?: (supplierId: string, supplierName: string, price: number) => void
  onProductUpdated?: () => void
}

export const ProductPriceComparisonModal: React.FC<Props> = ({
  productId,
  productNombre,
  onClose,
  onSelectSupplierPrice,
  onProductUpdated,
}) => {
  const toast = useToast()
  const [data, setData] = useState<ProductSupplierComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingHabitualId, setUpdatingHabitualId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.purchases.getProductSupplierComparison(productId)
      setData(res)
    } catch (err: any) {
      toast.error("Error al cargar comparativa", err.message || "No se pudo obtener el historial de precios.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) {
      fetchData()
    }
  }, [productId])

  const handleSetHabitualSupplier = async (supplierId: string, supplierName: string, nuevoCosto: number) => {
    setUpdatingHabitualId(supplierId)
    try {
      await api.products.update(productId, {
        supplier_id: supplierId as any,
        ultimo_costo: nuevoCosto as any,
      })
      toast.success("Proveedor Habitual Actualizado", `"${supplierName}" es ahora el proveedor principal de este producto.`)
      await fetchData()
      if (onProductUpdated) onProductUpdated()
    } catch (err: any) {
      toast.error("Error al actualizar proveedor habitual", err.message || String(err))
    } finally {
      setUpdatingHabitualId(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                  {data?.nombre || productNombre || "Comparativa de Proveedores"}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  Libertad de Compra
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                SKU: {data?.sku || "—"} | Barra: {data?.codigo_barra || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Analizando ofertas y compras históricas de todos los proveedores...</p>
            </div>
          ) : !data || data.proveedores.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No hay proveedores registrados aún para este producto</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Podés emitir la orden de compra seleccionando cualquier proveedor del supermercado; el sistema registrará automáticamente su precio para futuras comparativas.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen Superior: Quién vende más barato y ahorro */}
              {data.mejor_supplier_id && (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  data.ahorro_maximo_gs > 0
                    ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Proveedor Más Económico
                      </div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {data.mejor_supplier_nombre}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Precio: <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">{formatPYG(data.mejor_precio || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {data.ahorro_maximo_gs > 0 ? (
                    <div className="text-right sm:border-l sm:pl-4 border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Ahorro vs Proveedor Habitual</div>
                      <div className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-base">
                        +{formatPYG(data.ahorro_maximo_gs)} / un.
                      </div>
                      <span className="inline-block text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {data.ahorro_maximo_pct}% Más Barato
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-medium">
                      El proveedor habitual ya ofrece el mejor precio registrado.
                    </div>
                  )}
                </div>
              )}

              {/* Lista Detallada de Proveedores y Precios */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  <span>Proveedores Disponibles ({data.proveedores.length})</span>
                  <span>Historial y Condiciones</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {data.proveedores.map((p, idx) => {
                    const isBest = p.es_mas_barato
                    const isHabitual = p.es_habitual

                    return (
                      <div
                        key={p.supplier_id}
                        className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                          isBest
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Datos del Proveedor */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {p.razon_social}
                            </span>
                            {isBest && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-600 text-white shadow-sm flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Más Barato
                              </span>
                            )}
                            {isHabitual && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Habitual
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap">
                            {p.ruc && <span>RUC: {p.ruc}</span>}
                            {p.fecha_ultima_compra && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Últ. compra: {formatDate(p.fecha_ultima_compra)}
                              </span>
                            )}
                            {p.referencia_doc && <span>({p.referencia_doc})</span>}
                          </div>
                        </div>

                        {/* Precios y Acciones */}
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Precio Compra</div>
                            <div className={`font-mono font-extrabold text-sm ${isBest ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                              {formatPYG(p.mejor_precio)}
                            </div>
                            {p.ahorro_vs_habitual > 0 && (
                              <div className="text-[10px] text-emerald-600 font-bold">
                                -{formatPYG(p.ahorro_vs_habitual)} ({p.ahorro_pct}%)
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Botón Aplicar a Orden de Compra */}
                            {onSelectSupplierPrice && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSupplierPrice(p.supplier_id, p.razon_social, Number(p.mejor_precio))
                                  onClose()
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                                  isBest
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                }`}
                                title="Seleccionar este proveedor y precio para la orden"
                              >
                                Comprar aquí <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {/* Botón Convertir en Proveedor Habitual */}
                            {!isHabitual && (
                              <button
                                type="button"
                                disabled={updatingHabitualId === p.supplier_id}
                                onClick={() => handleSetHabitualSupplier(p.supplier_id, p.razon_social, Number(p.mejor_precio))}
                                className="px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                                title="Fijar este proveedor como nuevo habitual del producto"
                              >
                                {updatingHabitualId === p.supplier_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                                ) : (
                                  "Hacer Habitual"
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Intelimarket Inteligencia Comercial • Podés comprar de cualquier proveedor al costo más conveniente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
