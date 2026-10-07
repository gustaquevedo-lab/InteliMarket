import React, { useState, useEffect, useCallback } from "react"
import {
  PackageCheck,
  Search,
  Calendar,
  Sparkles,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Boxes,
  RefreshCw,
  Loader2,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Plus
} from "lucide-react"
import {
  api,
  type Supplier,
  type ConsignmentSettlement,
  type ConsignmentSettlementPreview,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, getAsuncionDateStr, getTodayAsuncion } from "../../utils/format"

interface ConsignacionesTabProps {
  suppliers: Supplier[]
  onSettled?: () => void
}

export function ConsignacionesTab({ suppliers, onSettled }: ConsignacionesTabProps) {
  const { user } = useAuth()
  const toast = useToast()

  // Filtros de liquidación
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return getAsuncionDateStr(d)
  })
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    return getTodayAsuncion()
  })

  // Estado del preview
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<ConsignmentSettlementPreview | null>(null)

  // Formalización de liquidación (factura de proveedor)
  const [numeroFactura, setNumeroFactura] = useState<string>("")
  const [timbradoFactura, setTimbradoFactura] = useState<string>("")
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return getAsuncionDateStr(d)
  })
  const [observaciones, setObservaciones] = useState<string>("")
  const [savingSettlement, setSavingSettlement] = useState(false)

  // Historial de liquidaciones
  const [settlements, setSettlements] = useState<ConsignmentSettlement[]>([])
  const [loadingSettlements, setLoadingSettlements] = useState(false)
  const [selectedSettlementDetail, setSelectedSettlementDetail] = useState<ConsignmentSettlement | null>(null)

  // Detectar y seleccionar Talismán S.A. automáticamente por defecto si existe
  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) {
      const talisman = suppliers.find(s =>
        s.ruc?.includes("80021636") ||
        s.razon_social?.toUpperCase().includes("TALISM")
      )
      if (talisman) {
        setSelectedSupplierId(talisman.id)
      } else {
        setSelectedSupplierId(suppliers[0].id)
      }
    }
  }, [suppliers, selectedSupplierId])

  // Cargar historial de liquidaciones
  const fetchSettlements = useCallback(async () => {
    setLoadingSettlements(true)
    try {
      const res = await api.purchases.consignments.listSettlements(selectedSupplierId || undefined)
      if (Array.isArray(res)) setSettlements(res)
    } catch (err: any) {
      console.warn("Error al cargar liquidaciones de consignación:", err)
    } finally {
      setLoadingSettlements(false)
    }
  }, [selectedSupplierId])

  useEffect(() => {
    fetchSettlements()
  }, [fetchSettlements])

  // Ejecutar previsualización
  const handleCalculatePreview = async () => {
    if (!selectedSupplierId) {
      toast.error("Seleccione un proveedor", "Debe elegir el proveedor para liquidar.")
      return
    }
    setLoadingPreview(true)
    setPreviewData(null)
    try {
      const res = await api.purchases.consignments.previewSettlement({
        supplier_id: selectedSupplierId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      })
      setPreviewData(res)
      if (!res.items || res.items.length === 0) {
        toast.info("Sin movimientos", "No se encontraron productos o ventas en el período seleccionado para este proveedor.")
      } else {
        toast.success("Cálculo completado", `Se cotejaron ${res.items.length} producto(s) en consignación.`)
      }
    } catch (err: any) {
      toast.error("Error al calcular liquidación", err.message || "Verifique los parámetros.")
    } finally {
      setLoadingPreview(false)
    }
  }

  // Confirmar y generar liquidación
  const handleConfirmSettlement = async () => {
    if (!previewData || previewData.items.length === 0) {
      toast.error("Sin datos", "Primero debe calcular la liquidación del período.")
      return
    }

    setSavingSettlement(true)
    try {
      const res = await api.purchases.consignments.settle({
        supplier_id: selectedSupplierId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        numero_factura_proveedor: numeroFactura.trim() || undefined,
        timbrado_factura: timbradoFactura.trim() || undefined,
        fecha_vencimiento_factura: fechaVencimiento || undefined,
        observaciones: observaciones.trim() || undefined,
        items: previewData.items.map(it => ({
          product_id: it.product_id,
          stock_inicial: it.stock_actual,
          cantidad_recibida: it.entradas_remision,
          cantidad_vendida: it.ventas_pos,
          cantidad_devuelta: it.devoluciones_rtv,
          stock_final_teorico: it.stock_actual,
          stock_fisico_remanente: it.stock_actual,
          diferencia_merma: 0,
          unidades_a_liquidar: it.unidades_a_liquidar,
          costo_unitario: it.costo_unitario,
          precio_venta_promedio: it.precio_venta,
          total_costo: it.total_costo,
          total_venta: it.total_venta,
          margen_ganancia: it.margen_ganancia,
        })),
      })

      toast.success(
        "¡Liquidación Cerrada!",
        `Se generó la liquidación ${res.numero}.${numeroFactura ? " Se creó la factura en Cuentas por Pagar." : ""}`
      )
      setNumeroFactura("")
      setObservaciones("")
      setPreviewData(null)
      fetchSettlements()
      if (onSettled) onSettled()
    } catch (err: any) {
      toast.error("Error al cerrar liquidación", err.message || "Ocurrió un error inesperado.")
    } finally {
      setSavingSettlement(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── BANNER EXPLICATIVO SBT ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 p-5 rounded-2xl border border-indigo-500/30 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
              <Boxes className="w-5 h-5" />
            </span>
            <h2 className="text-base font-extrabold tracking-tight">
              Liquidación y Control de Consignaciones (Scan-Based Trading / VMI)
            </h2>
          </div>
          <p className="text-xs text-indigo-200/80 max-w-3xl leading-relaxed">
            La mercadería en consignación (loterías, juegos de azar, panificados frescos, revistas) ingresa a custodia por <strong>Nota de Remisión</strong> aumentando el stock físico sin generar deuda comercial anticipada. Al cierre de ciclo, el sistema coteja automáticamente las <strong>ventas reales de las cajas registradoras (POS)</strong> contra el costo pactado para formalizar la liquidación y la Factura Legal del proveedor.
          </p>
        </div>
      </div>

      {/* ── BARRA DE PARÁMETROS DE CORTE ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Parámetros del Ciclo de Liquidación
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Sugerencia: Ciclos semanales (domingo a domingo para Telebingo)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Proveedor */}
          <div className="space-y-1 md:col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Proveedor en Consignación
            </label>
            <div className="relative">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="">Seleccione proveedor...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.razon_social} {s.ruc ? `(${s.ruc})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha Desde */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            />
          </div>

          {/* Fecha Hasta */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
            />
          </div>

          {/* Botón Calcular */}
          <div>
            <button
              onClick={handleCalculatePreview}
              disabled={loadingPreview || !selectedSupplierId}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {loadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calculando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Calcular Liquidación</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── RESULTADO DE LA LIQUIDACIÓN (PREVIEW) ───────────────────────────── */}
      {previewData && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Recibidas en Remisión
              </span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                {Number(previewData.total_unidades_recibidas || 0).toLocaleString("es-PY")} u.
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block mb-1">
                Ventas Registradas en POS
              </span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {Number(previewData.total_unidades_vendidas || 0).toLocaleString("es-PY")} u.
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block mb-1">
                Total a Pagar (Costo Proveedor)
              </span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {formatPYG(previewData.total_costo_liquidado || 0)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                Recaudado en Cajas POS
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {formatPYG(previewData.total_recaudado_pos || 0)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 shadow-xs col-span-2 md:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                Margen Bruto Supermercado
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                {formatPYG(previewData.margen_ganancia || 0)}
              </span>
            </div>
          </div>

          {/* TABLA DE PRODUCTOS A LIQUIDAR */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-500" />
                Detalle de Mercaderías Liquidadas del Período
              </h4>
              <span className="text-xs text-slate-500 font-semibold">
                Proveedor: <strong className="text-slate-800 dark:text-slate-200">{previewData.supplier_nombre}</strong> ({formatDate(previewData.fecha_desde)} al {formatDate(previewData.fecha_hasta)})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Stock Actual</th>
                    <th className="px-4 py-3 text-right">Remisiones Entradas</th>
                    <th className="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400">Ventas Cajas POS</th>
                    <th className="px-4 py-3 text-right">Costo Unit.</th>
                    <th className="px-4 py-3 text-right font-black text-rose-600">Total a Liquidar</th>
                    <th className="px-4 py-3 text-right text-emerald-600">Recaudación POS</th>
                    <th className="px-4 py-3 text-right text-amber-600">Margen Extra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {previewData.items.map((it) => (
                    <tr key={it.product_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{it.product_sku}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{it.product_nombre}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(it.stock_actual).toLocaleString("es-PY")} u.
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(it.entradas_remision).toLocaleString("es-PY")} u.
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {Number(it.ventas_pos).toLocaleString("es-PY")} u.
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatPYG(it.costo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        {formatPYG(it.total_costo)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatPYG(it.total_venta)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatPYG(it.margen_ganancia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FORMULARIO DE CIERRE Y FACTURACIÓN */}
            <div className="p-5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Formalización de Factura Legal del Proveedor (Opcional pero Recomendado)
                </h5>
              </div>
              <p className="text-[11px] text-slate-500">
                Si el promotor o transportista de {previewData.supplier_nombre} ya entregó la factura legal por este ciclo, ingrese los datos para que el sistema cree automáticamente la <strong>Cuenta por Pagar</strong> en estado pendiente para tesorería.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    N° Factura del Proveedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 001-001-0004589"
                    value={numeroFactura}
                    onChange={(e) => setNumeroFactura(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Timbrado Fiscal
                  </label>
                  <input
                    type="text"
                    placeholder="18545636"
                    value={timbradoFactura}
                    onChange={(e) => setTimbradoFactura(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Fecha Vencimiento Factura
                  </label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Observaciones / Notas de Liquidación
                </label>
                <input
                  type="text"
                  placeholder="Ej. Liquidación semanal de cartones Telebingo jugada domingo 05/10..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleConfirmSettlement}
                  disabled={savingSettlement}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  {savingSettlement ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cerrando Liquidación...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Cerrar Liquidación y Generar Compromiso</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE LIQUIDACIONES CERRADAS ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs space-y-3">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Historial de Liquidaciones de Consignación
            </h4>
          </div>
          <button
            onClick={fetchSettlements}
            disabled={loadingSettlements}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSettlements ? "animate-spin" : ""}`} />
          </button>
        </div>

        {settlements.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Boxes className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-xs">Aún no hay liquidaciones de consignación registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">N° Liquidación</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right font-black">Total Costo</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Recaudación POS</th>
                  <th className="px-4 py-3">Factura Asoc.</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {s.numero}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                      {s.supplier_nombre || "Proveedor"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {formatDate(s.fecha_desde)} al {formatDate(s.fecha_hasta)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(s.total_unidades_liquidadas || 0).toLocaleString("es-PY")} u.
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                      {formatPYG(s.total_costo_liquidado)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formatPYG(s.total_recaudado_pos)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {s.numero_factura_proveedor ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {s.numero_factura_proveedor}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        s.estado === "facturado"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      }`}>
                        {s.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
