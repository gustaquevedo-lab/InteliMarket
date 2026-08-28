import React, { useState, useMemo, useEffect, useCallback } from "react"
import {
  CreditCard, QrCode, Printer, Usb, CheckCircle2, AlertTriangle,
  RefreshCcw, Search, Plus, ExternalLink, ShieldCheck, DollarSign,
  ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet, Lock, Zap,
  Terminal, Store, ChevronRight, Eye, Smartphone, Wifi, Radio, Filter,
  TrendingUp, Activity, CheckCircle, Flame, ShieldAlert, Settings, Save, EyeOff
} from "lucide-react"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

type Tab = "bancard" | "dinelco" | "cierres_lote" | "qr_pix" | "hardware" | "config"

// Mismo listado que PUNTOS_EMISION en POSPage.tsx/CajaRapidaPage.tsx --
// duplicado a propósito, mismo patrón que esos dos archivos ya usan entre sí.
const PUNTOS_EMISION = [
  { id: "001-012", nombre: "Caja 01 · Salón Central (Boca 012)" },
  { id: "001-013", nombre: "Caja 02 · Salón Central (Boca 013)" },
  { id: "001-014", nombre: "Caja 03 · Salón Central (Boca 014)" },
  { id: "001-015", nombre: "Caja 04 · Salón Central (Boca 015)" },
  { id: "001-016", nombre: "Caja 05 · Salón Central (Boca 016)" },
  { id: "001-017", nombre: "Caja 06 · Salón Central (Boca 017)" },
  { id: "001-018", nombre: "Caja 07 · Línea de Caja (Boca 018)" },
  { id: "001-019", nombre: "Caja Especial Mayorista / Administración (Boca 019)" },
  { id: "001-020", nombre: "Caja Auxiliar / Refuerzo (Boca 020)" },
]

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>("bancard")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const toast = useToast()
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

  // ── CONFIGURACIÓN: Bancard (IP por caja) + PlugPay (credenciales) ─────────
  const [bancardIps, setBancardIps] = useState<Record<string, string>>({})
  const [bancardEnabled, setBancardEnabled] = useState(true)
  const [savingBancard, setSavingBancard] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)

  const [plugpayClientId, setPlugpayClientId] = useState("")
  const [plugpayPassword, setPlugpayPassword] = useState("")
  const [plugpayHasSavedPassword, setPlugpayHasSavedPassword] = useState(false)
  const [plugpayShowPassword, setPlugpayShowPassword] = useState(false)
  const [plugpayDocumentMerchant, setPlugpayDocumentMerchant] = useState("")
  const [plugpayEnvironment, setPlugpayEnvironment] = useState<"sandbox" | "production">("sandbox")
  const [plugpayEnabled, setPlugpayEnabled] = useState(true)
  const [savingPlugpay, setSavingPlugpay] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const [bancardCfg, plugpayCfg] = await Promise.all([
        api.paymentIntegrations.get("bancard").catch(() => null),
        api.paymentIntegrations.get("plugpay").catch(() => null),
      ])
      if (bancardCfg) {
        setBancardIps(bancardCfg.config?.ips_por_punto_emision || {})
        setBancardEnabled(bancardCfg.enabled)
      }
      if (plugpayCfg) {
        setPlugpayClientId(plugpayCfg.config?.client_id || "")
        setPlugpayHasSavedPassword(!!plugpayCfg.config?.client_id) // si hay client_id guardado, asumimos que hay password (nunca vuelve en el GET)
        setPlugpayDocumentMerchant(plugpayCfg.config?.document_merchant || "")
        setPlugpayEnvironment((plugpayCfg.environment as any) || "sandbox")
        setPlugpayEnabled(plugpayCfg.enabled)
      }
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "config") loadConfig()
  }, [tab, loadConfig])

  async function handleSaveBancard() {
    setSavingBancard(true)
    try {
      await api.paymentIntegrations.update("bancard", {
        environment: "production",
        enabled: bancardEnabled,
        config: { ips_por_punto_emision: bancardIps },
      })
      toast.success("Guardado", "IPs de terminales Bancard actualizadas -- el POS las toma la próxima vez que abra la venta.")
    } catch {
      toast.error("Error", "No se pudo guardar la configuración de Bancard.")
    } finally {
      setSavingBancard(false)
    }
  }

  async function handleSavePlugpay() {
    setSavingPlugpay(true)
    try {
      const config: Record<string, any> = {
        client_id: plugpayClientId,
        document_merchant: plugpayDocumentMerchant,
      }
      // Solo se manda la password si el usuario tipeó una nueva -- si la
      // dejó vacía y ya había una guardada, el backend la preserva (hace
      // merge, no reemplazo total).
      if (plugpayPassword.trim()) config.password = plugpayPassword.trim()
      await api.paymentIntegrations.update("plugpay", {
        environment: plugpayEnvironment,
        enabled: plugpayEnabled,
        config,
      })
      setPlugpayPassword("")
      setPlugpayHasSavedPassword(true)
      toast.success("Guardado", "Configuración de PlugPay actualizada.")
    } catch {
      toast.error("Error", "No se pudo guardar la configuración de PlugPay.")
    } finally {
      setSavingPlugpay(false)
    }
  }

  const webhookUrl = useMemo(() => `${window.location.origin.replace(":5174", ":8001")}/api/v1/plugpay/webhook`, [])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <CreditCard className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    INTEGRACIÓN MEDIOS DE PAGO
                  </span>
                  {kpis.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Conectado a POS Extra Supermercado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Modo Producción Activo
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Integración Medios de Pago
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Transacciones en vivo por tarjeta, QR y cupones de POS capturados en las 10 cajas de Extra Supermercado
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado Matriz
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💳 Bancard vPOS + Dinelco PlugPay
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                📱 QR Bancard Zimple & PIX Brasil
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refrescar Datos
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tarjetas Bancard (POS)</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatPYG(kpis.bancard_tarjetas_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cupones: <strong className="text-slate-700 dark:text-slate-200 font-mono">{kpis.bancard_tarjetas_txs.toLocaleString()} vch.</strong></span>
            <span className="text-blue-600 font-bold font-mono">Débito/Crédito</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cobros QR (Zimple)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatPYG(kpis.qr_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Operaciones: <strong className="text-slate-700 dark:text-slate-200 font-mono">{kpis.qr_total_txs.toLocaleString()}</strong></span>
            <span className="text-emerald-600 font-bold font-mono">Instantáneo</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tarjetas Dinelco</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {formatPYG(kpis.dinelco_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Débito + Crédito</span>
            <span className="text-purple-600 font-bold font-mono">{kpis.dinelco_txs} cupones</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Facturado Hoy en POS</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(kpis.hoy_total_gs)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Jornada: <strong className="text-slate-700 dark:text-slate-200 font-mono">{kpis.hoy_total_txs} txs</strong></span>
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
          { key: "config", label: "Configuración de Medios", icon: Settings },
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
            PIX Brasil (PlugPay) ya está integrado -- configuralo en la pestaña "Configuración". Los KPIs reales de PIX/crédito parcelado Brasil se agregan acá una vez que haya transacciones de verdad. QR Pagopar sigue sin una fuente real conectada.
          </div>
        </div>
      )}

      {/* ── TAB: CONFIGURACIÓN ── */}
      {tab === "config" && (
        <div className="space-y-5">
          {loadingConfig && (
            <div className="flex items-center justify-center py-8 text-gray-400"><RefreshCcw className="w-5 h-5 animate-spin" /></div>
          )}

          {!loadingConfig && (
            <>
              {/* BANCARD: IP por caja */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-base font-black text-gray-900 dark:text-white">Bancard -- IP de Terminal por Caja</h2>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={bancardEnabled} onChange={(e) => setBancardEnabled(e.target.checked)} className="w-4 h-4" />
                    Habilitado
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cada terminal Bancard Infonet tiene su propia IP en la red local del comercio. Se carga acá una sola vez por caja -- el POS la usa directo, sin tocar ningún archivo ni configurar nada por caja individualmente.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Punto de Emisión</th>
                        <th className="p-3">IP del Terminal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                      {PUNTOS_EMISION.map((pe) => (
                        <tr key={pe.id}>
                          <td className="p-3 font-bold text-gray-900 dark:text-white">{pe.nombre}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={bancardIps[pe.id] || ""}
                              onChange={(e) => setBancardIps((prev) => ({ ...prev, [pe.id]: e.target.value }))}
                              placeholder="Ej: 192.168.0.32"
                              className="w-48 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white font-mono text-xs outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleSaveBancard}
                  disabled={savingBancard}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                >
                  {savingBancard ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar IPs de Bancard
                </button>
              </div>

              {/* PLUGPAY */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h2 className="text-base font-black text-gray-900 dark:text-white">PlugPay -- PIX & Crédito Parcelado Brasil</h2>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={plugpayEnabled} onChange={(e) => setPlugpayEnabled(e.target.checked)} className="w-4 h-4" />
                    Habilitado
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Client ID</label>
                    <input
                      type="text"
                      value={plugpayClientId}
                      onChange={(e) => setPlugpayClientId(e.target.value)}
                      className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                      Password {plugpayHasSavedPassword && <span className="text-emerald-600 dark:text-emerald-400">(ya hay una guardada)</span>}
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={plugpayShowPassword ? "text" : "password"}
                        value={plugpayPassword}
                        onChange={(e) => setPlugpayPassword(e.target.value)}
                        placeholder={plugpayHasSavedPassword ? "Dejar vacío para no cambiarla" : ""}
                        className="w-full px-2.5 py-2 pr-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white text-xs outline-none focus:border-orange-500"
                      />
                      <button type="button" onClick={() => setPlugpayShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        {plugpayShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Documento del Comercio (RUC)</label>
                    <input
                      type="text"
                      value={plugpayDocumentMerchant}
                      onChange={(e) => setPlugpayDocumentMerchant(e.target.value)}
                      placeholder="80150377-9"
                      className="w-full mt-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white font-mono text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Entorno</label>
                    <div className="flex gap-1.5 mt-1">
                      <button type="button" onClick={() => setPlugpayEnvironment("sandbox")} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold ${plugpayEnvironment === "sandbox" ? "bg-orange-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400"}`}>Sandbox</button>
                      <button type="button" onClick={() => setPlugpayEnvironment("production")} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold ${plugpayEnvironment === "production" ? "bg-orange-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400"}`}>Producción</button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">URL de Webhook (registrar manualmente en el portal AERO de PlugPay)</p>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{webhookUrl}</p>
                </div>

                <button
                  onClick={handleSavePlugpay}
                  disabled={savingPlugpay}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                >
                  {savingPlugpay ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Configuración de PlugPay
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
