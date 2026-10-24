import React from "react"
import { createPortal } from "react-dom"
import { X, Loader2, ArrowDownRight, ArrowUpRight, History } from "lucide-react"

export interface KardexProductoInfo {
  id: string
  nombre: string
  sku?: string | undefined
}

export interface KardexMovimientoItem {
  id: string
  created_at: string
  tipo: string
  warehouse_nombre?: string
  cantidad: number
  saldo_acumulado?: number
  user_nombre?: string
  motivo?: string
}

interface KardexProductoDetalleModalProps {
  producto: KardexProductoInfo | null
  movimientos: KardexMovimientoItem[]
  loading: boolean
  onClose: () => void
}

/**
 * Modal estándar (Regla 14) para Visualización del Historial Completo de un Producto en Kardex.
 * Contenedor max-h-[90vh], cabecera y pie fijos (shrink-0), tabla scrolleable.
 */
export default function KardexProductoDetalleModal({
  producto,
  movimientos,
  loading,
  onClose,
}: KardexProductoDetalleModalProps) {
  if (!producto) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera (shrink-0) */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">
                {producto.nombre}
              </h3>
              <p className="text-[10px] font-mono text-gray-400">
                SKU: <span className="text-gray-600 dark:text-gray-300 font-bold">{producto.sku}</span> · Historial completo (hasta 500 movimientos más recientes)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Central (flex-1 overflow-y-auto) */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-bold">Cargando historial...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <p className="font-bold text-xs">Sin movimientos registrados para este producto.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800 sticky top-0 backdrop-blur-xs z-10">
                <tr>
                  <th className="p-3">Fecha & Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Depósito</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-right">Saldo</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Motivo / Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                {movimientos.map((m) => {
                  const isPositive = m.tipo === "ENTRADA" || (m.cantidad ?? 0) > 0
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono text-[11px] text-gray-500">
                        {new Date(m.created_at).toLocaleString("es-PY", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            m.tipo === "saldo_inicial"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                              : m.tipo === "ENTRADA" || (m.cantidad ?? 0) > 0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : m.tipo === "SALIDA" || (m.cantidad ?? 0) < 0
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {m.tipo === "saldo_inicial" ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block mr-0.5" />
                          ) : isPositive ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {m.tipo === "saldo_inicial" ? "SALDO INICIAL" : m.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        {m.warehouse_nombre || "Depósito Central"}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-black ${
                          isPositive ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {isPositive ? `+${Math.abs(m.cantidad ?? 0)}` : `-${Math.abs(m.cantidad ?? 0)}`}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                        {m.saldo_acumulado ?? "—"}
                      </td>
                      <td className="p-3 text-gray-500 text-[11px]">{m.user_nombre || "—"}</td>
                      <td className="p-3 text-gray-500 text-[11px]">{m.motivo || "Movimiento operativo"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie de Acciones Fijo (shrink-0) */}
        <div className="p-3.5 border-t border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-slate-400 font-mono text-[11px]">
            {movimientos.length} movimientos cargados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
