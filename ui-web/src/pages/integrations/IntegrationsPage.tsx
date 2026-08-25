import React, { useState, useMemo, useEffect, useCallback } from "react"
import {
  CreditCard, QrCode, Printer, Usb, CheckCircle2, AlertTriangle,
  RefreshCcw, Search, Plus, ExternalLink, ShieldCheck, DollarSign,
  ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet, Lock, Zap,
  Terminal, Store, ChevronRight, Eye, Smartphone, Wifi, Radio, Filter,
  TrendingUp, Activity, CheckCircle, Flame, ShieldAlert
} from "lucide-react"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"

type Tab = "bancard" | "dinelco" | "cierres_lote" | "qr_pix" | "hardware"

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>("bancard")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  // Arrancan en 0/desconectado -- antes había números inventados acá que se
  // veían idénticos a datos reales, incluso cuando la consulta al legacy
  // fallaba o devolvía 0 de verdad. Ahora "connected" refleja si la
  // consulta a la base real de Ñemuha funcionó o no.
  const [kpis, setKpis] = useState({
    connected: false,
    error: undefined as string | undefined,
    bancard_total_gs: 0,
    bancard_tarjetas_gs: 0,
    bancard_tarjetas_txs: 0,
    dinelco_total_gs: 0,
    dinelco_txs: 0,
    qr_total_gs: 0,
    qr_total_txs: 0,
    hoy_total_gs: 0,
    hoy_total_txs: 0,
    total_operaciones: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, txRes] = await Promise.allSettled([
        api.integrations.posKpis(),
        api.integrations.posTransactions({ limit: 150 }),
      ])
      if (kpiRes.status === "fulfilled" && kpiRes.value) {
        setKpis(kpiRes.value)
      } else {
        setKpis((prev) => ({ ...prev, connected: false }))
      }
      setTransactions(txRes.status === "fulfilled" && Array.isArray(txRes.value) ? txRes.value : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const bancardTxs = useMemo(() => {
    return transactions.filter(t => t.procesador.toUpperCase().includes("BANCARD"))
  }, [transactions])

  const dinelcoTxs = useMemo(() => {
    return transactions.filter(t => t.procesador.toUpperCase().includes("DINELCO"))
  }, [transactions])

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Pasarelas de Pago & Hardware POS
                </h1>
                {kpis.connected ? (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Conectado a Ñemuha (dato real)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Sin conexión al legacy
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Transacciones reales de Bancard/Dinelco capturadas por las maquinitas físicas, leídas en vivo desde la base del sistema legacy (Ñemuha)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refrescar Datos
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ESTILIZADAS CON ESTÉTICA OFICIAL ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tarjetas Bancard POS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Tarjetas Bancard (POS)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {formatPYG(kpis.bancard_tarjetas_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Cupones: <strong className="text-gray-700 dark:text-gray-200 font-mono">{kpis.bancard_tarjetas_txs.toLocaleString()} vch.</strong></span>
            <span className="text-blue-600 font-bold font-mono">Débito/Crédito</span>
          </div>
        </div>

        {/* KPI 2: QR Bancard Zimple */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Cobros QR (Zimple)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {formatPYG(kpis.qr_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Operaciones: <strong className="text-gray-700 dark:text-gray-200 font-mono">{kpis.qr_total_txs.toLocaleString()}</strong></span>
            <span className="text-emerald-600 font-bold font-mono flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Instantáneo
            </span>
          </div>
        </div>

        {/* KPI 3: Tarjetas Dinelco */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Tarjetas Dinelco</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-600 dark:text-purple-400 font-mono tracking-tight">
            {formatPYG(kpis.dinelco_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Débito + Crédito</span>
            <span className="text-purple-600 font-bold font-mono">{kpis.dinelco_txs} cupones</span>
          </div>
        </div>

        {/* KPI 4: POS en Vivo Hoy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Facturado Hoy en POS</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            {formatPYG(kpis.hoy_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Jornada: <strong className="text-gray-700 dark:text-gray-200 font-mono">{kpis.hoy_total_txs} txs</strong></span>
            <span className="text-amber-600 font-bold font-mono">En Vivo</span>
          </div>
        </div>
      </div>

      {/* ── TABS BAR ── */}
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {[
          { key: "bancard", label: "POS Bancard (Tarjetas/QR)", icon: CreditCard },
          { key: "dinelco", label: "POS Dinelco (Pronet)", icon: DollarSign },
          { key: "cierres_lote", label: "Cierres de Lote & Conciliación", icon: FileSpreadsheet },
          { key: "qr_pix", label: "QR Pagopar & PIX", icon: QrCode },
          { key: "hardware", label: "Hardware de Caja (Impresoras/Gavetas)", icon: Printer },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow-md text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: POS BANCARD ── */}
      {tab === "bancard" && (
        <div className="space-y-5">
          {/* Transacciones Reales en Vivo */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white">
                  Últimas Transacciones Capturadas por Maquinitas Bancard
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Registro en vivo con número de boleta, cajera, marca de tarjeta y venta asociada
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar boleta, tarjeta o cajera..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Fecha / Hora</th>
                    <th className="p-3 font-mono">Boleta / Voucher</th>
                    <th className="p-3">Tipo / Tarjeta</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Cajera</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {bancardTxs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400 text-xs">
                        {kpis.connected ? "Sin transacciones Bancard registradas todavía." : "No se pudo conectar con la base del legacy (Ñemuha) para traer transacciones reales."}
                      </td>
                    </tr>
                  )}
                  {bancardTxs
                    .filter(t => !search || t.voucher.includes(search) || t.tarjeta_marca.toLowerCase().includes(search.toLowerCase()) || t.cliente.toLowerCase().includes(search.toLowerCase()) || t.cajero.toLowerCase().includes(search.toLowerCase()))
                    .map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                        <td className="p-3 text-gray-500 font-mono text-[11px]">{t.fecha}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.voucher}</td>
                        <td className="p-3">
                          <span className="font-bold text-gray-900 dark:text-white block">{t.tarjeta_marca}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            t.tipo === "QR CODE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : t.tipo === "CRÉDITO" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}>{t.tipo}</span>
                        </td>
                        <td className="p-3 text-gray-700 dark:text-gray-300">{t.cliente}</td>
                        <td className="p-3 font-medium text-gray-900 dark:text-white">{t.cajero}</td>
                        <td className="p-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(t.monto)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            APROBADO
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: POS DINELCO ── */}
      {tab === "dinelco" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            <h2 className="text-base font-black text-gray-900 dark:text-white">Últimas Transacciones Maquinitas Dinelco</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Fecha / Hora</th>
                    <th className="p-3 font-mono">Nº Boleta</th>
                    <th className="p-3">Modalidad</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Cajera</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {dinelcoTxs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400 text-xs">
                        {kpis.connected ? "Sin transacciones Dinelco registradas todavía." : "No se pudo conectar con la base del legacy (Ñemuha) para traer transacciones reales."}
                      </td>
                    </tr>
                  )}
                  {dinelcoTxs.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                      <td className="p-3 text-gray-500 font-mono text-[11px]">{t.fecha}</td>
                      <td className="p-3 font-mono font-bold text-purple-600 dark:text-purple-400">{t.voucher}</td>
                      <td className="p-3 font-bold text-gray-900 dark:text-white">{t.tarjeta_marca}</td>
                      <td className="p-3 text-gray-700 dark:text-gray-300">{t.cliente}</td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white">{t.cajero}</td>
                      <td className="p-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(t.monto)}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          APROBADO
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CIERRES DE LOTE ── */}
      {tab === "cierres_lote" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
          <h2 className="text-base font-black text-gray-900 dark:text-white">Cierres de Lote & Comisiones Retenidas</h2>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            La fuente real (tabla <code className="font-mono">fin_operacao_pos</code> del legacy) no guarda número de lote ni terminal por transacción, solo procesador, monto, fecha y cajero -- así que un cierre de lote por terminal no se puede armar con datos reales todavía. Antes esta pestaña mostraba una tabla de ejemplo con números inventados; se sacó para no mostrar algo que parece un cierre real sin serlo. Si necesitan conciliación de lotes de verdad, hay que conseguir esa granularidad del lado de Bancard/Dinelco directamente.
          </div>
        </div>
      )}

      {/* ── TAB: HARDWARE DE CAJA ── */}
      {tab === "hardware" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
          <h2 className="text-base font-black text-gray-900 dark:text-white">Dispositivos Periféricos de Caja POS</h2>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            InteliMarket no tiene todavía un inventario real de hardware de caja (impresoras, gavetas, lectores) por sucursal/terminal. Esta pestaña mostraba antes una lista de ejemplo con marcas y modelos inventados; se sacó para no mostrar algo que parece un inventario real sin serlo.
          </div>
        </div>
      )}

      {/* ── TAB: QR & PIX ── */}
      {tab === "qr_pix" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <h2 className="text-base font-black text-gray-900 dark:text-white">Cobros Dinámicos QR (Zimple)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-750/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">QR Zimple / Bancard</p>
              <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(kpis.qr_total_gs)}</p>
              <p className="text-xs text-gray-400 font-mono">{kpis.qr_total_txs.toLocaleString()} pagos móviles procesados (dato real)</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            PIX Brasil y QR Pagopar mostraban antes montos fijos inventados -- se sacaron porque no hay ninguna fuente real conectada para esos dos todavía.
          </div>
        </div>
      )}
    </div>
  )
}
