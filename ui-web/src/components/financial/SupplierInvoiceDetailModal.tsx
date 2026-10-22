import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  X,
  Package,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Tag,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  Check,
} from "lucide-react"
import {
  api,
  type SupplierInvoiceWithPayments,
  type SupplierInvoiceItem,
} from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

interface Props {
  invoiceId: string
  onClose: () => void
  onUpdated?: () => void
}

export default function SupplierInvoiceDetailModal({
  invoiceId,
  onClose,
  onUpdated,
}: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<SupplierInvoiceWithPayments | null>(null)
  const [searchItem, setSearchItem] = useState("")
  const [filterTipoItem, setFilterTipoItem] = useState<"todos" | "producto" | "insumo">("todos")
  const [savingInvoiceType, setSavingInvoiceType] = useState(false)
  const [updatingItemIds, setUpdatingItemIds] = useState<Record<string, boolean>>({})

  // Cargar detalle completo de factura con ítems
  const loadInvoice = async () => {
    setLoading(true)
    try {
      const data = await api.financial.invoices.get(invoiceId)
      setInvoice(data)
    } catch (err: any) {
      toast.error("Error al cargar la factura", err.message || "No se pudo obtener el detalle")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId])

  // Determinar clasificación actual de la factura
  const currentInvoiceType = useMemo(() => {
    const t = (invoice?.tipo_comprobante || "").toLowerCase()
    if (t === "insumo_gasto" || t === "gasto") return "insumo_gasto"
    return "mercaderia"
  }, [invoice?.tipo_comprobante])

  // Cambiar tipo a nivel general de la factura
  const handleChangeInvoiceType = async (newType: "mercaderia" | "insumo_gasto", cascade: boolean = false) => {
    if (!invoice) return
    setSavingInvoiceType(true)
    try {
      const updated = await api.financial.invoices.updateClassification(invoice.id, {
        tipo_comprobante: newType,
        cascade_to_products: cascade,
      })
      setInvoice(updated)
      toast.success(
        "Clasificación actualizada",
        newType === "mercaderia"
          ? "Factura clasificada como Mercadería (Reventa)"
          : "Factura clasificada como Insumo / Gasto Operativo"
      )
      if (onUpdated) onUpdated()
    } catch (err: any) {
      toast.error("Error al actualizar clasificación", err.message)
    } finally {
      setSavingInvoiceType(false)
    }
  }

  // Conmutar clasificación de un producto / ítem individual
  const handleToggleItemType = async (item: SupplierInvoiceItem) => {
    if (!invoice || !item.product_id) {
      toast.warning("Ítem sin producto asociado", "Este concepto se clasifica a nivel general de la factura")
      return
    }

    const currentType = (item.tipo_producto || "producto").toLowerCase()
    const nextType = currentType === "insumo" ? "producto" : "insumo"

    // Optimistic update local
    setInvoice(prev => {
      if (!prev || !prev.items) return prev
      return {
        ...prev,
        items: prev.items.map(it => {
          if (it.product_id === item.product_id) {
            return { ...it, tipo_producto: nextType }
          }
          return it
        }),
      }
    })

    setUpdatingItemIds(prev => ({ ...prev, [item.product_id!]: true }))
    try {
      await api.financial.invoices.updateItemClassification(invoice.id, item.product_id, nextType)
      toast.success(
        "Producto reclasificado",
        nextType === "insumo"
          ? `"${item.descripcion}" ahora es Insumo (Uso Interno)`
          : `"${item.descripcion}" ahora es Mercadería (Reventa)`
      )
      if (onUpdated) onUpdated()
    } catch (err: any) {
      // Revertir optimistic update
      setInvoice(prev => {
        if (!prev || !prev.items) return prev
        return {
          ...prev,
          items: prev.items.map(it => {
            if (it.product_id === item.product_id) {
              return { ...it, tipo_producto: currentType }
            }
            return it
          }),
        }
      })
      toast.error("Error al reclasificar ítem", err.message)
    } finally {
      setUpdatingItemIds(prev => {
        const copy = { ...prev }
        delete copy[item.product_id!]
        return copy
      })
    }
  }

  // Filtrado de ítems
  const itemsFiltrados = useMemo(() => {
    if (!invoice?.items) return []
    return invoice.items.filter(it => {
      const q = searchItem.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (it.descripcion || "").toLowerCase().includes(q) ||
        (it.sku || "").toLowerCase().includes(q) ||
        (it.codigo_barra || "").toLowerCase().includes(q) ||
        (it.codigo_proveedor || "").toLowerCase().includes(q)

      const itType = (it.tipo_producto || "producto").toLowerCase()
      const matchesType =
        filterTipoItem === "todos" ||
        (filterTipoItem === "insumo" && itType === "insumo") ||
        (filterTipoItem === "producto" && itType !== "insumo")

      return matchesSearch && matchesType
    })
  }, [invoice?.items, searchItem, filterTipoItem])

  // Contadores por tipo de ítem
  const { countMercaderias, countInsumos } = useMemo(() => {
    let merc = 0
    let ins = 0
    if (invoice?.items) {
      for (const it of invoice.items) {
        if ((it.tipo_producto || "producto").toLowerCase() === "insumo") {
          ins++
        } else {
          merc++
        }
      }
    }
    return { countMercaderias: merc, countInsumos: ins }
  }, [invoice?.items])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
        {/* Cabecera (Rule 14: shrink-0 fija) */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                Factura #{invoice?.numero_factura || "..."}
              </h2>
              {invoice?.timbrado && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Timbrado: {invoice.timbrado}
                </span>
              )}
              {invoice?.estado && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    invoice.estado === "pagada"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : invoice.estado === "aprobada"
                      ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                  }`}
                >
                  {invoice.estado}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {invoice?.supplier_nombre || "Proveedor"}
              </span>
              {invoice?.supplier_ruc && (
                <span className="font-mono text-slate-400">RUC: {invoice.supplier_ruc}</span>
              )}
              {invoice?.fecha_emision && (
                <span>Emisión: <strong className="font-mono text-slate-600 dark:text-slate-300">{formatDate(invoice.fecha_emision)}</strong></span>
              )}
              {invoice?.fecha_vencimiento && (
                <span>Vencimiento: <strong className="font-mono text-slate-600 dark:text-slate-300">{formatDate(invoice.fecha_vencimiento)}</strong></span>
              )}
              {(invoice?.purchase_order_numero || invoice?.oc_numero) && (
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  OC: {(invoice.purchase_order_numero || invoice.oc_numero)?.replace(/^OC-/, "")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadInvoice}
              disabled={loading}
              title="Recargar datos"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Destacado de Clasificación de la Factura (shrink-0) */}
        <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Clasificación Global de la Factura
                </span>
                {savingInvoiceType && (
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">
                    Actualizando...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Define si este comprobante corresponde a mercadería para la reventa o a insumos/gastos operativos.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={savingInvoiceType || loading}
                onClick={() => handleChangeInvoiceType("mercaderia")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${
                  currentInvoiceType === "mercaderia"
                    ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/20"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                }`}
              >
                <Package className="w-4 h-4" />
                <span>📦 Mercadería (Reventa)</span>
                {currentInvoiceType === "mercaderia" && <Check className="w-3.5 h-3.5 ml-1" />}
              </button>

              <button
                type="button"
                disabled={savingInvoiceType || loading}
                onClick={() => handleChangeInvoiceType("insumo_gasto")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${
                  currentInvoiceType === "insumo_gasto"
                    ? "bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500/20"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>🏢 Insumo / Gasto Operativo</span>
                {currentInvoiceType === "insumo_gasto" && <Check className="w-3.5 h-3.5 ml-1" />}
              </button>

              {invoice?.items && invoice.items.length > 0 && (
                <button
                  type="button"
                  disabled={savingInvoiceType || loading}
                  onClick={() => {
                    const next = currentInvoiceType === "mercaderia" ? "insumo_gasto" : "mercaderia"
                    if (
                      window.confirm(
                        `¿Deseas clasificar la factura y TODOS sus ${invoice.items?.length || 0} productos como ${
                          next === "mercaderia" ? "MERCADERÍA (Reventa)" : "INSUMO (Uso Interno)"
                        }?`
                      )
                    ) {
                      handleChangeInvoiceType(next, true)
                    }
                  }}
                  title="Propagar a todos los artículos"
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  ⚡ Propagar a todos los ítems
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo Central Scrolleable (Rule 14: flex-1 overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Tarjetas de Totales Financieros */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Factura</span>
              <p className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white mt-0.5">
                {formatPYG(invoice?.total || 0)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Pendiente</span>
              <p className={`text-base sm:text-lg font-mono font-black mt-0.5 ${
                (invoice?.saldo_pendiente || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"
              }`}>
                {formatPYG(invoice?.saldo_pendiente || 0)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subtotal / Descuento</span>
              <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {formatPYG(invoice?.subtotal || invoice?.total || 0)}
                {Number(invoice?.descuento || 0) > 0 && (
                  <span className="text-emerald-600 text-xs ml-1">(-{formatPYG(invoice?.descuento)})</span>
                )}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Condición / Moneda</span>
              <p className="text-sm font-bold uppercase text-slate-700 dark:text-slate-300 mt-0.5">
                {invoice?.condicion || "Crédito"} • {invoice?.moneda || "PYG"}
              </p>
            </div>
          </div>

          {/* Barra de Filtros de Ítems */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar artículo por nombre, SKU o código de barra..."
                value={searchItem}
                onChange={e => setSearchItem(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setFilterTipoItem("todos")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterTipoItem === "todos"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Todos ({invoice?.items?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterTipoItem("producto")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterTipoItem === "producto"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span>📦 Mercaderías</span>
                <span className="text-[10px] opacity-80">({countMercaderias})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTipoItem("insumo")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterTipoItem === "insumo"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span>🏢 Insumos</span>
                <span className="text-[10px] opacity-80">({countInsumos})</span>
              </button>
            </div>
          </div>

          {/* Tabla de Artículos / Ítems */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Código / SKU</th>
                    <th className="p-3">Descripción del Producto</th>
                    <th className="p-3 text-right">Cantidad</th>
                    <th className="p-3 text-right">Precio Unit.</th>
                    <th className="p-3 text-center">IVA</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center min-w-[200px]">Clasificación de Ítem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                          <span>Cargando detalle de artículos...</span>
                        </div>
                      </td>
                    </tr>
                  ) : itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        {searchItem || filterTipoItem !== "todos"
                          ? "No se encontraron artículos con los filtros aplicados."
                          : "Esta factura no tiene líneas desglosadas."}
                      </td>
                    </tr>
                  ) : (
                    itemsFiltrados.map((it, idx) => {
                      const isUpdating = it.product_id ? !!updatingItemIds[it.product_id] : false
                      const itType = (it.tipo_producto || "producto").toLowerCase()
                      const isInsumo = itType === "insumo"

                      return (
                        <tr
                          key={it.id || idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>

                          <td className="p-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                            <div>{it.sku || it.codigo_proveedor || "-"}</div>
                            {it.codigo_barra && (
                              <div className="text-[10px] text-slate-400">{it.codigo_barra}</div>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {it.descripcion}
                            </span>
                            {it.origen && it.origen !== "direct" && (
                              <span className="text-[9px] text-slate-400 uppercase font-mono">
                                Origen: {it.origen === "receipt" ? "Recepción Muelle" : it.origen === "order" ? "Orden de Compra" : "Concepto Factura"}
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {Number(it.cantidad || 0).toLocaleString("es-PY", { maximumFractionDigits: 3 })}
                          </td>

                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatPYG(it.precio_unitario || 0)}
                          </td>

                          <td className="p-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {it.iva_tasa !== undefined && it.iva_tasa !== null ? `${it.iva_tasa}%` : "10%"}
                            </span>
                          </td>

                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatPYG(it.total || 0)}
                          </td>

                          {/* Clasificación interactiva del ítem */}
                          <td className="p-3 text-center">
                            {it.product_id ? (
                              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    if (isInsumo) handleToggleItemType(it)
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                    !isInsumo
                                      ? "bg-blue-600 text-white shadow-xs"
                                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                  }`}
                                  title="Marcar como Mercadería para Reventa en Góndola"
                                >
                                  <span>📦 Mercadería</span>
                                  {!isInsumo && <Check className="w-3 h-3" />}
                                </button>

                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    if (!isInsumo) handleToggleItemType(it)
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                    isInsumo
                                      ? "bg-amber-600 text-white shadow-xs"
                                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                  }`}
                                  title="Marcar como Insumo de Uso Interno del Supermercado"
                                >
                                  <span>🏢 Insumo</span>
                                  {isInsumo && <Check className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Clasificación en cabecera
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pie de Acciones (Rule 14: shrink-0 fija) */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>Total ítems: <strong className="font-mono text-slate-800 dark:text-slate-200">{invoice?.items?.length || 0}</strong></span>
            <span className="mx-2">•</span>
            <span>Mercaderías: <strong className="font-mono text-blue-600 dark:text-blue-400">{countMercaderias}</strong></span>
            <span className="mx-2">•</span>
            <span>Insumos: <strong className="font-mono text-amber-600 dark:text-amber-400">{countInsumos}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
